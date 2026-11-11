/* FrameForge · AI 生图（Gemini API 直连） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  function hex2rgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  FF.Tools.ai = function () {
    var sk = UI.pageSkeleton("mod.ai.t", "mod.ai.d", ["ai.s1", "ai.s2"]);
    var root = sk.root, card = sk.card, steps = sk.steps;

    var state = { result: null /* dataUrl */, refImage: null /* {mime, base64} */, busy: false };

    /* ---------------- Step 1: 输入 ---------------- */

    var p1 = steps.panels[0];

    // Key 状态提示
    var keyHint = UI.el("div", { class: "hint-text mb14" }, []);
    function refreshKeyHint() {
      var has = !!FF.Ai.getKey();
      keyHint.innerHTML = "";
      var label = has
        ? "✓ " + t("ai.key.ok") + " · " + FF.Ai.TYPE_LABELS[FF.Ai.effectiveType()] + " · " + FF.Ai.getModel()
        : "⚠ " + t("ai.key.none");
      keyHint.appendChild(UI.el("span", {
        class: "tag-chip",
        style: { color: has ? "var(--green)" : "var(--accent)" }
      }, [label]));
    }
    refreshKeyHint();

    // 模式切换
    var modeRow = UI.el("div", { class: "row mb14" }, []);
    var btnT2I = UI.btn(t("ai.mode.t2i"), "btn-primary", function () { setMode("t2i"); });
    var btnI2I = UI.btn(t("ai.mode.i2i"), "btn-outline", function () { setMode("i2i"); });
    modeRow.appendChild(btnT2I);
    modeRow.appendChild(btnI2I);
    var mode = "t2i";

    // 预设（分组 optgroup，对齐原站各生成模块）
    var presets = FF.Ai.getPresets();
    var presetSel = UI.el("select", { style: { width: "100%" } });
    (function () {
      var groups = [];
      presets.forEach(function (p, i) {
        var gName = p.group ? t("ai.group." + p.group) : "";
        var g = groups.find(function (x) { return x.name === gName; });
        if (!g) { g = { name: gName, items: [] }; groups.push(g); }
        g.items.push({ p: p, i: i });
      });
      groups.forEach(function (g) {
        if (g.name) {
          var og = document.createElement("optgroup");
          og.label = g.name;
          g.items.forEach(function (it) {
            var opt = document.createElement("option");
            opt.value = it.i;
            opt.textContent = it.p.label + (it.p.needRef ? " 🔗" : "");
            og.appendChild(opt);
          });
          presetSel.appendChild(og);
        } else {
          g.items.forEach(function (it) {
            var opt = document.createElement("option");
            opt.value = it.i;
            opt.textContent = it.p.label;
            presetSel.appendChild(opt);
          });
        }
      });
    })();
    presetSel.addEventListener("change", function () { applyPreset(); });
    var presetRow = UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("ai.preset")]), presetSel]);

    // 补充描述（替换模板中的 {input} 占位）
    var suppRow = UI.el("div", { class: "param-row", style: { display: "none" } }, []);
    var suppIn = UI.el("input", {
      type: "text",
      style: { width: "100%" },
      spellcheck: "false"
    });
    suppRow.appendChild(UI.el("label", {}, [t("ai.supplement")]));
    suppRow.appendChild(suppIn);
    function applyPreset() {
      var p = presets[Number(presetSel.value)];
      promptTA.value = p.prompt || "";
      suppRow.style.display = p.inputPlaceholder ? "" : "none";
      suppIn.placeholder = p.inputPlaceholder || "";
      suppIn.value = "";
      refZone.style.display = (p.needRef || mode === "i2i") ? "" : "none";
      if (p.needRef) setMode("i2i");
    }
    function currentPrompt() {
      var p = presets[Number(presetSel.value)];
      var base = (p && p.prompt) ? p.prompt : promptTA.value;
      if (base.indexOf("{input}") >= 0) {
        var supp = suppIn.value.trim();
        if (!supp) return { err: t("ai.needsupp") };
        base = base.split("{input}").join(supp);
      }
      return { text: base };
    }

    var promptTA = UI.el("textarea", {
      rows: "6",
      placeholder: t("ai.prompt.ph"),
      style: {
        width: "100%", background: "var(--input-bg)", color: "var(--text)",
        border: "1.5px solid var(--input-border)", borderRadius: "8px",
        padding: "10px", fontSize: "13.5px", fontFamily: "inherit", resize: "vertical"
      }
    });
    promptTA.value = presets[0].prompt;
    suppIn.placeholder = presets[0].inputPlaceholder || "";
    suppRow.style.display = presets[0].inputPlaceholder ? "" : "none";

    // 参考图（图生图）
    var refZone = UI.el("div", { class: "mt14", style: { display: "none" } }, []);
    var refFrame = UI.el("div", { class: "row", style: { alignItems: "flex-start" } }, []);
    var refClear = UI.btn(t("common.reset"), "btn-ghost btn-sm", function () {
      state.refImage = null;
      refFrame.innerHTML = "";
      refFrame.appendChild(refDz);
    });
    var refDz = UI.dropzone({
      accept: "image/*",
      main: t("ai.ref.drop"),
      hint: t("chroma.hint"),
      onFiles: function (files) {
        var fr = new FileReader();
        fr.onload = function () {
          var img = new Image();
          img.onload = function () {
            // 限制参考图尺寸 ≤1024，压缩 base64
            var scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
            var c = UI.makeCanvas(Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale));
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            var dataUrl = c.toDataURL("image/png");
            state.refImage = { mime: "image/png", base64: dataUrl.split(",")[1] };
            refFrame.innerHTML = "";
            var pv = UI.makeCanvas(c.width, c.height);
            pv.getContext("2d").drawImage(c, 0, 0);
            pv.style.maxWidth = "200px";
            refFrame.appendChild(pv);
            refFrame.appendChild(UI.el("div", {}, [refClear]));
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(files[0]);
      }
    });
    refFrame.appendChild(refDz);
    refZone.appendChild(UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("ai.ref")]), refFrame]));

    function setMode(m) {
      mode = m;
      btnT2I.className = "btn " + (m === "t2i" ? "btn-primary" : "btn-outline");
      btnI2I.className = "btn " + (m === "i2i" ? "btn-primary" : "btn-outline");
      var p = presets[Number(presetSel.value)];
      refZone.style.display = (m === "i2i" || p.needRef) ? "" : "none";
    }

    var genBtn = UI.btn(t("ai.generate"), "btn-primary", generate, "play");
    var genProg = UI.progress();
    var errBox = UI.el("div", { class: "hint-text", style: { color: "var(--danger)" } }, []);

    p1.appendChild(keyHint);
    p1.appendChild(modeRow);
    p1.appendChild(UI.el("div", { class: "param-grid" }, [presetRow]));
    p1.appendChild(UI.el("div", { class: "mt8" }, [suppRow]));
    p1.appendChild(UI.el("div", { class: "param-row mt8" }, [UI.el("label", {}, [t("ai.prompt")]), promptTA]));
    p1.appendChild(refZone);
    p1.appendChild(UI.el("div", { class: "mt20 btn-row" }, [genBtn]));
    p1.appendChild(genProg.el);
    p1.appendChild(errBox);

    async function generate() {
      if (state.busy) return;
      errBox.textContent = "";
      if (!FF.Ai.getKey()) {
        errBox.textContent = t("ai.nokey");
        return;
      }
      var pr = currentPrompt();
      if (pr.err) { errBox.textContent = pr.err; return; }
      var prompt = pr.text;
      if (!prompt.trim()) { errBox.textContent = t("ai.needprompt"); return; }
      state.busy = true;
      genBtn.disabled = true;
      genProg.show(t("common.processing"));
      genProg.set(0.4);
      try {
        var ref = mode === "i2i" ? state.refImage : null;
        if (mode === "i2i" && !ref) { errBox.textContent = t("ai.needref"); state.busy = false; genBtn.disabled = false; genProg.hide(); return; }
        var r = await FF.Ai.generate(prompt, ref);
        state.result = r.dataUrl;
        renderResult(r.dataUrl, prompt);
        FF.Ai.pushHistory({ dataUrl: r.dataUrl, prompt: prompt, ts: Date.now() });
        renderHistory();
        steps.set(1);
      } catch (e) {
        errBox.textContent = e.message === "NO_KEY" ? t("ai.nokey") : ("Error: " + e.message);
      } finally {
        state.busy = false;
        genBtn.disabled = false;
        genProg.hide();
      }
    }

    /* ---------------- Step 2: 结果 ---------------- */

    var p2 = steps.panels[1];
    var resultBox = UI.el("div", { class: "preview-box" }, []);
    var histBox = UI.el("div", { class: "mt14" }, []);

    p2.appendChild(resultBox);
    p2.appendChild(histBox);

    function renderResult(dataUrl, prompt) {
      resultBox.innerHTML = "";
      var img = new Image();
      img.src = dataUrl;
      img.style.maxWidth = "100%";
      img.style.maxHeight = "420px";
      img.style.imageRendering = "pixelated";
      resultBox.appendChild(UI.el("div", { class: "pb-title" }, [t("ai.result")]));
      resultBox.appendChild(UI.canvasFrame(img));

      var row = UI.el("div", { class: "btn-row mt14" }, []);
      row.appendChild(UI.btn(t("common.download") + " PNG", "btn-primary", function () {
        var a = document.createElement("a");
        a.href = dataUrl;
        a.download = "ai_gen_" + Date.now() + ".png";
        a.click();
      }, "download"));
      row.appendChild(UI.btn(t("ai.to.pixel"), "btn-ghost", function () { sendTo("pixel"); }));
      row.appendChild(UI.btn(t("ai.to.chroma"), "btn-ghost", function () { sendTo("chroma"); }));
      row.appendChild(UI.btn(t("ai.to.rpgmaker"), "btn-outline", rpgMakerDialog));
      row.appendChild(UI.btn(t("ai.regenerate"), "btn-ghost", generate));
      resultBox.appendChild(row);
      if (prompt) {
        resultBox.appendChild(UI.el("div", { class: "hint-text mt8" }, [prompt.slice(0, 160)]));
      }
    }

    function sendTo(tool) {
      if (!state.result) return;
      sessionStorage.setItem("ff.transfer", state.result);
      location.hash = "#/" + tool;
    }

    /* ---------- RPG Maker 走图转换 ---------- */

    function rpgMakerDialog() {
      if (!state.result) return;
      var body = UI.el("div", {}, []);
      var img = new Image();
      img.onload = function () {
        var info = UI.el("div", { class: "hint-text mb8" }, ["源图 " + img.naturalWidth + "×" + img.naturalHeight]);
        var srcCols = UI.el("input", { type: "number", value: "4", min: "1", max: "16", style: { width: "80px" } });
        var srcRows = UI.el("input", { type: "number", value: "3", min: "1", max: "16", style: { width: "80px" } });
        var cellPx = UI.el("input", { type: "number", value: "48", min: "16", max: "128", style: { width: "80px" } });
        var outCols = UI.el("input", { type: "number", value: "4", min: "1", max: "8", style: { width: "80px" } });
        var outRows = UI.el("input", { type: "number", value: "3", min: "1", max: "8", style: { width: "80px" } });
        var transparent = UI.el("div", {}, []);
        body.appendChild(info);
        body.appendChild(UI.el("div", { class: "param-grid" }, [
          UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("ai.rpg.src")]), UI.el("div", { class: "row" }, [srcCols, UI.el("span", { class: "hint-text" }, ["×"]), srcRows])]),
          UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("ai.rpg.cell")]), cellPx]),
          UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("ai.rpg.out")]), UI.el("div", { class: "row" }, [outCols, UI.el("span", { class: "hint-text" }, ["×"]), outRows])])
        ]));
        var go = UI.btn(t("ai.rpg.go"), "btn-primary", function () {
          var sc = Number(srcCols.value) || 4;
          var sr = Number(srcRows.value) || 3;
          var cs = Number(cellPx.value) || 48;
          var oc = Number(outCols.value) || 4;
          var or_ = Number(outRows.value) || 3;
          var out = UI.makeCanvas(oc * cs, or_ * cs);
          var octx = out.getContext("2d");
          octx.imageSmoothingEnabled = false;
          var sw = img.naturalWidth / sc, sh = img.naturalHeight / sr;
          var n = Math.min(sc * sr, oc * or_);
          for (var i = 0; i < n; i++) {
            var sx = (i % sc) * sw, sy = Math.floor(i / sc) * sh;
            var tmp = UI.makeCanvas(Math.round(sw), Math.round(sh));
            tmp.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
            // 居中缩放到目标格
            var s = Math.min(cs / tmp.width, cs / tmp.height);
            var dw = Math.round(tmp.width * s), dh = Math.round(tmp.height * s);
            octx.drawImage(tmp, (i % oc) * cs + Math.floor((cs - dw) / 2), Math.floor(i / oc) * cs + Math.floor((cs - dh) / 2), dw, dh);
          }
          transparent.innerHTML = "";
          transparent.appendChild(UI.canvasFrame(out));
          UI.downloadCanvas(out, "rpgmaker_walk_" + oc * cs + "x" + or_ * cs + ".png");
        }, "download");
        body.appendChild(UI.el("div", { class: "mt14" }, [go]));
        body.appendChild(UI.el("div", { class: "mt14" }, [transparent]));
      };
      img.src = state.result;
      UI.modal(t("ai.to.rpgmaker"), body);
    }

    /* ---------- 历史 ---------- */

    function renderHistory() {
      histBox.innerHTML = "";
      var h = FF.Ai.getHistory();
      if (!h.length) return;
      var head = UI.el("div", { class: "row between" }, [
        UI.el("div", { class: "pb-title" }, [t("ai.history")]),
        UI.btn(t("ai.hist.clear"), "btn-ghost btn-sm", function () { FF.Ai.clearHistory(); renderHistory(); })
      ]);
      var strip = UI.el("div", { class: "filmstrip" }, []);
      h.forEach(function (item) {
        var th = UI.el("div", { class: "thumb", title: (item.prompt || "").slice(0, 100) }, []);
        var im = new Image();
        im.src = item.dataUrl;
        th.appendChild(im);
        th.addEventListener("click", function () {
          state.result = item.dataUrl;
          renderResult(item.dataUrl, item.prompt);
          steps.set(1);
        });
        // 双击：灯箱放大 + 可重发提示词
        th.addEventListener("dblclick", function () {
          UI.lightbox(item.dataUrl, (item.prompt || "").slice(0, 80));
        });
        th.addEventListener("contextmenu", function (e) {
          e.preventDefault();
          promptTA.value = item.prompt || "";
          if (item.refDataUrl) acceptRefImage(item.refDataUrl);
          FF.Toast.show(t("ai.hist.reprompt"), "ok");
          steps.set(0);
        });
        strip.appendChild(th);
      });
      histBox.appendChild(head);
      histBox.appendChild(strip);
    }
    renderHistory();

    /* ---------------- 组装 ---------------- */

    // 设置参考图（供 transfer / 粘贴 / 拖拽共用）
    function acceptRefImage(url) {
      var tim = new Image();
      tim.onload = function () {
        var scale = Math.min(1, 1024 / Math.max(tim.naturalWidth, tim.naturalHeight));
        var c = UI.makeCanvas(Math.round(tim.naturalWidth * scale), Math.round(tim.naturalHeight * scale));
        c.getContext("2d").drawImage(tim, 0, 0, c.width, c.height);
        var dataUrl = c.toDataURL("image/png");
        state.refImage = { mime: "image/png", base64: dataUrl.split(",")[1] };
        setMode("i2i");
        refFrame.innerHTML = "";
        var pv = UI.makeCanvas(c.width, c.height);
        pv.getContext("2d").drawImage(c, 0, 0);
        pv.style.maxWidth = "200px";
        refFrame.appendChild(pv);
        refFrame.appendChild(UI.el("div", {}, [refClear]));
      };
      tim.src = url;
    }

    var transfer = sessionStorage.getItem("ff.transfer");
    if (transfer) {
      sessionStorage.removeItem("ff.transfer");
      acceptRefImage(transfer);
    }

    steps.set(0);

    return {
      root: root,
      onPaste: acceptRefImage,
      onDrop: acceptRefImage
    };

    return { root: root };
  };
})();
