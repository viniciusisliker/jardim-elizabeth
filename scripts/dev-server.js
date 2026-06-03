const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

function safePath(urlPath) {
  const normalized = path.normalize(urlPath.replace(/^\//, ''));
  if (normalized.startsWith('..')) return null;
  return path.join(ROOT, normalized);
}

function resolveFile(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return safePath('index.html');
  }

  let filePath = safePath(urlPath);
  if (!filePath) return null;

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  if (!path.extname(urlPath)) {
    const withHtml = safePath(`${urlPath}.html`);
    if (withHtml && fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) {
      return withHtml;
    }
    const indexInDir = safePath(path.join(urlPath, 'index.html'));
    if (indexInDir && fs.existsSync(indexInDir)) {
      return indexInDir;
    }
  }

  return null;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = resolveFile(urlPath);

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error reading file');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Jardim Elizabeth — dev server em http://localhost:${PORT}`);
  console.log('Ctrl+C para encerrar');
});
