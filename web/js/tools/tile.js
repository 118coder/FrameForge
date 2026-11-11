/* FrameForge · 瓦片调整（RoninTile 简化版：tileset 载入 / 图章绘制 / 地图导出） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.tile = function () {
    var sk = UI.pageSkeleton("mod.tile.t", "mod.tile.d", null);
    var root = sk.root, card = sk.card;

    var tilesetSize = 32;   // tileset 单块尺寸
    var mapCols = 16, mapRows = 12;
    var selTile = { x: 0, y: 0 }; // tileset 中选中块（格坐标）
    var tool = "stamp";           // stamp | erase
    var tilesetCanvas = null, tilesetIm = null;

    /* ---------- 地图画布 ---------- */

    var mapCanvas = UI.makeCanvas(mapCols * tilesetSize, mapRows * tilesetSize);
    mapCanvas.style.width = "100%";
    mapCanvas.style.maxHeight = "520px";
    mapCanvas.style.imageRendering = "pixelated";
    var mapFrame = UI.el("div", { class: "canvas-frame", style: { display: "block" } }, [mapCanvas]);
    var ctx = mapCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    /* ---------- tileset 面板 ---------- */

    var tsFrame = UI.el("div", { class: "canvas-frame", style: { display: "block", maxHeight: "300px", overflow: "auto" } }, []);
    var tsHint = UI.el("div", { class: "hint-text mt8" }, [t("tile.hint.pick")]);

    var dz = UI.dropzone({
      accept: "image/*",
      main: t("tile.drop"),
      hint: t("chroma.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          tilesetIm = UI.imageDataFrom(r.img, 2048);
          r.release();
          buildTilesetPanel();
        });
      }
    });

    function buildTilesetPanel() {
      tsFrame.innerHTML = "";
      tilesetCanvas = UI.imageDataToCanvas(tilesetIm);
      tilesetCanvas.style.imageRendering = "pixelated";
      tilesetCanvas.style.maxWidth = "100%";
      tsFrame.appendChild(tilesetCanvas);
      var cols = Math.floor(tilesetIm.width / tilesetSize);
      var rows = Math.floor(tilesetIm.height / tilesetSize);
      function pick(e) {
        var r2 = tilesetCanvas.getBoundingClientRect();
        var gx = Math.floor((e.clientX - r2.left) / r2.width * tilesetIm.width / tilesetSize);
        var gy = Math.floor((e.clientY - r2.top) / r2.height * tilesetIm.height / tilesetSize);
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return;
        selTile = { x: gx, y: gy };
        drawSel();
      }
      function drawSel() {
        // 重绘高亮框
        buildTilesetPanel.__highlight = selTile;
        var c = tilesetCanvas.getContext("2d");
        // 重画原图再叠加选框
        c.clearRect(0, 0, tilesetCanvas.width, tilesetCanvas.height);
        c.drawImage(UI.imageDataToCanvas(tilesetIm), 0, 0);
        c.strokeStyle = "#e8b04b";
        c.lineWidth = 2;
        c.strokeRect(selTile.x * tilesetSize + 1, selTile.y * tilesetSize + 1, tilesetSize - 2, tilesetSize - 2);
      }
      tilesetCanvas.addEventListener("click", function (e) { pick(e); drawSel(); });
      drawSel();
      tsHint.textContent = cols + "×" + rows + " " + t("tile.blocks") + " · " + tilesetSize + "px";
    }

    /* ---------- 地图交互 ---------- */

    var painting = false;
    function mapPos(e) {
      var r2 = mapCanvas.getBoundingClientRect();
      return {
        x: Math.floor((e.clientX - r2.left) / r2.width * mapCols),
        y: Math.floor((e.clientY - r2.top) / r2.height * mapRows)
      };
    }

    function stamp(gx, gy) {
      if (!tilesetIm) return;
      if (tool === "erase") {
        ctx.clearRect(gx * tilesetSize, gy * tilesetSize, tilesetSize, tilesetSize);
        return;
      }
      var sx = selTile.x * tilesetSize, sy = selTile.y * tilesetSize;
      ctx.drawImage(UI.imageDataToCanvas(tilesetIm), sx, sy, tilesetSize, tilesetSize,
        gx * tilesetSize, gy * tilesetSize, tilesetSize, tilesetSize);
    }

    mapCanvas.addEventListener("pointerdown", function (e) {
      var p = mapPos(e);
      if (p.x < 0 || p.y < 0 || p.x >= mapCols || p.y >= mapRows) return;
      painting = true;
      mapCanvas.setPointerCapture(e.pointerId);
      stamp(p.x, p.y);
    });
    mapCanvas.addEventListener("pointermove", function (e) {
      if (!painting) return;
      var p = mapPos(e);
      if (p.x >= 0 && p.y >= 0 && p.x < mapCols && p.y < mapRows) stamp(p.x, p.y);
    });
    mapCanvas.addEventListener("pointerup", function () { painting = false; });

    /* ---------- 控件 ---------- */

    var toolRow = UI.el("div", { class: "row", style: { gap: "6px" } }, []);
    function setTool(name) {
      tool = name;
      Array.from(toolRow.children).forEach(function (b) {
        b.className = "btn btn-sm " + (b.dataset.tool === tool ? "btn-primary" : "btn-ghost");
      });
    }
    [["stamp", "tile.stamp"], ["erase", "tile.erase"]].forEach(function (pair) {
      var b = UI.btn(t(pair[1]), "btn-ghost btn-sm", function () { setTool(pair[0]); });
      b.dataset.tool = pair[0];
      toolRow.appendChild(b);
    });

    var tsSize = UI.selectRow(t("tile.size"), [16, 24, 32, 48, 64].map(function (v) {
      return { v: v, label: v + "px" };
    }), 32, { onChange: function () {
      tilesetSize = Number(tsSize.value);
      if (tilesetIm) buildTilesetPanel();
      resizeMap();
    } });
    var mapColsIn = UI.el("input", { type: "number", value: mapCols, min: "2", max: "128", style: { width: "70px" } });
    var mapRowsIn = UI.el("input", { type: "number", value: mapRows, min: "2", max: "128", style: { width: "70px" } });
    var resizeBtn = UI.btn("✓", "btn-ghost btn-sm", function () {
      mapCols = Math.max(2, Math.min(128, Number(mapColsIn.value) || mapCols));
      mapRows = Math.max(2, Math.min(128, Number(mapRowsIn.value) || mapRows));
      resizeMap();
    });
    var clearBtn = UI.btn(t("map.clear"), "btn-ghost btn-sm", function () {
      ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    });
    var exportBtn = UI.btn(t("map.export"), "btn-primary", function () {
      UI.downloadCanvas(mapCanvas, "tilemap_" + mapCols + "x" + mapRows + ".png");
    }, "download");

    function resizeMap() {
      var old = UI.makeCanvas(mapCanvas.width, mapCanvas.height);
      old.getContext("2d").drawImage(mapCanvas, 0, 0);
      mapCanvas.width = mapCols * tilesetSize;
      mapCanvas.height = mapRows * tilesetSize;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(old, 0, 0);
    }

    /* ---------- 布局 ---------- */

    var layout = UI.el("div", {}, [
      dz,
      UI.el("div", { class: "preview-wrap mt14", style: { gridTemplateColumns: "1fr 320px" } }, [
        UI.el("div", { class: "preview-box" }, [
          UI.el("div", { class: "pb-title" }, [t("tile.map")]),
          mapFrame
        ]),
        UI.el("div", { class: "preview-box" }, [
          UI.el("div", { class: "pb-title" }, [t("tile.tileset")]),
          tsFrame,
          tsHint,
          UI.el("div", { class: "mt8" }, [toolRow])
        ])
      ]),
      UI.el("div", { class: "param-grid mt14" }, [
        tsSize.el,
        UI.el("div", { class: "param-row" }, [
          UI.el("label", {}, [t("tile.mapsize")]),
          UI.el("div", { class: "row" }, [mapColsIn, UI.el("span", { class: "hint-text" }, ["×"]), mapRowsIn, resizeBtn])
        ])
      ]),
      UI.el("div", { class: "btn-row mt14" }, [clearBtn, exportBtn])
    ]);

    card.appendChild(layout);

    return { root: root };
  };
})();
