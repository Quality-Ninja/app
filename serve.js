// Serves a built app folder for `npm start` and the browser tests, with the same rewrites and headers as render.yaml.
// Keep the two in sync. Usage: node serve.js [--dir=dist] [--host=localhost] [--port=5173]
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const option = (name, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3) || fallback
const root = path.resolve(here, option('dir', 'dist'))
const host = option('host', 'localhost')
const port = Number(option('port', process.env.PORT || 5173))

// The app is one page (index.html) whose router shows each of these paths. Any other path that isn't a file is a real
// 404: 404.html is the same page, and its router shows "Page not found".
const PAGES = [
  /^\/$/,
  /^\/sign-in$/,
  /^\/account$/,
  /^\/dashboard$/,
  /^\/workflow\/[^/]+$/,
]
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
}

function resolve(pathname) {
  const target = PAGES.some((page) => page.test(pathname))
    ? '/index.html'
    : pathname
  const file = path.join(root, path.normalize(target))
  return file.startsWith(root + path.sep) &&
    fs.statSync(file, { throwIfNoEntry: false })?.isFile()
    ? file
    : null
}

http
  .createServer((request, response) => {
    let pathname
    try {
      pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname
      )
    } catch {
      pathname = '/'
    }
    const file = resolve(pathname)
    const served = file ?? path.join(root, '404.html')
    // Vite names every file under /assets/ by its content, so a changed file is a new URL and these can be cached for good.
    const cache =
      file && pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache'
    const stream = fs.createReadStream(served)
    stream.on('open', () => {
      response.writeHead(file ? 200 : 404, {
        ...HEADERS,
        'Content-Type':
          TYPES[path.extname(served)] || 'application/octet-stream',
        'Cache-Control': cache,
      })
      stream.pipe(response)
    })
    stream.on('error', () => {
      response.writeHead(500, {
        ...HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      response.end(
        `Nothing to serve in ${path.relative(here, root) || '.'}/. Run npm run build first.\n`
      )
    })
  })
  .listen(port, host, () =>
    console.log(
      `QA Ninja app: http://${host}:${port} (serving ${path.relative(here, root) || '.'}/)`
    )
  )
