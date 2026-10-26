# WINGO - static server fallback for machines without Python or Node.
# Used automatically by START-WINGO.bat (needs no admin rights on localhost).
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8';  '.json' = 'application/json'
    '.png'  = 'image/png';  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
    '.svg'  = 'image/svg+xml'; '.mp3' = 'audio/mpeg'; '.webp' = 'image/webp'
    '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'
    '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch {
    Write-Host "Could not start on port $Port. Try running START-WINGO.bat as Administrator." -ForegroundColor Red
    Read-Host "Press Enter to exit"; exit 1
}

$url = "http://localhost:$Port/index.html"
Write-Host ""
Write-Host "WINGO server running  ->  $url" -ForegroundColor Green
Write-Host "Folder: $root"
Write-Host "Keep this window open. Press Ctrl+C to stop."
Start-Process $url

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        $rel = [System.Uri]::UnescapeDataString($req.Url.LocalPath)
        if ($rel -eq '/') { $rel = '/index.html' }
        $file = Join-Path $root ($rel.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar))

        if ((Test-Path $file -PathType Leaf) -and $file.StartsWith($root)) {
            $ext = [IO.Path]::GetExtension($file).ToLower()
            $bytes = [IO.File]::ReadAllBytes($file)
            $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $res.Headers.Add('Cache-Control', 'no-store')
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $b = [Text.Encoding]::UTF8.GetBytes("404 not found: $rel")
            $res.ContentLength64 = $b.Length
            $res.OutputStream.Write($b, 0, $b.Length)
        }
        $res.OutputStream.Close()
    } catch {
        if (-not $listener.IsListening) { break }
    }
}