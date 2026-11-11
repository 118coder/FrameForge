/* FrameForge · RoninPro 扩展工具集（对齐 frameronin v5 RoninPro）：
 * 简易裁剪 / 扩图与缩图 / 正斜转化 / 零散切图 / 大图切分 / 重复帧查找 / 序列压缩 / 音频压缩 / 光流补帧 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  var PP = FF.ProPlus = {};

  function numInput(val, min, max, w) {
    var i = UI.el("input", { type: "number", value: String(val), style: { width: (w || 72) + "px" } });
    if (min !== undefined) i.min = String(min);
    if (max !== undefined) i.max = String(max);
    return i;
  }
  function resultBox(pane, title) {
    var box = UI.el("div", { class: "mt14" }, []);
    pane.appendChild(box);
    return function (canvas, extraOps) {
      box.innerHTML = "";
      box.appendChild(UI.el("div", { class: "pb-title" }, [title]));
      box.appendChild(UI.canvasFrame(canvas));
      var row = UI.el("div", { class: "btn-row mt8" }, [
        UI.btn(t("common.download") + " PNG", "btn-primary", function () {
          UI.downloadCanvas(canvas, title.replace(/\s+/g, "_") + ".png");
        })
      ].concat(extraOps || []));
      box.appendChild(row);
    };
  }

  /* ========== 简易裁剪：四边裁切/透明扩边 + 选框模式 ========== */

  PP.simpleCrop = function (pane) {
    var im = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("sc.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
          preview.innerHTML = "";
          preview.appendChild(UI.canvasFrame(UI.imageDataToCanvas(im)));
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var preview = UI.el("div", { class: "mt8" });
    var mkEdge = function (lab, val) {
      var i = numInput(val, -999, 999);
      return { el: UI.el("label", { class: "param-row" }, [UI.el("span", {}, [lab]), i]), input: i };
    };
    var eL = mkEdge(t("sc.left"), 0), eT = mkEdge(t("sc.top"), 0),
        eR = mkEdge(t("sc.right"), 0), eB = mkEdge(t("sc.bottom"), 0);
    var edgeRow = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } },
      [eL.el, eT.el, eR.el, eB.el]);
    var hint = UI.el("div", { class: "hint-text" }, [t("sc.edgeHint")]);
    var go = UI.btn(t("sc.go"), "btn-primary", function () {
      if (!im) return;
      var L = +eL.input.value || 0, T = +eT.input.value || 0, R = +eR.input.value || 0, B = +eB.input.value || 0;
      var w = im.width - L - R, h = im.height - T - B;
      if (w < 1 || h < 1) { info.textContent = t("sc.invalid"); info.style.color = "var(--danger)"; return; }
      var out = UI.makeCanvas(w, h);
      var ctx = out.getContext("2d");
      var outIm = ctx.createImageData(w, h);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var sx = x + L, sy = y + T;
          var di = (y * w + x) * 4;
          if (sx >= 0 && sx < im.width && sy >= 0 && sy < im.height) {
            var si = (sy * im.width + sx) * 4;
            outIm.data[di] = im.data[si]; outIm.data[di + 1] = im.data[si + 1];
            outIm.data[di + 2] = im.data[si + 2]; outIm.data[di + 3] = im.data[si + 3];
          } else { outIm.data[di + 3] = 0; }
        }
      }
      ctx.putImageData(outIm, 0, 0);
      show(out);
    });
    var show = resultBox(pane, t("pp.tab.crop"));
    pane.appendChild(dz); pane.appendChild(info); pane.appendChild(preview);
    pane.appendChild(UI.el("div", { class: "mt8" }, [edgeRow, hint]));
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
  };

  /* ========== 扩图与缩图：N×M 格子中心裁切后合并 ========== */

  PP.expandShrink = function (pane) {
    var im = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("es.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var nIn = numInput(2, 1, 64), mIn = numInput(2, 1, 64);
    var cwIn = numInput(64, 1, 4096), chIn = numInput(64, 1, 4096);
    var gridRow = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, [
      UI.el("span", { class: "hint-text" }, ["N×M"]), nIn, mIn,
      UI.el("span", { class: "hint-text" }, [t("es.cell")]), cwIn, chIn
    ]);
    var hint = UI.el("div", { class: "hint-text" }, [t("es.hintDetail")]);
    var go = UI.btn(t("es.go"), "btn-primary", function () {
      if (!im) return;
      var N = Math.max(1, +nIn.value | 0), M = Math.max(1, +mIn.value | 0);
      var cw = Math.max(1, +cwIn.value | 0), ch = Math.max(1, +chIn.value | 0);
      var out = UI.makeCanvas(N * cw, M * ch);
      var ctx = out.getContext("2d");
      var cellW = im.width / N, cellH = im.height / M;
      for (var gy = 0; gy < M; gy++) {
        for (var gx = 0; gx < N; gx++) {
          // 每格中心裁出 cw×ch
          var cx = gx * cellW + cellW / 2 - cw / 2;
          var cy = gy * cellH + cellH / 2 - ch / 2;
          var sx = Math.round(cx), sy = Math.round(cy);
          var sw = cw, sh = ch, dx = 0, dy = 0;
          if (sx < 0) { dx = -sx; sw -= -sx; sx = 0; }
          if (sy < 0) { dy = -sy; sh -= -sy; sy = 0; }
          if (sx + sw > im.width) sw = im.width - sx;
          if (sy + sh > im.height) sh = im.height - sy;
          if (sw > 0 && sh > 0) {
            var sub = UI.makeCanvas(sw, sh);
            sub.getContext("2d").drawImage(UI.imageDataToCanvas(im), sx, sy, sw, sh, 0, 0, sw, sh);
            ctx.drawImage(sub, gx * cw + dx, gy * ch + dy);
          }
        }
      }
      show(out);
    });
    var show = resultBox(pane, t("pp.tab.expshrink"));
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "mt8" }, [gridRow, hint]));
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
  };

  /* ========== 正斜转化：方形瓦片 → 等距菱形 ========== */

  PP.isoSkew = function (pane) {
    var im = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("iso.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var nIn = numInput(24, 2, 256);
    var mergeCols = numInput(4, 1, 64);
    var go = UI.btn(t("iso.go"), "btn-primary", function () {
      if (!im) return;
      var N = Math.max(2, +nIn.value | 0);
      if (im.width % N || im.height % N) {
        info.textContent = t("iso.errSize").replace("{n}", N).replace("{w}", im.width).replace("{h}", im.height);
        info.style.color = "var(--danger)";
        return;
      }
      var cols = im.width / N, rows = im.height / N;
      var MC = Math.max(1, +mergeCols.value | 0);
      var outRows = Math.ceil(cols / MC);
      var cellW = 2 * N, cellH = N;
      var out = UI.makeCanvas(MC * cellW, outRows * cellH);
      var octx = out.getContext("2d");
      var src = im;
      var outIm = octx.createImageData(out.width, out.height);
      for (var ty = 0; ty < rows; ty++) {
        for (var tx = 0; tx < cols; tx++) {
          var slot = ty * cols + tx;
          var ox = (slot % MC) * cellW;
          var oy = Math.floor(slot / MC) * cellH;
          for (var py = 0; py < cellH; py++) {
            for (var px = 0; px < cellW; px++) {
              // 菱形 → 方形反算
              var u = (px - N) / N + (py / N);   // -1..1 横向
              var v = (py / N) - (px - N) / N;   // 0..2 纵向（近似）
              var sx = tx * N + Math.round((u + 1) / 2 * (N - 1));
              var sy = ty * N + Math.round(v / 2 * (N - 1));
              if (sx < tx * N || sx >= tx * N + N || sy < ty * N || sy >= ty * N + N) continue;
              var si = (sy * src.width + sx) * 4;
              if (src.data[si + 3] === 0) continue;
              var di = ((oy + py) * out.width + (ox + px)) * 4;
              outIm.data[di] = src.data[si];
              outIm.data[di + 1] = src.data[si + 1];
              outIm.data[di + 2] = src.data[si + 2];
              outIm.data[di + 3] = src.data[si + 3];
            }
          }
        }
      }
      octx.putImageData(outIm, 0, 0);
      show(out);
    });
    var show = resultBox(pane, t("pp.tab.isoskew"));
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "mt8" }, [
      UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, [
        UI.el("span", { class: "hint-text" }, [t("iso.n")]), nIn,
        UI.el("span", { class: "hint-text" }, [t("iso.mergeCols")]), mergeCols
      ])
    ]));
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
  };

  /* ========== 重复帧查找：网格切分 → 像素/轮廓比较 → 去重导出 ========== */

  PP.dupFrames = function (pane) {
    var im = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("dup.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var cIn = numInput(4, 1, 64), rIn = numInput(4, 1, 64);
    var run = UI.btn(t("dup.run"), "btn-primary", function () {
      if (!im) return;
      var C = Math.max(1, +cIn.value | 0), R = Math.max(1, +rIn.value | 0);
      var cw = Math.floor(im.width / C), ch = Math.floor(im.height / R);
      var frames = [];
      for (var ry = 0; ry < R; ry++) {
        for (var rx = 0; rx < C; rx++) {
          var f = UI.makeCanvas(cw, ch);
          f.getContext("2d").drawImage(UI.imageDataToCanvas(im), rx * cw, ry * ch, cw, ch, 0, 0, cw, ch);
          f._idx = frames.length + 1;
          frames.push(f);
        }
      }
      // 指纹（降采样 8×8 RGBA + alpha 轮廓）
      function fingerprint(cv) {
        var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height);
        var N = 8, sig = "", asig = "";
        for (var y = 0; y < N; y++) {
          for (var x = 0; x < N; x++) {
            var sx = Math.floor(x * cv.width / N), sy = Math.floor(y * cv.height / N);
            var i = (sy * cv.width + sx) * 4;
            sig += String.fromCharCode(d.data[i] >> 4, d.data[i + 1] >> 4, d.data[i + 2] >> 4);
            asig += d.data[i + 3] > 16 ? "1" : "0";
          }
        }
        return { sig: sig, asig: asig, blank: !asig.match(/1/) };
      }
      var fps = frames.map(fingerprint);
      var groups = {}, outlineGroups = {}, blanks = [];
      for (var i = 0; i < frames.length; i++) {
        if (fps[i].blank) { blanks.push(i + 1); continue; }
        var k = fps[i].sig;
        (groups[k] = groups[k] || []).push(i + 1);
      }
      Object.keys(groups).forEach(function (k) {
        if (groups[k].length < 2) delete groups[k];
        else {
          // 组内检查轮廓差异
          var first = fps[groups[k][0] - 1];
          groups[k].forEach(function (n) {
            if (fps[n - 1].asig !== first.asig) {
              (outlineGroups[k] = outlineGroups[k] || []).push(n);
            }
          });
        }
      });
      // 报告
      report.innerHTML = "";
      var html = "";
      var gkeys = Object.keys(groups);
      html += "<b>" + t("dup.found").replace("{frames}", frames.length).replace("{groups}", gkeys.length) + "</b>";
      if (blanks.length) html += "<div class='hint-text'>" + t("dup.blanks") + blanks.join(",") + "</div>";
      gkeys.forEach(function (k) {
        var members = groups[k].filter(function (n) { return (outlineGroups[k] || []).indexOf(n) < 0; });
        if (members.length >= 2) html += "<div>" + t("dup.groupLine").replace("{list}", members.join(", ")) + "</div>";
      });
      Object.keys(outlineGroups).forEach(function (k) {
        html += "<div class='hint-text'>" + t("dup.outlineLine").replace("{list}", outlineGroups[k].join(", ")) + "</div>";
      });
      if (!gkeys.length) html += "<div>" + t("dup.none") + "</div>";
      report.innerHTML = html;
      // 去重导出
      lastResult = { frames: frames, fps: fps, groups: groups, blanks: blanks, cw: cw, ch: ch, C: C, R: R };
      // 预览
      stripEl.innerHTML = "";
      var strip = UI.el("div", { class: "filmstrip" });
      frames.forEach(function (f, i) {
        var th = UI.el("div", { class: "thumb" + (fps[i].blank ? " off" : "") }, [
          f, UI.el("div", { class: "t-idx" }, [String(i + 1)])
        ]);
        strip.appendChild(th);
      });
      stripEl.appendChild(strip);
    });
    var report = UI.el("div", { class: "mt8 dup-report" });
    var stripEl = UI.el("div", { class: "mt8" });
    var lastResult = null;
    var dlDedup = UI.btn(t("dup.downloadMerged"), "btn-outline", function () {
      if (!lastResult) return;
      var lr = lastResult;
      var removed = new Set();
      Object.keys(lr.groups).forEach(function (k) {
        lr.groups[k].slice(1).forEach(function (n) { removed.add(n - 1); });
      });
      lr.blanks.forEach(function (n) { removed.add(n - 1); });
      var kept = lr.frames.filter(function (f, i) { return !removed.has(i); });
      if (!kept.length) return;
      var cols = lr.C;
      var rows = Math.ceil(kept.length / cols);
      var out = UI.makeCanvas(cols * lr.cw, rows * lr.ch);
      var ctx = out.getContext("2d");
      kept.forEach(function (f, i) {
        ctx.drawImage(f, (i % cols) * lr.cw, Math.floor(i / cols) * lr.ch);
      });
      UI.downloadCanvas(out, "dedup_sheet.png");
      FF.Toast.show(t("dup.done").replace("{kept}", kept.length).replace("{removed}", removed.size), "ok");
    });
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px" } }, [
      UI.el("span", { class: "hint-text" }, [t("dup.cols")]), cIn,
      UI.el("span", { class: "hint-text" }, [t("dup.rows")]), rIn, run
    ]));
    pane.appendChild(report);
    pane.appendChild(stripEl);
    pane.appendChild(UI.el("div", { class: "mt8" }, [dlDedup]));
  };

  /* ========== 序列压缩：横向序列帧检测 → 紧凑重排 ========== */

  PP.seqCompress = function (pane) {
    var im = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("scq.upload"), hint: t("scq.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var alphaIn = numInput(16, 1, 254);
    var padIn = numInput(2, 0, 200);
    var run = UI.btn(t("scq.run"), "btn-primary", function () {
      if (!im) return;
      var A = +alphaIn.value | 0, pad = +padIn.value | 0;
      // 检测空白列
      var colHas = [];
      for (var x = 0; x < im.width; x++) {
        var has = false;
        for (var y = 0; y < im.height; y++) {
          if (im.data[(y * im.width + x) * 4 + 3] > A) { has = true; break; }
        }
        colHas.push(has);
      }
      // 提取内容段
      var segs = [], s = -1;
      for (var x2 = 0; x2 < im.width; x2++) {
        if (colHas[x2] && s < 0) s = x2;
        if ((!colHas[x2] || x2 === im.width - 1) && s >= 0) {
          var e = colHas[x2] ? x2 + 1 : x2;
          if (e > s) segs.push([s, e]);
          s = -1;
        }
      }
      if (!segs.length) { info.textContent = t("scq.none"); info.style.color = "var(--danger)"; return; }
      // 每帧统一左右边界（取并集再收紧到内容）
      var minL = Infinity, maxR = -Infinity;
      segs.forEach(function (sg) { minL = Math.min(minL, sg[0]); maxR = Math.max(maxR, sg[1]); });
      var fw = maxR - minL;
      // 每帧逐列紧凑：先裁到各自内容再放回统一帧宽（左对齐）
      var out = UI.makeCanvas((fw + pad * 2) * segs.length, im.height);
      var octx = out.getContext("2d");
      var srcCv = UI.imageDataToCanvas(im);
      segs.forEach(function (sg, i) {
        var w = sg[1] - sg[0];
        octx.drawImage(srcCv, sg[0], 0, w, im.height, i * (fw + pad * 2) + pad, 0, w, im.height);
      });
      show(out);
      info.textContent = t("scq.done").replace("{n}", segs.length);
    });
    var show = resultBox(pane, t("pp.tab.seqcompress"));
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap" } }, [
      UI.el("span", { class: "hint-text" }, [t("scq.alpha")]), alphaIn,
      UI.el("span", { class: "hint-text" }, [t("scq.pad")]), padIn, run
    ]));
  };

  /* ========== 大图切分：按行列 + 重叠率切分 → ZIP ========== */

  PP.largeSplit = function (pane) {
    var im = null, name = "large";
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("ls.hint"),
      onFiles: function (files) {
        name = files[0].name.replace(/\.[^.]+$/, "");
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 8192); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var cIn = numInput(2, 1, 64), rIn = numInput(2, 1, 64);
    var ovIn = numInput(0, 0, 80);
    var run = UI.btn(t("ls.run"), "btn-primary", function () {
      if (!im) return;
      var C = Math.max(1, +cIn.value | 0), R = Math.max(1, +rIn.value | 0);
      var ov = Math.min(80, Math.max(0, +ovIn.value | 0));
      var cw = Math.floor(im.width / C), ch = Math.floor(im.height / R);
      var px = Math.floor(cw * ov / 100), py = Math.floor(ch * ov / 100);
      var srcCv = UI.imageDataToCanvas(im);
      var jobs = [];
      for (var ry = 0; ry < R; ry++) {
        for (var rx = 0; rx < C; rx++) {
          var x = Math.max(0, rx * cw - px);
          var y = Math.max(0, ry * ch - py);
          var w = Math.min(im.width - x, cw + px * 2);
          var h = Math.min(im.height - y, ch + py * 2);
          var cv2 = UI.makeCanvas(w, h);
          cv2.getContext("2d").drawImage(srcCv, x, y, w, h, 0, 0, w, h);
          jobs.push({ name: name + "_r" + (ry + 1) + "c" + (rx + 1) + ".png", canvas: cv2 });
        }
      }
      // 打包 ZIP（store 模式，复用 zip.js）
      var zipParts = [], offset = 0, central = [];
      var enc = new TextEncoder();
      function crc32(u8) {
        var c, crc = 0xFFFFFFFF;
        for (var n = 0; n < u8.length; n++) {
          c = (crc ^ u8[n]) & 0xFF;
          for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
          crc = (crc >>> 8) ^ c;
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
      }
      var pending = jobs.length;
      jobs.forEach(function (j) {
        j.canvas.toBlob(function (blob) {
          var fr = new FileReader();
          fr.onload = function () {
            var u8 = new Uint8Array(fr.result);
            var nameU8 = enc.encode(j.name);
            var crc = crc32(u8);
            var lh = new Uint8Array(30 + nameU8.length);
            var dv = new DataView(lh.buffer);
            dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
            dv.setUint16(8, 0, true); dv.setUint16(10, 0, true);
            dv.setUint32(14, crc, true); dv.setUint32(18, u8.length, true); dv.setUint32(22, u8.length, true);
            dv.setUint16(26, nameU8.length, true);
            lh.set(nameU8, 30);
            central.push({ nameU8: nameU8, crc: crc, size: u8.length, off: offset });
            zipParts.push(lh, u8);
            offset += lh.length + u8.length;
            if (--pending === 0) finish();
          };
          fr.readAsArrayBuffer(blob);
        }, "image/png");
      });
      function finish() {
        var cdStart = offset;
        central.forEach(function (c) {
          var ch2 = new Uint8Array(46 + c.nameU8.length);
          var dv2 = new DataView(ch2.buffer);
          dv2.setUint32(0, 0x02014b50, true); dv2.setUint16(4, 20, true); dv2.setUint16(6, 20, true);
          dv2.setUint32(16, c.crc, true); dv2.setUint32(20, c.size, true); dv2.setUint32(24, c.size, true);
          dv2.setUint16(28, c.nameU8.length, true);
          dv2.setUint32(42, c.off, true);
          ch2.set(c.nameU8, 46);
          zipParts.push(ch2); offset += ch2.length;
        });
        var eocd = new Uint8Array(22);
        var dv3 = new DataView(eocd.buffer);
        dv3.setUint32(0, 0x06054b50, true);
        dv3.setUint16(8, central.length, true); dv3.setUint16(10, central.length, true);
        dv3.setUint32(12, offset - cdStart, true); dv3.setUint32(16, cdStart, true);
        zipParts.push(eocd);
        UI.download(new Blob(zipParts, { type: "application/zip" }), name + "_split.zip");
      }
    });
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap" } }, [
      UI.el("span", { class: "hint-text" }, [t("dup.cols")]), cIn,
      UI.el("span", { class: "hint-text" }, [t("dup.rows")]), rIn,
      UI.el("span", { class: "hint-text" }, [t("ls.overlap")]), ovIn, run
    ]));
  };

  /* ========== 音频压缩：WAV → MP3（lamejs） ========== */

  PP.audioCompress = function (pane) {
    var files = [];
    var bitrate = UI.selectRow(t("ac.bitrate"), [
      { v: "128", label: "128 kbps" }, { v: "192", label: "192 kbps" }, { v: "320", label: "320 kbps" }, { v: "96", label: "96 kbps" }
    ], "192", {});
    var dz = UI.dropzone({
      accept: "audio/wav,audio/x-wav,.wav", multiple: true, main: t("ac.upload"), hint: t("ac.hint"),
      onFiles: function (fs) {
        files = Array.from(fs).filter(function (f) { return /\.wav$/i.test(f.name) || /wav/.test(f.type); });
        info.textContent = files.length + " × WAV";
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var progress = UI.progress();
    var run = UI.btn(t("ac.run"), "btn-primary", function () {
      if (!files.length) { info.textContent = t("ac.needFile"); info.style.color = "var(--danger)"; return; }
      if (!window.lamejs) {
        // 动态加载本地 lamejs
        var s = document.createElement("script");
        s.src = "js/lib/lame.min.js";
        s.onload = function () { doRun(); };
        s.onerror = function () { info.textContent = t("ac.noEnc"); info.style.color = "var(--danger)"; };
        document.head.appendChild(s);
      } else doRun();

      function doRun() {
        var idx = 0;
        progress.show(t("ac.running"));
        function next() {
          if (idx >= files.length) {
            progress.hide();
            FF.Toast.show(t("ac.done"), "ok");
            return;
          }
          var f = files[idx];
          progress.set(idx / files.length, f.name + " (" + (idx + 1) + "/" + files.length + ")");
          var fr = new FileReader();
          fr.onload = function () {
            try {
              var buf = new Uint8Array(fr.result);
              // 解析 WAV
              var dv = new DataView(buf.buffer);
              var pos = 12, channels = 1, sampleRate = 44100, bits = 16;
              while (pos < buf.length - 8) {
                var id = String.fromCharCode(buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]);
                var sz = dv.getUint32(pos + 4, true);
                if (id === "fmt ") {
                  channels = dv.getUint16(pos + 10, true);
                  sampleRate = dv.getUint32(pos + 12, true);
                  bits = dv.getUint16(pos + 22, true);
                } else if (id === "data") {
                  var dataOff = pos + 8;
                  var n = sz;
                  var samples = channels === 2
                    ? new Int16Array((buf.buffer.slice(dataOff, dataOff + n))).filter(function (_, i) { return i % 2 === 0; })
                    : new Int16Array(buf.buffer.slice(dataOff, dataOff + n));
                  var enc = new lamejs.Mp3Encoder(1, sampleRate, +bitrate.value);
                  var chunks = [], BLOCK = 1152;
                  for (var i2 = 0; i2 < samples.length; i2 += BLOCK) {
                    var chunk = enc.encodeBuffer(samples.subarray(i2, i2 + BLOCK));
                    if (chunk.length) chunks.push(new Int8Array(chunk));
                  }
                  var end = enc.flush();
                  if (end.length) chunks.push(new Int8Array(end));
                  UI.download(new Blob(chunks, { type: "audio/mp3" }), f.name.replace(/\.wav$/i, "") + ".mp3");
                  break;
                }
                pos += 8 + sz + (sz % 2);
              }
            } catch (e) {
              FF.Toast.show(f.name + ": " + e.message, "err");
            }
            idx++;
            setTimeout(next, 60);
          };
          fr.readAsArrayBuffer(f);
        }
        next();
      }
    });
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(bitrate.el);
    pane.appendChild(UI.el("div", { class: "mt14" }, [run]));
    pane.appendChild(progress.el);
  };

  /* ========== 光流补帧（简化：双向块匹配插帧） ========== */

  PP.flowInterp = function (pane) {
    var frames = [];
    var dz = UI.dropzone({
      accept: "image/*", multiple: true, main: t("fl.upload"), hint: t("fl.hint"),
      onFiles: function (fs) {
        Promise.all(Array.from(fs).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); })
          .map(function (f) {
            return UI.fileToImage(f).then(function (r) {
              var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
              c.getContext("2d").drawImage(r.img, 0, 0);
              r.release();
              return c;
            });
          })).then(function (cs) {
            // 统一到第一帧尺寸
            frames = cs.map(function (c) {
              if (c.width !== cs[0].width || c.height !== cs[0].height) {
                var cc = UI.makeCanvas(cs[0].width, cs[0].height);
                cc.getContext("2d").drawImage(c, 0, 0);
                return cc;
              }
              return c;
            });
            info.textContent = t("fl.count").replace("{n}", frames.length);
          });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var modeSel = UI.selectRow(t("fl.mode"), [
      { v: "1", label: "1×（每对帧插 1 帧，N→2N-1）" },
      { v: "2", label: "2×（每对帧插 2 帧）" },
      { v: "3", label: "3×（每对帧插 3 帧）" }
    ], "1", {});
    var blockSlider = UI.slider(t("fl.block"), 4, 32, 8, {});
    var run = UI.btn(t("fl.run"), "btn-primary", function () {
      if (frames.length < 2) { info.textContent = t("fl.needTwo"); info.style.color = "var(--danger)"; return; }
      var k = +modeSel.value;
      var B = blockSlider.value;
      var W = frames[0].width, H = frames[0].height;
      var out = [frames[0]];
      progress.show(t("fl.running"));
      var pair = 0, total = frames.length - 1;
      function nextPair() {
        if (pair >= total) {
          progress.hide();
          // 导出 ZIP
          var names = [];
          var parts = [], central = [], offset = 0;
          var enc = new TextEncoder();
          function crc32(u8) {
            var c, crc = 0xFFFFFFFF;
            for (var n = 0; n < u8.length; n++) {
              c = (crc ^ u8[n]) & 0xFF;
              for (var k2 = 0; k2 < 8; k2++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
              crc = (crc >>> 8) ^ c;
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
          }
          var pending = out.length;
          out.forEach(function (cv2, i) {
            cv2.toBlob(function (blob) {
              var fr = new FileReader();
              fr.onload = function () {
                var u8 = new Uint8Array(fr.result);
                var nm = "frame_" + String(i + 1).padStart(3, "0") + ".png";
                names.push(nm);
                var nameU8 = enc.encode(nm);
                var crc = crc32(u8);
                var lh = new Uint8Array(30 + nameU8.length);
                var dv = new DataView(lh.buffer);
                dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
                dv.setUint32(14, crc, true); dv.setUint32(18, u8.length, true); dv.setUint32(22, u8.length, true);
                dv.setUint16(26, nameU8.length, true);
                lh.set(nameU8, 30);
                central.push({ nameU8: nameU8, crc: crc, size: u8.length, off: offset });
                parts.push(lh, u8); offset += lh.length + u8.length;
                if (--pending === 0) {
                  var cdStart = offset;
                  central.forEach(function (c) {
                    var ch2 = new Uint8Array(46 + c.nameU8.length);
                    var dv2 = new DataView(ch2.buffer);
                    dv2.setUint32(0, 0x02014b50, true); dv2.setUint16(4, 20, true); dv2.setUint16(6, 20, true);
                    dv2.setUint32(16, c.crc, true); dv2.setUint32(20, c.size, true); dv2.setUint32(24, c.size, true);
                    dv2.setUint16(28, c.nameU8.length, true);
                    dv2.setUint32(42, c.off, true);
                    ch2.set(c.nameU8, 46);
                    parts.push(ch2); offset += ch2.length;
                  });
                  var eocd = new Uint8Array(22);
                  var dv3 = new DataView(eocd.buffer);
                  dv3.setUint32(0, 0x06054b50, true);
                  dv3.setUint16(8, central.length, true); dv3.setUint16(10, central.length, true);
                  dv3.setUint32(12, offset - cdStart, true); dv3.setUint32(16, cdStart, true);
                  parts.push(eocd);
                  UI.download(new Blob(parts, { type: "application/zip" }), "interp_frames.zip");
                  FF.Toast.show(t("fl.done").replace("{out}", out.length).replace("{src}", frames.length), "ok");
                }
              };
              fr.readAsArrayBuffer(blob);
            }, "image/png");
          });
          return;
        }
        var A = frames[pair], Bf = frames[pair + 1];
        var actx = A.getContext("2d").getImageData(0, 0, W, H);
        var bctx = Bf.getContext("2d").getImageData(0, 0, W, H);
        for (var j = 1; j <= k; j++) {
          var alpha = j / (k + 1);
          var mid = blockInterp(actx, bctx, W, H, B, alpha);
          out.push(UI.imageDataToCanvas(mid));
        }
        out.push(Bf);
        pair++;
        progress.set(pair / total, pair + "/" + total);
        setTimeout(nextPair, 20);
      }
      nextPair();
    });
    /** 双向块匹配插值：对每个目标块在前/后帧搜索最佳匹配块，位移加权后混合 */
    function blockInterp(A, B, W, H, blockSize, alpha) {
      var out = new ImageData(W, H);
      var ad = A.data, bd = B.data, od = out.data;
      var R = Math.round(blockSize * 0.75); // 搜索半径
      function gray(d, x, y) {
        var i = (y * W + x) * 4;
        return (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
      }
      function match(bx, by, from, to) {
        // 在 to 帧内为 from 帧 (bx,by) 块找最佳位移
        var best = { dx: 0, dy: 0, cost: Infinity };
        for (var dy = -R; dy <= R; dy += 2) {
          for (var dx = -R; dx <= R; dx += 2) {
            var cost = 0, cnt = 0;
            for (var y = by; y < Math.min(by + blockSize, H); y += 2) {
              for (var x = bx; x < Math.min(bx + blockSize, W); x += 2) {
                var sx = x + dx, sy = y + dy;
                if (sx < 0 || sy < 0 || sx >= W || sy >= H) { cost += 40; continue; }
                cost += Math.abs(gray(from.data, x, y) - gray(to.data, sx, sy));
                cnt++;
              }
            }
            if (cnt) cost /= cnt;
            if (cost < best.cost) best = { dx: dx, dy: dy, cost: cost };
          }
        }
        return best;
      }
      for (var by = 0; by < H; by += blockSize) {
        for (var bx = 0; bx < W; bx += blockSize) {
          var mAB = match(bx, by, A, B);   // A 块在 B 中的位移
          var mBA = match(bx, by, B, A);   // B 块在 A 中的位移
          for (var y = by; y < Math.min(by + blockSize, H); y++) {
            for (var x = bx; x < Math.min(bx + blockSize, W); x++) {
              // 正向位置：x + alpha * mAB（A→B 方向）
              var fx = Math.round(x + alpha * mAB.dx), fy = Math.round(y + alpha * mAB.dy);
              // 反向位置：x - (1-alpha) * mBA（B→A 反推）
              var gx = Math.round(x - (1 - alpha) * mBA.dx), gy = Math.round(y - (1 - alpha) * mBA.dy);
              var i = (y * W + x) * 4;
              var ai = (Math.max(0, Math.min(H - 1, fy)) * W + Math.max(0, Math.min(W - 1, fx))) * 4;
              var bi = (Math.max(0, Math.min(H - 1, gy)) * W + Math.max(0, Math.min(W - 1, gx))) * 4;
              for (var c = 0; c < 4; c++) {
                var av = ad[ai + c], bv = bd[bi + c];
                od[i + c] = Math.round(av * (1 - alpha) + bv * alpha);
              }
              // alpha 合成：若一侧透明用另一侧
              if (ad[ai + 3] === 0 && bd[bi + 3] > 0) { od[i] = bd[bi]; od[i + 1] = bd[bi + 1]; od[i + 2] = bd[bi + 2]; }
              if (bd[bi + 3] === 0 && ad[ai + 3] > 0) { od[i] = ad[ai]; od[i + 1] = ad[ai + 1]; od[i + 2] = ad[ai + 2]; }
            }
          }
        }
      }
      return out;
    }
    var progress = UI.progress();
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(modeSel.el);
    pane.appendChild(blockSlider.el);
    pane.appendChild(UI.el("div", { class: "mt14" }, [run]));
    pane.appendChild(progress.el);
  };

  /* ========== 零散切图：固定网格 + 手动框选 → ZIP ========== */

  PP.scatterSlice = function (pane) {
    var im = null, name = "scatter";
    var manual = [];   // 手动框 {x,y,w,h}
    var cvWrap = UI.el("div", { class: "mt8" });
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("ss.hint"),
      onFiles: function (files) {
        name = files[0].name.replace(/\.[^.]+$/, "");
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
          drawPreview();
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var alphaIn = numInput(16, 1, 254);
    function detectRegions() {
      // 基于连通域的零散元素识别（BFS 4邻接，alpha 阈值）
      var A = +alphaIn.value | 0;
      var W = im.width, H = im.height, d = im.data;
      var seen = new Uint8Array(W * H);
      var regions = [];
      var step = 1;
      for (var y = 0; y < H; y += step) {
        for (var x = 0; x < W; x += step) {
          if (seen[y * W + x]) continue;
          if (d[(y * W + x) * 4 + 3] <= A) { seen[y * W + x] = 1; continue; }
          // BFS
          var q = [[x, y]], head = 0;
          seen[y * W + x] = 1;
          var minX = x, maxX = x, minY = y, maxY = y, cnt = 0;
          while (head < q.length) {
            var p = q[head++]; cnt++;
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
            var nb = [[p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] - 1], [p[0], p[1] + 1]];
            nb.forEach(function (n) {
              if (n[0] < 0 || n[1] < 0 || n[0] >= W || n[1] >= H) return;
              var ii = n[1] * W + n[0];
              if (seen[ii]) return;
              if (d[ii * 4 + 3] > A) { seen[ii] = 1; q.push(n); }
              else seen[ii] = 1;
            });
          }
          if (cnt >= 6) regions.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
        }
      }
      return regions;
    }
    function drawPreview() {
      cvWrap.innerHTML = "";
      if (!im) return;
      var src = UI.imageDataToCanvas(im);
      var c = UI.makeCanvas(im.width, im.height);
      var ctx = c.getContext("2d");
      ctx.drawImage(src, 0, 0);
      ctx.strokeStyle = "#e8b04b"; ctx.lineWidth = 1;
      currentRegions().forEach(function (r2) {
        ctx.strokeRect(r2.x + 0.5, r2.y + 0.5, r2.w - 1, r2.h - 1);
      });
      // 框选
      var sel = null, start = null;
      function pt(e) {
        var r3 = c.getBoundingClientRect();
        return { x: (e.clientX - r3.left) * im.width / r3.width, y: (e.clientY - r3.top) * im.height / r3.height };
      }
      c.addEventListener("pointerdown", function (e) { start = pt(e); sel = null; });
      c.addEventListener("pointermove", function (e) {
        if (!start) return;
        sel = pt(e);
        drawPreview._last = sel;
        ctx.drawImage(src, 0, 0);
        currentRegions().forEach(function (r2) { ctx.strokeRect(r2.x + 0.5, r2.y + 0.5, r2.w - 1, r2.h - 1); });
        ctx.strokeStyle = "#4ad8ff"; ctx.setLineDash([4, 3]);
        ctx.strokeRect(Math.min(start.x, sel.x), Math.min(start.y, sel.y), Math.abs(sel.x - start.x), Math.abs(sel.y - start.y));
        ctx.setLineDash([]);
      });
      window.addEventListener("pointerup", function up() {
        if (start && sel) {
          var rx = Math.round(Math.min(start.x, sel.x)), ry = Math.round(Math.min(start.y, sel.y));
          var rw = Math.round(Math.abs(sel.x - start.x)), rh = Math.round(Math.abs(sel.y - start.y));
          if (rw > 4 && rh > 4) { manual.push({ x: rx, y: ry, w: rw, h: rh }); FF.Toast.show(t("ss.regionAdded"), "ok"); }
        }
        start = sel = null;
        window.removeEventListener("pointerup", up);
      });
      cvWrap.appendChild(UI.canvasFrame(c));
    }
    var useDetect = UI.switchRow(t("ss.auto"), true, function () { drawPreview(); });
    function currentRegions() {
      var out = [];
      if (useDetect.value && im) out = out.concat(detectRegions());
      return out.concat(manual);
    }
    var clearBtn = UI.btn(t("ss.clearManual"), "btn-ghost btn-sm", function () { manual = []; drawPreview(); });
    var run = UI.btn(t("ss.run") + " (ZIP)", "btn-primary", function () {
      if (!im) return;
      var regions = currentRegions();
      if (!regions.length) { info.textContent = t("ss.none"); info.style.color = "var(--danger)"; return; }
      var srcCv = UI.imageDataToCanvas(im);
      var jobs = regions.map(function (r2, i) {
        var c2 = UI.makeCanvas(r2.w, r2.h);
        c2.getContext("2d").drawImage(srcCv, r2.x, r2.y, r2.w, r2.h, 0, 0, r2.w, r2.h);
        return { name: name + "_" + (i + 1) + ".png", canvas: c2 };
      });
      // 与大图切分同款 ZIP 打包
      var zipParts = [], central = [], offset = 0;
      var enc = new TextEncoder();
      function crc32(u8) {
        var c, crc = 0xFFFFFFFF;
        for (var n = 0; n < u8.length; n++) {
          c = (crc ^ u8[n]) & 0xFF;
          for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
          crc = (crc >>> 8) ^ c;
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
      }
      var pending = jobs.length;
      jobs.forEach(function (j) {
        j.canvas.toBlob(function (blob) {
          var fr = new FileReader();
          fr.onload = function () {
            var u8 = new Uint8Array(fr.result);
            var nameU8 = enc.encode(j.name);
            var crc = crc32(u8);
            var lh = new Uint8Array(30 + nameU8.length);
            var dv = new DataView(lh.buffer);
            dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
            dv.setUint32(14, crc, true); dv.setUint32(18, u8.length, true); dv.setUint32(22, u8.length, true);
            dv.setUint16(26, nameU8.length, true);
            lh.set(nameU8, 30);
            central.push({ nameU8: nameU8, crc: crc, size: u8.length, off: offset });
            zipParts.push(lh, u8); offset += lh.length + u8.length;
            if (--pending === 0) {
              var cdStart = offset;
              central.forEach(function (c3) {
                var ch2 = new Uint8Array(46 + c3.nameU8.length);
                var dv2 = new DataView(ch2.buffer);
                dv2.setUint32(0, 0x02014b50, true); dv2.setUint16(4, 20, true); dv2.setUint16(6, 20, true);
                dv2.setUint32(16, c3.crc, true); dv2.setUint32(20, c3.size, true); dv2.setUint32(24, c3.size, true);
                dv2.setUint16(28, c3.nameU8.length, true);
                dv2.setUint32(42, c3.off, true);
                ch2.set(c3.nameU8, 46);
                zipParts.push(ch2); offset += ch2.length;
              });
              var eocd = new Uint8Array(22);
              var dv3 = new DataView(eocd.buffer);
              dv3.setUint32(0, 0x06054b50, true);
              dv3.setUint16(8, central.length, true); dv3.setUint16(10, central.length, true);
              dv3.setUint32(12, offset - cdStart, true); dv3.setUint32(16, cdStart, true);
              zipParts.push(eocd);
              UI.download(new Blob(zipParts, { type: "application/zip" }), name + "_scatter.zip");
            }
          };
          fr.readAsArrayBuffer(blob);
        }, "image/png");
      });
    });
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap" } }, [
      useDetect.el,
      UI.el("span", { class: "hint-text" }, [t("scq.alpha")]), alphaIn, clearBtn
    ]));
    pane.appendChild(cvWrap);
    pane.appendChild(UI.el("div", { class: "mt14" }, [run]));
  };
})();
