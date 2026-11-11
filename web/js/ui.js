/* FrameForge · 共享 UI 组件 */
(function () {
  "use strict";

  var FF = window.FF;

  /* ---------- DOM 构建 ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === "class") node.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      if (typeof c === "string" || typeof c === "number" || typeof c === "boolean") {
        node.appendChild(document.createTextNode(String(c)));
      } else {
        node.appendChild(c);
      }
    });
    return node;
  }

  /* ---------- 图标库（锈红线条风 SVG） ---------- */

  var ICONS = {
    video: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="12" width="26" height="24" rx="3"/><path d="M30 21l13-7v20l-13-7"/></svg>',
    map: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44s14-12.5 14-24A14 14 0 0 0 10 20c0 11.5 14 24 14 24z"/><circle cx="24" cy="19" r="5"/></svg>',
    scissors: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="36" r="6"/><circle cx="36" cy="36" r="6"/><path d="M16 31.5L38 8M32 31.5L10 8"/></svg>',
    grid: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="36" height="36" rx="3"/><path d="M6 18h36M6 30h36M18 6v36M30 6v36"/></svg>',
    film: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="10" width="36" height="28" rx="3"/><path d="M14 10v28M34 10v28M6 20h8M6 28h8M34 20h8M34 28h8"/></svg>',
    pixel: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="14" height="14"/><rect x="26" y="8" width="14" height="14"/><rect x="8" y="26" width="14" height="14"/><rect x="26" y="26" width="14" height="14" fill="currentColor"/></svg>',
    layers: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6L44 17 24 28 4 17z"/><path d="M44 27L24 38 4 27"/></svg>',
    tile: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="16" height="16"/><rect x="26" y="6" width="16" height="16"/><rect x="6" y="26" width="16" height="16"/><rect x="26" y="26" width="16" height="16" stroke-dasharray="4 3"/></svg>',
    ps: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="36" height="36" rx="4"/><path d="M15 33V15h6a5 5 0 0 1 0 10h-6M30 33v-9m0 0a4 4 0 0 1 8 0v9" stroke-width="2.2"/></svg>',
    hd2d: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 4l18 10v20L24 44 6 34V14z"/><path d="M24 24l18-10M24 24v20M24 24L6 14"/></svg>',
    ai: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6l4.2 8.8 9.8 1.4-7 6.8 1.6 9.6L24 28l-8.6 4.6 1.6-9.6-7-6.8 9.8-1.4z"/><path d="M10 36l-2 6M38 36l2 6M24 34v8" stroke-dasharray="2 4"/></svg>',
    upload: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 30v8a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3v-8M24 6v26M14 20l10-10 10 10"/></svg>',
    back: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 2.5l9 5.5-9 5.5z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/></svg>'
  };

  function icon(name) {
    var d = el("div");
    d.innerHTML = ICONS[name] || "";
    return d.firstElementChild;
  }

  /* ---------- 步骤条 + 分步面板 ---------- */

  function stepBar(keys) {
    // keys: ["video.s1","video.s2","video.s3"]
    var bar = el("div", { class: "stepbar" });
    var panels = [];
    var steps = [];
    keys.forEach(function (k, i) {
      if (i > 0) bar.appendChild(el("div", { class: "step-line" }));
      var st = el("div", { class: "step" }, [
        el("div", { class: "n" }, [String(i + 1)]),
        el("span", {}, [FF.I18N.t(k)])
      ]);
      bar.appendChild(st);
      steps.push(st);
      var panel = el("div", { class: "step-panel" });
      panels.push(panel);
    });
    var cur = -1;
    function set(n) {
      steps.forEach(function (s, i) { s.classList.toggle("active", i <= n); });
      panels.forEach(function (p, i) { p.classList.toggle("active", i === n); });
      cur = n;
    }
    set(0);
    return { el: bar, panels: panels, set: set, get current() { return cur; } };
  }

  /* ---------- 上传区 ---------- */

  function dropzone(opts) {
    // opts: {accept, hint, multiple, onFiles(files), height}
    var input = el("input", { type: "file", accept: opts.accept || "", style: { display: "none" } });
    if (opts.multiple) input.multiple = true;
    var zone = el("div", { class: "dropzone" }, [
      icon("upload"),
      el("div", { class: "dz-main" }, [opts.main || FF.I18N.t("common.upload.here")]),
      opts.hint ? el("div", { class: "dz-hint" }, [opts.hint]) : null,
      input
    ]);
    if (opts.height) zone.style.minHeight = opts.height;
    zone.addEventListener("click", function () { input.click(); });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("over"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("over");
      if (e.dataTransfer.files.length) opts.onFiles(Array.from(e.dataTransfer.files));
    });
    input.addEventListener("change", function () {
      if (input.files.length) opts.onFiles(Array.from(input.files));
      input.value = "";
    });
    return zone;
  }

  /* ---------- 控件 ---------- */

  function slider(label, min, max, val, opts) {
    opts = opts || {};
    var valSpan = el("span", { class: "val" }, [String(val)]);
    var input = el("input", { type: "range", min: min, max: max, value: val, step: opts.step || 1 });
    var row = el("div", { class: "param-row" }, [
      el("label", {}, [label, valSpan]),
      input
    ]);
    input.addEventListener("input", function () {
      valSpan.textContent = input.value;
      if (opts.onInput) opts.onInput(Number(input.value));
    });
    return {
      el: row,
      input: input,
      get value() { return Number(input.value); },
      set: function (v) { input.value = v; valSpan.textContent = String(v); }
    };
  }

  function selectRow(label, options, val, opts) {
    opts = opts || {};
    var sel = el("select", {});
    options.forEach(function (o) {
      var opt = el("option", { value: o.v }, [o.label]);
      if (String(o.v) === String(val)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { if (opts.onChange) opts.onChange(sel.value); });
    var row = el("div", { class: "param-row" }, [el("label", {}, [label]), sel]);
    return { el: row, sel: sel, get value() { return sel.value; } };
  }

  function switchRow(label, checked, onChange) {
    var input = el("input", { type: "checkbox" });
    input.checked = !!checked;
    input.addEventListener("change", function () { onChange(input.checked); });
    var row = el("label", { class: "checkline" }, [
      el("span", { class: "switch" }, [input, el("span", { class: "track" })]),
      el("span", {}, [label])
    ]);
    return { el: row, input: input, get value() { return input.checked; } };
  }

  function colorRow(label, value, onChange) {
    var input = el("input", { type: "color", value: value });
    input.addEventListener("input", function () { onChange(input.value); });
    return el("div", { class: "param-row" }, [el("label", {}, [label]), input]);
  }

  function progress() {
    var bar = el("div", { class: "progress" }, [el("div")]);
    var lab = el("div", { class: "progress-label" }, [""]);
    var wrap = el("div", { style: { display: "none" } }, [bar, lab]);
    var api = {
      el: wrap,
      show: function (txt) { wrap.style.display = "block"; lab.textContent = txt || ""; api.set(0); },
      hide: function () { wrap.style.display = "none"; },
      set: function (frac, txt) {
        bar.firstElementChild.style.width = (frac * 100).toFixed(1) + "%";
        if (txt !== undefined) lab.textContent = txt;
      }
    };
    return api;
  }

  /* ---------- 按钮 ---------- */

  function btn(label, cls, onClick, iconName) {
    var b = el("button", { class: "btn " + (cls || "btn-ghost") }, [
      iconName ? icon(iconName) : null,
      el("span", {}, [label])
    ]);
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  /* ---------- 画布工具 ---------- */

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function imageDataToCanvas(im) {
    var c = makeCanvas(im.width, im.height);
    c.getContext("2d").putImageData(im, 0, 0);
    return c;
  }

  function fileToImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () { resolve({ img: img, w: img.naturalWidth, h: img.naturalHeight, release: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("图片解码失败")); };
      img.src = url;
    });
  }

  function imageDataFrom(img, maxW) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var scale = maxW && w > maxW ? maxW / w : 1;
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var c = makeCanvas(cw, ch);
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, cw, ch);
    return ctx.getImageData(0, 0, cw, ch);
  }

  function canvasFrame(canvas, note) {
    var f = el("div", { class: "canvas-frame zoomable" }, [canvas]);
    // 尺寸标注（左下角）
    var w = canvas.width || (canvas.naturalWidth || 0);
    var h = canvas.height || (canvas.naturalHeight || 0);
    if (w && h) {
      f.appendChild(el("div", { class: "frame-note size-note" }, [w + "×" + h]));
    }
    if (note) f.appendChild(el("div", { class: "frame-note" }, [note]));
    // 点击放大灯箱
    f.addEventListener("dblclick", function () { lightbox(canvas, note || (w ? w + "×" + h : "")); });
    return f;
  }

  /** 全局灯箱：点击放大查看图片/画布 */
  function lightbox(source, note) {
    var mask = el("div", { class: "lightbox" });
    var img;
    if (source instanceof HTMLCanvasElement) {
      img = el("img");
      img.src = source.toDataURL("image/png");
    } else if (source instanceof HTMLImageElement) {
      img = el("img");
      img.src = source.src;
    } else {
      img = el("img");
      img.src = String(source);
    }
    mask.appendChild(img);
    if (note) mask.appendChild(el("div", { class: "lb-note" }, [note]));
    mask.addEventListener("click", function () { mask.remove(); });
    document.body.appendChild(mask);
    function onKey(e) {
      if (e.key === "Escape") { mask.remove(); document.removeEventListener("keydown", onKey); }
    }
    document.addEventListener("keydown", onKey);
  }

  /* ---------- 对比查看器 ---------- */

  function compare(beforeCanvas, afterCanvas) {
    var box = el("div", { class: "canvas-frame compare", style: { position: "relative" } });
    var bWrap = el("div", { class: "layer-b" });
    box.appendChild(beforeCanvas);
    box.appendChild(bWrap);
    bWrap.appendChild(afterCanvas);
    afterCanvas.style.position = "absolute";
    afterCanvas.style.top = "0";
    afterCanvas.style.left = "0";
    afterCanvas.style.maxWidth = "none";
    var handle = el("div", { class: "compare-handle", style: { left: "50%" } });
    box.appendChild(handle);
    function setPos(x) {
      var r = box.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (x - r.left) / r.width));
      handle.style.left = (p * 100) + "%";
      bWrap.style.clipPath = "inset(0 0 0 " + (p * 100) + "%)";
    }
    var dragging = false;
    box.addEventListener("pointerdown", function (e) { dragging = true; setPos(e.clientX); });
    window.addEventListener("pointermove", function (e) { if (dragging) setPos(e.clientX); });
    window.addEventListener("pointerup", function () { dragging = false; });
    requestAnimationFrame(function () { setPos(box.getBoundingClientRect().left + box.getBoundingClientRect().width / 2); });
    return box;
  }

  /* ---------- 胶片缩略条 ---------- */

  function filmstrip(canvases, opts) {
    // opts: {selectable, reorderable, onDelete(i), onSelect(i, selected), delayEditable, onDelay(i, ms)}
    opts = opts || {};
    var strip = el("div", { class: "filmstrip" });
    var items = [];
    var selected = canvases.map(function () { return true; });

    function rebuild() {
      strip.innerHTML = "";
      items.length = 0;
      canvases.forEach(function (cv, i) {
        var t = el("div", { class: "thumb", draggable: opts.reorderable ? "true" : "false" }, [
          cv, el("div", { class: "t-idx" }, [String(i + 1)])
        ]);
        if (opts.delayEditable) {
          var d = el("input", { class: "t-delay", type: "number", value: (canvases[i]._delay || 80) });
          d.title = "ms";
          d.addEventListener("change", function () {
            canvases[i]._delay = Math.max(20, Number(d.value) || 80);
            if (opts.onDelay) opts.onDelay(i, canvases[i]._delay);
          });
          d.addEventListener("click", function (e) { e.stopPropagation(); });
          t.appendChild(d);
        }
        t.addEventListener("click", function () {
          if (opts.selectable) {
            selected[i] = !selected[i];
            t.classList.toggle("off", !selected[i]);
            if (opts.onSelect) opts.onSelect(i, selected[i]);
          }
        });
        t.addEventListener("dblclick", function (e) {
          if (opts.onDelete) { e.stopPropagation(); opts.onDelete(i); }
        });
        if (opts.reorderable) {
          t.addEventListener("dragstart", function (e) {
            t.classList.add("dragging");
            e.dataTransfer.setData("text/plain", String(i));
            e.dataTransfer.effectAllowed = "move";
          });
          t.addEventListener("dragend", function () { t.classList.remove("dragging"); });
          t.addEventListener("dragover", function (e) { e.preventDefault(); });
          t.addEventListener("drop", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var from = Number(e.dataTransfer.getData("text/plain"));
            if (!isNaN(from) && from !== i) {
              var moved = canvases.splice(from, 1)[0];
              canvases.splice(i, 0, moved);
              if (opts.onReorder) opts.onReorder(from, i);
              rebuild();
            }
          });
        }
        strip.appendChild(t);
        items.push(t);
      });
    }
    rebuild();
    return {
      el: strip,
      get selected() { return selected; },
      rebuild: rebuild,
      selectAll: function (v) { selected = selected.map(function () { return v; }); rebuild(); }
    };
  }

  /* ---------- 下载 ---------- */

  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 800);
    if (window.FF && FF.Toast) FF.Toast.show("⬇ " + name, "ok");
  }

  function downloadCanvas(canvas, name) {
    canvas.toBlob(function (b) { download(b, name); }, "image/png");
  }

  /* ---------- 弹窗 ---------- */

  function modal(title, contentEl) {
    var mask = el("div", { class: "modal-mask" });
    var box = el("div", { class: "modal" }, [
      el("div", { class: "modal-head" }, [
        el("span", {}, [title]),
        el("button", { class: "modal-close" }, ["×"])
      ]),
      el("div", { class: "modal-body" }, [contentEl])
    ]);
    mask.appendChild(box);
    function close() { mask.remove(); }
    box.querySelector(".modal-close").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    document.getElementById("modalRoot").appendChild(mask);
    return close;
  }

  /* ---------- 工具页骨架 ---------- */

  function pageSkeleton(titleKey, descKey, steps) {
    var back = el("button", { class: "page-back" }, [
      icon("back"), el("span", {}, [FF.I18N.t("common.back")])
    ]);
    back.addEventListener("click", function () { location.hash = "#/"; });
    var sb = steps ? stepBar(steps) : null;
    var card = el("div", { class: "page-card" }, [
      back,
      el("div", { class: "page-title" }, [FF.I18N.t(titleKey)]),
      descKey ? el("div", { class: "page-desc" }, [FF.I18N.t(descKey)]) : null,
      sb ? sb.el : null
    ]);
    if (sb) sb.panels.forEach(function (p) { card.appendChild(p); });
    var root = el("div", {}, [card]);
    return { root: root, card: card, steps: sb };
  }

  window.FF.UI = {
    el: el, icon: icon, stepBar: stepBar, dropzone: dropzone,
    slider: slider, selectRow: selectRow, switchRow: switchRow, colorRow: colorRow,
    progress: progress, btn: btn,
    makeCanvas: makeCanvas, imageDataToCanvas: imageDataToCanvas,
    fileToImage: fileToImage, imageDataFrom: imageDataFrom,
    canvasFrame: canvasFrame, compare: compare, filmstrip: filmstrip,
    download: download, downloadCanvas: downloadCanvas, modal: modal,
    pageSkeleton: pageSkeleton, lightbox: lightbox
  };
})();
