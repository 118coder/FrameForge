/* FrameForge · 节点式工作流蓝图（对齐 V5「自定义流程蓝图」）
 * 图片从「输入」节点沿连线流过各处理节点，到「输出」节点。
 * 蓝图可保存/加载/导出 JSON，内置 RPGMakerVX 等预设管线。
 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  /* ================= 节点注册表 ================= */

  function hex2rgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  var NODE_DEFS = {
    input: {
      title: "输入图片", color: "#4a7c59",
      params: [],
      hasImage: true
    },
    chromaKey: {
      title: "色键去背", color: "#b64a2e",
      params: [
        { k: "mode", label: "类型", type: "select", options: [[0, "绿幕"], [1, "蓝幕"], [3, "自定义"]], def: 0 },
        { k: "tol", label: "容差", type: "range", min: 0, max: 100, def: 35 },
        { k: "feather", label: "羽化", type: "range", min: 0, max: 100, def: 25 },
        { k: "suppress", label: "抑色", type: "range", min: 0, max: 100, def: 60 },
        { k: "c1", label: "自定义色", type: "color", def: "#00ff00" }
      ]
    },
    matteContiguous: {
      title: "左上角连通域抠图", color: "#b64a2e",
      params: [
        { k: "tol", label: "容差", type: "range", min: 0, max: 150, def: 80 },
        { k: "feather", label: "羽化", type: "range", min: 0, max: 100, def: 5 }
      ]
    },
    pixelate: {
      title: "像素块化", color: "#8a6f2b",
      params: [{ k: "block", label: "块大小", type: "range", min: 2, max: 32, def: 8 }]
    },
    quantize: {
      title: "调色板量化", color: "#8a6f2b",
      params: [
        { k: "k", label: "颜色数", type: "range", min: 2, max: 64, def: 16 },
        { k: "cs", label: "距离算法", type: "select", options: [[0, "RGB"], [1, "LAB（推荐）"]], def: 1 },
        { k: "dither", label: "抖动", type: "select", options: [[0, "关"], [1, "Floyd-Steinberg"]], def: 0 }
      ]
    },
    mergeNear: {
      title: "合并临近色 (LAB)", color: "#8a6f2b",
      params: [{ k: "strength", label: "合并强度", type: "range", min: 1, max: 100, def: 30 }]
    },
    adjust: {
      title: "色彩调整", color: "#2b6f8a",
      params: [
        { k: "sat", label: "饱和度 %", type: "range", min: 0, max: 200, def: 100 },
        { k: "con", label: "对比度 %", type: "range", min: 0, max: 200, def: 100 },
        { k: "bri", label: "亮度", type: "range", min: -100, max: 100, def: 0 }
      ]
    },
    outline: {
      title: "内描边", color: "#2b6f8a",
      params: [
        { k: "color", label: "颜色", type: "color", def: "#1a1a1a" },
        { k: "radius", label: "粗细", type: "range", min: 1, max: 3, def: 1 }
      ]
    },
    resize: {
      title: "硬缩放", color: "#7a4a8a",
      params: [
        { k: "size", label: "目标边长 px（0=不变）", type: "number", def: 128 }
      ]
    },
    cropEdge: {
      title: "四边裁边", color: "#7a4a8a",
      params: [{ k: "px", label: "每边裁切 px", type: "number", def: 4 }]
    },
    gridOps: {
      title: "网格删列/行", color: "#7a4a8a",
      params: [
        { k: "cols", label: "网格列", type: "number", def: 4 },
        { k: "rows", label: "网格行", type: "number", def: 4 },
        { k: "delCol", label: "删除列序号（-1=不删）", type: "number", def: -1 },
        { k: "delRow", label: "删除行序号（-1=不删）", type: "number", def: -1 }
      ]
    },
    /* ===== 原站 v5 workflow 节点扩充（默认参数与主包 I9 节点表对齐） ===== */
    crop: {
      title: "四边裁切", color: "#7a4a8a",
      params: [
        { k: "left", label: "左", type: "number", def: 0 },
        { k: "top", label: "上", type: "number", def: 0 },
        { k: "right", label: "右", type: "number", def: 0 },
        { k: "bottom", label: "下", type: "number", def: 0 }
      ]
    },
    padExpand: {
      title: "四边扩透明", color: "#7a4a8a",
      params: [
        { k: "padTop", label: "上", type: "number", def: 0 },
        { k: "padRight", label: "右", type: "number", def: 0 },
        { k: "padBottom", label: "下", type: "number", def: 0 },
        { k: "padLeft", label: "左", type: "number", def: 0 }
      ]
    },
    matteGlobal: {
      title: "全图色键（左上取色）", color: "#b64a2e",
      params: [
        { k: "tolerance", label: "容差", type: "range", min: 0, max: 150, def: 80 },
        { k: "feather", label: "羽化", type: "range", min: 0, max: 100, def: 5 }
      ]
    },
    mattePostRepair: {
      title: "去背修复（自合成+清底）", color: "#b64a2e",
      params: []
    },
    alphaFrontierErode: {
      title: "贴边 alpha 削减", color: "#b64a2e",
      params: [{ k: "erosion", label: "削减量 (0-100)", type: "range", min: 0, max: 100, def: 0 }]
    },
    conditionalSuperEraser: {
      title: "条件超级橡皮（种子色匹配才抠）", color: "#b64a2e",
      params: [
        { k: "seedX", label: "种子 X", type: "number", def: 0 },
        { k: "seedY", label: "种子 Y", type: "number", def: 0 },
        { k: "tolerance", label: "容差", type: "range", min: 0, max: 150, def: 30 }
      ]
    },
    gridDeleteRow: {
      title: "网格删行", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "rowIndex", label: "行序号", type: "number", def: 1 }
      ]
    },
    gridDeleteCol: {
      title: "网格删列", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "colIndex", label: "列序号", type: "number", def: 1 }
      ]
    },
    gridExpandRow: {
      title: "网格插行", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "rowIndex", label: "行序号", type: "number", def: 1 }
      ]
    },
    gridExpandCol: {
      title: "网格插列", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "colIndex", label: "列序号", type: "number", def: 1 }
      ]
    },
    gridFlipRow: {
      title: "网格行水平翻转", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "rowIndex", label: "行序号", type: "number", def: 1 }
      ]
    },
    gridFlipCol: {
      title: "网格列垂直翻转", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "colIndex", label: "列序号", type: "number", def: 1 }
      ]
    },
    gridCopyRow: {
      title: "网格行复制", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "rowIndex", label: "源行序号", type: "number", def: 1 },
        { k: "atRow", label: "目标行序号", type: "number", def: 2 }
      ]
    },
    gridCopyCol: {
      title: "网格列复制", color: "#7a4a8a",
      params: [
        { k: "gCols", label: "网格列", type: "number", def: 4 },
        { k: "gRows", label: "网格行", type: "number", def: 4 },
        { k: "colIndex", label: "源列序号", type: "number", def: 1 },
        { k: "atCol", label: "目标列序号", type: "number", def: 2 }
      ]
    },
    regionCopy: {
      title: "区域复制", color: "#7a4a8a",
      params: [
        { k: "srcX1", label: "X1", type: "number", def: 0 },
        { k: "srcY1", label: "Y1", type: "number", def: 0 },
        { k: "srcX2", label: "X2", type: "number", def: 31 },
        { k: "srcY2", label: "Y2", type: "number", def: 31 },
        { k: "offsetX", label: "偏移 X", type: "number", def: 32 },
        { k: "offsetY", label: "偏移 Y", type: "number", def: 0 },
        { k: "clearTargetFirst", label: "先清目标区", type: "number", def: 0 }
      ]
    },
    regionDelete: {
      title: "区域清除", color: "#7a4a8a",
      params: [
        { k: "srcX1", label: "X1", type: "number", def: 0 },
        { k: "srcY1", label: "Y1", type: "number", def: 0 },
        { k: "srcX2", label: "X2", type: "number", def: 31 },
        { k: "srcY2", label: "Y2", type: "number", def: 31 }
      ]
    },
    movePixels: {
      title: "区域移动", color: "#7a4a8a",
      params: [
        { k: "x1", label: "X1", type: "number", def: 0 },
        { k: "y1", label: "Y1", type: "number", def: 0 },
        { k: "x2", label: "X2", type: "number", def: 31 },
        { k: "y2", label: "Y2", type: "number", def: 31 },
        { k: "moveOffsetX", label: "移动 X", type: "number", def: 1 },
        { k: "moveOffsetY", label: "移动 Y", type: "number", def: 0 }
      ]
    },
    customGridRearrange: {
      title: "网格重排（格号 1..n，0空，负=水平翻转）", color: "#7a4a8a",
      params: [
        { k: "splitCols", label: "源列数", type: "number", def: 2 },
        { k: "splitRows", label: "源行数", type: "number", def: 2 },
        { k: "outCols", label: "输出列数", type: "number", def: 2 },
        { k: "outRows", label: "输出行数", type: "number", def: 2 },
        { k: "map", label: "格号映射（逗号分隔，行主序）", type: "text", def: "1,2,3,4" }
      ]
    },
    perfectPixel: {
      title: "完美像素（节点）", color: "#8a6f2b",
      params: [
        { k: "minSize", label: "最小格", type: "range", min: 2, max: 16, def: 4 },
        { k: "peakWidth", label: "峰宽", type: "range", min: 2, max: 20, def: 6 },
        { k: "refineX100", label: "细化强度 %", type: "range", min: 0, max: 100, def: 25 },
        { k: "fixSquare", label: "裁方(1/0)", type: "number", def: 0 },
        { k: "manualGrid", label: "手动网格(1/0)", type: "number", def: 0 },
        { k: "gridCols", label: "网格列", type: "number", def: 32 },
        { k: "gridRows", label: "网格行", type: "number", def: 32 }
      ]
    },
    evenSplitStrip: {
      title: "均分展开为横带", color: "#7a4a8a",
      params: [
        { k: "evenCols", label: "列", type: "number", def: 4 },
        { k: "evenRows", label: "行", type: "number", def: 4 }
      ]
    },
    evenSplitPerCellEdge: {
      title: "均分+每格扩/裁边", color: "#7a4a8a",
      params: [
        { k: "evenCols", label: "列", type: "number", def: 4 },
        { k: "evenRows", label: "行", type: "number", def: 4 },
        { k: "cellEdgeMode", label: "模式(0扩1裁)", type: "number", def: 0 },
        { k: "edgeL", label: "左", type: "number", def: 0 },
        { k: "edgeT", label: "上", type: "number", def: 0 },
        { k: "edgeR", label: "右", type: "number", def: 0 },
        { k: "edgeB", label: "下", type: "number", def: 0 }
      ]
    },
    mergeStrip: {
      title: "条带重排为网格", color: "#7a4a8a",
      params: [
        { k: "mergeCols", label: "列数", type: "number", def: 4 },
        { k: "frameCount", label: "帧数(0=按frameW)", type: "number", def: 16 },
        { k: "frameW", label: "帧宽(frameCount=0时)", type: "number", def: 32 }
      ]
    },
    simpleStitchVertical: {
      title: "拼接（多输入简版：单图复制）", color: "#7a4a8a",
      params: [
        { k: "stitchMode", label: "0竖叠/1横排/2叠加", type: "number", def: 0 },
        { k: "stitchSlotCount", label: "槽位数", type: "number", def: 2 }
      ]
    },
    output: {
      title: "输出结果", color: "#4a7c59",
      params: []
    }
  };

  /* ================= 执行引擎 ================= */

  function hardScale(im, size) {
    if (!size || size <= 0) return im;
    var scale = size / Math.max(im.width, im.height);
    var w = Math.max(1, Math.round(im.width * scale));
    var h = Math.max(1, Math.round(im.height * scale));
    var src = UI.imageDataToCanvas(im);
    var c = UI.makeCanvas(w, h);
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  function clampPx(v, max) { return Math.max(0, Math.min(max - 1, v | 0)); }

  /* 原站 grid 系节点：删/插/翻转/复制 行或列（gCols×gRows 网格语义） */
  function gridCellOp(type, im, p) {
    var cols = Math.max(1, Number(p.gCols) || 1), rows = Math.max(1, Number(p.gRows) || 1);
    var cw = Math.floor(im.width / cols), ch = Math.floor(im.height / rows);
    var src = UI.imageDataToCanvas(im);
    var srcCtx = src.getContext("2d");
    function drawCell(ctx, srcCx, srcCy, dstCx, dstCy, flipX, flipY) {
      if (srcCx < 0 || srcCy < 0 || srcCx >= cols || srcCy >= rows) return;
      if (flipX || flipY) {
        ctx.save();
        ctx.translate((dstCx + (flipX ? 1 : 0)) * cw, (dstCy + (flipY ? 1 : 0)) * ch);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(src, srcCx * cw, srcCy * ch, cw, ch, 0, 0, cw, ch);
        ctx.restore();
      } else {
        ctx.drawImage(src, srcCx * cw, srcCy * ch, cw, ch, dstCx * cw, dstCy * ch, cw, ch);
      }
    }
    function renderGrid(outCols, outRows, fillFn) {
      var out = UI.makeCanvas(outCols * cw, outRows * ch);
      var octx = out.getContext("2d");
      for (var r = 0; r < outRows; r++) {
        for (var c = 0; c < outCols; c++) {
          var cell = fillFn(r, c);
          if (!cell) continue;
          drawCell(octx, cell[0], cell[1], c, r, cell[2], cell[3]);
        }
      }
      return out.getContext("2d").getImageData(0, 0, out.width, out.height);
    }
    switch (type) {
      case "gridDeleteRow": {
        var ri = Number(p.rowIndex) | 0;
        if (ri < 0 || ri >= rows) return im;
        return renderGrid(cols, rows - 1, function (r, c) {
          var sr = r < ri ? r : r + 1;
          return [c, sr, false, false];
        });
      }
      case "gridDeleteCol": {
        var ci = Number(p.colIndex) | 0;
        if (ci < 0 || ci >= cols) return im;
        return renderGrid(cols - 1, rows, function (r, c) {
          var sc = c < ci ? c : c + 1;
          return [sc, r, false, false];
        });
      }
      case "gridExpandRow": {
        var ri2 = Math.max(0, Math.min(rows, Number(p.rowIndex) | 0));
        return renderGrid(cols, rows + 1, function (r, c) {
          return [c, r < ri2 ? r : r - 1, false, false];
        });
      }
      case "gridExpandCol": {
        var ci2 = Math.max(0, Math.min(cols, Number(p.colIndex) | 0));
        return renderGrid(cols + 1, rows, function (r, c) {
          return [c < ci2 ? c : c - 1, r, false, false];
        });
      }
      case "gridFlipRow": {
        var ri3 = Number(p.rowIndex) | 0;
        return renderGrid(cols, rows, function (r, c) {
          return [c, r, r === ri3, false];
        });
      }
      case "gridFlipCol": {
        var ci3 = Number(p.colIndex) | 0;
        return renderGrid(cols, rows, function (r, c) {
          return [c, r, false, c === ci3];
        });
      }
      case "gridCopyRow": {
        // 原站 $z：把 rowIndex 行复制插入到 atRow 位置，输出高度 +ch
        var from = Math.max(0, Math.min(rows - 1, Number(p.rowIndex) | 0));
        var to = Math.max(0, Math.min(rows, Number(p.atRow) | 0));
        return renderGrid(cols, rows + 1, function (r, c) {
          var sr = r < to ? r : (r === to ? from : r - 1);
          return [c, sr, false, false];
        });
      }
      case "gridCopyCol": {
        var fromC = Math.max(0, Math.min(cols - 1, Number(p.colIndex) | 0));
        var toC = Math.max(0, Math.min(cols, Number(p.atCol) | 0));
        return renderGrid(cols + 1, rows, function (r, c) {
          var sc = c < toC ? c : (c === toC ? fromC : c - 1);
          return [sc, r, false, false];
        });
      }
    }
    return im;
  }

  function execNode(node, im) {
    var p = node.params;
    switch (node.type) {
      case "chromaKey":
        return FF.Wasm.chromaKey(im, {
          mode: Number(p.mode), tol: Number(p.tol), feather: Number(p.feather),
          suppress: Number(p.suppress), c1: hex2rgb(p.c1 || "#00ff00"), c2: [0, 0, 255]
        });
      case "matteContiguous":
        return FF.Wasm.chromaKey(im, {
          mode: 5, tol: Number(p.tol), feather: Number(p.feather),
          suppress: 0, c1: [0, 0, 0], c2: [0, 0, 0]
        });
      case "pixelate":
        return FF.Wasm.pixelate(im, Number(p.block));
      case "quantize":
        return FF.Wasm.quantize(im, 9, 100, Number(p.dither), Number(p.cs), Number(p.k));
      case "mergeNear":
        return Promise.resolve(FF.Lab.mergeSimilar(im, Number(p.strength)));
      case "adjust":
        return FF.Wasm.adjust(im, Number(p.sat), Number(p.con), Number(p.bri));
      case "outline": {
        var c = hex2rgb(p.color || "#1a1a1a");
        return FF.Wasm.outline(im, c, Number(p.radius));
      }
      case "resize":
        return Promise.resolve(hardScale(im, Number(p.size)));
      case "cropEdge": {
        var cut = Math.max(0, Number(p.px) || 0);
        var w = im.width - cut * 2, h = im.height - cut * 2;
        if (w < 1 || h < 1) return Promise.reject(new Error("裁边过大"));
        var src = UI.imageDataToCanvas(im);
        var c2 = UI.makeCanvas(w, h);
        c2.getContext("2d").drawImage(src, cut, cut, w, h, 0, 0, w, h);
        return Promise.resolve(c2.getContext("2d").getImageData(0, 0, w, h));
      }
      case "gridOps": {
        var cols = Math.max(1, Number(p.cols) || 1), rows = Math.max(1, Number(p.rows) || 1);
        var delCol = Number(p.delCol), delRow = Number(p.delRow);
        var cw = Math.floor(im.width / cols), ch = Math.floor(im.height / rows);
        var outCols = cols - (delCol >= 0 && delCol < cols ? 1 : 0);
        var outRows = rows - (delRow >= 0 && delRow < rows ? 1 : 0);
        if (outCols < 1 || outRows < 1) return Promise.reject(new Error("网格删除后为空"));
        var src2 = UI.imageDataToCanvas(im);
        var out = UI.makeCanvas(outCols * cw, outRows * ch);
        var octx = out.getContext("2d");
        var idx = 0;
        for (var ry = 0; ry < rows; ry++) {
          if (delRow === ry) continue;
          for (var rx = 0; rx < cols; rx++) {
            if (delCol === rx) continue;
            octx.drawImage(src2, rx * cw, ry * ch, cw, ch, (idx % outCols) * cw, Math.floor(idx / outCols) * ch, cw, ch);
            idx++;
          }
        }
        return Promise.resolve(out.getContext("2d").getImageData(0, 0, outCols * cw, outRows * ch));
      }
      /* ===== 原站 v5 workflow 节点执行器（纯本地像素操作） ===== */
      case "crop": {
        var L = Math.max(0, Number(p.left) || 0), T = Math.max(0, Number(p.top) || 0);
        var R = Math.max(0, Number(p.right) || 0), B = Math.max(0, Number(p.bottom) || 0);
        var w2 = im.width - L - R, h2 = im.height - T - B;
        if (w2 < 1 || h2 < 1) return Promise.reject(new Error("裁切过大"));
        var c3 = UI.makeCanvas(w2, h2);
        c3.getContext("2d").drawImage(UI.imageDataToCanvas(im), L, T, w2, h2, 0, 0, w2, h2);
        return Promise.resolve(c3.getContext("2d").getImageData(0, 0, w2, h2));
      }
      case "padExpand": {
        var pt = Math.max(0, Number(p.padTop) || 0), pr = Math.max(0, Number(p.padRight) || 0);
        var pb = Math.max(0, Number(p.padBottom) || 0), pl = Math.max(0, Number(p.padLeft) || 0);
        var w3 = im.width + pl + pr, h3 = im.height + pt + pb;
        var c4 = UI.makeCanvas(w3, h3);
        c4.getContext("2d").drawImage(UI.imageDataToCanvas(im), pl, pt);
        return Promise.resolve(c4.getContext("2d").getImageData(0, 0, w3, h3));
      }
      case "matteGlobal": {
        // 全图色键：键色 = 左上角像素（原站语义），mode3
        var d0 = im.data;
        return FF.Wasm.chromaKey(im, {
          mode: 3, tol: Number(p.tolerance), feather: Number(p.feather),
          suppress: 0, c1: [d0[0], d0[1], d0[2]], c2: [0, 0, 255]
        });
      }
      case "mattePostRepair":
        return FF.Wasm.matteRepair(im);
      case "alphaFrontierErode": {
        // 原站 Zz→Kz：passes = min(56, round(erosion/100*56))，每层 frontier alpha-22
        var itE = Math.min(56, Math.round((Number(p.erosion) || 0) / 100 * 56));
        if (itE <= 0) return Promise.resolve(im);
        return FF.Wasm.shaveAlpha(im, itE);
      }
      case "conditionalSuperEraser": {
        // 读种子点色，RGB 距离 ≤ 容差才执行连通域抠图
        var sx = Math.max(0, Math.min(im.width - 1, Number(p.seedX) | 0));
        var sy = Math.max(0, Math.min(im.height - 1, Number(p.seedY) | 0));
        var si = (sy * im.width + sx) * 4;
        var seed = [im.data[si], im.data[si + 1], im.data[si + 2]];
        var tol2 = Number(p.tolerance) || 30;
        // 原站语义：种子色与白色 targetRGB(255,255,255) 距离 ≤ 容差才执行超级橡皮（种子连通域清除）
        var dr2 = seed[0] - 255, dg2 = seed[1] - 255, db2 = seed[2] - 255;
        var matches = Math.sqrt(dr2 * dr2 + dg2 * dg2 + db2 * db2) <= tol2;
        if (!matches) return Promise.resolve(im);
        // 实际容差以节点 tolerance 为准（原站 jz：targetRGB 仅做触发开关）
        return FF.Wasm.floodErase(im, sx, sy, tol2);
      }
      case "gridDeleteRow":
      case "gridDeleteCol":
      case "gridExpandRow":
      case "gridExpandCol":
      case "gridFlipRow":
      case "gridFlipCol":
      case "gridCopyRow":
      case "gridCopyCol":
        return Promise.resolve(gridCellOp(node.type, im, p));
      case "regionCopy": {
        var x1 = clampPx(Number(p.srcX1) | 0, im.width), y1 = clampPx(Number(p.srcY1) | 0, im.height);
        var x2 = clampPx(Number(p.srcX2) | 0, im.width), y2 = clampPx(Number(p.srcY2) | 0, im.height);
        var rx1 = Math.min(x1, x2), ry1 = Math.min(y1, y2), rw = Math.abs(x2 - x1) + 1, rh = Math.abs(y2 - y1) + 1;
        var ox = Number(p.offsetX) | 0, oy = Number(p.offsetY) | 0;
        var out3 = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
        var d3 = out3.data;
        if (p.clearTargetFirst) {
          for (var yy3 = 0; yy3 < rh; yy3++) {
            for (var xx3 = 0; xx3 < rw; xx3++) {
              var tx = rx1 + ox + xx3, ty = ry1 + oy + yy3;
              if (tx < 0 || ty < 0 || tx >= im.width || ty >= im.height) continue;
              var ti = (ty * im.width + tx) * 4;
              d3[ti] = d3[ti + 1] = d3[ti + 2] = d3[ti + 3] = 0;
            }
          }
        }
        for (var yy4 = 0; yy4 < rh; yy4++) {
          for (var xx4 = 0; xx4 < rw; xx4++) {
            var sxi = rx1 + xx4, syi = ry1 + yy4;
            var txi = rx1 + ox + xx4, tyi = ry1 + oy + yy4;
            if (txi < 0 || tyi < 0 || txi >= im.width || tyi >= im.height) continue;
            var sIdx = (syi * im.width + sxi) * 4, tIdx = (tyi * im.width + txi) * 4;
            d3[tIdx] = d3[sIdx]; d3[tIdx + 1] = d3[sIdx + 1]; d3[tIdx + 2] = d3[sIdx + 2]; d3[tIdx + 3] = d3[sIdx + 3];
          }
        }
        return Promise.resolve(out3);
      }
      case "regionDelete": {
        var x1d = clampPx(Number(p.srcX1) | 0, im.width), y1d = clampPx(Number(p.srcY1) | 0, im.height);
        var x2d = clampPx(Number(p.srcX2) | 0, im.width), y2d = clampPx(Number(p.srcY2) | 0, im.height);
        var out4 = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
        var d4 = out4.data;
        for (var yy5 = Math.min(y1d, y2d); yy5 <= Math.max(y1d, y2d); yy5++) {
          for (var xx5 = Math.min(x1d, x2d); xx5 <= Math.max(x1d, x2d); xx5++) {
            var di5 = (yy5 * im.width + xx5) * 4;
            d4[di5] = d4[di5 + 1] = d4[di5 + 2] = d4[di5 + 3] = 0;
          }
        }
        return Promise.resolve(out4);
      }
      case "movePixels": {
        var x1m = clampPx(Number(p.x1) | 0, im.width), y1m = clampPx(Number(p.y1) | 0, im.height);
        var x2m = clampPx(Number(p.x2) | 0, im.width), y2m = clampPx(Number(p.y2) | 0, im.height);
        var rx = Math.min(x1m, x2m), ry = Math.min(y1m, y2m);
        var rw2 = Math.abs(x2m - x1m) + 1, rh2 = Math.abs(y2m - y1m) + 1;
        var mx = Number(p.moveOffsetX) | 0, my = Number(p.moveOffsetY) | 0;
        var out5 = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
        var src5 = new Uint8ClampedArray(im.data);
        var d5 = out5.data;
        // 先清源区，再贴到目标位置
        for (var yy6 = ry; yy6 < ry + rh2; yy6++) {
          for (var xx6 = rx; xx6 < rx + rw2; xx6++) {
            var ci = (yy6 * im.width + xx6) * 4;
            d5[ci] = d5[ci + 1] = d5[ci + 2] = d5[ci + 3] = 0;
          }
        }
        for (var yy7 = 0; yy7 < rh2; yy7++) {
          for (var xx7 = 0; xx7 < rw2; xx7++) {
            var sI = ((ry + yy7) * im.width + (rx + xx7)) * 4;
            var tx2 = rx + mx + xx7, ty2 = ry + my + yy7;
            if (tx2 < 0 || ty2 < 0 || tx2 >= im.width || ty2 >= im.height) continue;
            var tI = (ty2 * im.width + tx2) * 4;
            d5[tI] = src5[sI]; d5[tI + 1] = src5[sI + 1]; d5[tI + 2] = src5[sI + 2]; d5[tI + 3] = src5[sI + 3];
          }
        }
        return Promise.resolve(out5);
      }
      case "customGridRearrange": {
        var sc = Math.max(1, Number(p.splitCols) | 0), sr = Math.max(1, Number(p.splitRows) | 0);
        var oc = Math.max(1, Number(p.outCols) | 0), or_ = Math.max(1, Number(p.outRows) | 0);
        // 原站 _z：边界式切分（每格 [floor(W*k/n), floor(W*(k+1)/n))，格间可差 1px）
        function bnd(total, n, k) { return [Math.floor(total * k / n), Math.floor(total * (k + 1) / n)]; }
        var colB = [], rowB = [];
        for (var k1 = 0; k1 < sc; k1++) colB.push(bnd(im.width, sc, k1));
        for (var k2 = 0; k2 < sr; k2++) rowB.push(bnd(im.height, sr, k2));
        var cw2 = Math.ceil(im.width / sc), chh = Math.ceil(im.height / sr);
        var map = String(p.map || "").split(",").map(function (v) { return parseInt(v, 10) || 0; });
        var out6 = UI.makeCanvas(oc * cw2, or_ * chh);
        var octx6 = out6.getContext("2d");
        var src6 = UI.imageDataToCanvas(im);
        for (var r6 = 0; r6 < or_; r6++) {
          for (var c6 = 0; c6 < oc; c6++) {
            var cellNo = map[r6 * oc + c6] || 0;
            if (!cellNo) continue;
            var flip = cellNo < 0;
            var abs = Math.abs(cellNo) - 1;
            var srcCol = abs % sc, srcRow = Math.floor(abs / sc);
            if (srcRow >= sr) continue;
            var sbx = colB[srcCol], sby = rowB[srcRow];
            var sw6 = sbx[1] - sbx[0], sh6 = sby[1] - sby[0];
            var dx6 = c6 * cw2 + Math.floor((cw2 - sw6) / 2);
            var dy6 = r6 * chh + Math.floor((chh - sh6) / 2);
            if (flip) {
              octx6.save();
              octx6.translate(dx6 + sw6, dy6);
              octx6.scale(-1, 1);
              octx6.drawImage(src6, sbx[0], sby[0], sw6, sh6, 0, 0, sw6, sh6);
              octx6.restore();
            } else {
              octx6.drawImage(src6, sbx[0], sby[0], sw6, sh6, dx6, dy6, sw6, sh6);
            }
          }
        }
        return Promise.resolve(out6.getContext("2d").getImageData(0, 0, out6.width, out6.height));
      }
      case "perfectPixel": {
        try {
          var opts = {
            sampleMethod: "center",
            minSize: Number(p.minSize) || 4,
            peakWidth: Number(p.peakWidth) || 6,
            refineIntensity: (Number(p.refineX100) || 25) / 100,
            fixSquare: !!Number(p.fixSquare),
            gridSize: Number(p.manualGrid) ? { cols: Number(p.gridCols) || 32, rows: Number(p.gridRows) || 32 } : null
          };
          return Promise.resolve(FF.PerfectPixel.getPerfectPixel(im, opts));
        } catch (e) {
          return Promise.reject(e);
        }
      }
      case "evenSplitStrip": {
        // 原站 Ez：cols×rows 网格按行优先展开为单条横带
        var ec = Math.max(1, Number(p.evenCols) | 0), er = Math.max(1, Number(p.evenRows) | 0);
        var cwx = Math.floor(im.width / ec), chx = Math.floor(im.height / er);
        var out7 = UI.makeCanvas(ec * er * cwx, chx);
        var octx7 = out7.getContext("2d");
        var src7 = UI.imageDataToCanvas(im);
        var n7 = 0;
        for (var ry7 = 0; ry7 < er; ry7++) {
          for (var rx7 = 0; rx7 < ec; rx7++) {
            octx7.drawImage(src7, rx7 * cwx, ry7 * chx, cwx, chx, n7 * cwx, 0, cwx, chx);
            n7++;
          }
        }
        return Promise.resolve(out7.getContext("2d").getImageData(0, 0, out7.width, out7.height));
      }
      case "evenSplitPerCellEdge": {
        // 原站 Rz：每格先扩边(d1)/裁边(n1) 再拼横带
        var ec2 = Math.max(1, Number(p.evenCols) | 0), er2 = Math.max(1, Number(p.evenRows) | 0);
        var cwx2 = Math.floor(im.width / ec2), chx2 = Math.floor(im.height / er2);
        var expand = (Number(p.cellEdgeMode) | 0) === 0;
        var eL = Math.max(0, Number(p.edgeL) | 0), eT = Math.max(0, Number(p.edgeT) | 0);
        var eR = Math.max(0, Number(p.edgeR) | 0), eB = Math.max(0, Number(p.edgeB) | 0);
        var src8 = UI.imageDataToCanvas(im);
        var cellW = expand ? cwx2 + eL + eR : Math.max(1, cwx2 - eL - eR);
        var cellH = expand ? chx2 + eT + eB : Math.max(1, chx2 - eT - eB);
        var out8 = UI.makeCanvas(ec2 * er2 * cellW, cellH);
        var octx8 = out8.getContext("2d");
        var n8 = 0;
        for (var ry8 = 0; ry8 < er2; ry8++) {
          for (var rx8 = 0; rx8 < ec2; rx8++) {
            var cx8 = n8 * cellW;
            var sx8 = rx8 * cwx2, sy8 = ry8 * chx2;
            if (expand) {
              octx8.drawImage(src8, sx8, sy8, cwx2, chx2, cx8 + eL, eT, cwx2, chx2);
            } else {
              octx8.drawImage(src8, sx8 + eL, sy8 + eT, cellW, cellH, cx8, 0, cellW, cellH);
            }
            n8++;
          }
        }
        return Promise.resolve(out8.getContext("2d").getImageData(0, 0, out8.width, out8.height));
      }
      case "mergeStrip": {
        // 原站 Iz：横向逐帧条带重排到 mergeCols 列网格
        var mc = Math.max(1, Number(p.mergeCols) | 0);
        var fcount = Number(p.frameCount) | 0;
        var frames = fcount > 0 ? Math.min(fcount, im.width) : Math.floor(im.width / (Number(p.frameW) || 32));
        if (frames < 1) frames = 1;
        var fW = Math.floor(im.width / frames);
        var fH = im.height;
        var rows9 = Math.ceil(frames / mc);
        var out9 = UI.makeCanvas(mc * fW, rows9 * fH);
        var octx9 = out9.getContext("2d");
        var src9 = UI.imageDataToCanvas(im);
        for (var k9 = 0; k9 < frames; k9++) {
          octx9.drawImage(src9, k9 * fW, 0, fW, fH, (k9 % mc) * fW, Math.floor(k9 / mc) * fH, fW, fH);
        }
        return Promise.resolve(out9.getContext("2d").getImageData(0, 0, out9.width, out9.height));
      }
      case "simpleStitchVertical": {
        // 原站 oH 简版：单输入时按槽位数复制拼接（0=竖叠 1=横排 2=叠加）
        var mode = Number(p.stitchMode) | 0;
        var slots = Math.max(2, Math.min(16, Number(p.stitchSlotCount) | 0));
        var src10 = UI.imageDataToCanvas(im);
        var out10;
        if (mode === 0) {
          out10 = UI.makeCanvas(im.width, im.height * slots);
          var c10 = out10.getContext("2d");
          for (var s10 = 0; s10 < slots; s10++) c10.drawImage(src10, 0, s10 * im.height);
        } else if (mode === 1) {
          out10 = UI.makeCanvas(im.width * slots, im.height);
          var c11 = out10.getContext("2d");
          for (var s11 = 0; s11 < slots; s11++) c11.drawImage(src10, s11 * im.width, 0);
        } else {
          out10 = UI.makeCanvas(im.width, im.height);
          var c12 = out10.getContext("2d");
          for (var s12 = 0; s12 < slots; s12++) c12.drawImage(src10, 0, 0);
        }
        return Promise.resolve(out10.getContext("2d").getImageData(0, 0, out10.width, out10.height));
      }
      default:
        return Promise.resolve(im);
    }
  }

  /* ================= 工具页 ================= */

  FF.Tools.flow = function () {
    var sk = UI.pageSkeleton("mod.flow.t", "mod.flow.d", null);
    var root = sk.root, card = sk.card;

    var state = { nodes: [], edges: [], nextId: 1 };
    var canvasArea = UI.el("div", { class: "flow-canvas" }, []);
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("flow-wires");
    canvasArea.appendChild(svg);
    var linking = null; // {fromId}
    var dragNode = null; // {id, offX, offY}

    /* ---------- 蓝图数据 ---------- */

    function addNode(type, x, y) {
      var id = "n" + state.nextId++;
      state.nodes.push({
        id: id, type: type, x: x || 40 + (state.nodes.length % 4) * 250, y: y || 40 + Math.floor(state.nodes.length / 4) * 40,
        params: (function () {
          var o = {};
          (NODE_DEFS[type].params || []).forEach(function (p) { o[p.k] = p.def; });
          return o;
        })(),
        imageData: null
      });
      render();
      return id;
    }

    function removeNode(id) {
      state.nodes = state.nodes.filter(function (n) { return n.id !== id; });
      state.edges = state.edges.filter(function (e) { return e.from !== id && e.to !== id; });
      render();
    }

    function nodeById(id) { return state.nodes.find(function (n) { return n.id === id; }); }

    /* ---------- 渲染 ---------- */

    function render() {
      canvasArea.querySelectorAll(".flow-node").forEach(function (n) { n.remove(); });
      // 连线
      svg.innerHTML = "";
      state.edges.forEach(function (e) {
        var a = nodeById(e.from), b = nodeById(e.to);
        if (!a || !b) return;
        var x1 = a.x + nodeW(a), y1 = a.y + 34;
        var x2 = b.x, y2 = b.y + 34;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        var mx = (x1 + x2) / 2;
        path.setAttribute("d", "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2);
        path.setAttribute("class", "flow-wire");
        path.addEventListener("dblclick", function () {
          state.edges = state.edges.filter(function (x) { return x !== e; });
          render();
        });
        svg.appendChild(path);
      });
      state.nodes.forEach(function (n) { renderNode(n); });
    }

    function nodeW(n) {
      return 230;
    }

    function renderNode(n) {
      var def = NODE_DEFS[n.type];
      var el = UI.el("div", { class: "flow-node", style: { left: n.x + "px", top: n.y + "px" } });
      el.style.borderTopColor = def.color;
      // 标题栏（拖动）
      var head = UI.el("div", { class: "flow-node-head" }, [
        UI.el("span", {}, [def.title]),
        n.type !== "input" ? UI.el("span", { class: "flow-node-del", title: "删除节点" }, ["×"]) : null
      ]);
      head.addEventListener("pointerdown", function (e) {
        if (e.target.classList.contains("flow-node-del")) return;
        dragNode = { id: n.id, offX: e.clientX - n.x, offY: e.clientY - n.y };
        head.setPointerCapture(e.pointerId);
      });
      head.addEventListener("pointermove", function (e) {
        if (!dragNode || dragNode.id !== n.id) return;
        n.x = Math.max(0, e.clientX - dragNode.offX);
        n.y = Math.max(0, e.clientY - dragNode.offY);
        el.style.left = n.x + "px";
        el.style.top = n.y + "px";
        render();
      });
      head.addEventListener("pointerup", function () { dragNode = null; });
      el.appendChild(head);
      // 删除
      var del = el.querySelector(".flow-node-del");
      if (del) del.addEventListener("click", function () { removeNode(n.id); });

      // 输入端口
      if (n.type !== "input") {
        var inPort = UI.el("div", { class: "flow-port in", title: "输入" });
        inPort.style.top = "27px";
        inPort.addEventListener("click", function () {
          if (linking && linking.fromId !== n.id) {
            if (!state.edges.some(function (e) { return e.to === n.id; })) {
              state.edges.push({ from: linking.fromId, to: n.id });
            }
            linking = null;
            render();
          }
        });
        el.appendChild(inPort);
      }
      // 输出端口
      if (n.type !== "output") {
        var outPort = UI.el("div", { class: "flow-port out", title: "拖到目标输入端口" });
        outPort.style.top = "27px";
        outPort.addEventListener("click", function () {
          linking = { fromId: n.id };
          FF.Toast.show(t("flow.linking"), "info");
        });
        el.appendChild(outPort);
      }

      // 主体
      var body = UI.el("div", { class: "flow-node-body" }, []);
      if (n.type === "input") {
        var thumb = UI.el("div", { class: "flow-thumb" }, []);
        if (n.imageData) {
          var cv = UI.imageDataToCanvas(n.imageData);
          cv.style.maxWidth = "100%";
          cv.style.maxHeight = "80px";
          thumb.appendChild(cv);
        } else {
          thumb.appendChild(UI.el("div", { class: "hint-text" }, [t("flow.noimage")]));
        }
        body.appendChild(thumb);
        body.appendChild(UI.el("div", { class: "btn-row", style: { marginTop: "6px" } }, [
          UI.btn(t("flow.load"), "btn-ghost btn-sm", function () { n._fileInput.click(); })
        ]));
        var fi = UI.el("input", { type: "file", accept: "image/*", style: { display: "none" } });
        fi.addEventListener("change", function () {
          if (!fi.files.length) return;
          UI.fileToImage(fi.files[0]).then(function (r) {
            n.imageData = UI.imageDataFrom(r.img, 2048);
            r.release();
            render();
            FF.Toast.show(t("flow.loaded"), "ok");
          });
        });
        n._fileInput = fi;
        body.appendChild(fi);
      } else if (n.type === "output") {
        var outThumb = UI.el("div", { class: "flow-thumb" }, []);
        if (n.imageData) {
          var ocv = UI.imageDataToCanvas(n.imageData);
          ocv.style.maxWidth = "100%";
          ocv.style.maxHeight = "110px";
          outThumb.appendChild(ocv);
          outThumb.addEventListener("dblclick", function () { UI.lightbox(ocv, "output"); });
        } else {
          outThumb.appendChild(UI.el("div", { class: "hint-text" }, [t("flow.waitout")]));
        }
        body.appendChild(outThumb);
        if (n.imageData) {
          body.appendChild(UI.el("div", { class: "btn-row", style: { marginTop: "6px" } }, [
            UI.btn(t("common.download") + " PNG", "btn-primary btn-sm", function () {
              UI.downloadCanvas(UI.imageDataToCanvas(n.imageData), "flow_output.png");
            }, "download")
          ]));
        }
      } else {
        (NODE_DEFS[n.type].params || []).forEach(function (p) {
          body.appendChild(paramControl(n, p));
        });
      }
      el.appendChild(body);
      canvasArea.appendChild(el);
    }

    function paramControl(n, p) {
      var row = UI.el("div", { class: "flow-param" }, []);
      var label = UI.el("label", {}, [p.label]);
      row.appendChild(label);
      var v = n.params[p.k];
      if (p.type === "select") {
        var s = UI.el("select", {});
        p.options.forEach(function (o) {
          var opt = UI.el("option", { value: o[0] }, [o[1]]);
          if (String(o[0]) === String(v)) opt.selected = true;
          s.appendChild(opt);
        });
        s.addEventListener("change", function () { n.params[p.k] = s.value; });
        row.appendChild(s);
      } else if (p.type === "color") {
        var cIn = UI.el("input", { type: "color", value: v });
        cIn.addEventListener("input", function () { n.params[p.k] = cIn.value; });
        row.appendChild(cIn);
      } else if (p.type === "range") {
        var wrap = UI.el("div", { class: "row", style: { gap: "6px" } }, []);
        var rIn = UI.el("input", { type: "range", min: p.min, max: p.max, value: v });
        var val = UI.el("span", { class: "val" }, [String(v)]);
        rIn.addEventListener("input", function () {
          n.params[p.k] = Number(rIn.value);
          val.textContent = rIn.value;
        });
        wrap.appendChild(rIn);
        wrap.appendChild(val);
        row.appendChild(wrap);
      } else if (p.type === "text") {
        var tIn = UI.el("input", { type: "text", value: v, style: { width: "100%" } });
        tIn.addEventListener("change", function () { n.params[p.k] = tIn.value; });
        row.appendChild(tIn);
      } else {
        var nIn = UI.el("input", { type: "number", value: v });
        nIn.addEventListener("change", function () { n.params[p.k] = Number(nIn.value); });
        row.appendChild(nIn);
      }
      return row;
    }

    /* ---------- 执行 ---------- */

    var running = false;
    function run() {
      if (running) return;
      var inputNode = state.nodes.find(function (n) { return n.type === "input"; });
      if (!inputNode || !inputNode.imageData) {
        FF.Toast.show(t("flow.needinput"), "warn");
        return;
      }
      running = true;
      var outNode = state.nodes.find(function (n) { return n.type === "output"; });
      // 邻接表
      var nextOf = {};
      state.edges.forEach(function (e) { if (!nextOf[e.from]) nextOf[e.from] = e.to; });
      var cur = inputNode, curIm = Promise.resolve(inputNode.imageData);
      var steps = 0;
      function step() {
        var nextId = nextOf[cur.id];
        if (nextId === undefined || steps > 64) { finish(); return; }
        var next = nodeById(nextId);
        if (!next) { finish(); return; }
        if (next.type === "output") {
          curIm.then(function (im) {
            next.imageData = im;
            render();
            FF.Toast.show(t("flow.done"), "ok");
            finish();
          }, function (e) { fail(e); });
          return;
        }
        curIm = curIm.then(function (im) { return execNode(next, im); });
        curIm.then(function (im) {
          next.imageData = im;
          cur = next;
          steps++;
          step();
        }, fail);
      }
      function finish() { running = false; render(); }
      function fail(e) {
        running = false;
        FF.Toast.show("Error: " + (e.message || e), "err");
        finish();
      }
      step();
    }

    /* ---------- 蓝图保存 / 加载 / 预设 ---------- */

    function blueprintJson() {
      return JSON.stringify({
        version: 1,
        nodes: state.nodes.map(function (n) {
          return { id: n.id, type: n.type, x: n.x, y: n.y, params: n.params };
        }),
        edges: state.edges
      });
    }

    function loadBlueprint(json) {
      var bp = typeof json === "string" ? JSON.parse(json) : json;
      state.nodes = bp.nodes.map(function (n) {
        var copy = Object.assign({}, n);
        copy.imageData = null;
        copy._fileInput = null;
        return copy;
      });
      state.edges = bp.edges || [];
      state.nextId = state.nodes.length + 1;
      render();
    }

    function saveLocal() {
      localStorage.setItem("ff.flow", blueprintJson());
      FF.Toast.show(t("flow.saved"), "ok");
    }
    function loadLocal() {
      var s = localStorage.getItem("ff.flow");
      if (!s) { FF.Toast.show(t("flow.none"), "warn"); return; }
      loadBlueprint(s);
    }
    function exportJson() {
      var blob = new Blob([blueprintJson()], { type: "application/json" });
      UI.download(blob, "workflow.json");
    }
    function importJson(file) {
      file.text().then(function (s) {
        loadBlueprint(s);
        FF.Toast.show(t("flow.imported"), "ok");
      }).catch(function (e) { FF.Toast.show("Error: " + e.message, "err"); });
    }

    var BUILTIN = {
      rpgmakerVX: {
        nodes: [
          { id: "a", type: "input", x: 20, y: 60, params: {} },
          { id: "b", type: "matteContiguous", x: 300, y: 30, params: { tol: 80, feather: 5 } },
          { id: "c", type: "resize", x: 580, y: 30, params: { size: 128 } },
          { id: "d", type: "gridOps", x: 860, y: 30, params: { cols: 4, rows: 4, delCol: 4, delRow: -1 } },
          { id: "e", type: "output", x: 1140, y: 60, params: {} }
        ],
        edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }, { from: "d", to: "e" }]
      },
      aiPost: {
        nodes: [
          { id: "a", type: "input", x: 20, y: 60, params: {} },
          { id: "b", type: "matteContiguous", x: 300, y: 30, params: { tol: 80, feather: 5 } },
          { id: "c", type: "pixelate", x: 580, y: 30, params: { block: 2 } },
          { id: "d", type: "quantize", x: 860, y: 30, params: { k: 16, cs: 1, dither: 0 } },
          { id: "e", type: "output", x: 1140, y: 60, params: {} }
        ],
        edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }, { from: "d", to: "e" }]
      },
      walkNormalize: {
        nodes: [
          { id: "a", type: "input", x: 20, y: 60, params: {} },
          { id: "b", type: "resize", x: 300, y: 30, params: { size: 256 } },
          { id: "c", type: "cropEdge", x: 580, y: 30, params: { px: 4 } },
          { id: "d", type: "outline", x: 860, y: 30, params: { color: "#1a1a1a", radius: 1 } },
          { id: "e", type: "output", x: 1140, y: 60, params: {} }
        ],
        edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }, { from: "d", to: "e" }]
      }
    };

    /* ---------- 工具栏 ---------- */

    var addSel = UI.el("select", { class: "flow-add-sel" });
    Object.keys(NODE_DEFS).forEach(function (k) {
      var opt = UI.el("option", { value: k }, [NODE_DEFS[k].title]);
      addSel.appendChild(opt);
    });
    var addBtn = UI.btn(t("flow.add"), "btn-ghost btn-sm", function () {
      addNode(addSel.value);
    });

    var presetSel = UI.el("select", { class: "flow-add-sel" });
    [["", t("flow.preset.pick")], ["rpgmakerVX", t("flow.preset.vx")], ["aiPost", t("flow.preset.ai")], ["walkNormalize", t("flow.preset.walk")]]
      .forEach(function (o) {
        var opt = UI.el("option", { value: o[0] }, [o[1]]);
        presetSel.appendChild(opt);
      });
    presetSel.addEventListener("change", function () {
      if (presetSel.value && BUILTIN[presetSel.value]) {
        loadBlueprint(BUILTIN[presetSel.value]);
        FF.Toast.show(t("flow.loaded"), "ok");
      }
    });

    var toolbar = UI.el("div", { class: "row mt14 mb14", style: { gap: "8px", flexWrap: "wrap" } }, [
      addSel, addBtn,
      UI.el("span", { class: "hint-text" }, ["│"]),
      presetSel,
      UI.btn(t("flow.run"), "btn-primary btn-sm", run, "play"),
      UI.btn(t("flow.save"), "btn-ghost btn-sm", saveLocal),
      UI.btn(t("flow.loadbtn"), "btn-ghost btn-sm", loadLocal),
      UI.btn(t("flow.export"), "btn-ghost btn-sm", exportJson),
      (function () {
        var imp = UI.btn(t("flow.import"), "btn-ghost btn-sm", function () { impFile.click(); });
        var impFile = UI.el("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
        impFile.addEventListener("change", function () {
          if (impFile.files.length) importJson(impFile.files[0]);
          impFile.value = "";
        });
        var wrap = UI.el("span", {}, [imp, impFile]);
        return wrap;
      })(),
      UI.btn(t("flow.clear"), "btn-ghost btn-sm", function () {
        state.nodes = []; state.edges = []; state.nextId = 1;
        addNode("input"); addNode("output");
      })
    ]);

    /* ---------- 组装 ---------- */

    card.appendChild(toolbar);
    card.appendChild(canvasArea);
    addNode("input", 20, 60);
    addNode("output", 320, 60);

    // 支持从 AI 生图等送来的图片
    var transfer = sessionStorage.getItem("ff.transfer");
    if (transfer) {
      sessionStorage.removeItem("ff.transfer");
      var inputNode = state.nodes.find(function (n) { return n.type === "input"; });
      var tim = new Image();
      tim.onload = function () {
        inputNode.imageData = UI.imageDataFrom(tim, 2048);
        render();
      };
      tim.src = transfer;
    }

    return {
      root: root,
      onPaste: function (url) {
        var inputNode = state.nodes.find(function (n) { return n.type === "input"; });
        var tim = new Image();
        tim.onload = function () {
          inputNode.imageData = UI.imageDataFrom(tim, 2048);
          render();
          FF.Toast.show(t("flow.loaded"), "ok");
        };
        tim.src = url;
      },
      onDrop: function (url) {
        var inputNode = state.nodes.find(function (n) { return n.type === "input"; });
        var tim = new Image();
        tim.onload = function () {
          inputNode.imageData = UI.imageDataFrom(tim, 2048);
          render();
          FF.Toast.show(t("flow.loaded"), "ok");
        };
        tim.src = url;
      }
    };
  };
})();
