/**
 * E-Claims + Apeiro L3 live operations dashboard server.
 *
 * Usage:
 *   node operations-dashboard/server.mjs
 *   OPS_DASHBOARD_PORT=8090 node operations-dashboard/server.mjs
 *
 * Env: reads eclaim-backend/.env (RPC, contracts, operator wallets, backend URL)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSnapshot } from './lib/snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(__dirname, 'public');
const logDir = path.join(root, 'logs');
const PORT = Number(process.env.OPS_DASHBOARD_PORT || 8090);
const REFRESH_MS = Number(process.env.OPS_DASHBOARD_CACHE_MS || 60_000);

let cache = { at: 0, data: null, building: null };

async function getSnapshot() {
  if (cache.data && Date.now() - cache.at < REFRESH_MS) return cache.data;
  if (cache.building) return cache.building;
  cache.building = buildSnapshot({ root, logDir })
    .then((data) => {
      cache = { at: Date.now(), data, building: null };
      return data;
    })
    .catch((err) => {
      cache.building = null;
      throw err;
    });
  return cache.building;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(publicDir, rel);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/api/snapshot' || url.pathname === '/api/operations/snapshot') {
    try {
      const data = await getSnapshot();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT }));
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`E-Claims operations dashboard → http://0.0.0.0:${PORT}`);
  console.log(`API snapshot → http://0.0.0.0:${PORT}/api/snapshot`);
  console.log(`Cache TTL: ${REFRESH_MS / 1000}s`);
});
