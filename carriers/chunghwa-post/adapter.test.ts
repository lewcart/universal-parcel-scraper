import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { ChunghwaPostTracker, normalizeChunghwaPostNumber, parseChunghwaPost } from './adapter.js';
import { ChunghwaPostOcr } from './ocr.js';

const NUMBER = 'EE000000005TW';
const fixture = () => [{ header: { OutputType: 'Screen' }, body: { cptCheck: true, incorrectList: [], iType: 1,
  host_rs: { Status: 'S', MAILNO: NUMBER, ITEM: [
    { EVCODE: 'E', STATUS: '海關查驗', DATIME: '20260103102030', BRHNAT: '德國', 'REASON-E': 'PRIVATE', RCVMAN: 'PRIVATE' },
    { EVCODE: 'A', STATUS: '交寄郵件', DATIME: '20260101090000', BRHNAT: '郵件處理中心', SENDER: 'PRIVATE' },
  ] } } }];
const unknown = (number = NUMBER) => [{ header: { OutputType: 'Message' }, body: {
  msgCode: 'Z999', msgData: `${number}|CH|Z993|資料不存在！Tracking is not available for this item!`,
} }, { header: { OutputType: 'EndBracket' }, body: { result: 'success' } }];

describe('Chunghwa Post international tracking', () => {
  it('binds the item and preserves foreign local clocks, status and location without detail fields', () => {
    const result = parseChunghwaPost(fixture(), NUMBER);
    expect(result).toMatchObject({ current_stage: 'customs', provider_code: 'E', last_update: null, last_update_local: '2026-01-03T10:20:30' });
    expect(result.events![0]).toMatchObject({ description: '海關查驗', location: '德國', local_time: '2026-01-03T10:20:30', stage: 'customs' });
    expect(result.events![1]).toMatchObject({ stage: 'accepted' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    const row = fixture()[0]!;
    expect(parseChunghwaPost([{ ...row, body: { ...row.body, incorrectList: null } }], NUMBER).events).toHaveLength(2);
  });

  it('requires accepted verification and repeated identity, and recognizes only the matching absence message', () => {
    expect(() => parseChunghwaPost(unknown(), NUMBER)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => parseChunghwaPost(unknown('EA000000005TW'), NUMBER)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    const refused = fixture(); refused[0]!.body.cptCheck = false;
    expect(() => parseChunghwaPost(refused, NUMBER)).toThrow(expect.objectContaining({ kind: 'challenge' }));
    const wrong = fixture(); wrong[0]!.body.host_rs.MAILNO = 'EA000000005TW';
    expect(() => parseChunghwaPost(wrong, NUMBER)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    const invalid = fixture(); invalid[0]!.body.host_rs.ITEM[0]!.DATIME = '20260231090000';
    expect(() => parseChunghwaPost(invalid, NUMBER)).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(normalizeChunghwaPostNumber('ee 000000005 tw')).toBe(NUMBER);
    expect(normalizeChunghwaPostNumber('EE000000006TW')).toBe('EE000000006TW');
    for (const value of ['00000000000001', 'PB00000000000']) expect(() => normalizeChunghwaPostNumber(value)).toThrow(expect.objectContaining({ kind: 'invalid_input' }));
  });

  it('leaves domestic and proprietary references recoverable by providers without querying the international gateway', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['00000000000001', '00000000000000000001', 'PB00000000000', 'FT000000005TW', 'VA000000005TW', 'UA000000005TW']) {
      await expect(new ChunghwaPostTracker({ fetcher }).fetch(number)).rejects.toMatchObject({ kind: 'indeterminate' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('opens one cookie jar, solves a fresh image and submits the same challenge with the whole item', async () => {
    const opened = new Response('', { headers: { 'Set-Cookie': 'JSESSIONID=synthetic; Path=/pstmail' } });
    Object.defineProperty(opened, 'url', { value: 'https://postserv.post.gov.tw/pstmail/SessionServlet' });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(opened).mockResolvedValueOnce(new Response('image')).mockResolvedValueOnce(Response.json(fixture()));
    await expect(new ChunghwaPostTracker({ fetcher, solveCaptcha: async () => '1234' }).fetch(NUMBER)).resolves.toMatchObject({ current_stage: 'customs' });
    const imageUrl = new URL(String(fetcher.mock.calls[1]![0]));
    const init = fetcher.mock.calls[2]![1]!;
    expect(JSON.parse(String(init.body))).toMatchObject({ header: { TxnCode: 'EB500200', BizCode: 'query' },
      body: { MAILNO: NUMBER, captcha: '1234', uuid: imageUrl.searchParams.get('uuid') } });
    expect(new Headers(init.headers).get('Cookie')).toContain('JSESSIONID=synthetic'); expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries only an explicitly refused answer, and strips challenge diagnostics from HTTP failures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(new Response('image'))
      .mockResolvedValueOnce(Response.json([{ header: { OutputType: 'Screen' }, body: { cptCheck: false } }]))
      .mockResolvedValueOnce(new Response('image')).mockResolvedValueOnce(Response.json(fixture()));
    await expect(new ChunghwaPostTracker({ fetcher, solveCaptcha: async () => '1234' }).fetch(NUMBER)).resolves.toMatchObject({ current_stage: 'customs' });
    const first = JSON.parse(String(fetcher.mock.calls[2]![1]?.body));
    const second = JSON.parse(String(fetcher.mock.calls[4]![1]?.body));
    expect(first.body.uuid).not.toBe(second.body.uuid);
    fetcher.mockReset().mockResolvedValue(new Response('PRIVATE', { status: 429 }));
    await expect(new ChunghwaPostTracker({ fetcher }).fetch(NUMBER)).rejects.toMatchObject({ kind: 'rate_limited', diagnostics: undefined });
    fetcher.mockReset().mockResolvedValue(new Response('missing endpoint', { status: 404 }));
    await expect(new ChunghwaPostTracker({ fetcher }).fetch(NUMBER)).rejects.toMatchObject({ kind: 'transport' });
  });

  it('loads the shared model through the JPEG profile without accepting the Viettel image geometry', async () => {
    const worker = new ChunghwaPostOcr();
    try {
      const image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="162" height="54"><rect width="162" height="54" fill="white"/><text x="32" y="40" font-family="serif" font-size="36" font-weight="bold">1234</text></svg>')).jpeg().toBuffer();
      expect(await worker.solve(image, AbortSignal.timeout(10_000))).toBe('1234');
      const other = await sharp({ create: { width: 200, height: 50, channels: 3, background: '#fff' } }).png().toBuffer();
      await expect(worker.solve(other, AbortSignal.timeout(2000))).rejects.toMatchObject({ kind: 'challenge' });
    } finally { await worker.close(); }
  }, 15_000);
});
