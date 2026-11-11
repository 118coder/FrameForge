/* FrameForge · WASM Worker：加载 core.wasm 并执行像素处理 */
"use strict";

var wasmInst = null;      // { exports }
var readyPromise = null;

function ready() {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise(function (resolve, reject) {
    var url = new URL("../wasm/core.wasm", self.location.href);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("wasm fetch " + r.status);
        return WebAssembly.instantiateStreaming(r, {});
      })
      .then(function (res) {
        wasmInst = res.instance;
        resolve();
      })
      .catch(function (e) {
        // instantiateStreaming 在 MIME 不对时退化
        return fetch(url)
          .then(function (r) { return r.arrayBuffer(); })
          .then(function (b) { return WebAssembly.instantiate(b, {}); })
          .then(function (res) { wasmInst = res.instance; resolve(); })
          .catch(reject);
      });
  });
  return readyPromise;
}

/* ---------- 内存辅助 ---------- */

function allocAndCopy(u8) {
  var ptr = wasmInst.exports.ff_alloc(u8.length);
  if (!ptr) throw new Error("alloc fail");
  new Uint8Array(wasmInst.exports.memory.buffer, ptr, u8.length).set(u8);
  return ptr;
}

function freeBuf(ptr, len) {
  try { wasmInst.exports.ff_free(ptr, len); } catch (e) { /* noop */ }
}

function takeResult() {
  var ptr = wasmInst.exports.ff_result_ptr();
  var len = wasmInst.exports.ff_result_len();
  var out = new Uint8Array(len);
  if (len > 0) out.set(new Uint8Array(wasmInst.exports.memory.buffer, ptr, len));
  wasmInst.exports.ff_result_clear();
  return out;
}

/* ---------- 多帧序列化解析 ---------- */

function parseSeq(u8) {
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  var magic = dv.getUint32(0, true);
  if (magic !== 0x1ffc0001) throw new Error("bad seq");
  var count = dv.getUint32(4, true);
  var frames = [];
  var off = 8;
  for (var i = 0; i < count; i++) {
    var w = dv.getUint32(off, true);
    var h = dv.getUint32(off + 4, true);
    var delay = dv.getUint32(off + 8, true);
    var len = dv.getUint32(off + 12, true);
    off += 16;
    frames.push({ w: w, h: h, delay: delay, data: u8.slice(off, off + len) });
    off += len;
  }
  return frames;
}

/* ---------- 各操作 ---------- */

var OPS = {
  ping: function () { return "pong"; },

  chromaKey: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    if (src.length !== n) src = src.slice(0, n);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_chroma_key(
      ptr, p.w, p.h, p.mode, p.tol, p.feather, p.suppress,
      p.c1[0], p.c1[1], p.c1[2], p.c2[0], p.c2[1], p.c2[2]
    );
    // v5.0：色键/白底侵蚀 = min(5, round(值/100*10)) 层 3×3 最小值滤波
    if (rc === 0 && p.erode > 0) {
      var passes = Math.min(5, Math.round(p.erode / 100 * 10));
      if (passes > 0) wasmInst.exports.ff_erode_alpha(ptr, p.w, p.h, passes);
    }
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("chromaKey rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  matteRepair: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_matte_repair(ptr, p.w, p.h);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("matteRepair rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  erodeAlpha: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    wasmInst.exports.ff_erode_alpha(ptr, p.w, p.h, p.passes || 1);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    xfer.push(out.buffer);
    return out;
  },

  floodErase: function (p, xfer) {
    // 原站 superEraser：种子点连通域清除 (dR^2+dG^2+dB^2<=tol^2)
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_flood_erase(ptr, p.w, p.h, p.seedX, p.seedY, p.tol);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("floodErase rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  shaveAlpha: function (p, xfer) {
    // 原站 alphaFrontierErode / Kz：贴边 frontier 每层 alpha-22
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    wasmInst.exports.ff_shave_alpha(ptr, p.w, p.h, p.passes || 1);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    xfer.push(out.buffer);
    return out;
  },

  pixelate: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_pixelate(ptr, p.w, p.h, p.block);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("pixelate rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  quantize: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_quantize(ptr, p.w, p.h, p.palette, p.strength, p.dither, p.colorSpace || 0, p.adaptiveK || 0);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("quantize rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  doubleBg: function (p, xfer) {
    var n = p.w * p.h * 4;
    var black = new Uint8Array(p.black);
    var white = new Uint8Array(p.white);
    if (black.length !== n || white.length !== n) throw new Error("两图尺寸不一致");
    var ptrB = allocAndCopy(black);
    var ptrW = allocAndCopy(white);
    var rc = wasmInst.exports.ff_double_bg(ptrB, ptrW, p.w, p.h, p.tolerance, p.edgeContrast, p.erode);
    freeBuf(ptrW, n);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptrB, n).slice();
    freeBuf(ptrB, n);
    if (rc !== 0) throw new Error("doubleBg rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  adjust: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_adjust(ptr, p.w, p.h, p.sat, p.con, p.bri);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("adjust rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  outline: function (p, xfer) {
    var n = p.w * p.h * 4;
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_outline(ptr, p.w, p.h, p.color[0], p.color[1], p.color[2], p.radius);
    var out = new Uint8Array(wasmInst.exports.memory.buffer, ptr, n).slice();
    freeBuf(ptr, n);
    if (rc !== 0) throw new Error("outline rc=" + rc);
    xfer.push(out.buffer);
    return out;
  },

  sheetAssemble: function (p, xfer) {
    var count = p.frames.length;
    var fw = p.fw, fh = p.fh;
    var fsize = fw * fh * 4;
    var head = new Uint8Array(16);
    var hdv = new DataView(head.buffer);
    hdv.setUint32(0, count, true);
    hdv.setUint32(4, fw, true);
    hdv.setUint32(8, fh, true);
    hdv.setUint32(12, p.cols, true);
    var all = new Uint8Array(16 + fsize * count);
    all.set(head, 0);
    p.frames.forEach(function (f, i) {
      var d = f instanceof Uint8Array ? f : f.data;
      all.set(d.length === fsize ? d : d.slice(0, fsize), 16 + i * fsize);
    });
    var ptr = allocAndCopy(all);
    var rc = wasmInst.exports.ff_sheet_assemble(ptr, all.length);
    freeBuf(ptr, all.length);
    if (rc !== 0) throw new Error("sheetAssemble rc=" + rc);
    var out = takeResult();
    xfer.push(out.buffer);
    return out;
  },

  sheetSplit: function (p) {
    var src = new Uint8Array(p.buf);
    var head = new Uint8Array(20);
    var hdv = new DataView(head.buffer);
    hdv.setUint32(0, p.w, true);
    hdv.setUint32(4, p.h, true);
    hdv.setUint32(8, p.cw, true);
    hdv.setUint32(12, p.ch, true);
    hdv.setUint32(16, p.skip ? 1 : 0, true);
    var all = new Uint8Array(20 + src.length);
    all.set(head, 0);
    all.set(src, 20);
    var ptr = allocAndCopy(all);
    var rc = wasmInst.exports.ff_sheet_split(ptr, all.length);
    freeBuf(ptr, all.length);
    if (rc !== 0) throw new Error("sheetSplit rc=" + rc);
    var out = takeResult();
    return { frames: parseSeq(out) };
  },

  gifDecode: function (p) {
    var src = new Uint8Array(p.buf);
    var ptr = allocAndCopy(src);
    var rc = wasmInst.exports.ff_gif_decode(ptr, src.length);
    freeBuf(ptr, src.length);
    if (rc !== 0) throw new Error("gifDecode rc=" + rc);
    var out = takeResult();
    return { frames: parseSeq(out) };
  },

  gifEncode: function (p, xfer) {
    var count = p.frames.length;
    var w = p.w, h = p.h;
    var fsize = w * h * 4;
    var bg = p.bg || [0, 0, 0];
    var speed = p.speed || 10;
    var repeat = p.repeat === undefined ? 1 : p.repeat;
    var delays = p.delays || [];
    var head = new Uint8Array(24 + count * 4);
    var hdv = new DataView(head.buffer);
    hdv.setUint32(0, count, true);
    hdv.setUint32(4, w, true);
    hdv.setUint32(8, h, true);
    head[12] = bg[0]; head[13] = bg[1]; head[14] = bg[2];
    head[15] = speed;
    hdv.setUint32(16, repeat, true);
    hdv.setUint32(20, p.defaultDelay || 80, true);
    for (var i = 0; i < count; i++) {
      hdv.setUint32(24 + i * 4, delays[i] || 0, true);
    }
    var all = new Uint8Array(24 + count * 4 + fsize * count);
    all.set(head, 0);
    p.frames.forEach(function (f, i) {
      var d = f instanceof Uint8Array ? f : f.data;
      all.set(d.length === fsize ? d : d.slice(0, fsize), 24 + count * 4 + i * fsize);
    });
    var ptr = allocAndCopy(all);
    var rc = wasmInst.exports.ff_gif_encode(ptr, all.length);
    freeBuf(ptr, all.length);
    if (rc !== 0) throw new Error("gifEncode rc=" + rc);
    var out = takeResult();
    xfer.push(out.buffer);
    return out;
  }
};

self.onmessage = function (e) {
  var msg = e.data;
  var id = msg.id;
  ready()
    .then(function () {
      var op = OPS[msg.op];
      if (!op) throw new Error("unknown op " + msg.op);
      var xfer = [];
      var result = op(msg.params || {}, xfer);
      self.postMessage({ id: id, ok: true, result: result }, xfer);
    })
    .catch(function (err) {
      self.postMessage({ id: id, ok: false, error: String(err && err.message || err) });
    });
};
