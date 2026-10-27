const http = require('http');
const fs = require('fs');
const path = require('path');
const { getManifest, rootDir } = require('./scanner');

const PORT = 3456;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Endpoint API para árbol de sagas, libros y capítulos
  if (pathname === '/api/manifest') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(getManifest()));
  }

  // Endpoint API para obtener el contenido de un capítulo en crudo
  if (pathname === '/api/chapter') {
    const saga = urlObj.searchParams.get('saga');
    const book = urlObj.searchParams.get('book');
    const chapter = urlObj.searchParams.get('chapter');

    if (!saga || !book || !chapter) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Parámetros saga, book y chapter requeridos' }));
    }

    const filePath = path.join(rootDir, 'sagas', saga, 'libros', book, 'capitulos', chapter);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ content }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Capítulo no encontrado' }));
    }
  }

  // Endpoint API para TTS Neuronal de Alta Fidelidad (Streaming MP3)
  if (pathname === '/api/tts') {
    const ttsHandler = require('../api/tts');
    req.query = Object.fromEntries(urlObj.searchParams);
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    return ttsHandler(req, res);
  }

  // Archivos estáticos de la web
  let staticPath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    const ext = path.extname(staticPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    return fs.createReadStream(staticPath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('No encontrado');
});

server.listen(PORT, () => {
  console.log(`Lector Wattpad de Sagas activo en http://localhost:${PORT}`);
});
