/* FrameForge · 智能图层合成 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.layers = function () {
    var sk = UI.pageSkeleton("mod.layers.t", "mod.layers.d", null);
    var root = sk.root, card = sk.card;

    var CW = 640, CH = 480;
    var layers = []; // 自底向上: {name, canvas(native w/h), x, y, opacity, blend, visible}
    var selIdx = -1;

    /* ---------- 画布区 ---------- */
    var view = UI.el("div", { class: "canvas-frame", style: { height: "480px", cursor: "move" } });
    var canvas = UI.makeCanvas(CW, CH);
    canvas.style.maxHeight = "none";
    canvas.style.height = "100%";
    view.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    /* ---------- 图层面板 ---------- */
    var layerList = UI.el("div", { style: { display: "flex", flexDirection: "column", gap: "6px", minWidth: "240px" } });
    var nameIn = UI.el("input", { type: "text", style: { width: "130px" }, placeholder: "图层名" });
    var opacity = UI.slider(t("layers.opacity"), 0, 100, 100, { onInput: function (v) { if (selIdx >= 0) { layers[selIdx].opacity = v / 100; render(); } } });
    var blend = UI.selectRow(t("layers.blend"), [
      { v: "source-over", label: t("layers.blend.normal") },
      { v: "multiply", label: t("layers.blend.multiply") },
      { v: "screen", label: t("layers.blend.screen") },
      { v: "overlay", label: t("layers.blend.overlay") },
      { v: "darken", label: t("layers.blend.darken") },
      { v: "lighten", label: t("layers.blend.lighten") },
      { v: "difference", label: t("layers.blend.difference") }
    ], "source-over", { onChange: function (v) { if (selIdx >= 0) { layers[selIdx].blend = v; render(); } } });

    var addImgBtn = UI.btn(t("layers.addimg"), "btn-ghost btn-sm", function () { fileInput.click(); });
    var fileInput = UI.el("input", { type: "file", accept: "image/*", multiple: "multiple", style: { display: "none" } });
    fileInput.addEventListener("change", function () {
      if (fileInput.files.length) addImages(Array.from(fileInput.files));
      fileInput.value = "";
    });
    var solidColor = UI.el("input", { type: "color", value: "#ffffff" });
    var addSolidBtn = UI.btn(t("layers.addsolid"), "btn-ghost btn-sm", function () {
      var c = UI.makeCanvas(CW, CH);
      var c2 = c.getContext("2d");
      c2.fillStyle = solidColor.value;
      c2.fillRect(0, 0, CW, CH);
      pushLayer(c, t("layers.addsolid"));
    });
    var wIn = UI.el("input", { type: "number", value: CW, min: "16", max: "4096", style: { width: "80px" } });
    var hIn = UI.el("input", { type: "number", value: CH, min: "16", max: "4096", style: { width: "80px" } });
    var applySizeBtn = UI.btn("✓", "btn-ghost btn-sm", function () {
      CW = Math.max(16, Math.min(4096, Number(wIn.value) || CW));
      CH = Math.max(16, Math.min(4096, Number(hIn.value) || CH));
      canvas.width = CW; canvas.height = CH;
      view.style.height = Math.min(480, CH) + "px";
      render();
    });

    var upBtn = UI.btn(t("layers.up"), "btn-ghost btn-sm", function () {
      if (selIdx >= 0 && selIdx < layers.length - 1) {
        var m = layers.splice(selIdx, 1)[0];
        layers.splice(selIdx + 1, 0, m);
        selIdx++;
        renderList(); render();
      }
    });
    var downBtn = UI.btn(t("layers.down"), "btn-ghost btn-sm", function () {
      if (selIdx > 0) {
        var m = layers.splice(selIdx, 1)[0];
        layers.splice(selIdx - 1, 0, m);
        selIdx--;
        renderList(); render();
      }
    });
    var delBtn = UI.btn(t("layers.del"), "btn-ghost btn-sm", function () {
      if (selIdx >= 0) {
        layers.splice(selIdx, 1);
        selIdx = layers.length - 1;
        renderList(); render();
      }
    });
    var exportBtn = UI.btn(t("common.download") + " PNG", "btn-primary", function () {
      var out = UI.makeCanvas(CW, CH);
      composite(out.getContext("2d"));
      UI.downloadCanvas(out, "composition.png");
    }, "download");

    function pushLayer(canvasNative, name) {
      layers.push({
        name: name || "Layer " + (layers.length + 1),
        canvas: canvasNative,
        x: Math.round((CW - canvasNative.width) / 2),
        y: Math.round((CH - canvasNative.height) / 2),
        opacity: 1, blend: "source-over", visible: true
      });
      selIdx = layers.length - 1;
      renderList(); render();
    }

    function addImages(files) {
      var jobs = Array.from(files).map(function (f) { return UI.fileToImage(f); });
      Promise.all(jobs).then(function (rs) {
        rs.forEach(function (r) {
          var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
          c.getContext("2d").drawImage(r.img, 0, 0);
          pushLayer(c);
          r.release();
        });
      });
    }

    function composite(c) {
      c.clearRect(0, 0, CW, CH);
      layers.forEach(function (L) {
        if (!L.visible) return;
        c.globalAlpha = L.opacity;
        c.globalCompositeOperation = L.blend;
        c.drawImage(L.canvas, L.x, L.y);
      });
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }

    function render() { composite(ctx); renderListSel(); }

    function renderList() {
      layerList.innerHTML = "";
      // 顶部图层显示在列表上方
      for (var i = layers.length - 1; i >= 0; i--) {
        (function (idx) {
          var L = layers[idx];
          var eye = UI.el("button", { class: "btn-ghost btn-sm", style: { border: "none", background: "transparent" } }, [L.visible ? "👁" : "🚫"]);
          eye.style.opacity = L.visible ? 1 : .5;
          eye.addEventListener("click", function () { L.visible = !L.visible; renderList(); render(); });
          var item = UI.el("div", {
            class: "checkline",
            style: {
              border: "1.5px solid " + (idx === selIdx ? "var(--accent)" : "var(--card-border)"),
              borderRadius: "8px", padding: "6px 10px", background: "var(--card-bg2)",
              cursor: "pointer", gap: "8px"
            }
          }, [
            eye,
            UI.el("span", { style: { flex: "1", fontSize: "12.5px", fontWeight: "700" } }, [L.name]),
            UI.el("span", { class: "hint-text", style: { fontSize: "10.5px" } }, [L.canvas.width + "×" + L.canvas.height])
          ]);
          item.addEventListener("click", function (e) {
            if (e.target === eye || eye.contains(e.target)) return;
            selIdx = idx;
            opacity.set(Math.round(L.opacity * 100));
            blend.sel.value = L.blend;
            renderList();
          });
          layerList.appendChild(item);
        })(i);
      }
      renderListSel();
    }

    function renderListSel() {
      if (selIdx >= layers.length) selIdx = layers.length - 1;
      if (selIdx >= 0) {
        opacity.set(Math.round(layers[selIdx].opacity * 100));
        blend.sel.value = layers[selIdx].blend;
      }
    }

    /* ---------- 画布拖拽 ---------- */

    var dragging = false, dragOff = { x: 0, y: 0 };
    function canvasPos(e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width * CW,
        y: (e.clientY - r.top) / r.height * CH
      };
    }
    view.addEventListener("pointerdown", function (e) {
      var p = canvasPos(e);
      // 自顶向下命中
      for (var i = layers.length - 1; i >= 0; i--) {
        var L = layers[i];
        if (!L.visible) continue;
        if (p.x >= L.x && p.x < L.x + L.canvas.width && p.y >= L.y && p.y < L.y + L.canvas.height) {
          selIdx = i;
          dragging = true;
          dragOff = { x: p.x - L.x, y: p.y - L.y };
          view.setPointerCapture(e.pointerId);
          renderList();
          return;
        }
      }
    });
    view.addEventListener("pointermove", function (e) {
      if (!dragging || selIdx < 0) return;
      var p = canvasPos(e);
      var L = layers[selIdx];
      L.x = Math.round(p.x - dragOff.x);
      L.y = Math.round(p.y - dragOff.y);
      render();
    });
    view.addEventListener("pointerup", function () { dragging = false; });

    /* ---------- 布局 ---------- */

    var layout = UI.el("div", { class: "preview-wrap", style: { gridTemplateColumns: "1fr 300px" } }, [
      view,
      UI.el("div", { class: "preview-box" }, [
        UI.el("div", { class: "row", style: { marginBottom: "8px" } }, [addImgBtn, fileInput, addSolidBtn, solidColor]),
        UI.el("div", { class: "hint-text mb8" }, [t("layers.drag")]),
        layerList,
        UI.el("div", { class: "row mt8", style: { gap: "6px" } }, [upBtn, downBtn, delBtn]),
        UI.el("hr", { class: "divider" }),
        UI.el("div", { class: "param-grid", style: { gridTemplateColumns: "1fr" } }, [
          UI.el("div", { class: "param-row" }, [
            UI.el("label", {}, [t("layers.size")]),
            UI.el("div", { class: "row" }, [wIn, UI.el("span", { class: "hint-text" }, ["×"]), hIn, applySizeBtn])
          ]),
          opacity.el, blend.el
        ]),
        UI.el("div", { class: "mt14" }, [exportBtn])
      ])
    ]);

    var emptyHint = UI.el("div", { class: "hint-text", style: { textAlign: "center", padding: "40px 0" } }, [t("layers.empty")]);
    layerList.appendChild(emptyHint);

    var _renderList = renderList;
    renderList = function () {
      if (layers.length && emptyHint.parentNode) emptyHint.remove();
      if (!layers.length && !emptyHint.parentNode) layerList.appendChild(emptyHint);
      _renderList();
    };

    card.appendChild(layout);

    // 默认铺一个底色图层方便上手
    (function () {
      var c = UI.makeCanvas(CW, CH);
      var c2 = c.getContext("2d");
      var g = c2.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, "#2b3550");
      g.addColorStop(1, "#4a3527");
      c2.fillStyle = g;
      c2.fillRect(0, 0, CW, CH);
      pushLayer(c, "背景");
      selIdx = -1;
      renderList();
      render();
    })();

    return { root: root };
  };
})();
