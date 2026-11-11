/* FrameForge · 视频转序列帧 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k, v) { return FF.I18N.t(k, v); };

  FF.Tools = FF.Tools || {};

  FF.Tools.video = function () {
    var sk = UI.pageSkeleton("mod.video.t", "mod.video.d", ["video.s1", "video.s2", "video.s3"]);
    var root = sk.root, card = sk.card, steps = sk.steps;

    var state = {
      file: null, video: null, url: null,
      duration: 0, vw: 0, vh: 0,
      frames: [],           // {w,h,data:Uint8Array}
      excluded: [],         // bool[]
      frameW: 0, frameH: 0
    };

    /* ---------------- Step 1: 上传 ---------------- */

    var infoRow = UI.el("div", { class: "row mt14" });
    var next1 = UI.btn(t("common.next"), "btn-primary", function () { steps.set(1); }, null);
    next1.disabled = true;

    var dz = UI.dropzone({
      accept: "video/*",
      main: t("video.drop"),
      hint: t("video.hint"),
      onFiles: function (files) {
        var f = files[0];
        if (!f) return;
        loadVideo(f);
      }
    });

    function loadVideo(f) {
      cleanupVideo();
      var v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      var url = URL.createObjectURL(f);
      v.src = url;
      state.file = f;
      v.addEventListener("loadedmetadata", function () {
        // MediaRecorder 等产生的 WebM 时长为 Infinity：跳到末尾再回来以修正
        if (v.duration === Infinity) {
          v.currentTime = 1e7;
          v.addEventListener("seeked", function onSeekFix() {
            v.removeEventListener("seeked", onSeekFix);
            v.currentTime = 0;
            // 等待回到起点后再进入流程
            v.addEventListener("seeked", function onBack() {
              v.removeEventListener("seeked", onBack);
              proceed();
            }, { once: true });
          }, { once: true });
          setTimeout(function () { if (!state.video) proceed(); }, 1200);
          return;
        }
        proceed();
      });
      v.addEventListener("error", function () {
        UI.modal("Error", UI.el("p", {}, [t("video.noseek")]));
      });

      function proceed() {
        if (state.video) return;
        // 检查是否可精确 seek
        if (!isFinite(v.duration) || v.duration <= 0) {
          UI.modal("Error", UI.el("p", {}, [t("video.noseek")]));
          return;
        }
        state.video = v;
        state.url = url;
        state.duration = v.duration;
        state.vw = v.videoWidth;
        state.vh = v.videoHeight;
        var preview = UI.canvasFrame(v);
        v.style.maxWidth = "100%";
        v.style.maxHeight = "300px";
        infoRow.innerHTML = "";
        infoRow.appendChild(preview);
        infoRow.appendChild(UI.el("div", { class: "row" }, [
          UI.el("span", { class: "tag-chip" }, [UI.el("b", {}, [fmtTime(state.duration)]), " " + "时长"]),
          UI.el("span", { class: "tag-chip" }, [UI.el("b", {}, [state.vw + "×" + state.vh]), " 分辨率"]),
          UI.el("span", { class: "tag-chip" }, [UI.el("b", {}, [fmtSize(f.size)]), " 大小"])
        ]));
        // 默认截取范围 = 全片
        trimStartIn.value = "0";
        trimEndIn.value = state.duration.toFixed(2);
        next1.disabled = false;
      }
    }

    function cleanupVideo() {
      if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
      state.video = null;
    }

    function fmtTime(s) {
      var m = Math.floor(s / 60), sec = (s % 60).toFixed(1);
      return m + ":" + (sec < 10 ? "0" : "") + sec;
    }
    function fmtSize(n) {
      return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : (n / 1024).toFixed(0) + " KB";
    }

    var p1 = steps.panels[0];
    p1.appendChild(dz);
    p1.appendChild(infoRow);
    p1.appendChild(UI.el("div", { class: "mt20" }, [next1]));

    /* ---------------- Step 2: 参数 ---------------- */

    var fpsSel = UI.selectRow(t("video.fps"),
      [1, 2, 4, 6, 8, 10, 12, 15, 20, 24, 30].map(function (v) { return { v: v, label: v + " FPS" }; }), 12, {});
    var maxWSel = UI.selectRow(t("video.maxw"),
      [96, 128, 192, 256, 384, 512, 768].map(function (v) { return { v: v, label: v + " px" }; }), 256, {});
    var capSel = UI.selectRow(t("video.cap"),
      [50, 100, 200, 300, 500].map(function (v) { return { v: v, label: v + " " + t("video.frames") }; }), 100, {});
    var trimStartIn = UI.el("input", { type: "number", value: "0", min: "0", step: "0.1", style: { width: "90px" } });
    var trimEndIn = UI.el("input", { type: "number", value: "0", min: "0", step: "0.1", style: { width: "90px" } });
    var trimRow = UI.el("div", { class: "param-row" }, [
      UI.el("label", {}, [t("video.trim")]),
      UI.el("div", { class: "row" }, [trimStartIn, UI.el("span", {}, ["~"]), trimEndIn, UI.el("span", { class: "hint-text" }, ["秒"])])
    ]);

    var chromaSw = UI.switchRow(t("video.chroma"), false, function (v) { chromaParams.style.display = v ? "" : "none"; });
    var cMode = UI.selectRow(t("chroma.mode"), [
      { v: 0, label: t("chroma.mode.green") }, { v: 1, label: t("chroma.mode.blue") },
      { v: 2, label: t("chroma.mode.white") }, { v: 3, label: t("chroma.mode.custom") },
      { v: 4, label: t("chroma.mode.dual") }
    ], 0, {});
    var cTol = UI.slider(t("chroma.tol"), 0, 100, 35, {});
    var cFeather = UI.slider(t("chroma.feather"), 0, 100, 25, {});
    var cSuppress = UI.slider(t("chroma.suppress"), 0, 100, 60, {});
    var cColor1 = UI.el("input", { type: "color", value: "#00ff00" });
    var cColor2 = UI.el("input", { type: "color", value: "#0000ff" });
    var chromaParams = UI.el("div", { class: "param-grid mt14", style: { display: "none" } }, [
      cMode.el, cTol.el, cFeather.el, cSuppress.el,
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("chroma.c1")]), cColor1]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("chroma.c2")]), cColor2])
    ]);

    var pixSw = UI.switchRow(t("video.pixelate"), false, function (v) { pixParams.style.display = v ? "" : "none"; });
    var pixBlock = UI.slider(t("pixel.block"), 2, 16, 4, {});
    var pixParams = UI.el("div", { class: "param-grid mt14", style: { display: "none" } }, [pixBlock.el]);

    var extractProg = UI.progress();
    var extractBtn = UI.btn(t("video.extract"), "btn-primary", startExtract);
    var hint2 = UI.el("div", { class: "hint-text mt8" }, [t("video.pick")]);

    var p2 = steps.panels[1];
    p2.appendChild(UI.el("div", { class: "param-grid" }, [fpsSel.el, maxWSel.el, capSel.el, trimRow]));
    p2.appendChild(UI.el("hr", { class: "divider" }));
    p2.appendChild(UI.el("div", {}, [chromaSw.el, chromaParams]));
    p2.appendChild(UI.el("div", { class: "mt14" }, [pixSw.el, pixParams]));
    p2.appendChild(UI.el("div", { class: "mt20 btn-row" }, [extractBtn]));
    p2.appendChild(extractProg.el);
    p2.appendChild(hint2);

    function hex2rgb(hex) {
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function seekTo(v, time) {
      return new Promise(function (resolve) {
        var target = Math.min(time, Math.max(0, (v.duration || 0) - 0.01));
        var done = false;
        var poll = null;
        function finish() {
          if (done) return;
          done = true;
          v.removeEventListener("seeked", finish);
          if (poll) { clearInterval(poll); poll = null; }
          resolve();
        }
        // 已经在目标位置且就绪：无需 seek
        if (!v.seeking && Math.abs(v.currentTime - target) < 0.001 && v.readyState >= 2) {
          finish();
          return;
        }
        v.addEventListener("seeked", finish);
        v.currentTime = target;
        // 轮询兜底（事件丢失 / 后台节流时依然可用）
        poll = setInterval(function () {
          if (!v.seeking && Math.abs(v.currentTime - target) < 0.05 && v.readyState >= 2) finish();
        }, 80);
        // 最终兜底
        setTimeout(finish, 4000);
      });
    }

    async function startExtract() {
      var v = state.video;
      if (!v) return;
      extractBtn.disabled = true;
      extractProg.show("");
      try {
        var fps = Number(fpsSel.value);
        var maxW = Number(maxWSel.value);
        var cap = Number(capSel.value);
        var t0 = Math.max(0, Number(trimStartIn.value) || 0);
        var t1 = Math.min(state.duration, Number(trimEndIn.value) || state.duration);
        if (t1 <= t0) { t1 = state.duration; trimEndIn.value = t1; }
        var total = Math.min(cap, Math.max(1, Math.floor((t1 - t0) * fps)));
        if (total < 1) total = 1;

        var scale = Math.min(1, maxW / state.vw);
        state.frameW = Math.max(1, Math.round(state.vw * scale / 2) * 2);
        state.frameH = Math.max(1, Math.round(state.vh * scale / 2) * 2);
        var cv = UI.makeCanvas(state.frameW, state.frameH);
        var ctx = cv.getContext("2d", { willReadFrequently: true });

        await seekTo(v, t0);
        state.frames = [];
        for (var i = 0; i < total; i++) {
          if (i > 0) await seekTo(v, t0 + i / fps);
          ctx.drawImage(v, 0, 0, state.frameW, state.frameH);
          var im = ctx.getImageData(0, 0, state.frameW, state.frameH);
          state.frames.push({ w: state.frameW, h: state.frameH, data: new Uint8Array(im.data.buffer.slice(0)) });
          extractProg.set((i + 1) / total, t("video.extracting", { cur: i + 1, total: total }));
        }

        // 后处理（逐帧并行）
        var items = state.frames;
        if (pixSw.input.checked) {
          var block = pixBlock.value;
          var next = await FF.Wasm.batch(items.map(function (f) {
            return { op: "pixelate", params: { buf: f.data.buffer, w: f.w, h: f.h, block: block }, transfer: [f.data.buffer] };
          }), function (d, tot) {
            extractProg.set(d / tot, t("common.processing") + " pixelate " + d + "/" + tot);
          });
          items.forEach(function (f, i) { f.data = next[i]; });
        }
        if (chromaSw.input.checked) {
          var cparams = {
            mode: Number(cMode.value), tol: cTol.value, feather: cFeather.value, suppress: cSuppress.value,
            c1: hex2rgb(cColor1.value), c2: hex2rgb(cColor2.value)
          };
          var next2 = await FF.Wasm.batch(items.map(function (f) {
            var params = Object.assign({ buf: f.data.buffer, w: f.w, h: f.h }, cparams);
            return { op: "chromaKey", params: params, transfer: [f.data.buffer] };
          }), function (d, tot) {
            extractProg.set(d / tot, t("common.processing") + " chroma " + d + "/" + tot);
          });
          items.forEach(function (f, i) { f.data = next2[i]; });
        }

        state.excluded = state.frames.map(function () { return false; });
        renderStrip();
        steps.set(2);
      } catch (err) {
        UI.modal("Error", UI.el("p", {}, [String(err.message || err)]));
      } finally {
        extractBtn.disabled = false;
        setTimeout(function () { extractProg.hide(); }, 800);
      }
    }

    /* ---------------- Step 3: 导出 ---------------- */

    var stripWrap = UI.el("div", { class: "mb14" });
    var strip = null;
    var colsSel = UI.selectRow(t("video.cols"), [1, 2, 4, 5, 6, 8, 10].map(function (v) { return { v: v, label: v }; }), 4, {});
    var delayIn = UI.el("input", { type: "number", value: "80", min: "20", step: "10", style: { width: "90px" } });
    var bgIn = UI.el("input", { type: "color", value: "#000000" });
    var sheetPreview = UI.el("div", {});
    var gifPreview = UI.el("div", {});
    var zipBtn = UI.btn(t("video.zip"), "btn-primary", exportZip, "download");
    var sheetBtn = UI.btn(t("video.mksheet"), "btn-ghost", buildSheet);
    var gifBtn = UI.btn(t("video.mkgif"), "btn-ghost", buildGif);
    var exportProg = UI.progress();

    var p3 = steps.panels[2];
    p3.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("video.pick")]));
    p3.appendChild(stripWrap);
    p3.appendChild(UI.el("div", { class: "mt14 btn-row" }, [zipBtn, sheetBtn, gifBtn]));
    p3.appendChild(UI.el("div", { class: "param-grid mt14" }, [
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("video.cols")]), colsSel.sel]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("video.delay")]), delayIn]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("video.bg")]), bgIn])
    ]));
    p3.appendChild(exportProg.el);
    p3.appendChild(sheetPreview);
    p3.appendChild(gifPreview);

    function activeFrames() {
      return state.frames.filter(function (_, i) { return !state.excluded[i]; });
    }

    function renderStrip() {
      stripWrap.innerHTML = "";
      var canvases = state.frames.map(function (f) {
        return UI.imageDataToCanvas(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h));
      });
      strip = UI.filmstrip(canvases, {
        selectable: true,
        onSelect: function (i) { state.excluded[i] = !state.excluded[i]; }
      });
      // 恢复排除状态
      state.excluded.forEach(function (ex, i) {
        if (ex) strip.el.children[i].classList.add("off");
      });
      stripWrap.appendChild(strip.el);
    }

    async function exportZip() {
      var frames = activeFrames();
      if (!frames.length) return;
      zipBtn.disabled = true;
      exportProg.show("");
      try {
        var cv = UI.makeCanvas(state.frameW, state.frameH);
        var ctx = cv.getContext("2d");
        var files = [];
        for (var i = 0; i < frames.length; i++) {
          ctx.putImageData(new ImageData(new Uint8ClampedArray(frames[i].data), state.frameW, state.frameH), 0, 0);
          var blob = await new Promise(function (r) { cv.toBlob(r, "image/png"); });
          files.push({ name: "frame_" + String(i + 1).padStart(4, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
          exportProg.set((i + 1) / frames.length, "PNG " + (i + 1) + "/" + frames.length);
        }
        UI.download(FF.Zip.make(files), "frames_" + frames.length + ".zip");
      } finally {
        zipBtn.disabled = false;
        setTimeout(function () { exportProg.hide(); }, 800);
      }
    }

    async function buildSheet() {
      var frames = activeFrames();
      if (!frames.length) return;
      sheetBtn.disabled = true;
      exportProg.show("");
      try {
        var cols = Number(colsSel.value);
        var out = await FF.Wasm.sheetAssemble(frames, state.frameW, state.frameH, cols);
        var im = new ImageData(new Uint8ClampedArray(out), state.frameW * cols, state.frameH * Math.ceil(frames.length / cols));
        sheetPreview.innerHTML = "";
        var cv = UI.imageDataToCanvas(im);
        sheetPreview.appendChild(UI.el("div", { class: "preview-box mt14" }, [
          UI.el("div", { class: "pb-title" }, ["Sprite Sheet"]),
          UI.canvasFrame(cv)
        ]));
        UI.downloadCanvas(cv, "sprite_sheet.png");
      } finally {
        sheetBtn.disabled = false;
        setTimeout(function () { exportProg.hide(); }, 800);
      }
    }

    async function buildGif() {
      var frames = activeFrames();
      if (!frames.length) return;
      gifBtn.disabled = true;
      exportProg.show("");
      try {
        var delay = Math.max(20, Number(delayIn.value) || 80);
        var bg = hex2rgb(bgIn.value);
        var out = await FF.Wasm.gifEncode(frames, state.frameW, state.frameH, {
          bg: bg, delay: delay, repeat: 1
        });
        var blob = new Blob([out], { type: "image/gif" });
        gifPreview.innerHTML = "";
        var img = new Image();
        img.src = URL.createObjectURL(blob);
        img.style.maxWidth = "100%";
        img.style.maxHeight = "300px";
        img.style.imageRendering = "pixelated";
        gifPreview.appendChild(UI.el("div", { class: "preview-box mt14" }, [
          UI.el("div", { class: "pb-title" }, ["GIF · " + fmtSize(blob.size)]),
          img
        ]));
        UI.download(blob, "animation.gif");
      } finally {
        gifBtn.disabled = false;
        setTimeout(function () { exportProg.hide(); }, 800);
      }
    }

    /* ---------------- 组装 ---------------- */

    steps.set(0);

    return {
      root: root,
      cleanup: function () { cleanupVideo(); }
    };
  };
})();
