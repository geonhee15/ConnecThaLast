// 로컬 개발 서버: 정적 파일 + /api/* 서버리스 함수(Vercel 형식)를 함께 띄운다.
// 사용: node dev-server.mjs [port]   (기본 5555)
// 환경변수(STDICT_KEY 등)는 .env.local 이 있으면 자동으로 읽는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PORT = parseInt(process.argv[2] || process.env.PORT || '5555', 10);

// .env.local 로드 (값에 따옴표 없음 가정)
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.flac': 'audio/flac',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon',
};

// Vercel 의 res 헬퍼(status/json/setHeader) 흉내
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    const fn = path.join(ROOT, url.pathname.replace(/^\//, '') + '.js');
    if (!fs.existsSync(fn)) { res.statusCode = 404; return res.end('no such api'); }
    try {
      const mod = await import(pathToFileURL(fn).href + '?t=' + fs.statSync(fn).mtimeMs); // 수정 시 재로드
      req.query = Object.fromEntries(url.searchParams.entries());
      return await mod.default(req, wrapRes(res));
    } catch (e) {
      res.statusCode = 500; return res.end('api error: ' + e.message);
    }
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`ConnecThaLast dev server → http://localhost:${PORT}  (static + /api)`));
