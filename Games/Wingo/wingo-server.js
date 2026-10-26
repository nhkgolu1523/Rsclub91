/* WINGO - tiny zero-dependency static server (used by START-WINGO.bat) */
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const port = parseInt(process.argv[2] || '8000', 10);
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
    '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.ico': 'image/x-icon', '.map': 'application/json'
};
http.createServer(function (req, res) {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 not found: ' + p);
    }
    res.writeHead(200, {
        'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
    });
    fs.createReadStream(f).pipe(res);
}).listen(port, function () {
    console.log('WINGO server running  ->  http://localhost:' + port + '/index.html');
    console.log('Folder: ' + root);
    console.log('Press Ctrl+C to stop.');
});