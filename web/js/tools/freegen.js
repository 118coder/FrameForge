/* FrameForge · 自由生图（画布工作台，对齐 frameronin v5「核心生图」）：
 * 画布拖放/平移缩放 · 画面描述+负面词 · 参考图/风格参考 · 预设四组 · 比例/分辨率 · 生成历史 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var Ai = FF.Ai;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  /* ---------- 画布卡片模型 ---------- */
  // card: { id, img(HTMLImageElement), url(dataUrl), x, y, w, h, role: null|"ref"|"style", prompt }

  var RATIO_OPTS = [
    { v: "auto", label: "auto" }, { v: "1:1", label: "1:1" }, { v: "3:4", label: "3:4" },
    { v: "4:3", label: "4:3" }, { v: "9:16", label: "9:16" }, { v: "16:9", label: "16:9" }, { v: "2:1", label: "2:1" }
  ];
  var RES_OPTS = [{ v: "1k", label: "1k" }, { v: "2k", label: "2k" }, { v: "4k", label: "4k" }];

  /* 预设四组：换=换提示词模板，参=要求参考图角色一致 */
  var PRESET_GROUPS = [
    { id: "map", label: "地图预设", ph: "场景描述（地形/建筑/氛围）",
      items: ["正视角 16-bit 像素场景", "45 度俯视 RPG 场景", "泰拉瑞亚风格横版场景", "复古街机机台场景", "地牢洞穴", "雪原村庄", "沙漠绿洲", "港口小镇"] },
    { id: "char", label: "角色预设", ph: "角色描述（外貌/服装/配色）",
      items: ["RPG Maker 行走图 3×4", "四方向行走图 4×4", "八方向九宫格", "一图全动作（待机/行走/攻击）", "像素怪物（斜方向+爬梯）", "Q 版角色", "骑马角色", "横版角色"] },
    { id: "ui", label: "UI 预设", ph: "UI 描述（按钮/面板/图标）",
      items: ["游戏主菜单面板", "血条/蓝条状态栏", "物品栏图标 8 宫格", "技能按钮（金属边框）", "对话框窗口", "小地图框", "金币/宝石图标", "设置齿轮图标"] },
    { id: "prop", label: "道具预设", ph: "道具描述（武器/消耗品/装备）",
      items: ["铁剑", "法杖", "弓箭", "盾牌", "红药水", "蓝药水", "宝箱", "钥匙"] }
  ];

  FF.Tools.freegen = function () {
    var cards = [];          // 画布上的图片卡片
    var seq = 0;
    var cam = { x: 0, y: 0, z: 1 };   // 相机
    var histExpanded = true;
    var refImg = null;       // {mime, base64, url}
    var styleRef = null;     // 风格参考（来自卡片）
    var currentPreset = null;

    /* ========== 骨架 ========== */
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("common.backhome")])]);
    back.addEventListener("click", function () { location.hash = "#/"; });

    var btnFocus = UI.btn(t("fg.focus"), "btn-outline btn-sm", function () { fitAll(); }, "aim");
    var btnUpload = UI.btn(t("fg.upload"), "btn-outline btn-sm", null, "upload");
    var fileInput = UI.el("input", { type: "file", accept: "image/*", multiple: "", style: { display: "none" } });
    fileInput.addEventListener("change", function () {
      Array.from(fileInput.files || []).forEach(function (f) { addImageFile(f); });
      fileInput.value = "";
    });
    btnUpload.addEventListener("click", function () { fileInput.click(); });
    var btnSave = UI.btn(t("fg.save"), "btn-outline btn-sm", saveProject);
    var btnNew = UI.btn(t("fg.new"), "btn-outline btn-sm", function () {
      if (!cards.length || confirm(t("fg.new.confirm"))) { cards = []; draw(); }
    });
    var btnLoad = UI.btn(t("fg.load"), "btn-outline btn-sm", loadProject);
    var bar = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, [
      btnFocus, btnUpload, fileInput, btnSave, btnNew, btnLoad
    ]);

    /* ---------- 画布 ---------- */
    var stageWrap = UI.el("div", { class: "fg-stage-wrap" });
    var stage = UI.el("div", { class: "fg-stage" });
    var hint = UI.el("div", { class: "fg-hint" }, [t("fg.stage.hint")]);
    stageWrap.appendChild(stage);
    stageWrap.appendChild(hint);

    function screenToWorld(sx, sy) {
      var r = stageWrap.getBoundingClientRect();
      return { x: (sx - r.left - r.width / 2) / cam.z - cam.x, y: (sy - r.top - r.height / 2) / cam.z - cam.y };
    }
    function draw() {
      stage.innerHTML = "";
      hint.style.display = cards.length ? "none" : "";
      cards.forEach(function (c) {
        var elc = UI.el("div", { class: "fg-card" + (c.role ? " role-" + c.role : "") });
        var img = UI.el("img", { src: c.url, draggable: "false" });
        elc.appendChild(img);
        // 角色角标
        if (c.role === "ref") elc.appendChild(UI.el("div", { class: "fg-tag" }, [t("fg.tag.ref")]));
        if (c.role === "style") elc.appendChild(UI.el("div", { class: "fg-tag style" }, [t("fg.tag.style")]));
        // 操作条
        var ops = UI.el("div", { class: "fg-ops" }, []);
        var mk = function (lab, title, fn, cls) {
          var b = UI.el("button", { class: "fg-op " + (cls || ""), title: title }, [lab]);
          b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
          return b;
        };
        ops.appendChild(mk(t("fg.op.ref"), t("fg.op.ref.tip"), function () {
          var was = c.role === "ref";
          cards.forEach(function (x) { if (x.role === "ref") x.role = null; });
          c.role = was ? null : "ref";
          syncRefFromCards(); draw();
        }));
        ops.appendChild(mk(t("fg.op.style"), t("fg.op.style.tip"), function () {
          var was = c.role === "style";
          cards.forEach(function (x) { if (x.role === "style") x.role = null; });
          c.role = was ? null : "style";
          syncRefFromCards(); draw();
        }));
        ops.appendChild(mk("↓", t("common.download"), function () {
          var a = document.createElement("a");
          a.href = c.url; a.download = "freegen_" + c.id + ".png"; a.click();
        }));
        ops.appendChild(mk("✕", t("common.delete"), function () {
          cards = cards.filter(function (x) { return x !== c; });
          syncRefFromCards(); draw();
        }, "danger"));
        elc.appendChild(ops);
        // 位置
        elc.style.transform = "translate(" + (c.x + c.w / 2) + "px," + (c.y + c.h / 2) + "px) translate(-50%,-50%)";
        elc.style.width = c.w + "px";
        elc.style.zIndex = String(10 + (c.z || 0));
        elc.addEventListener("pointerdown", function (e) {
          if (e.button !== 0) return;
          e.stopPropagation();
          dragCard = c; dragOff = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y };
          elc.style.zIndex = String(999);
        });
        stage.appendChild(elc);
      });
      stage.style.transform = "translate(" + (-cam.x * cam.z) + "px," + (-cam.y * cam.z) + "px)";
    }

    var dragCard = null, dragOff = null, panning = false, panStart = null;
    stageWrap.addEventListener("pointerdown", function (e) {
      // 中键或右键拖动画布
      if (e.button === 1 || e.button === 2) {
        panning = true; panStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
        e.preventDefault();
      }
    });
    window.addEventListener("pointermove", function (e) {
      if (dragCard && dragOff) {
        var w0 = screenToWorld(dragOff.x, dragOff.y);
        var w1 = screenToWorld(e.clientX, e.clientY);
        dragCard.x = dragOff.cx + (w1.x - w0.x);
        dragCard.y = dragOff.cy + (w1.y - w0.y);
        draw();
      } else if (panning && panStart) {
        cam.x = panStart.cx - (e.clientX - panStart.x) / cam.z;
        cam.y = panStart.cy - (e.clientY - panStart.y) / cam.z;
        draw();
      }
    });
    window.addEventListener("pointerup", function () {
      if (dragCard) { dragCard = null; draw(); }
      panning = false;
    });
    stageWrap.addEventListener("wheel", function (e) {
      e.preventDefault();
      var dz = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      cam.z = Math.min(6, Math.max(0.12, cam.z * dz));
      draw();
    }, { passive: false });
    stageWrap.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    // 落卡（URL → 卡片），供拖放/暂存拖出/粘贴共用
    function addCardUrl(url) {
      var img = new Image();
      img.onload = function () {
        cards.push({ id: ++seq, url: url, img: img, w: 240, h: Math.round(240 * img.naturalHeight / img.naturalWidth), x: 0, y: 0, role: null, z: seq });
        draw();
      };
      img.src = url;
    }
    // 拖入图片
    stageWrap.addEventListener("dragover", function (e) { e.preventDefault(); });
    stageWrap.addEventListener("drop", function (e) {
      e.preventDefault();
      // 暂存拖出（原站 MIME 优先，兼容 text/ff-stash）
      var stashData = "";
      try { stashData = e.dataTransfer.getData("application/x-frameronin-stash-url") || e.dataTransfer.getData("text/ff-stash") || ""; } catch (err) {}
      if (stashData) {
        var hit = false;
        stashData.split("\n").forEach(function (u) {
          u = u.trim();
          if (/^data:image\//.test(u)) { addCardUrl(u); hit = true; }
        });
        if (!hit) {
          var files2 = e.dataTransfer.files;
          if (files2) Array.prototype.forEach.call(files2, function (f) { if (/image\//.test(f.type)) addImageFile(f); });
        }
        return;
      }
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files) return;
      Array.prototype.forEach.call(files, function (f) {
        if (/image\//.test(f.type)) addImageFile(f);
      });
    });
    // G 隐藏提示词角标
    function onKey(e) {
      if (e.key === "g" || e.key === "G") {
        if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
        hint.classList.toggle("hide");
      }
    }
    document.addEventListener("keydown", onKey);

    function fitAll() {
      if (!cards.length) { cam = { x: 0, y: 0, z: 1 }; draw(); return; }
      var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      cards.forEach(function (c) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
      });
      cam.x = (minX + maxX) / 2; cam.y = (minY + maxY) / 2;
      var r = stageWrap.getBoundingClientRect();
      cam.z = Math.min(2.4, Math.max(0.15, Math.min(r.width / (maxX - minX + 160), r.height / (maxY - minY + 160))));
      draw();
    }

    function addImageFile(f) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxSide = 360;
          var s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          cards.push({
            id: ++seq, url: fr.result, img: img,
            w: Math.round(img.naturalWidth * s), h: Math.round(img.naturalHeight * s),
            x: (seq % 5) * 40 - 80 + (Math.random() * 30 - 15), y: (Math.ceil(seq / 5) - 1) * 40 - 60,
            role: null, z: seq
          });
          draw();
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(f);
    }

    function syncRefFromCards() {
      var rc = cards.find(function (c) { return c.role === "ref"; });
      var sc = cards.find(function (c) { return c.role === "style"; });
      refImg = rc ? toAiRef(rc.url) : null;
      styleRef = sc ? sc : null;
      styleHint.textContent = styleRef ? t("fg.style.set") : t("fg.style.none");
      clearStyleBtn.disabled = !styleRef;
      refHint.textContent = rc ? t("fg.ref.set") : t("fg.ref.none");
    }
    function toAiRef(dataUrl) {
      return { mime: "image/png", base64: dataUrl.split(",")[1] };
    }

    /* ---------- 输入面板 ---------- */
    var input = UI.el("div", { class: "fg-input" });
    var promptIn = UI.el("textarea", { class: "fg-prompt", placeholder: t("fg.prompt.ph") });
    var negIn = UI.el("textarea", { class: "fg-prompt sm", placeholder: t("fg.neg.ph") });
    // 预设 chips
    var presetRow = UI.el("div", { class: "row", style: { gap: "4px", flexWrap: "wrap" } }, []);
    var presetList = UI.el("div", { class: "fg-preset-list" });
    var presetInput = UI.el("textarea", { class: "fg-prompt sm", style: { display: "none" }, placeholder: "" });
    PRESET_GROUPS.forEach(function (g) {
      var b = UI.btn(g.label, "btn-outline btn-sm", function () {
        presetList.innerHTML = "";
        g.items.forEach(function (it) {
          var chip = UI.el("button", { class: "chip" }, [it]);
          chip.addEventListener("click", function () {
            currentPreset = { group: g.id, label: it };
            promptIn.value = buildPresetPrompt(g.id, it);
            presetInput.style.display = "";
            presetInput.placeholder = g.ph;
            presetInput.dataset.ph = g.ph;
          });
          presetList.appendChild(chip);
        });
      });
      presetRow.appendChild(b);
    });
    var btnSwap = UI.btn(t("fg.swap"), "btn-outline btn-sm", function () {
      // 换一组随机模板
      var g = PRESET_GROUPS[Math.floor(Math.random() * PRESET_GROUPS.length)];
      var it = g.items[Math.floor(Math.random() * g.items.length)];
      promptIn.value = buildPresetPrompt(g.id, it);
      currentPreset = { group: g.id, label: it };
      presetInput.style.display = ""; presetInput.placeholder = g.ph;
    });
    var btnRef = UI.btn(t("fg.useRef"), "btn-outline btn-sm", function () {
      var rc = cards.find(function (c) { return c.role === "ref"; });
      if (!rc) { FF.Toast.show(t("fg.needRef"), "warn"); return; }
      promptIn.value += (promptIn.value ? "\n" : "") + t("fg.refAppend");
    });
    presetRow.appendChild(btnSwap);
    presetRow.appendChild(btnRef);

    var refHint = UI.el("div", { class: "hint-text" }, [t("fg.ref.none")]);
    var refZone = UI.dropzone({
      accept: "image/*", main: t("fg.ref.upload"), hint: t("fg.ref.hint"), height: "72px",
      onFiles: function (files) {
        var fr = new FileReader();
        fr.onload = function () {
          refImg = toAiRef(fr.result);
          refHint.textContent = t("fg.ref.set");
          // 也落一张到画布
          var img = new Image();
          img.onload = function () {
            cards.push({ id: ++seq, url: fr.result, img: img, w: 180, h: Math.round(180 * img.naturalHeight / img.naturalWidth), x: -60, y: 120, role: "ref", z: seq });
            draw();
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(files[0]);
      }
    });
    var styleHint = UI.el("div", { class: "hint-text" }, [t("fg.style.none")]);
    var clearStyleBtn = UI.btn(t("fg.style.clear"), "btn-ghost btn-sm", function () {
      cards.forEach(function (c) { if (c.role === "style") c.role = null; });
      syncRefFromCards(); draw();
    });
    clearStyleBtn.disabled = true;

    var ratioSel = UI.selectRow(t("fg.ratio"), RATIO_OPTS, "auto", {});
    var resSel = UI.selectRow(t("fg.res"), RES_OPTS, "1k", {});

    var genBtn = UI.btn(t("fg.generate"), "btn-primary", generate);
    var statusLine = UI.el("div", { class: "hint-text mt8" }, []);

    function buildPresetPrompt(groupId, item) {
      var base = "";
      switch (groupId) {
        case "map": base = "生成一张像素游戏场景（" + item + "）。要求：细节丰富、16-bit 像素风、光影自然，画面中不要出现文字与水印。内容："; break;
        case "char": base = "生成像素游戏角色素材（" + item + "）。要求：干净的 16-bit 像素风、轮廓清晰、角色居中、纯色背景，不要文字、水印、网格线。角色设定："; break;
        case "ui": base = "生成一张游戏 UI 素材（" + item + "）。要求：像素风、边缘干净利落、适合游戏界面使用，纯色或透明背景，不要文字水印（除非 UI 自身需要）。内容："; break;
        case "prop": base = "生成一个像素游戏道具图标（" + item + "）。要求：32×32 或 64×64 逻辑像素、轮廓清晰、纯色背景，不要文字与水印。道具："; break;
      }
      return base;
    }

    function composePrompt() {
      var p = promptIn.value.trim();
      if (!p) return null;
      var tail = "";
      if (styleRef) tail += "\n（风格参考：严格模仿所附风格参考图的像素风格、配色与渲染质感，但内容按描述生成。）";
      if (negIn.value.trim()) tail += "\n避免出现：" + negIn.value.trim() + "。";
      var ratio = ratioSel.value, res = resSel.value;
      if (ratio !== "auto") tail += "\n画面比例 " + ratio + "。";
      if (res === "2k") tail += "\n输出较高分辨率细节。"; else if (res === "4k") tail += "\n输出高分辨率细节。";
      return p + tail;
    }

    var generating = false;
    function generate() {
      if (generating) return;
      var prompt = composePrompt();
      if (!prompt) { FF.Toast.show(t("fg.needPrompt"), "warn"); return; }
      generating = true;
      genBtn.disabled = true;
      statusLine.textContent = t("fg.generating");
      var styleUrl = styleRef ? styleRef.url : null;
      var ref = refImg || (styleUrl ? toAiRef(styleUrl) : null);
      Ai.generate(prompt, ref)
        .then(function (r) {
          statusLine.textContent = t("fg.done");
          addImageFile(dataUrlToFile(r.dataUrl));
          Ai.pushHistory({ time: Date.now(), prompt: promptIn.value.trim(), dataUrl: r.dataUrl });
          renderHistory();
          FF.Toast.show(t("fg.done"), "ok");
        })
        .catch(function (e) {
          statusLine.textContent = e.message === "NO_KEY" ? t("fg.needKey") : t("fg.fail") + e.message;
          FF.Toast.show(e.message === "NO_KEY" ? t("fg.needKey") : String(e.message || e), "err");
        })
        .finally(function () { generating = false; genBtn.disabled = false; });
    }
    promptIn.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); generate(); }
    });
    function dataUrlToFile(dataUrl) {
      var bin = atob(dataUrl.split(",")[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], "generated.png", { type: "image/png" });
    }

    /* ---------- 保存 / 加载画布 ---------- */
    function saveProject() {
      var data = { v: 1, cards: cards.map(function (c) { return { url: c.url, x: c.x, y: c.y, w: c.w, h: c.h, role: c.role }; }), prompt: promptIn.value };
      var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      UI.download(blob, "frameforge_canvas.json");
    }
    function loadProject() {
      var inp = UI.el("input", { type: "file", accept: "application/json", style: { display: "none" } });
      inp.addEventListener("change", function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var d = JSON.parse(fr.result);
            cards = (d.cards || []).map(function (c, i) { c.id = ++seq; c.z = seq; return c; });
            if (d.prompt) promptIn.value = d.prompt;
            syncRefFromCards(); fitAll();
          } catch (e) { FF.Toast.show(t("fg.load.fail"), "err"); }
        };
        fr.readAsText(f);
      });
      inp.click();
    }

    /* ---------- 历史侧栏 ---------- */
    var histList = UI.el("div", { class: "fg-hist-list" });
    function renderHistory() {
      histList.innerHTML = "";
      var h = Ai.getHistory();
      if (!h.length) { histList.appendChild(UI.el("div", { class: "hint-text" }, [t("fg.hist.empty")])); return; }
      h.forEach(function (item, idx) {
        var row = UI.el("div", { class: "fg-hist-item" }, [
          UI.el("img", { src: item.url || (item.dataUrl || "") })
        ]);
        row.title = (item.prompt || "").slice(0, 120);
        row.addEventListener("click", function () {
          // 回填提示词并放回画布
          if (item.prompt) promptIn.value = item.prompt;
          if (item.dataUrl || item.url) addImageFile(dataUrlToFile(item.dataUrl || item.url));
        });
        histList.appendChild(row);
      });
    }
    renderHistory();

    var histPanel = UI.el("div", { class: "fg-hist" + (histExpanded ? "" : " collapsed") }, [
      UI.el("div", { class: "fg-hist-head" }, [
        UI.el("strong", {}, [t("fg.hist")]),
        UI.btn(t("fg.hist.tidy"), "btn-ghost btn-xs", function () { FF.Toast.show(t("fg.hist.tidied"), "ok"); }),
        UI.btn(t("common.collapse"), "btn-ghost btn-xs", function () {
          histExpanded = !histExpanded;
          histPanel.classList.toggle("collapsed", !histExpanded);
        })
      ]),
      histList
    ]);

    /* ---------- 组装 ---------- */
    input.appendChild(UI.el("div", { class: "pb-title" }, [t("fg.prompt")]));
    input.appendChild(promptIn);
    input.appendChild(UI.el("div", { class: "row mt8", style: { gap: "4px", flexWrap: "wrap" } }, [presetRow]));
    input.appendChild(presetList);
    input.appendChild(presetInput);
    input.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("fg.neg")]));
    input.appendChild(negIn);
    input.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("fg.ref")]));
    input.appendChild(refZone);
    input.appendChild(refHint);
    input.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", alignItems: "center" } }, [clearStyleBtn, styleHint]));
    input.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px" } }, [ratioSel.el, resSel.el]));
    input.appendChild(UI.el("div", { class: "mt14" }, [genBtn]));
    input.appendChild(statusLine);
    input.appendChild(UI.el("div", { class: "hint-text mt8" }, [t("fg.privacy")]));

    var layout = UI.el("div", { class: "fg-layout" }, [
      input,
      UI.el("div", { class: "fg-center" }, [bar, stageWrap]),
      histPanel
    ]);
    var root = UI.el("div", { class: "freegen-root" }, [back, layout]);

    var view = {
      root: root,
      onPaste: function (url) { addCardUrl(url); },
      cleanup: function () { document.removeEventListener("keydown", onKey); }
    };
    // 跨页提示词传递（特效库/大杂烩/rpgall → 自由生图）
    try {
      var tp = sessionStorage.getItem("ff.transferPrompt");
      if (tp) {
        promptIn.value = tp;
        sessionStorage.removeItem("ff.transferPrompt");
      }
    } catch (e) { /* noop */ }
    // 初始渲染
    setTimeout(function () { draw(); }, 0);
    return view;
  };
})();
