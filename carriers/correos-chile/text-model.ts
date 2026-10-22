import { CarrierError, carrierErrorKind, retryAfterMsOf, SchemaError, TransportError } from '../../core/errors/index.js';
import { fetchBounded } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';

/** Only the widget's question reaches the optional private model, never parcel data or browser state. */
export async function answerCorreosChileText(url: string, heading: string, question: string,
  signal: AbortSignal, timeoutMs: number, fetcher?: typeof fetch): Promise<string | null> {
  if (heading.length > 150 || question.length > 400) return null;
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { throw new TransportError('Correos de Chile', 'Text solver address is invalid'); }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.hash) {
    throw new TransportError('Correos de Chile', 'Text solver address is invalid');
  }
  let bytes: Uint8Array;
  try { ({ bytes } = await fetchBounded(endpoint.href, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [
      { role: 'system', content: 'Answer the simple question with only the requested word, number, or short phrase. Use lowercase and singular form for a person or object. Do not explain.' },
      { role: 'user', content: `${heading}\n${question}` },
    ], max_tokens: 32, temperature: 0, stream: false }) },
  { provider: 'Correos de Chile text solver', fetcher, timeoutMs: Math.max(1, Math.min(10_000, timeoutMs)),
    maxBytes: 8_000, redirect: 'error' }));
  } catch (error) {
    signal.throwIfAborted();
    // Private endpoint paths and request diagnostics must not reach telemetry.
    const kind = carrierErrorKind(error);
    // A missing model route says nothing about shipment existence.
    throw new CarrierError(kind === 'not_found' ? 'transport' : kind ?? 'transport', 'Correos de Chile', 'Text solver is unavailable', {
      ...(error instanceof CarrierError && kind !== 'not_found' ? { status: error.status } : {}), retryAfterMs: retryAfterMsOf(error),
    });
  }
  signal.throwIfAborted();
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new SchemaError('Correos de Chile', 'Text solver returned invalid JSON'); }
  const choice: unknown = isRecord(data) && Array.isArray(data.choices) ? data.choices[0] : null;
  const content: unknown = isRecord(choice) && isRecord(choice.message) ? choice.message.content : null;
  if (typeof content !== 'string') return null;
  const answer = content.trim().replace(/\.$/, '');
  return /^[A-Za-z0-9-][A-Za-z0-9 ,'-]{0,59}$/.test(answer) ? answer : null;
}
