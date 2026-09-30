// Serves a built app folder for local development and tests, with the same page rewrites and headers as
// render.yaml. Keep the two in sync. Usage: node serve.js [--dir=dist] [--host=localhost] [--port=5173]
const fs = require('fs');
const http = require('http');
const path = require('path');

const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const root = path.resolve(__dirname, option('dir', 'dist'));
const host = option('host', 'localhost');
const port = Number(option('port', process.env.PORT || 5173));

const REWRITES = [
  [/^\/sign-in$/, '/sign-in.html'],
  [/^\/account$/, '/account.html'],
  [/^\/dashboard$/, '/dashboard.html'],
  [/^\/workflow\/[^/]+$/, '/workflow.html'],
];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

function resolve(pathname) {
  const target = REWRITES.find(([pattern]) => pattern.test(pathname))?.[1] || (pathname === '/' ? '/index.html' : pathname);
  const file = path.join(root, path.normalize(target));
  return file.startsWith(root + path.sep) && fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}

http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { pathname = '/'; }
  const file = resolve(pathname);
  const served = file || path.join(root, '404.html');
  const cache = pathname.startsWith('/assets/fonts/') ? 'public, max-age=31536000, immutable' : 'no-cache';
  response.writeHead(file ? 200 : 404, { ...HEADERS, 'Content-Type': TYPES[path.extname(served)] || 'application/octet-stream', 'Cache-Control': cache });
  fs.createReadStream(served).pipe(response);
}).listen(port, host, () => console.log(`QA Ninja app: http://${host}:${port} (serving ${path.relative(__dirname, root) || '.'}/)`));
