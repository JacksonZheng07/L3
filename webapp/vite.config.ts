import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Vite plugin that proxies Cashu mint HTTP requests to bypass browser CORS.
 *
 * Browser → /cashu-proxy/testnut.cashu.space/v1/info
 *        → fetches https://testnut.cashu.space/v1/info server-side
 *        → returns response with CORS headers
 *
 * This lets cashu-ts work in the browser without mint servers needing CORS headers.
 */
function cashuProxyPlugin(): Plugin {
  return {
    name: 'cashu-cors-proxy',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/cashu-proxy/')) return next();

        // /cashu-proxy/testnut.cashu.space/v1/info → https://testnut.cashu.space/v1/info
        const target = 'https://' + req.url.slice('/cashu-proxy/'.length);

        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
            'Access-Control-Max-Age': '86400',
          });
          res.end();
          return;
        }

        // Collect request body
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString();
          try {
            const fetchOpts: RequestInit = {
              method: req.method || 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
              },
            };
            if (body && req.method !== 'GET' && req.method !== 'HEAD') {
              fetchOpts.body = body;
            }

            const response = await fetch(target, fetchOpts);
            const responseBody = await response.arrayBuffer();

            res.writeHead(response.status, {
              'Content-Type': response.headers.get('content-type') || 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(Buffer.from(responseBody));
          } catch (err) {
            console.error(`[cashu-proxy] ${req.method} ${target} →`, err);
            res.writeHead(502, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cashuProxyPlugin()],
})
