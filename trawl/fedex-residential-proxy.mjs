import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns/promises';
import { fedexDestination, publicAddress } from './fedex-ipv6-proxy.mjs';

/** Every TLS connection goes through the configured authenticated gateway; no direct fallback. */
export async function createFedExResidentialProxy(value, { resolve = lookup, requestHttp = httpRequest,
  requestHttps = httpsRequest, onBytes = () => {} } = {}) {
  let gateway;
  try { gateway = new URL(value); } catch { throw new Error('Invalid residential gateway'); }
  if (!['http:', 'https:'].includes(gateway.protocol) || !gateway.hostname || gateway.search || gateway.hash
    || !['', '/'].includes(gateway.pathname)) throw new Error('Invalid residential gateway');
  let authorization;
  try { authorization = 'Basic ' + Buffer.from(decodeURIComponent(gateway.username) + ':' + decodeURIComponent(gateway.password)).toString('base64'); }
  catch { throw new Error('Invalid residential gateway credentials'); }
  const peers = await resolve(gateway.hostname, { all: true });
  if (!peers.length || peers.some(peer => !publicAddress(peer.address))) throw new Error('Invalid residential gateway address');
  const sockets = new Set(), requests = new Set();
  const counts = { page: 0, api: 0, failures: 0, bytes: 0 };
  let closed = false;
  const server = createServer((_request, response) => { response.writeHead(405); response.end(); });
  server.maxConnections = 64; server.headersTimeout = 5000;
  server.on('clientError', (_error, socket) => socket.destroy());
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('connect', async (incoming, client, head) => {
    let upstream, request, timer, failed = false;
    const fail = () => { if (!failed) counts.failures++; failed = true; clearTimeout(timer); client.destroy(); upstream?.destroy(); request?.destroy(); };
    client.once('error', fail);
    client.once('close', () => { clearTimeout(timer); upstream?.destroy(); request?.destroy(); });
    try {
      timer = setTimeout(fail, 5000);
      const destination = fedexDestination(incoming.url);
      const addresses = await resolve(destination.host, { all: true });
      if (!addresses.length || addresses.some(peer => !publicAddress(peer.address))) throw new Error('Invalid destination');
      if (closed || client.destroyed) { clearTimeout(timer); return; }
      const peer = peers[0];
      request = (gateway.protocol === 'https:' ? requestHttps : requestHttp)({
        hostname: peer.address, family: peer.family, port: Number(gateway.port || (gateway.protocol === 'https:' ? 443 : 80)),
        servername: gateway.hostname, method: 'CONNECT', path: `${destination.host}:443`, agent: false,
        headers: { Host: `${destination.host}:443`, 'Proxy-Authorization': authorization },
      });
      requests.add(request); request.once('close', () => requests.delete(request));
      request.once('error', fail);
      request.once('connect', (response, socket, buffered) => {
        upstream = socket;
        if (response.statusCode !== 200 || closed || client.destroyed) { fail(); return; }
        clearTimeout(timer);
        sockets.add(socket); socket.once('close', () => sockets.delete(socket)); socket.once('error', fail);
        if (destination.target === 'page' || destination.target === 'api') counts[destination.target]++;
        const bytes = chunk => { counts.bytes += chunk.length; onBytes(chunk.length);
          if (counts.bytes > 64 * 1024 * 1024) fail(); };
        client.on('data', bytes); socket.on('data', bytes);
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) { bytes(head); socket.write(head); }
        if (buffered.length) { bytes(buffered); client.write(buffered); }
        socket.pipe(client); client.pipe(socket);
      });
      request.end();
    } catch { fail(); }
  });
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready); });
  return { url: `http://127.0.0.1:${server.address().port}`,
    proof: () => ({ route: 'residential', family: 'unknown', pageConnections: counts.page,
      apiConnections: counts.api, connectionFailures: counts.failures, bytes: counts.bytes }),
    async close() { closed = true; for (const request of requests) request.destroy(); for (const socket of sockets) socket.destroy();
      await new Promise(done => server.close(done)); },
  };
}
