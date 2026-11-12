/* FrameForge · 主线程 WASM 桥（Worker 池 + Promise 封装） */
(function () {
  "use strict";

  var workers = [];
  var nextId = 1;
  var pending = new Map(); // id -> {resolve, reject}
  var rr = 0;
  var initPromise = null;

  function poolSize() {
    var c = navigator.hardwareConcurrency || 4;
    return Math.max(1, Math.min(2, Math.floor(c / 2)));
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = new Promise(function (resolve, reject) {
      try {
        var n = poolSize();
        for (var i = 0; i < n; i++) {
          var w = new Worker("js/worker.js");
          w.onmessage = function (e) {
            var p = pending.get(e.data.id);
            if (!p) return;
            pending.delete(e.data.id);
            if (e.data.ok) p.resolve(e.data.result);
            else p.reject(new Error(e.data.error));
          };
          w.onerror = function (e) {
            pending.forEach(function (p) { p.reject(new Error("worker error")); });
            pending.clear();
          };
          workers.push(w);
        }
        // ping 确认 wasm 就绪
        Promise.all(workers.map(function (w) {
          return call(w, "ping", {});
        })).then(function () { resolve(); }, reject);
      } catch (e) {
        reject(e);
      }
    });
    return initPromise;
  }

  function call(w, op, params, transfer) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending.set(id, { resolve: resolve, reject: reject });
      w.postMessage({ id: id, op: op, params: params }, transfer || []);
    });
  }

  function pick() {
    rr = (rr + 1) % workers.length;
    return workers[rr];
  }

  /**
   * 分发一个操作。buf 相关的 transferable 会被转移（调用后原 buffer 不可用，
   * 需要保留时先 slice）。
   */
  function run(op, params, transfer) {
    return init().then(function () {
      return call(pick(), op, params, transfer);
    });
  }

  /**
   * 并行批量：items 每项生成一次 op 调用，onProgress(done, total)
   */
  function batch(opFn, items, onProgress) {
    return init().then(function () {
      var total = items.length;
      var done = 0;
      var results = new Array(total);
      return Promise.all(items.map(function (item, i) {
        return call(pick(), item.op, item.params, item.transfer || [])
          .then(function (res) {
            results[i] = res;
            done++;
            if (onProgress) onProgress(done, total);
            return res;
          }, function (err) {
            done++;
            if (onProgress) onProgress(done, total);
            throw err;
          });
      })).then(function () { return results; });
    });
  }

  /* ---------- 高层 API ---------- */

  function im2buf(imageData) { return imageData.data.buffer; }
  function buf2im(buf, w, h) { return new ImageData(new Uint8ClampedArray(buf), w, h); }

  window.FF = window.FF || {};
  FF.Wasm = {
    init: init,
    isReady: function () { return workers.length > 0; },

    /* ImageData 进，ImageData 出 */
    chromaKey: function (im, o) {
      var buf = im.data.buffer.slice(0);
      return run("chromaKey", {
        buf: buf, w: im.width, h: im.height,
        mode: o.mode, tol: o.tol, feather: o.feather, suppress: o.suppress,
        erode: o.erode || 0,
        c1: o.c1 || [0, 255, 0], c2: o.c2 || [0, 0, 255]
      }, [buf]).then(function (out) { return buf2im(out, im.width, im.height); });
    },
    /* 边缘侵蚀：3×3 邻域最小 alpha（v5.0 jt） */
    erodeAlpha: function (im, passes) {
      var buf = im.data.buffer.slice(0);
      return run("erodeAlpha", { buf: buf, w: im.width, h: im.height, passes: passes }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },
    /* 种子点连通域清除（原站 superEraser） */
    floodErase: function (im, seedX, seedY, tol) {
      var buf = im.data.buffer.slice(0);
      return run("floodErase", { buf: buf, w: im.width, h: im.height, seedX: seedX, seedY: seedY, tol: tol }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },
    /* 贴边削：frontier 每层 alpha-22（v5.0 Kz / alphaFrontierErode） */
    shaveAlpha: function (im, passes) {
      var buf = im.data.buffer.slice(0);
      return run("shaveAlpha", { buf: buf, w: im.width, h: im.height, passes: passes }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },
    /* 去背景后处理（v5.0 Yz：4 次自合成 + 低 alpha 清理 + 小域清除） */
    matteRepair: function (im) {
      var buf = im.data.buffer.slice(0);
      return run("matteRepair", { buf: buf, w: im.width, h: im.height }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },
    pixelate: function (im, block) {
      var buf = im.data.buffer.slice(0);
      return run("pixelate", { buf: buf, w: im.width, h: im.height, block: block }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },
    quantize: function (im, palette, strength, dither, colorSpace, adaptiveK) {
      var buf = im.data.buffer.slice(0);
      return run("quantize", { buf: buf, w: im.width, h: im.height, palette: palette, strength: strength, dither: dither, colorSpace: colorSpace || 0, adaptiveK: adaptiveK || 0 }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },

    /* 双背景差分抠图：同一主体黑底图 + 白底图 */
    doubleBg: function (blackIm, whiteIm, tolerance, edgeContrast, erode) {
      if (blackIm.width !== whiteIm.width || blackIm.height !== whiteIm.height) {
        return Promise.reject(new Error("两张图尺寸不一致"));
      }
      var bbuf = blackIm.data.buffer.slice(0);
      var wbuf = whiteIm.data.buffer.slice(0);
      return run("doubleBg", {
        black: bbuf, white: wbuf, w: blackIm.width, h: blackIm.height,
        tolerance: tolerance, edgeContrast: edgeContrast, erode: erode
      }, [bbuf, wbuf]).then(function (out) { return buf2im(out, blackIm.width, blackIm.height); });
    },
    adjust: function (im, sat, con, bri) {
      var buf = im.data.buffer.slice(0);
      return run("adjust", { buf: buf, w: im.width, h: im.height, sat: sat, con: con, bri: bri }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },
    outline: function (im, color, radius) {
      var buf = im.data.buffer.slice(0);
      return run("outline", { buf: buf, w: im.width, h: im.height, color: color, radius: radius }, [buf])
        .then(function (out) { return buf2im(out, im.width, im.height); });
    },

    /* 帧数据 {w,h,data:Uint8Array} 数组（拷贝语义：不转移输入 buffer，可重复导出） */
    sheetAssemble: function (frames, fw, fh, cols) {
      return run("sheetAssemble", { frames: frames, fw: fw, fh: fh, cols: cols }, [])
        .then(function (out) { return new Uint8Array(out); });
    },
    sheetSplit: function (im, cw, ch, skip) {
      var buf = im.data.buffer.slice(0);
      return run("sheetSplit", { buf: buf, w: im.width, h: im.height, cw: cw, ch: ch, skip: skip }, [buf]);
    },
    gifDecode: function (arrayBuffer) {
      return run("gifDecode", { buf: arrayBuffer }, [arrayBuffer]);
    },
    gifEncode: function (frames, w, h, opts) {
      opts = opts || {};
      return run("gifEncode", {
        frames: frames, w: w, h: h,
        bg: opts.bg || [0, 0, 0],
        speed: opts.speed || 10,
        repeat: opts.repeat === undefined ? 1 : opts.repeat,
        delays: opts.delays || [],
        defaultDelay: opts.delay || 80
      }, []).then(function (out) { return new Uint8Array(out); });
    },

    /* 批量执行：items = [{op, params, transfer}] */
    batch: function (items, onProgress) {
      return batch(null, items, onProgress);
    },

    /* 批量处理 ImageData 数组 */
    batchImages: function (images, fn, onProgress) {
      var items = images.map(function (im) { return fn(im); });
      return batch(null, items, onProgress);
    }
  };
})();
