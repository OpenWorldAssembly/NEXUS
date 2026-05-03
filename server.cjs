/**
 * File: server.cjs
 * Description: Serves the exported Expo web bundle on Railway and forwards API requests to the Expo server build when available.
 */

const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize, resolve } = require('node:path');

const { createRequestHandler } = require('expo-server/adapter/http');

const DIST_DIR = join(process.cwd(), 'dist');
const CLIENT_BUILD_DIR = join(DIST_DIR, 'client');
const SERVER_BUILD_DIR = join(DIST_DIR, 'server');
const HAS_SERVER_BUILD = existsSync(SERVER_BUILD_DIR);
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'production';
const expoRequestHandler = HAS_SERVER_BUILD
  ? createRequestHandler({
      build: SERVER_BUILD_DIR,
      environment: NODE_ENV,
    })
  : null;

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

function safeDecodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch (_error) {
    return null;
  }
}

function resolveFilePath(baseDir, pathname) {
  if (!existsSync(baseDir) || pathname === '/' || pathname.length === 0) {
    return null;
  }

  const decodedPathname = safeDecodePathname(pathname);

  if (!decodedPathname) {
    return null;
  }

  const relativePath = normalize(decodedPathname).replace(/^([/\\])+/, '');
  const absolutePath = resolve(baseDir, relativePath);

  if (!absolutePath.startsWith(baseDir)) {
    return null;
  }

  if (!existsSync(absolutePath)) {
    return null;
  }

  const fileStats = statSync(absolutePath);

  return fileStats.isFile() ? absolutePath : null;
}

function resolveStaticAssetPath(pathname) {
  return resolveFilePath(CLIENT_BUILD_DIR, pathname) ?? resolveFilePath(SERVER_BUILD_DIR, pathname);
}

function resolveRouteHtmlPath(pathname) {
  if (!HAS_SERVER_BUILD) {
    return null;
  }

  const decodedPathname = safeDecodePathname(pathname);

  if (!decodedPathname) {
    return null;
  }

  const routePath = normalize(decodedPathname).replace(/^([/\\])+/, '').replace(/([/\\])+$/, '');
  const routeWithoutExtension = routePath.replace(/\.html$/i, '');
  const publicGroupDir = join(SERVER_BUILD_DIR, '(public)');
  const candidates = routeWithoutExtension
    ? [
        join(SERVER_BUILD_DIR, `${routeWithoutExtension}.html`),
        join(SERVER_BUILD_DIR, routeWithoutExtension, 'index.html'),
        join(publicGroupDir, `${routeWithoutExtension}.html`),
        join(publicGroupDir, routeWithoutExtension, 'index.html'),
      ]
    : [join(publicGroupDir, 'index.html'), join(SERVER_BUILD_DIR, 'index.html')];

  return candidates.find((candidatePath) => existsSync(candidatePath) && statSync(candidatePath).isFile()) ?? null;
}

function getContentType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function serveFile(request, response, filePath) {
  response.statusCode = 200;
  response.setHeader('Content-Type', getContentType(filePath));

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const fileStream = createReadStream(filePath);
  fileStream.on('error', (error) => {
    console.error(error);

    if (!response.writableEnded) {
      response.statusCode = 500;
      response.end('Unable to read file.');
    }
  });
  fileStream.pipe(response);
}

function serveHealth(response) {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(
    JSON.stringify({
      ok: true,
      environment: NODE_ENV,
      distDir: DIST_DIR,
      clientBuildDir: CLIENT_BUILD_DIR,
      serverBuildDir: SERVER_BUILD_DIR,
      hasClientBuild: existsSync(CLIENT_BUILD_DIR),
      hasClientIndex: existsSync(join(CLIENT_BUILD_DIR, 'index.html')),
      hasServerBuild: HAS_SERVER_BUILD,
      routeIndexPath: resolveRouteHtmlPath('/'),
    })
  );
}

function serveThroughExpo(request, response) {
  if (!expoRequestHandler) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Not found.');
    return;
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
}

const server = createServer((request, response) => {
  if (!request.url || !request.method) {
    response.statusCode = 400;
    response.end('Malformed request.');
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

  if (requestUrl.pathname === '/health') {
    serveHealth(response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const staticAssetPath = resolveStaticAssetPath(requestUrl.pathname);

    if (staticAssetPath) {
      serveFile(request, response, staticAssetPath);
      return;
    }

    if (!requestUrl.pathname.startsWith('/api/')) {
      const routeHtmlPath = resolveRouteHtmlPath(requestUrl.pathname);

      if (routeHtmlPath) {
        serveFile(request, response, routeHtmlPath);
        return;
      }
    }
  }

  serveThroughExpo(request, response);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OWA server listening on http://0.0.0.0:${PORT}`);
  console.log(`OWA client build dir: ${CLIENT_BUILD_DIR}`);
  console.log(`OWA server build dir: ${SERVER_BUILD_DIR}`);
  console.log(`OWA route index path: ${resolveRouteHtmlPath('/')}`);
});
