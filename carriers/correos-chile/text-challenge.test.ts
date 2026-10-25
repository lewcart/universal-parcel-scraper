import { expect, it, vi } from 'vitest';
import { solveCorreosChileText } from './text-challenge.js';
import { answerCorreosChileText } from './text-model.js';

it('answers exact arithmetic and string operations without guessing unfamiliar instructions', () => {
  expect(solveCorreosChileText('Find the number of coins still in the jar. Use digits only', 'A jar contains 19 coins. You remove 6 coins from it.')).toBe('13');
  expect(solveCorreosChileText('How many did you remove?', 'A jar contains 19 coins. You remove 6 coins from it.')).toBeNull();
  expect(solveCorreosChileText('Give the final coin count in the jar using digits only', 'A jar starts with 4 coins. You take 8 coins out.')).toBeNull();
  expect(solveCorreosChileText('Follow the instructions', 'Duplicate every r in carrot. Write only the result.')).toBe('carrrrot');
  expect(solveCorreosChileText('Count letters', 'How many letters e does evergreen contain? Answer using digits.')).toBe('4');
  expect(solveCorreosChileText('Write the result', 'Use the Latin z instead of every a in banana. Type just the result.')).toBe('bznznz');
  expect(solveCorreosChileText('Count letters', 'Find the number of letters n in banana. Answer using digits.')).toBe('2');
  expect(solveCorreosChileText('Respond with just the result.', 'Replace every t with the Latin x in tablet. Write only the result.')).toBe('xablex');
  expect(solveCorreosChileText('Give just the result.', 'Change each t to the Latin x in tablet. Type just the result.')).toBe('xablex');
  expect(solveCorreosChileText('Enter only the answer.', 'Delete every 4 from 84604. Keep leading zeros and type only the remaining digits.')).toBe('860');
  expect(solveCorreosChileText('Enter only the answer.', 'Delete every 1 from 10213. Write the remaining digits, keeping leading zeros.')).toBe('023');
  expect(solveCorreosChileText('Write just your answer.', 'Remove each 5 from 50551. Write the remaining digits, keeping leading zeros.')).toBe('01');
  expect(solveCorreosChileText('Give just the result.', 'Take out each 2 from 32123. Write the remaining digits, keeping leading zeros.')).toBe('313');
  expect(solveCorreosChileText('Enter only the answer.', 'Delete every 7 from 777. Write the remaining digits, keeping leading zeros.')).toBeNull();
  expect(solveCorreosChileText('Pick one', 'unknown question')).toBeNull();
  expect(solveCorreosChileText('x'.repeat(151), 'question')).toBeNull();
});

it('sends only bounded questions through the supplied transport and accepts short answers', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: '  apple. ' } }] }));
  const signal = new AbortController().signal;
  await expect(answerCorreosChileText('http://model.test/v1/chat/completions', 'Select a fruit', 'apple chair clock', signal, 500, fetcher)).resolves.toBe('apple');
  const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
  expect(body).toEqual({ messages: [{ role: 'system', content: expect.any(String) }, { role: 'user', content: 'Select a fruit\napple chair clock' }], max_tokens: 32, temperature: 0, stream: false });
  await expect(answerCorreosChileText('http://model.test', 'x'.repeat(151), 'q', signal, 500, fetcher)).resolves.toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('strips model diagnostics while preserving rate limits and cancellation', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('PRIVATE response', { status: 429, headers: { 'retry-after': '30' } }));
  const controller = new AbortController();
  const result = answerCorreosChileText('http://model.test/PRIVATE', 'Question', 'PRIVATE prompt', controller.signal, 500, fetcher);
  await expect(result).rejects.toMatchObject({ kind: 'rate_limited', retryAfterMs: 30_000 });
  const error = await result.catch(e => e);
  expect(JSON.stringify(error)).not.toContain('PRIVATE');
  expect(error.cause).toBeUndefined();
  controller.abort(new Error('cancelled'));
  await expect(answerCorreosChileText('http://model.test', 'Question', 'q', controller.signal, 500, fetcher)).rejects.toBe(controller.signal.reason);
});

it.each(['<script>bad</script>', 'x'.repeat(61), 'a\nb', ''])('refuses unbounded or non-answer model output', async content => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content } }] }));
  await expect(answerCorreosChileText('http://model.test', 'Question', 'q', new AbortController().signal, 500, fetcher)).resolves.toBeNull();
});

it('does not mistake a missing model route for a missing shipment', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('missing', { status: 404 }));
  await expect(answerCorreosChileText('http://model.test', 'Question', 'q', new AbortController().signal, 500, fetcher)).rejects.toMatchObject({ kind: 'transport' });
});
