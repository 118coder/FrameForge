/* FrameForge · GIF 合成器（对齐 frameronin v5 RoninProGifComposer）
 * 多个 GIF / 图片序列 / 精灵图作为图层合成：位置 / 缩放 / 不透明度 / 帧时序，
 * 逐帧合成导出 GIF + ZIP 逐帧 PNG。解码走 ff_gif_decode，编码走 ff_gif_encode。 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.gifcomposer = function () {
    var sk = UI.pageSkeleton("mod.gifcomp.t", "mod.gifcomp.d", null);
    var root = sk.root, card = sk.card;

    var layers = [];   // { name, frames:[{w,h,delay,data:Uint8Array}], delay, x, y, scale, opacity, visible, color:图层面板色 }
    var LAYER_COLORS = ["#b55233", "#3f7fbf", "#4aa272", "#c8a23f", "#8a5fb0", "#c8433f", "#4a9ab0", "#7a8a3f"];
    var canvasW = 480, canvasH = 320;

    var stageWrap = UI.el("div", { class: "mt8" }, []);
    var layerList = UI.el("div", { class: "mt8" }, []);

    /* ---------- 上传 ---------- */
    var dz = UI.dropzone({
      accept: "image/gif,image/png,image/*", multiple: true,
      main: t("gc.drop"), hint: t("gc.hint"),
      onFiles: function (files) {
        Array.prototype.forEach.call(files, function (f) {
          if (layers.length >= 16) { FF.Toast.show(t("gc.maxlayers"), "warn"); return; }
          addFile(f);
        });
      }
    });

    function addFile(f) {
      var name = f.name.replace(/\.[^.]+$/, "");
      if (/gif$/i.test(f.name)) {
        f.arrayBuffer().then(function (buf) {
          FF.Wasm.gifDecode(buf).then(function (res) {
            layers.push({
              name: name, frames: res.frames.map(function (fr) {
                return { w: fr.w, h: fr.h, delay: fr.delay, data: fr.data };
              }),
              delay: 0, x: 0, y: 0, scale: 100, opacity: 100, visible: true,
              color: LAYER_COLORS[layers.length % LAYER_COLORS.length]
            });
            refresh();
          }).catch(function (e) { FF.Toast.show(name + ": " + e.message, "err"); });
        });
      } else {
        UI.fileToImage(f).then(function (r) {
          var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
          c.getContext("2d").drawImage(r.img, 0, 0);
          var im = c.getContext("2d").getImageData(0, 0, c.width, c.height);
          layers.push({
            name: name,
            frames: [{ w: c.width, h: c.height, delay: 80, data: new Uint8Array(im.data) }],
            delay: 0, x: 0, y: 0, scale: 100, opacity: 100, visible: true,
            color: LAYER_COLORS[layers.length % LAYER_COLORS.length]
          });
          r.release();
          refresh();
        });
      }
    }

    /* ---------- 画布尺寸 ---------- */
    function fitCanvas() {
      var w = 1, h = 1;
      layers.forEach(function (L) {
        if (!L.visible || !L.frames.length) return;
        var fw = Math.round(L.frames[0].w * L.scale / 100) + L.x;
        var fh = Math.round(L.frames[0].h * L.scale / 100) + L.y;
        w = Math.max(w, fw); h = Math.max(h, fh);
      });
      canvasW = Math.min(4096, Math.max(16, w));
      canvasH = Math.min(4096, Math.max(16, h));
    }

    /* ---------- 预览 ---------- */
    var previewTimer = null, previewFrame = 0;
    function totalFrames() {
      var n = 1;
      layers.forEach(function (L) { if (L.visible) n = Math.max(n, L.frames.length); });
      return n;
    }
    function drawFrame(ctx, fi) {
      ctx.clearRect(0, 0, canvasW, canvasH);
      layers.forEach(function (L) {
        if (!L.visible || !L.frames.length) return;
        var fr = L.frames[Math.min(fi, L.frames.length - 1)];
        var tmp = document.createElement("canvas");
        tmp.width = fr.w; tmp.height = fr.h;
        tmp.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(fr.data), fr.w, fr.h), 0, 0);
        ctx.save();
        ctx.globalAlpha = L.opacity / 100;
        ctx.imageSmoothingEnabled = false;
        var dw = Math.round(fr.w * L.scale / 100), dh = Math.round(fr.h * L.scale / 100);
        ctx.drawImage(tmp, L.x, L.y, dw, dh);
        ctx.restore();
      });
    }
    function renderPreview() {
      stageWrap.innerHTML = "";
      if (!layers.length) return;
      fitCanvas();
      var c = UI.makeCanvas(canvasW, canvasH);
      c.style.maxWidth = "100%";
      c.style.border = "1.2px solid var(--card-border)";
      c.style.borderRadius = "10px";
      c.style.background = "repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%) 50% / 16px 16px";
      var ctx = c.getContext("2d");
      drawFrame(ctx, previewFrame);
      stageWrap.appendChild(UI.canvasFrame(c));
      var bar = UI.el("div", { class: "row mt8", style: { gap: "8px" } }, []);
      var playBtn = UI.btn(t("gc.play"), "btn-outline btn-sm", function () {
        if (previewTimer) { clearInterval(previewTimer); previewTimer = null; playBtn.textContent = t("gc.play"); return; }
        playBtn.textContent = t("gc.stop");
        previewTimer = setInterval(function () {
          previewFrame = (previewFrame + 1) % totalFrames();
          drawFrame(ctx, previewFrame);
        }, frameDelay());
      });
      bar.appendChild(playBtn);
      bar.appendChild(UI.el("span", { class: "hint-text" }, [t("gc.frames") + " " + totalFrames() + " · " + canvasW + "×" + canvasH]));
      stageWrap.appendChild(bar);
    }
    function frameDelay() {
      var d = 80;
      layers.forEach(function (L) { if (L.visible && L.delay > 0) d = L.delay; });
      return d;
    }

    /* ---------- 图层面板 ---------- */
    function refresh() {
      renderPreview();
      layerList.innerHTML = "";
      if (!layers.length) return;
      layers.forEach(function (L, i) {
        var row = UI.el("div", { class: "canvas-frame", style: { display: "block", padding: "8px", marginBottom: "6px", borderLeft: "4px solid " + L.color } }, []);
        var head = UI.el("div", { class: "row", style: { gap: "6px", alignItems: "center", flexWrap: "wrap" } }, []);
        var vis = UI.el("input", { type: "checkbox" });
        vis.checked = L.visible;
        vis.addEventListener("change", function () { L.visible = vis.checked; refresh(); });
        head.appendChild(vis);
        head.appendChild(UI.el("strong", {}, [L.name]));
        head.appendChild(UI.el("span", { class: "hint-text" }, [L.frames.length + " 帧 · " + L.frames[0].w + "×" + L.frames[0].h]));
        var up = UI.btn("↑", "btn-ghost btn-xs", function () { if (i > 0) { layers.splice(i - 1, 0, layers.splice(i, 1)[0]); refresh(); } });
        var down = UI.btn("↓", "btn-ghost btn-xs", function () { if (i < layers.length - 1) { layers.splice(i + 1, 0, layers.splice(i, 1)[0]); refresh(); } });
        var del = UI.btn("✕", "btn-ghost btn-xs", function () { layers.splice(i, 1); refresh(); });
        head.appendChild(up); head.appendChild(down); head.appendChild(del);
        row.appendChild(head);
        // 属性行：X / Y / 缩放 / 不透明度 / 帧延时
        function numRow(label, key, min, max) {
          var inp = UI.el("input", { type: "number", value: String(L[key]), style: { width: "64px" } });
          inp.addEventListener("change", function () {
            L[key] = Math.max(min, Math.min(max, Number(inp.value) || 0));
            refresh();
          });
          return UI.el("label", { class: "hint-text", style: { marginRight: "10px" } }, [label, " ", inp]);
        }
        var props = UI.el("div", { class: "row mt4", style: { gap: "4px", flexWrap: "wrap" } }, [
          numRow("X", "x", -4096, 4096),
          numRow("Y", "y", -4096, 4096),
          numRow(t("gc.scale") + "%", "scale", 5, 400),
          numRow(t("gc.opacity") + "%", "opacity", 0, 100),
          numRow(t("gc.delay"), "delay", 0, 6000)
        ]);
        row.appendChild(props);
        layerList.appendChild(row);
      });
    }

    /* ---------- 导出 ---------- */
    var exportStatus = UI.el("div", { class: "hint-text mt8" }, []);
    var go = UI.btn(t("gc.export") + " GIF", "btn-primary", function () {
      if (!layers.length) return;
      go.disabled = true;
      fitCanvas();
      var n = totalFrames();
      var frames = [];
      var tmp = UI.makeCanvas(canvasW, canvasH);
      var ctx = tmp.getContext("2d");
      var delays = [];
      for (var fi = 0; fi < n; fi++) {
        drawFrame(ctx, fi);
        var im = ctx.getImageData(0, 0, canvasW, canvasH);
        frames.push(new Uint8Array(im.data));
        delays.push(frameDelay());
        exportStatus.textContent = t("gc.rendering") + " " + (fi + 1) + "/" + n;
      }
      FF.Wasm.gifEncode(frames, canvasW, canvasH, { delays: delays, repeat: 1, defaultDelay: frameDelay() })
        .then(function (gif) {
          UI.download(new Blob([gif], { type: "image/gif" }), "gif_compose_" + n + "f.gif");
          // 逐帧 ZIP
          var files = [];
          var pend = frames.length;
          frames.forEach(function (fr, k) {
            var fc = UI.makeCanvas(canvasW, canvasH);
            fc.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(fr), canvasW, canvasH), 0, 0);
            fc.toBlob(function (blob) {
              files.push({ name: "frame_" + String(k + 1).padStart(3, "0") + ".png", data: blob });
              if (--pend === 0) {
                Promise.all(files.map(function (f2) {
                  return f2.data.arrayBuffer().then(function (ab) { return { name: f2.name, data: new Uint8Array(ab) }; });
                })).then(function (zipped) {
                  UI.download(FF.Zip.make(zipped), "gif_compose_frames.zip");
                  exportStatus.textContent = t("gc.done") + " (" + n + " " + t("video.frames") + ")";
                  exportStatus.style.color = "var(--green)";
                  go.disabled = false;
                });
              }
            }, "image/png");
          });
        })
        .catch(function (e) {
          exportStatus.textContent = t("vg.fail") + e.message;
          exportStatus.style.color = "var(--danger)";
          go.disabled = false;
        });
    });

    card.appendChild(dz);
    card.appendChild(stageWrap);
    card.appendChild(layerList);
    card.appendChild(UI.el("div", { class: "mt14" }, [go]));
    card.appendChild(exportStatus);
    refresh();

    return { root: root };
  };
})();
