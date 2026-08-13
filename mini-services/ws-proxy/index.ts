// ============================================================================
// WebSocket Proxy — Proxies WebSocket connections (including socket.io) to game server
// ============================================================================
// Why: The Caddy XTransformPort gateway is broken (routes everything to Next.js),
// so we need a dedicated WebSocket proxy that the client can reach.
// The client connects here via Caddy (root path), and this proxy forwards to the game server.

import http from 'node:http';

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';

const PROXY_PORT = 3002;
const GAME_SERVER_WS = 'ws://127.0.0.1:3001';

const server = createServer((req, res) => {
  // Handle HTTP requests (socket.io polling fallback, health check, etc.)
 const url = new URL(req.url || '/', `http://localhost:${PROXY_PORT}`);
  const sid = url.searchParams.get('sid');
 const transport = url.searchParams.get('transport');

  // If this is a socket.io polling request, proxy it to game server
  if (transport === 'polling' && sid) {
    const targetUrl = `http://127.0.0.1:3001/?EIO=4&transport=polling&sid=${sid}`;
    httpProxy(req, res, targetUrl);
    return;
  }

  // Default: reject (we only handle WebSocket upgrades and socket.io polling)
 res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('Upgrade Required');
});

// Simple HTTP proxy for socket.io polling
function httpProxy(req: IncomingMessage, res: ServerResponse, targetUrl: string) {
  const url = new URL(targetUrl);
  const options = {
    hostname: url.hostname,
    port: parseInt(url.port),
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:3001` },
 };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers);
    proxyRes.pipe(res);
  });

  req.on('error', () => {
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

const wss = new WebSocketServer({ noServer: server });

wss.on('connection', (clientWs, req) => {
  // Get the original path+query from the upgrade request
  const url = new URL(req.url || '/', `http://localhost:${PROXY_PORT}`);
  const targetWsUrl = `ws://127.0.0.1:3001${url.pathname}${url.search}`;
  console.log(`[WS-Proxy] WS connection → ${targetWsUrl}`);

  const serverWs = new WebSocket(targetWsUrl);
  let alive = true;

  serverWs.on('open', () => {
    console.log('[WS-Proxy] Connected to game server');
  });

  serverWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN && alive) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  serverWs.on('close', (code, reason) => {
    console.log(`[WS-Proxy] Game server closed (${code})`);
    if (clientWs.readyState === WebSocket.OPEN && alive) {
      clientWs.close(code, reason);
    }
    alive = false;
  });

  serverWs.on('error', (err) => {
    console.error('[WS-Proxy] Game server error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN && alive) {
      clientWs.close(1012, 'Game server error');
    }
    alive = false;
  });

  clientWs.on('message', (data, isBinary) => {
    if (alive && serverWs.readyState === WebSocket.OPEN) {
      serverWs.send(data, { binary: isBinary });
  }
 });

  clientWs.on('close', (code, reason) => {
    console.log(`[WS-Proxy] Client closed (${code})`);
    if (serverWs.readyState === WebSocket.OPEN || serverWs.readyState === WebSocket.CONNECTING) {
    serverWs.close();
    }
    alive = false;
  });

  clientWs.on('error', () => {
    if (serverWs.readyState === WebSocket.OPEN || serverWs.readyState === WebSocket.CONNECTING) {
      serverWs.close();
    }
    alive = false;
  });
});

server.listen(PROXY_PORT, () => {
  console.log(`[WS-Proxy] WebSocket proxy running on port ${PROXY_PORT}`);
  console.log(`[WS-Proxy] Forwarding to game server at ws://127.0.0.1:3001`);
});
