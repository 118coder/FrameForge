# FrameForge WASM 构建脚本（Windows PowerShell）
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "wasm")

Write-Host "==> cargo build --release --target wasm32-unknown-unknown" -ForegroundColor Cyan
cargo build --release --target wasm32-unknown-unknown

$dst = Join-Path $PSScriptRoot "web\wasm\core.wasm"
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
Copy-Item "target\wasm32-unknown-unknown\release\frameforge_core.wasm" $dst -Force
$kb = [math]::Round((Get-Item $dst).Length / 1KB)
Write-Host "==> 已输出 $dst ($kb KB)" -ForegroundColor Green

# ---- 单文件 exe（内嵌 web/ 资源）----
Write-Host "==> 构建 FrameForge.exe" -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "server")
cargo build --release
Copy-Item "target\release\frameforge-server.exe" (Join-Path $PSScriptRoot "FrameForge.exe") -Force
$kb2 = [math]::Round((Get-Item (Join-Path $PSScriptRoot "FrameForge.exe")).Length / 1KB)
Write-Host "==> 已输出 FrameForge.exe ($kb2 KB) —— 双击即用" -ForegroundColor Green
