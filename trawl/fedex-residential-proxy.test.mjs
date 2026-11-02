import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { createFedExResidentialProxy } from './fedex-residential-proxy.mjs';

const resolve = async () => [{ address: '8.8.8.8', family: 4 }];
async function tunnel(proxy, authority, body = '') {
  return new Promise((done, reject) => {
    const url = new URL(proxy.url); let reply = '';
    const socket = connect({ host: url.hostname, port: Number(url.port) }, () =>
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`));
    socket.on('data', chunk => { reply += chunk.toString();
      if (reply.includes('\r\n\r\n') && body) { socket.write(body); body = ''; }
      if (reply.includes('pong')) socket.end();
    });
    socket.once('error', reject); socket.once('close', () => done(reply));
  });
}
test('every connection uses the authenticated gateway; proof counts actual tunnels and bytes', async () => {
  const upstream = createServer(); const sockets = new Set(); const calls = [];
  upstream.on('connect', (req, socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket));
    calls.push({ target: req.url, auth: req.headers['proxy-authorization'] });
    socket.write('HTTP/1.1 200 OK\r\n\r\n'); socket.on('data', () => socket.end('pong'));
  });
  await new Promise(done => upstream.listen(0, '127.0.0.1', done)); let totalBytes = 0;
  const proxy = await createFedExResidentialProxy('http://synthetic-user:synthetic-password@gateway.test:80', {
    resolve, requestHttp: options => request({ ...options, hostname: '127.0.0.1', port: upstream.address().port }),
    onBytes: n => { totalBytes += n; },
  });
  try {
    assert.match(await tunnel(proxy, 'www.fedex.com:443', 'ping'), /pong/);
    assert.match(await tunnel(proxy, 'api.fedex.com:443', 'ping'), /pong/);
    assert.deepEqual(calls.map(c => c.target), ['www.fedex.com:443', 'api.fedex.com:443']);
    assert.ok(calls.every(c => c.auth === 'Basic ' + Buffer.from('synthetic-user:synthetic-password').toString('base64')));
    assert.deepEqual(proxy.proof(), { route: 'residential', family: 'unknown', pageConnections: 1, apiConnections: 1, connectionFailures: 0, bytes: 16 });
    assert.equal(totalBytes, 16);
  } finally { await proxy.close(); for (const socket of sockets) socket.destroy(); await new Promise(done => upstream.close(done)); }
});
test('gateway refusals and private destinations never get a direct fallback or accepted proof', async () => {
  let calls = 0;
  const upstream = createServer(); upstream.on('connect', (_req, socket) => socket.end('HTTP/1.1 407 Refused\r\n\r\n'));
  await new Promise(done => upstream.listen(0, '127.0.0.1', done));
  const proxy = await createFedExResidentialProxy('http://user:password@gateway.test', { resolve,
    requestHttp: options => { calls++; return request({ ...options, hostname: '127.0.0.1', port: upstream.address().port }); } });
  try {
    assert.equal(await tunnel(proxy, 'api.fedex.com:443'), '');
    assert.equal(await tunnel(proxy, '127.0.0.1:443'), '');
    assert.equal(calls, 1); assert.equal(proxy.proof().apiConnections, 0);
    assert.equal(proxy.proof().connectionFailures, 2);
  } finally { await proxy.close(); await new Promise(done => upstream.close(done)); }
  await assert.rejects(createFedExResidentialProxy('http://user:password@gateway.test', { resolve: async () => [{ address: '127.0.0.1', family: 4 }] }));
});
