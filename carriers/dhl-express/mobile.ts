import { randomBytes, randomUUID } from 'node:crypto';
import type { AdapterEnvironment, LookupBudget } from '../../core/adapter/index.js';
import { ChallengeError, RateLimitedError, SchemaError, TransportError, UpstreamHttpError, UpstreamNetworkError } from '../../core/errors/index.js';
import { decodeText, fetchBounded, parseJsonBytes } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';

const PROVIDER = 'DHL Express';
const APP = 'com.dhl.exp.dhlmobile';
const VERSION = '6.1.0';
const API = `https://dhle.dhl.com/access/access/${APP}`;
// The shared guest application bearer is deliberately distributed with this adapter.
const APPLICATION_BEARER = "Bearer MtX6uKNcGM295BXaJGa83GFhTHCL9a";
/** How long a confirmed plaintext-waybill setting is reused before it is read again. */
export const SETTINGS_TTL_MS = 15 * 60_000;
/** The codes of the CAPTCHA the app would show, which DHL turns on for a whole address at a time. */
const CAPTCHA_CODES = ['DRG10012', 'DRG10013'];
/**
 * How long after a CAPTCHA tracking is not asked again. Asked every two
 * minutes, the address kept its CAPTCHA past a quarter of an hour; left alone
 * for half an hour, it was gone.
 */
export const CAPTCHA_MEMORY_MS = 30 * 60_000;

/** The mobile API's CAPTCHA, which the instance remembers. */
class CaptchaError extends ChallengeError {}

/** Mobile errors can arrive as JSON strings or envelopes with HTTP 200. */
function checkReply(payload: unknown, httpStatus: number): void {
  const root = isRecord(payload) ? payload : {};
  const nested = isRecord(root.error) ? root.error : {};
  const codes = [payload, root.error, root.statusCode, root.status, root.code, root.message,
    nested.error, nested.statusCode, nested.status, nested.code, nested.message]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).trim());
  if (codes.some((code) => ['429', 'temporary_blocked', 'max_attempts_reached'].includes(code))) throw new RateLimitedError(PROVIDER);
  const status = httpStatus === 200 ? undefined : { status: httpStatus };
  if (codes.some((code) => CAPTCHA_CODES.includes(code))) throw new CaptchaError(PROVIDER, 'DHL mobile tracking requires verification', status);
  if (codes.some((code) => ['401', '403', '428'].includes(code))) throw new ChallengeError(PROVIDER, 'DHL mobile tracking requires verification', status);
  const serverError = codes.find((code) => /^5\d{2}$/.test(code));
  if (serverError) throw new UpstreamHttpError(PROVIDER, Number(serverError));
}

/**
 * The guest mobile API for one adapter instance: its device identity, the last
 * time the application configuration allowed a plaintext waybill and its last
 * CAPTCHA.
 */
export class DhlMobileApi {
  private readonly device = randomUUID();
  /** When `api_awb_encryption` last read N; null until it is read again. */
  private settingsCheckedAt: number | null = null;
  /** When the mobile API last answered with its CAPTCHA. */
  private captchaAt: number | null = null;

  constructor(private readonly environment: AdapterEnvironment) {}

  /**
   * One waybill's shipments. The encryption setting is read first unless it was
   * confirmed within the TTL, so an empty list counts as missing only under a
   * recently verified configuration. Any reply other than a shipment list
   * discards the setting. A request that got no reply, including one its own
   * lookup cancelled or ran out of time for, says nothing about it. A CAPTCHA
   * holds for every waybill and device from the address for a while, so for
   * `CAPTCHA_MEMORY_MS` after one, lookups fail as a challenge without a request.
   */
  async tracking(number: string, budget: LookupBudget): Promise<unknown> {
    const captchaAt = this.captchaAt;
    if (captchaAt !== null && Date.now() - captchaAt < CAPTCHA_MEMORY_MS) throw new ChallengeError(PROVIDER, 'DHL mobile tracking recently required verification');
    const checkedAt = this.settingsCheckedAt;
    if (checkedAt === null || Date.now() - checkedAt >= SETTINGS_TTL_MS) await this.checkSettings(budget);
    let payload: unknown;
    try {
      payload = await this.request(budget, 'tracking', 'shipments', { airWayBill: number, countryCode: 'GB', languageCd: 'en',
        addShipmentToODD: 'N', moreDetails: 'Y', iv: Buffer.from(randomBytes(8).toString('hex')).toString('base64'), captchaVerificationData: {} });
    } catch (error) {
      if (!(error instanceof UpstreamNetworkError) && !budget.signal.aborted) this.settingsCheckedAt = null;
      if (error instanceof CaptchaError) this.captchaAt = Date.now();
      throw error;
    }
    if (!Array.isArray(payload)) this.settingsCheckedAt = null;
    return payload;
  }

  private async checkSettings(budget: LookupBudget): Promise<void> {
    this.settingsCheckedAt = null;
    const checkedAt = Date.now();
    const settings = await this.request(budget, 'countrySettingsBySettingName', 'common', { countryCode: 'GB', settingNames: ['api_awb_encryption'] });
    if (!Array.isArray(settings) || settings.length > 20 || settings.some((setting) => !isRecord(setting))) throw new SchemaError(PROVIDER, 'DHL mobile tracking returned invalid settings');
    const encryption = settings.filter(isRecord).filter((setting) => setting.name === 'api_awb_encryption');
    if (encryption.length !== 1 || (encryption[0]!.value !== 'N' && encryption[0]!.value !== 'Y')) throw new SchemaError(PROVIDER, 'DHL mobile tracking returned invalid encryption settings');
    if (encryption[0]!.value === 'Y') throw new ChallengeError(PROVIDER, 'DHL mobile tracking requires waybill encryption');
    this.settingsCheckedAt = checkedAt;
  }

  private async request(budget: LookupBudget, method: string, service: string, extra: Record<string, unknown>): Promise<unknown> {
    budget.signal.throwIfAborted();
    const { response, bytes } = await fetchBounded(`${API}?${new URLSearchParams({ appVersion: VERSION, service: `${service}-${method}` })}`, {
      method: 'POST', signal: budget.signal,
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: APPLICATION_BEARER,
        'cache-control': 'no-cache', transactionId: randomUUID(), 'user-agent': this.environment.userAgent ?? 'Mozilla/5.0' },
      body: JSON.stringify({ method, service, authentication: { provider: 'DEMP.RS1', token: '', login: '' },
        data: { parameters: {}, timezoneOffset: '+00:00', appVersion: VERSION, UIClient: 'Android',
          device_info: { device_unique_id: this.device, deviceId: this.device, device_language: 'en', app_id: APP,
            platform: 'Android', appStore: 'PlayStore', gpsLoc: '', pushToken: '' }, ...extra } }),
    }, { provider: PROVIDER, timeoutMs: budget.remainingMs(), maxBytes: 1_000_000, fetcher: this.environment.fetcher,
      allowHttpStatuses: [400, 404, 410, 503] });
    budget.signal.throwIfAborted();
    if (response.status === 404 || response.status === 410) throw new TransportError(PROVIDER, 'DHL mobile tracking endpoint is unavailable', { status: response.status });
    if (/^\s*</.test(decodeText(bytes))) {
      if (response.status !== 200) throw new UpstreamHttpError(PROVIDER, response.status);
      throw new ChallengeError(PROVIDER, 'DHL mobile tracking rejected the request');
    }
    let payload: unknown;
    try { payload = parseJsonBytes(bytes, PROVIDER); }
    catch (error) {
      if (response.status !== 200) throw new UpstreamHttpError(PROVIDER, response.status);
      throw new SchemaError(PROVIDER, 'DHL mobile tracking returned invalid JSON', { cause: error });
    }
    checkReply(payload, response.status);
    if (response.status !== 200) throw new UpstreamHttpError(PROVIDER, response.status);
    return payload;
  }
}
