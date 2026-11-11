#!/usr/bin/env bash
# FrameForge WASM 构建脚本
set -e
cd "$(dirname "$0")/wasm"
echo "==> cargo build --release --target wasm32-unknown-unknown"
cargo build --release --target wasm32-unknown-unknown
TARGET="../web/wasm/core.wasm"
mkdir -p ../web/wasm
cp "target/wasm32-unknown-unknown/release/frameforge_core.wasm" "$TARGET"
echo "==> 已复制到 $TARGET ($(du -h "$TARGET" | cut -f1))"
