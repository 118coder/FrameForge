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
    var nIn = numInput(4, 1, 64), mIn = numInput(4, 1, 64);
    var cwIn = numInput(32, 1, 4096), chIn = numInput(32, 1, 4096);
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
    var nIn = numInput(24, 4, 512);
    var mergeCols = numInput(4, 1, 64);
    var sampleSel = UI.selectRow(t("iso.sample"), [
      { v: "nearest", label: "nearest" }, { v: "bilinear", label: "bilinear" }
    ], "nearest", {});

    /* ---- 原站 Js/Tc/Oc：单位方→菱形单应（8 元方程+部分主元高斯消元），逆映射采样 ---- */
    function solveHomography(src, dst) {
      // 求 H：src(2D) → dst(2D)，h22=1，8 未知数
      var A = [], b = [];
      for (var i = 0; i < 4; i++) {
        var u = src[i][0], v = src[i][1], x = dst[i][0], y = dst[i][1];
        A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
        A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
      }
      // 高斯消元（部分主元）
      for (var c = 0; c < 8; c++) {
        var piv = c;
        for (var r2 = c + 1; r2 < 8; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[piv][c])) piv = r2;
        var tmp = A[c]; A[c] = A[piv]; A[piv] = tmp;
        var tb = b[c]; b[c] = b[piv]; b[piv] = tb;
        for (var r3 = c + 1; r3 < 8; r3++) {
          var f = A[r3][c] / A[c][c];
          for (var cc = c; cc < 8; cc++) A[r3][cc] -= f * A[c][cc];
          b[r3] -= f * b[c];
        }
      }
      var h = new Array(8);
      for (var r4 = 7; r4 >= 0; r4--) {
        var s = b[r4];
        for (var c2 = r4 + 1; c2 < 8; c2++) s -= A[r4][c2] * h[c2];
        h[r4] = s / A[r4][r4];
      }
      return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    }
    function invert3(m) {
      var a = m[0], b2 = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h2 = m[7], k = m[8];
      var A = e * k - f * h2, B = f * g - d * k, C = d * h2 - e * g;
      var det = a * A + b2 * B + c * C;
      if (!det) return null;
      return [
        A / det, (c * h2 - b2 * k) / det, (b2 * f - c * e) / det,
        B / det, (a * k - c * g) / det, (c * d - a * f) / det,
        C / det, (b2 * g - a * h2) / det, (a * e - b2 * d) / det
      ];
    }
    // 单瓦片：源 (tx,ty) 格 N×N → 输出 2N×N 菱形
    function skewTile(src, tx, ty, N, Hinv, bilinear, out, ox, oy) {
      var W = src.width, sd = src.data, od = out.data, OW = out.width;
      function sample(sxf, syf) {
        if (bilinear) {
          var x0 = Math.floor(sxf), y0 = Math.floor(syf);
          var fx = sxf - x0, fy = syf - y0;
          var acc = [0, 0, 0, 0];
          for (var dy = 0; dy <= 1; dy++) {
            for (var dx = 0; dx <= 1; dx++) {
              var sx = Math.min(N - 1, Math.max(0, x0 + dx));
              var sy = Math.min(N - 1, Math.max(0, y0 + dy));
              var si = ((ty * N + sy) * W + tx * N + sx) * 4;
              var w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
              acc[0] += sd[si] * w; acc[1] += sd[si + 1] * w;
              acc[2] += sd[si + 2] * w; acc[3] += sd[si + 3] * w;
            }
          }
          return [Math.round(acc[0]), Math.round(acc[1]), Math.round(acc[2]), Math.round(acc[3])];
        }
        var sx2 = Math.round(sxf), sy2 = Math.round(syf);
        if (sx2 < 0 || sy2 < 0 || sx2 >= N || sy2 >= N) return [0, 0, 0, 0];
        var si2 = ((ty * N + sy2) * W + tx * N + sx2) * 4;
        return [sd[si2], sd[si2 + 1], sd[si2 + 2], sd[si2 + 3]];
      }
      for (var Y = 0; Y < N; Y++) {
        for (var X = 0; X < 2 * N; X++) {
          var cx = X + 0.5, cy = Y + 0.5;
          var den = Hinv[6] * cx + Hinv[7] * cy + Hinv[8];
          if (!den) continue;
          var u = (Hinv[0] * cx + Hinv[1] * cy + Hinv[2]) / den;
          var v = (Hinv[3] * cx + Hinv[4] * cy + Hinv[5]) / den;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          var px = sample(u * (N - 1), v * (N - 1));
          if (px[3] === 0) continue;
          var di = ((oy + Y) * OW + (ox + X)) * 4;
          od[di] = px[0]; od[di + 1] = px[1]; od[di + 2] = px[2]; od[di + 3] = px[3];
        }
      }
    }
    // 边缘膨胀：透明像素 8 邻域有内容则复制其颜色（去锯齿缝）
    function dilateEdges(img) {
      var W = img.width, H = img.height, d = img.data;
      var copy = new Uint8ClampedArray(d);
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var i = (y * W + x) * 4;
          if (copy[i + 3] !== 0) continue;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              var nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              var j = (ny * W + nx) * 4;
              if (copy[j + 3] === 0) continue;
              d[i] = copy[j]; d[i + 1] = copy[j + 1]; d[i + 2] = copy[j + 2]; d[i + 3] = copy[j + 3];
              dy = 2; break;
            }
          }
        }
      }
    }

    var go = UI.btn(t("iso.go"), "btn-primary", function () {
      if (!im) return;
      var N = Math.max(4, +nIn.value | 0);
      N = Math.floor(N / 2) * 2; // 强制偶数（原站语义）
      if (N > 512) N = 512;
      if (im.width % N || im.height % N) {
        info.textContent = t("iso.errSize").replace("{n}", N).replace("{w}", im.width).replace("{h}", im.height);
        info.style.color = "var(--danger)";
        return;
      }
      var cols = im.width / N, rows = im.height / N;
      var MC = Math.max(1, +mergeCols.value | 0);
      var cellW = 2 * N, cellH = N;
      var out = UI.makeCanvas(MC * cellW, Math.ceil(cols / MC) * cellH);
      var octx = out.getContext("2d");
      var outIm = octx.createImageData(out.width, out.height);
      // 单位方 (0,0),(1,0),(1,1),(0,1) → 菱形四角 [N,0],[2N-1,N/2],[N,N-1],[0,N/2]
      var Hfwd = solveHomography([[0, 0], [1, 0], [1, 1], [0, 1]],
        [[N, 0], [2 * N - 1, N / 2], [N, N - 1], [0, N / 2]]);
      var Hinv = invert3(Hfwd);
      var bilinear = sampleSel.value === "bilinear";
      for (var ty = 0; ty < rows; ty++) {
        for (var tx = 0; tx < cols; tx++) {
          var slot = ty * cols + tx;
          var ox = (slot % MC) * cellW;
          var oy = Math.floor(slot / MC) * cellH;
          skewTile(im, tx, ty, N, Hinv, bilinear, outIm, ox, oy);
        }
      }
      dilateEdges(outIm);
      octx.putImageData(outIm, 0, 0);
      show(out, [
        UI.btn(t("common.download") + " iso_rhombus_" + N + ".png", "btn-outline", function () {
          out.toBlob(function (blob) { UI.download(blob, "iso_rhombus_" + N + ".png"); }, "image/png", 0.95);
        })
      ]);
    });
    var show = resultBox(pane, t("pp.tab.isoskew"));
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "mt8" }, [
      UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, [
        UI.el("span", { class: "hint-text" }, [t("iso.n")]), nIn,
        UI.el("span", { class: "hint-text" }, [t("iso.mergeCols")]), mergeCols
      ]),
      sampleSel.el
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
    var cIn = numInput(8, 1, 64), rIn = numInput(4, 1, 64);
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
      // 原站语义：空白帧（全透明）单列；完全重复=RGBA 全等分组；轮廓重复=可见区域相等但颜色不等
      function sigOf(cv) {
        var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        var full = "", outline = "", blank = true;
        for (var i = 0; i < d.length; i += 4) {
          var a = d[i + 3];
          if (a !== 0) blank = false;
          // 完全重复指纹：RGBA 全字节（用三段压缩字符串降内存）
          full += String.fromCharCode(d[i], d[i + 1], d[i + 2], a);
          // 轮廓指纹：可见性位（alpha>16 与原站语义一致）
          outline += a > 16 ? "1" : "0";
        }
        return { full: full, outline: outline, blank: blank };
      }
      var fps = frames.map(sigOf);
      var groups = {}, outlineGroups = {}, blanks = [];
      for (var i = 0; i < frames.length; i++) {
        if (fps[i].blank) { blanks.push(i + 1); continue; }
        var k = fps[i].full;
        (groups[k] = groups[k] || []).push(i + 1);
      }
      // 轮廓重复：不同颜色但可见区域完全一致的帧归入 outline 组
      var outlineBySig = {};
      for (var i2 = 0; i2 < frames.length; i2++) {
        if (fps[i2].blank) continue;
        var ok = fps[i2].outline;
        (outlineBySig[ok] = outlineBySig[ok] || []).push(i2 + 1);
      }
      Object.keys(outlineBySig).forEach(function (ok) {
        var members = outlineBySig[ok];
        if (members.length < 2) { delete outlineBySig[ok]; return; }
        // 若组内全部已属同一 full 组（颜色也一致），不算轮廓组
        var fulls = {};
        members.forEach(function (n) { fulls[fps[n - 1].full] = 1; });
        if (Object.keys(fulls).length < 2) delete outlineBySig[ok];
      });
      Object.keys(groups).forEach(function (k) {
        if (groups[k].length < 2) delete groups[k];
      });
      // 报告
      report.innerHTML = "";
      var html = "";
      var gkeys = Object.keys(groups);
      html += "<b>" + t("dup.found").replace("{frames}", frames.length).replace("{groups}", gkeys.length) + "</b>";
      if (blanks.length) html += "<div class='hint-text'>" + t("dup.blanks") + blanks.join(",") + "</div>";
      gkeys.forEach(function (k) {
        html += "<div>" + t("dup.groupLine").replace("{list}", groups[k].join(", ")) + "</div>";
      });
      Object.keys(outlineBySig).forEach(function (ok) {
        html += "<div class='hint-text'>" + t("dup.outlineLine").replace("{list}", outlineBySig[ok].join(", ")) + "</div>";
      });
      if (!gkeys.length && !Object.keys(outlineBySig).length) html += "<div>" + t("dup.none") + "</div>";
      report.innerHTML = html;
      // 去重导出
      lastResult = { frames: frames, fps: fps, groups: groups, blanks: blanks, cw: cw, ch: ch, C: C, R: R, outlineBySig: outlineBySig };
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
    var dupMode = UI.selectRow(t("dup.mode"), [
      { v: "dedupe", label: t("dup.mode.dedupe") },
      { v: "copyFirst", label: t("dup.mode.copyFirst") }
    ], "dedupe", {});
    var dlDedup = UI.btn(t("dup.downloadMerged"), "btn-outline", function () {
      if (!lastResult) return;
      var lr = lastResult;
      var removed = new Set();
      if (dupMode.value === "copyFirst") {
        // copyFirst：保留全部格数，组内非首帧用首帧像素覆盖
        Object.keys(lr.groups).forEach(function (k) {
          var g = lr.groups[k];
          var first = lr.frames[g[0] - 1];
          g.slice(1).forEach(function (n) {
            var tgt = lr.frames[n - 1];
            tgt.getContext("2d").clearRect(0, 0, lr.cw, lr.ch);
            tgt.getContext("2d").drawImage(first, 0, 0);
          });
        });
        lr.blanks.forEach(function (n) {
          var tgt = lr.frames[n - 1];
          tgt.getContext("2d").clearRect(0, 0, lr.cw, lr.ch);
        });
      } else {
        // dedupe：删除后续重复帧与空帧后重拼
        Object.keys(lr.groups).forEach(function (k) {
          lr.groups[k].slice(1).forEach(function (n) { removed.add(n - 1); });
        });
        lr.blanks.forEach(function (n) { removed.add(n - 1); });
      }
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
    pane.appendChild(dupMode.el);
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
    var skipDup = UI.switchRow(t("scq.skipdup"), false, function () {});
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
      // 可选：跳过完全重复帧（逐像素全等比较）
      if (skipDup.value) {
        var uniq = [];
        segs.forEach(function (sg) {
          var w = sg[1] - sg[0];
          var d = im.data, dup = false;
          for (var u = 0; u < uniq.length; u++) {
            var ug = uniq[u];
            if (ug[1] - ug[0] !== w) continue;
            var same = true;
            for (var xx = 0; xx < w && same; xx++) {
              for (var yy = 0; yy < im.height; yy++) {
                var a = ((yy * im.width + ug[0] + xx) * 4);
                var b2 = ((yy * im.width + sg[0] + xx) * 4);
                if (d[a] !== d[b2] || d[a + 1] !== d[b2 + 1] || d[a + 2] !== d[b2 + 2] || d[a + 3] !== d[b2 + 3]) { same = false; break; }
              }
            }
            if (same) { dup = true; break; }
          }
          if (!dup) uniq.push(sg);
        });
        segs = uniq;
        if (!segs.length) { info.textContent = t("scq.none"); info.style.color = "var(--danger)"; return; }
      }
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
    pane.appendChild(skipDup.el);
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
    var cIn = numInput(2, 1, 40), rIn = numInput(2, 1, 40);
    var ovIn = numInput(15, 0, 50);
    var run = UI.btn(t("ls.run"), "btn-primary", function () {
      if (!im) return;
      var C = Math.max(1, Math.min(40, +cIn.value | 0)), R = Math.max(1, Math.min(40, +rIn.value | 0));
      var ov = Math.min(50, Math.max(0, (+ovIn.value || 0))) / 100;
      // 原站 Qo 公式：tileLen = len/(n−(n−1)ov)，step = tileLen*(1−ov)，末块强制贴底
      function splitAxis(len, n) {
        var tileLen = len / (n - (n - 1) * ov);
        var step = tileLen * (1 - ov);
        var starts = [];
        for (var p = 0; p < n; p++) {
          var s = p * step;
          if (p === n - 1) s = len - tileLen; // 末块贴底
          starts.push(Math.max(0, Math.min(len - 1, Math.round(s))));
        }
        var size = Math.max(1, Math.round(tileLen));
        return { starts: starts, size: size };
      }
      var SX = splitAxis(im.width, C), SY = splitAxis(im.height, R);
      var srcCv = UI.imageDataToCanvas(im);
      var jobs = [];
      for (var ry = 0; ry < R; ry++) {
        for (var rx = 0; rx < C; rx++) {
          var x = SX.starts[rx], y = SY.starts[ry];
          var w = Math.min(im.width - x, SX.size), h = Math.min(im.height - y, SY.size);
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
    var thrIn = numInput(24, 1, 254);
    var minPxIn = numInput(4, 1, 999);
    var mergeGapIn = numInput(0, 0, 64);
    var sortSel = UI.selectRow(t("ss.sort"), [
      { v: "row", label: t("ss.sort.row") }, { v: "col", label: t("ss.sort.col") }
    ], "row", {});
    function detectRegions() {
      // 原站语义：以背景色（默认取左上角像素，可改白色）距离阈值识别前景，BFS 4 邻接连通域
      var thr = +thrIn.value | 0;
      var minPx = Math.max(1, +minPxIn.value | 0);
      var mergeGap = Math.max(0, +mergeGapIn.value | 0);
      var W = im.width, H = im.height, d = im.data;
      var bg = [d[0], d[1], d[2], d[3]];
      function isFg(i) {
        if (d[i + 3] === 0) return false;
        var dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
        return Math.sqrt(dr * dr + dg * dg + db * db) > thr;
      }
      var seen = new Uint8Array(W * H);
      var regions = [];
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          if (seen[y * W + x]) continue;
          if (!isFg((y * W + x) * 4)) { seen[y * W + x] = 1; continue; }
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
              if (isFg(ii * 4)) { seen[ii] = 1; q.push(n); }
              else seen[ii] = 1;
            });
          }
          if (cnt >= minPx) regions.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
        }
      }
      // mergeGap：包围盒间隙 ≤mergeGap 的区域两两合并（迭代至稳定）
      if (mergeGap > 0) {
        var changed = true;
        while (changed) {
          changed = false;
          outer:
          for (var i = 0; i < regions.length; i++) {
            for (var j = i + 1; j < regions.length; j++) {
              var a = regions[i], b = regions[j];
              var gx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
              var gy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
              if (gx <= mergeGap && gy <= mergeGap) {
                var nx = Math.min(a.x, b.x), ny = Math.min(a.y, b.y);
                var nw = Math.max(a.x + a.w, b.x + b.w) - nx, nh = Math.max(a.y + a.h, b.y + b.h) - ny;
                regions[i] = { x: nx, y: ny, w: nw, h: nh };
                regions.splice(j, 1);
                changed = true;
                break outer;
              }
            }
          }
        }
      }
      // 排序：row-major（y±8 聚行，行内按 x）/ col-major（x±8 聚列，列内按 y）
      var TOL = 8;
      if (sortSel.value === "row") {
        regions.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
        var rows = [];
        regions.forEach(function (r2) {
          var row = rows.find(function (rw) { return Math.abs(rw.y - r2.y) <= TOL; });
          if (row) row.items.push(r2);
          else rows.push({ y: r2.y, items: [r2] });
        });
        regions = [];
        rows.forEach(function (rw) {
          rw.items.sort(function (a, b) { return a.x - b.x; });
          regions = regions.concat(rw.items);
        });
      } else {
        regions.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
        var cols = [];
        regions.forEach(function (r3) {
          var col = cols.find(function (cl) { return Math.abs(cl.x - r3.x) <= TOL; });
          if (col) col.items.push(r3);
          else cols.push({ x: r3.x, items: [r3] });
        });
        regions = [];
        cols.forEach(function (cl) {
          cl.items.sort(function (a, b) { return a.y - b.y; });
          regions = regions.concat(cl.items);
        });
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
    pane.appendChild(UI.el("div", { class: "param-grid" }, [
      UI.el("div", { class: "param-row" }, [useDetect.el, UI.el("span", { class: "hint-text" }, [t("scq.alpha")]), thrIn, clearBtn]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("ss.minpx")]), minPxIn, UI.el("label", {}, [t("ss.mergegap")]), mergeGapIn]),
      sortSel.el
    ]));
    pane.appendChild(cvWrap);
    pane.appendChild(UI.el("div", { class: "mt14" }, [run]));
  };

  /* ========== 像素引擎 pixelCore（原站 7 步流水线 1:1 复刻）==========
   * 网格评分 → 格心重建 → 区域合并 → 量化 → 量化后合并 → (可选连通域预处理) → 输出 1px 逻辑图
   * 公式来源：线上 v5.0 主包 l1/rz/iz/lz/az/sz 流水线 */
  PP.pixelCore = function (pane) {
    var im = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("chroma.drop"), hint: t("pc.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          im = UI.imageDataFrom(r.img, 4096); r.release();
          info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);

    function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function dist4(a, b) {
      var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2], da = a[3] - b[3];
      return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
    }

    /* 步骤1：自动网格检测 rz —— score = onGrid − 0.68*offGrid + 整除奖励 */
    function detectGrid(img, maxSize) {
      var W = img.width, H = img.height, d = img.data;
      function lineDist(vertical, pitch, phase) {
        // vertical=true：比较竖直格线两侧 (x,y) vs (x-1,y)，x 按 pitch 遍历（0..W）
        var sum = 0, cnt = 0;
        var outerLen = vertical ? W : H;
        var innerLen = vertical ? H : W;
        var step = Math.max(1, Math.floor(innerLen / 220)); // 抽样限流
        for (var o = phase; o < outerLen; o += pitch) {
          if (o === 0) continue;
          for (var i2 = 0; i2 < innerLen; i2 += step) {
            var x1 = vertical ? o : i2, y1 = vertical ? i2 : o;
            var x0 = vertical ? o - 1 : i2, y0 = vertical ? i2 : o - 1;
            var a = (y1 * W + x1) * 4, b = (y0 * W + x0) * 4;
            sum += dist4([d[a], d[a + 1], d[a + 2], d[a + 3]], [d[b], d[b + 1], d[b + 2], d[b + 3]]);
            cnt++;
          }
        }
        return cnt ? sum / cnt : 0;
      }
      var best = null, second = -1;
      for (var c = 2; c <= maxSize; c++) {
        var onGrid = (lineDist(true, c, 0) + lineDist(false, c, 0)) / 2;
        var offGrid = (lineDist(true, c, Math.floor(c / 2)) + lineDist(false, c, Math.floor(c / 2))) / 2;
        var bonus = (W % c === 0 ? 4 : 0) + (H % c === 0 ? 4 : 0);
        var score = onGrid - offGrid * 0.68 + bonus;
        if (!best || score > best.score) {
          if (best) second = best.score;
          best = { c: c, score: score };
        } else if (score > second) second = score;
      }
      if (!best || best.score < 12 || (second >= 0 && best.score - second < 1.5)) return 1;
      return best.c;
    }

    /* 步骤3：区域合并 lz —— fillRatio = clamp(0.36+th*0.06, 0.42, 0.92)；主色占比达标或颜色≤2 → 整格填主色 */
    function regionMerge(img, t, th, enabled) {
      var cv = UI.imageDataToCanvas(img);
      if (!enabled || t <= 1) return cv;
      var W = img.width, H = img.height, d = img.data;
      var fillRatio = clampN(0.36 + (+th || 1.3) * 0.06, 0.42, 0.92);
      var oim = cv.getContext("2d").getImageData(0, 0, W, H);
      var od = oim.data;
      var cols = Math.floor(W / t), rows = Math.floor(H / t);
      for (var gy = 0; gy < rows; gy++) {
        for (var gx = 0; gx < cols; gx++) {
          var freq = {}, total = 0, bestC = null, bestN = 0;
          for (var py = 0; py < t; py++) {
            var sy = gy * t + py;
            for (var px = 0; px < t; px++) {
              var sx = gx * t + px;
              var si = (sy * W + sx) * 4;
              var key = d[si] + "," + d[si + 1] + "," + d[si + 2] + "," + d[si + 3];
              var n1 = (freq[key] || 0) + 1;
              freq[key] = n1;
              total++;
              if (n1 > bestN) { bestN = n1; bestC = key; }
            }
          }
          if (bestN / total >= fillRatio || Object.keys(freq).length <= 2) {
            var bc = bestC.split(",");
            for (var py2 = 0; py2 < t; py2++) {
              for (var px2 = 0; px2 < t; px2++) {
                var di = ((gy * t + py2) * W + gx * t + px2) * 4;
                od[di] = +bc[0]; od[di + 1] = +bc[1]; od[di + 2] = +bc[2]; od[di + 3] = +bc[3];
              }
            }
          }
        }
      }
      cv.getContext("2d").putImageData(oim, 0, 0);
      return cv;
    }

    /* 步骤5：量化后合并 sz —— mergeDist = clamp(delta*4.5, 4, 90)，按频次降序归并到首个近代表色 */
    function mergeAfterQuantize(img, delta) {
      var d = img.data;
      var freq = {}, list = [];
      for (var i = 0; i < d.length; i += 4) {
        var key = d[i] + "," + d[i + 1] + "," + d[i + 2] + "," + d[i + 3];
        if (!freq[key]) { freq[key] = { c: [d[i], d[i + 1], d[i + 2], d[i + 3]], n: 0 }; list.push(freq[key]); }
        freq[key].n++;
      }
      if (list.length < 2) return;
      list.sort(function (a, b) { return b.n - a.n; });
      var mergeDist = clampN(delta * 4.5, 4, 90);
      var reps = [], map = {};
      list.forEach(function (item) {
        var key = item.c.join(",");
        if (map[key] !== undefined) { item.target = map[key]; return; }
        var hit = null;
        for (var r = 0; r < reps.length; r++) {
          if (dist4(item.c, reps[r].c) <= mergeDist) { hit = reps[r]; break; }
        }
        if (hit) { map[key] = hit; item.target = hit; }
        else { reps.push(item); map[key] = item; }
      });
      for (var i2 = 0; i2 < d.length; i2 += 4) {
        var key2 = d[i2] + "," + d[i2 + 1] + "," + d[i2 + 2] + "," + d[i2 + 3];
        var tgt = freq[key2] && freq[key2].target;
        if (tgt) {
          d[i2] = tgt.c[0]; d[i2 + 1] = tgt.c[1]; d[i2 + 2] = tgt.c[2]; d[i2 + 3] = tgt.c[3];
        }
      }
    }

    var go = UI.btn(t("pc.run"), "btn-primary", function () {
      if (!im) return;
      var auto = gridMode.value === "auto";
      var maxSize = clampN(+gMax.value | 0 || 16, 1, 16);
      var gridSize = auto ? detectGrid(im, maxSize) : clampN(+gSize.value | 0 || 4, 1, 16);
      var doRun = function (work) {
        // 步骤3：区域合并
        var merged = UI.imageDataFrom(regionMerge(work, gridSize, regThIn.value, regEn.value), 4096);
        var finish = function (img) {
          // 输出：按 effectiveGridSize 收缩为 1px 逻辑图（格心采样）
          var t = gridSize;
          var out;
          if (t > 1) {
            var W = img.width, H = img.height, d = img.data;
            out = UI.makeCanvas(Math.max(1, Math.floor(W / t)), Math.max(1, Math.floor(H / t)));
            var oim = out.getContext("2d").createImageData(out.width, out.height);
            for (var cy = 0; cy < out.height; cy++) {
              for (var cx = 0; cx < out.width; cx++) {
                var sx = Math.min(W - 1, cx * t + Math.floor(t / 2));
                var sy = Math.min(H - 1, cy * t + Math.floor(t / 2));
                var si = (sy * W + sx) * 4, di = (cy * out.width + cx) * 4;
                oim.data[di] = d[si]; oim.data[di + 1] = d[si + 1];
                oim.data[di + 2] = d[si + 2]; oim.data[di + 3] = d[si + 3];
              }
            }
            out.getContext("2d").putImageData(oim, 0, 0);
          } else {
            out = UI.imageDataToCanvas(img);
          }
          stat.textContent = t("pc.stat")
            .replace("{cols}", Math.floor(im.width / t)).replace("{rows}", Math.floor(im.height / t))
            .replace("{t}", String(t))
            .replace("{w}", out.width).replace("{h}", out.height);
          show(out);
        };
        // 步骤4+5：量化（delta>14 启用 FS 抖动，否则最近邻）+ 量化后合并
        if (qEn.value) {
          var colors = clampN(+qColors.value | 0 || 64, 2, 512);
          var delta = clampN(+qDelta.value | 0 || 2, 1, 20);
          FF.Wasm.quantize(merged, 9, 100, delta > 14 ? 1 : 0, 1, colors).then(function (q) {
            mergeAfterQuantize(q, delta);
            finish(q);
          }).catch(function () { finish(merged); });
        } else {
          finish(merged);
        }
      };
      // 预处理：连通域去背（与蓝图 matteContiguous 同语义），失败用原图继续
      if (matteSw.value) {
        FF.Wasm.chromaKey(im, { mode: 5, tol: clampN(+matteTol.value | 0 || 80, 0, 150), feather: 5, suppress: 0 })
          .then(doRun)
          .catch(function () { doRun(im); });
      } else {
        doRun(im);
      }
    });

    var stat = UI.el("div", { class: "hint-text mt8" }, []);
    var gridMode = UI.selectRow(t("pc.gridmode"), [
      { v: "auto", label: t("pc.auto") }, { v: "manual", label: t("pc.manual") }
    ], "auto", {});
    var gSize = numInput(4, 1, 16);
    var gMax = numInput(16, 1, 16);
    var matteSw = UI.switchRow(t("pc.matte"), true, function () {});
    var matteTol = numInput(80, 0, 150);
    var qEn = UI.switchRow(t("pc.qen"), true, function () {});
    var qColors = numInput(64, 2, 512);
    var qDelta = numInput(2, 1, 20);
    var regEn = UI.switchRow(t("pc.regen"), true, function (v) { regThIn.disabled = !v; });
    var regThIn = numInput(1.3, 0.1, 10);

    var show = resultBox(pane, t("pp.tab.pixelcore"));
    pane.appendChild(dz); pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "param-grid" }, [
      gridMode.el,
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pc.gsize")]), gSize]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pc.gmax")]), gMax]),
      UI.el("div", { class: "param-row" }, [matteSw.el, UI.el("label", {}, [t("pc.mattetol")]), matteTol]),
      UI.el("div", { class: "param-row" }, [qEn.el, UI.el("label", {}, [t("pc.qcolors")]), qColors, UI.el("label", {}, [t("pc.qdelta")]), qDelta]),
      UI.el("div", { class: "param-row" }, [regEn.el, UI.el("label", {}, [t("pc.regth")]), regThIn])
    ]));
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    pane.appendChild(stat);
  };
})();
