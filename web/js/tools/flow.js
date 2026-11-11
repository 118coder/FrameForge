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
        { k: "tol", label: "容差", type: "range", min: 0, max: 100, def: 80 },
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
