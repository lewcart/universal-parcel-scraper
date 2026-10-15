import { constants, createHash, createPublicKey, publicEncrypt, type KeyObject } from 'node:crypto';
import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, NotFoundError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { IMILE_MAX_BYTES, normalizeImileNumber, parseImile, PROVIDER } from './parser.js';

const ORIGIN = 'https://www.imile.com';
/** The lookup the tracking page on www.imile.com makes for the number in its address. */
export const IMILE_API = `${ORIGIN}/saastms/mobileWeb/track/query`;
/** The tracking page, whose script holds the values it signs a lookup with. */
export const IMILE_PAGE = `${ORIGIN}/AE-en/track`;

/** How the page signs a lookup: the RSA public key the `sign` header encrypts the number with, and the salt of the MD5 `code`. */
export interface ImileSigning {
  key: string;
  salt: string;
}

/** The values in the page's script, the same for every visitor. */
export const IMILE_SIGNING: Readonly<ImileSigning> = {
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3dFPiKNZwt+HoBbPAG/t7kZC2k3pBX2eCl5LeyeW8woNuEV5bA5kB9Y9KKTOQng62ERGPLwi84CdIB8s265ljQUib//iO3jVrZesJueO5Xu+s80s3Z/89jgJleT1XawN1GubgkGXOoT1a7tvX8+aItkGgR//48ELqJVVUL+yGsBtXxFjNmOEWxBJNQuwAf9yWcCIl1enD60GjZjPWrsfw8QUqam7K5e45ealcPEYGenNePwuPpCq6twdD0YYYzKdRN0dZP1uTviFpNfph90c9YgQ8kgDkRMcpjVv6KZ+bg5JZ4sK6LkV4vwOjPijisthHBvUXhu3fyhMgvoDO/j5gwIDAQAB', // gitleaks:allow
  salt: 'imileTrackQuery2024', // gitleaks:allow
};

// How long the page's values stand once read: an empty reply in that time is an unknown number.
const SIGNING_CHECKED_MS = 60 * 60_000;
const PAGE_MAX_BYTES = 2 * 1024 * 1024;
const REDIRECTS = [301, 302, 303, 307, 308];
// The page's own script, by the route it serves; its name changes with every deploy.
const TRACK_SCRIPT = /\/_next\/static\/chunks\/pages\/(?:%5B|\[)countryAndLang(?:%5D|\])\/track-[\w-]+\.js/;
const SCRIPT_KEY = /setPublicKey\("([A-Za-z0-9+/]{200,1000}={0,2})"\)/;
const SCRIPT_SALT = /\.MD5\(""\.concat\([\w$]+,"([\w-]{1,64})"\)\)/;
// Bot checks Cloudflare, in front of the site, could put in place of a reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|challenge-platform|<title>\s*(?:Just a moment|Attention Required)/i;

function publicKey(key: string): KeyObject {
  return createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' });
}

/** The page's `code` and `sign` for a number: the MD5 of the number and the salt, and the number encrypted with the key. */
export function imileSignature(number: string, signing: ImileSigning): { code: string; sign: string } {
  return {
    code: createHash('md5').update(`${number}${signing.salt}`).digest('hex'),
    sign: publicEncrypt({ key: publicKey(signing.key), padding: constants.RSA_PKCS1_PADDING }, Buffer.from(number)).toString('base64'),
  };
}

/** The signing values in the tracking page's script; a script without them is a changed page. */
export function scriptSigning(script: string): ImileSigning {
  const key = SCRIPT_KEY.exec(script)?.[1];
  const salt = SCRIPT_SALT.exec(script)?.[1];
  if (!key || !salt || !script.includes('/saastms/mobileWeb/track/query')) {
    throw new SchemaError(PROVIDER, 'iMile\'s tracking script no longer shows how it signs a lookup');
  }
  try {
    publicKey(key);
  } catch (cause) {
    throw new SchemaError(PROVIDER, 'iMile\'s tracking script holds an unreadable key', { cause });
  }
  return { key, salt };
}

function json(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (cause) {
    if (CHALLENGE.test(body.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'iMile answered with a browser check', { cause });
    throw new SchemaError(PROVIDER, 'iMile returned a reply that is not JSON', { cause });
  }
}

export class ImileTracker {
  #signing: Readonly<ImileSigning>;
  // When the page last showed the values in use.
  #checkedAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string; now?: () => number;
    signing?: Readonly<ImileSigning> } = {}) {
    this.#signing = options.signing ?? IMILE_SIGNING;
  }

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeImileNumber(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const deadline = performance.now() + timeoutMs;
      const left = () => Math.max(1, Math.floor(deadline - performance.now()));
      const signing = this.#signing;
      try {
        return parseImile(await this.#query(number, signing, signal, left()), number);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        // A sign the service does not accept gets the same empty reply as an
        // unknown number, so the page must still sign with the values used.
        const current = await this.#currentSigning(signal, left);
        if (current.key === signing.key && current.salt === signing.salt) throw error;
        return parseImile(await this.#query(number, current, signal, left()), number);
      }
    };
    // A request that fails to reach the site, or hangs, gets one more try: the
    // first gets half of the budget, so the retry fits in the rest.
    return runSteps({ carrier: 'imile', budgetMs: context.budgetMs ?? 20_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }

  async #query(number: string, signing: ImileSigning, signal: AbortSignal, timeoutMs: number): Promise<unknown> {
    const { code, sign } = imileSignature(number, signing);
    const { response, bytes } = await fetchBounded(`${IMILE_API}?waybillNo=${encodeURIComponent(number)}&code=${code}`, { method: 'GET', signal,
      headers: { Accept: 'application/json', lang: 'en_US', sign, 'User-Agent': userAgentOf(this.options.userAgent) } },
    { provider: PROVIDER, timeoutMs, maxBytes: IMILE_MAX_BYTES, redirect: 'manual', fetcher: this.options.fetcher,
      allowHttpStatuses: [...REDIRECTS, 404, 410] });
    if (REDIRECTS.includes(response.status)) throw new TransportError(PROVIDER, 'iMile redirected its tracking lookup');
    // The page reads a missing parcel from a 200 reply; a 404 is a moved route.
    if (response.status === 404 || response.status === 410) throw new TransportError(PROVIDER, 'iMile tracking lookup is unavailable');
    return json(decodeText(bytes));
  }

  /** The values the page signs with, read again once their last reading is an hour old. */
  async #currentSigning(signal: AbortSignal, left: () => number): Promise<Readonly<ImileSigning>> {
    const now = (this.options.now ?? Date.now)();
    if (now - this.#checkedAt < SIGNING_CHECKED_MS) return this.#signing;
    const page = await this.#text(IMILE_PAGE, signal, left());
    const path = TRACK_SCRIPT.exec(page)?.[0];
    if (!path) {
      if (CHALLENGE.test(page.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'iMile answered its tracking page with a browser check');
      throw new SchemaError(PROVIDER, 'iMile\'s tracking page no longer names its tracking script');
    }
    const signing = scriptSigning(await this.#text(`${ORIGIN}${path}`, signal, left()));
    this.#signing = signing;
    this.#checkedAt = now;
    return signing;
  }

  async #text(url: string, signal: AbortSignal, timeoutMs: number): Promise<string> {
    const { response, bytes } = await fetchBounded(url, { method: 'GET', signal, headers: { 'User-Agent': userAgentOf(this.options.userAgent) } },
      { provider: PROVIDER, timeoutMs, maxBytes: PAGE_MAX_BYTES, redirect: 'manual', fetcher: this.options.fetcher,
        allowHttpStatuses: [...REDIRECTS, 404, 410] });
    if (response.status !== 200) throw new TransportError(PROVIDER, 'iMile\'s tracking page is unavailable', { status: response.status });
    return decodeText(bytes);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new ImileTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'imile', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
