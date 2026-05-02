/**
 * File: server.cjs
 * Description: Serves the exported Expo client bundle and forwards dynamic web and API requests to the Expo server build.
 */

const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize, resolve } = require('node:path');

const { createRequestHandler } = require('expo-server/adapter/http');

const CLIENT_BUILD_DIR = join(process.cwd(), 'dist', 'client');
const SERVER_BUILD_DIR = join(process.cwd(), 'dist', 'server');
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'production';
const expoRequestHandler = createRequestHandler({
  build: SERVER_BUILD_DIR,
  environment: NODE_ENV,
});

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

/**
 * Inputs: a request pathname.
 * Output: the absolute static file path when the client build contains that file, otherwise `null`.
 */
function resolveStaticAssetPath(pathname) {
  if (pathname === '/' || pathname.length === 0) {
    return null;
  }

  const decodedPathname = decodeURIComponent(pathname);
  const relativePath = normalize(decodedPathname).replace(/^([/\\])+/, '');
  const absolutePath = resolve(CLIENT_BUILD_DIR, relativePath);

  if (!absolutePath.startsWith(CLIENT_BUILD_DIR)) {
    return null;
  }

  if (!existsSync(absolutePath)) {
    return null;
  }

  const fileStats = statSync(absolutePath);

  if (!fileStats.isFile()) {
    return null;
  }

  return absolutePath;
}

/**
 * Inputs: a static asset path.
 * Output: the content type header value for the file extension.
 */
function getContentType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Inputs: a request and response pair.
 * Output: serves a static client asset into the response.
 */
function serveStaticAsset(request, response, filePath) {
  response.statusCode = 200;
  response.setHeader('Content-Type', getContentType(filePath));

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const fileStream = createReadStream(filePath);
  fileStream.on('error', () => {
    if (!response.writableEnded) {
      response.statusCode = 500;
      response.end('Unable to read static asset.');
    }
  });
  fileStream.pipe(response);
}

const server = createServer((request, response) => {
  if (!request.url || !request.method) {
    response.statusCode = 400;
    response.end('Malformed request.');
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

  if (requestUrl.pathname === '/health') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(
      JSON.stringify({
        ok: true,
        environment: NODE_ENV,
      })
    );
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const staticAssetPath = resolveStaticAssetPath(requestUrl.pathname);

    if (staticAssetPath) {
      serveStaticAsset(request, response, staticAssetPath);
      return;
    }

    if (
      requestUrl.pathname === '/' ||
      !requestUrl.pathname.startsWith('/api/')
    ) {
      serveClientIndex(request, response);
      return;
    }
  }

  expoRequestHandler(request, response, (error) => {
    if (error) {
      console.error(error);

      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }

      if (!response.writableEnded) {
        response.end('OWA server request failed.');
      }

      return;
    }

    if (!response.writableEnded) {
      response.statusCode = 404;
      response.end('Not found.');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OWA server listening on http://0.0.0.0:${PORT}`);
});

function serveClientIndex(request, response) {
  const indexPath = join(CLIENT_BUILD_DIR, 'index.html');

  if (!existsSync(indexPath)) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end(`Missing client index at ${indexPath}`);
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(indexPath).pipe(response);
}