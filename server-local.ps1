param([int]$Port = 5500)
$ErrorActionPreference = 'Stop'
$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
$prefix = "http://127.0.0.1:$Port/"

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8'; break }
    '.htm'  { 'text/html; charset=utf-8'; break }
    '.css'  { 'text/css; charset=utf-8'; break }
    '.js'   { 'application/javascript; charset=utf-8'; break }
    '.json' { 'application/json; charset=utf-8'; break }
    '.xml'  { 'application/xml; charset=utf-8'; break }
    '.txt'  { 'text/plain; charset=utf-8'; break }
    '.svg'  { 'image/svg+xml'; break }
    '.png'  { 'image/png'; break }
    '.jpg'  { 'image/jpeg'; break }
    '.jpeg' { 'image/jpeg'; break }
    '.webp' { 'image/webp'; break }
    '.gif'  { 'image/gif'; break }
    '.ico'  { 'image/x-icon'; break }
    '.pdf'  { 'application/pdf'; break }
    '.mp4'  { 'video/mp4'; break }
    '.webm' { 'video/webm'; break }
    '.mp3'  { 'audio/mpeg'; break }
    '.woff' { 'font/woff'; break }
    '.woff2'{ 'font/woff2'; break }
    default { 'application/octet-stream' }
  }
}

$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Gagal menjalankan server pada port $Port." -ForegroundColor Red
  Write-Host "Jika port sedang dipakai, tutup server lama lalu jalankan lagi." -ForegroundColor Yellow
  Read-Host 'Tekan ENTER untuk keluar'
  exit 1
}

Write-Host ''
Write-Host '=============================================' -ForegroundColor Green
Write-Host '  SMK RIMBA BAHARI - LOCAL DEVELOPMENT' -ForegroundColor Green
Write-Host '=============================================' -ForegroundColor Green
Write-Host "  Website : $prefix" -ForegroundColor Cyan
Write-Host "  Login   : ${prefix}signin.html" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Server aktif. Jangan tutup jendela ini selama testing.' -ForegroundColor Yellow
Write-Host 'Untuk menghentikan server: tekan CTRL+C.' -ForegroundColor Yellow
Write-Host ''
Start-Process $prefix

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq '/') { $requestPath = '/index.html' }
    $relative = $requestPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $Root $relative))
    $rootFull = [IO.Path]::GetFullPath($Root)
    if (-not $fullPath.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) { throw 'Forbidden' }

    if (Test-Path -LiteralPath $fullPath -PathType Container) {
      $fullPath = Join-Path $fullPath 'index.html'
    }

    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($fullPath)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-ContentType $fullPath
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.AddHeader('Cache-Control','no-cache')
      $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } else {
      $body = [Text.Encoding]::UTF8.GetBytes('<h1>404 - File tidak ditemukan</h1>')
      $context.Response.StatusCode = 404
      $context.Response.ContentType = 'text/html; charset=utf-8'
      $context.Response.ContentLength64 = $body.Length
      $context.Response.OutputStream.Write($body,0,$body.Length)
    }
    $context.Response.OutputStream.Close()
  } catch {
    try {
      $context.Response.StatusCode = 403
      $context.Response.Close()
    } catch {}
  }
}
