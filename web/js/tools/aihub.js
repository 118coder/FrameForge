/* FrameForge · AI 生图页合集（对齐 frameronin v5）：
 * 完美八方向 / 一图自定义 / 特效库 / UI&图标 / 生成大杂烩 / 像素创造 / API 生图（简单版） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var Ai = FF.Ai;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  /* ================= 公共 ================= */

  function fileToRef(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        resolve({ mime: file.type || "image/png", base64: fr.result.split(",")[1], url: fr.result });
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  function dataUrlToBlob(dataUrl) {
    var bin = atob(dataUrl.split(",")[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: "image/png" });
  }
  function backBtn() {
    var b = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("common.backhome")])]);
    b.addEventListener("click", function () { location.hash = "#/"; });
    return b;
  }
  function needKeyHint(status) {
    status.textContent = t("fg.needKey");
    status.style.color = "var(--danger)";
  }
  function runGen(status, btn, prompt, ref, onOk) {
    btn.disabled = true;
    status.style.color = "";
    status.textContent = t("fg.generating");
    Ai.generate(prompt, ref)
      .then(function (r) {
        status.textContent = t("fg.done");
        Ai.pushHistory({ time: Date.now(), prompt: prompt.slice(0, 200), dataUrl: r.dataUrl });
        onOk(r.dataUrl);
      })
      .catch(function (e) {
        status.textContent = e.message === "NO_KEY" ? t("fg.needKey") : t("fg.fail") + e.message;
        status.style.color = "var(--danger)";
      })
      .finally(function () { btn.disabled = false; });
  }
  function resultView(status, pane) {
    var box = UI.el("div", { class: "mt14" }, []);
    pane.appendChild(box);
    return function (dataUrl, label) {
      box.innerHTML = "";
      var img = UI.el("img", { class: "result-img", src: dataUrl });
      img.addEventListener("dblclick", function () { UI.lightbox(dataUrl, label || ""); });
      box.appendChild(UI.el("div", { class: "pb-title" }, [label || t("fg.result")]));
      var frame = UI.el("div", { class: "canvas-frame" }, [img]);
      box.appendChild(frame);
      var row = UI.el("div", { class: "btn-row mt8" }, [
        UI.btn(t("common.download") + " PNG", "btn-primary", function () {
          UI.download(dataUrlToBlob(dataUrl), (label || "result").replace(/\s+/g, "_") + ".png");
        }, "download"),
        UI.btn(t("common.toStash"), "btn-outline", function () { FF.Stash.add(dataUrl, (label || "result") + ".png"); })
      ]);
      box.appendChild(row);
    };
  }

  /* ================= 完美八方向 ================= */

  var BG_OPTS = [
    { v: "auto", label: "自动（纯色背景）" },
    { v: "green", label: "绿幕" }, { v: "blue", label: "蓝幕" },
    { v: "white", label: "白底" }, { v: "magenta", label: "洋红底" }
  ];

  FF.Tools.eightdir = function () {
    var sk = UI.pageSkeleton("mod.eightdir.t", "mod.eightdir.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());

    var intro = UI.el("div", { class: "hint-text" }, [t("ed.intro")]);
    var refData = null; // {mime, base64, url}
    var dz = UI.dropzone({
      accept: "image/*", main: t("ed.choose"), hint: t("ed.limits"), height: "110px",
      onFiles: function (files) {
        fileToRef(files[0]).then(function (r) {
          refData = r;
          info.textContent = t("pixel.loaded") + " ✓";
          preview.innerHTML = "";
          var img = UI.el("img", { class: "result-img sm", src: r.url });
          preview.appendChild(UI.el("div", { class: "canvas-frame" }, [img]));
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);
    var preview = UI.el("div", { class: "mt8" });

    var bgSel = UI.selectRow(t("ed.bg"), BG_OPTS, "auto", {});
    var nonPixelSw = UI.switchRow(t("ed.nonPixel"), false, function () {});
    var topDownSw = UI.switchRow(t("ed.topDown"), false, function () {});
    var descIn = UI.el("input", { type: "text", placeholder: t("ed.desc.ph") });

    var go = UI.btn(t("ed.go"), "btn-primary", function () {
      if (!refData) { info.textContent = t("ed.needImg"); info.style.color = "var(--danger)"; return; }
      var p = "参考图是一个游戏角色。请生成它的「八方向九宫格」像素图（3×3 网格）：" +
        "中心格为正面立绘（与参考图一致），周围 8 格按顺时针依次为：上(背面)、右上、右(侧面)、右下、下(正面)、左下、左(侧面)、左上。" +
        "要求：严格保持参考图角色的像素风格、配色、比例与细节；八个方向造型一致，仅朝向不同；角色大小一致居中；" +
        (nonPixelSw.value ? "保留原图非像素插画风。" : "干净的 16-bit 像素风；") +
        (topDownSw.value ? "采用约 60 度俯视视角。" : "") +
        "背景用" + (bgSel.value === "auto" ? "统一纯色" : BG_OPTS.find(function (o) { return o.v === bgSel.value; }).label) +
        "；不要文字、水印、网格线。" +
        (descIn.value.trim() ? "补充：" + descIn.value.trim() : "");
      showResult.pending = true;
      runGen(status, go, p, refData, function (dataUrl) { showResult(dataUrl, t("ed.result")); });
    });
    var status = UI.el("div", { class: "hint-text mt8" }, []);
    var showResult = resultView(status, pane);

    pane.appendChild(intro);
    pane.appendChild(dz);
    pane.appendChild(info);
    pane.appendChild(preview);
    pane.appendChild(UI.el("div", { class: "mt8" }, [bgSel.el]));
    pane.appendChild(nonPixelSw.el);
    pane.appendChild(topDownSw.el);
    pane.appendChild(UI.el("div", { class: "mt8" }, [descIn]));
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    pane.appendChild(status);
    return { root: sk.root };
  };

  /* ================= 一图自定义（动作库） ================= */

  var ACTIONS = [
    { c: "移动", n: "行走（下/左/右/上 4×4）", f: 16 }, { c: "移动", n: "奔跑（下/左/右/上）", f: 16 },
    { c: "移动", n: "跳跃", f: 6 }, { c: "移动", n: "攀爬", f: 6 },
    { c: "攻击", n: "挥剑攻击", f: 6 }, { c: "攻击", n: "刺枪攻击", f: 6 },
    { c: "攻击", n: "射箭", f: 6 }, { c: "攻击", n: "施法", f: 8 },
    { c: "攻击", n: "多段连击", f: 10 }, { c: "攻击", n: "蓄力重击", f: 8 },
    { c: "待机", n: "待机呼吸", f: 4 }, { c: "待机", n: "待机张望", f: 6 },
    { c: "待机", n: "打坐", f: 6 }, { c: "待机", n: "睡觉", f: 4 },
    { c: "受击", n: "受击", f: 2 }, { c: "受击", n: "倒地", f: 4 },
    { c: "受击", n: "死亡", f: 6 }, { c: "交互", n: "坐下", f: 4 },
    { c: "交互", n: "采集（挖矿/伐木）", f: 8 }, { c: "交互", n: "钓鱼", f: 8 },
    { c: "交互", n: "开门", f: 4 }, { c: "交互", n: "喝水进食", f: 6 },
    { c: "转身", n: "自转一圈（八方向）", f: 8 }, { c: "表情", n: "欢呼", f: 6 }, { c: "表情", n: "哭泣", f: 6 }
  ];
  var COMMON_BG = ["#FFFFFF", "#00FF00", "#0000FF", "#800080", "#FF0000", "#FFFF00", "#808080", "#000000"];

  FF.Tools.customactions = function () {
    var sk = UI.pageSkeleton("mod.customactions.t", "mod.customactions.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());

    var picked = [];          // 选中的动作名
    var favs = [];            // 收藏组
    try { favs = JSON.parse(localStorage.getItem("ff.actions.favs") || "[]"); } catch (e) {}

    /* 动作库 */
    var searchIn = UI.el("input", { type: "text", placeholder: t("ca.search.ph") });
    var catSel = UI.el("select", {});
    ["全部"].concat(ACTIONS.map(function (a) { return a.c; }).filter(function (c, i, a) { return a.indexOf(c) === i; }))
      .forEach(function (c) { catSel.appendChild(UI.el("option", { value: c }, [c])); });
    var pickedInfo = UI.el("div", { class: "hint-text" }, []);
    var list = UI.el("div", { class: "ca-list" });
    function renderLib() {
      list.innerHTML = "";
      var q = searchIn.value.trim().toLowerCase();
      ACTIONS.forEach(function (a) {
        if (catSel.value !== "全部" && a.c !== catSel.value) return;
        if (q && a.n.toLowerCase().indexOf(q) < 0) return;
        var on = picked.indexOf(a.n) >= 0;
        var row = UI.el("div", { class: "ca-item" + (on ? " on" : "") }, [
          UI.el("span", { class: "ca-name" }, [a.n]),
          UI.el("span", { class: "ca-meta" }, [a.c + " · " + a.f + "帧"])
        ]);
        row.addEventListener("click", function () {
          var i = picked.indexOf(a.n);
          if (i >= 0) picked.splice(i, 1); else picked.push(a.n);
          renderLib(); updatePicked();
        });
        list.appendChild(row);
      });
    }
    function updatePicked() {
      pickedInfo.textContent = t("ca.picked") + picked.length + " · " + picked.slice(0, 4).join("、") + (picked.length > 4 ? "…" : "");
    }
    searchIn.addEventListener("input", renderLib);
    catSel.addEventListener("change", renderLib);

    /* 收藏 / 导入导出 */
    var favRow = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, [
      UI.btn(t("ca.fav.save"), "btn-outline btn-sm", function () {
        if (!picked.length) return;
        var name = prompt(t("ca.fav.name"), "预设 " + (favs.length + 1));
        if (!name) return;
        favs.push({ name: name, actions: picked.slice() });
        try { localStorage.setItem("ff.actions.favs", JSON.stringify(favs.slice(0, 50))); } catch (e) {}
        renderFavs();
      }),
      UI.btn(t("ca.export"), "btn-outline btn-sm", function () {
        UI.download(new Blob([JSON.stringify({ actions: picked })], { type: "application/json" }), "自定义动作选择.json");
      }),
      UI.btn(t("ca.import"), "btn-outline btn-sm", function () {
        var inp = UI.el("input", { type: "file", accept: "application/json", style: { display: "none" } });
        inp.addEventListener("change", function () {
          var fr = new FileReader();
          fr.onload = function () {
            try {
              var d = JSON.parse(fr.result);
              picked = (d.actions || []).filter(function (x) { return ACTIONS.some(function (a) { return a.n === x; }); });
              renderLib(); updatePicked();
            } catch (e) { FF.Toast.show(t("ca.import.fail"), "err"); }
          };
          fr.readAsText(inp.files[0]);
        });
        inp.click();
      }),
      UI.btn(t("ca.clear"), "btn-ghost btn-sm", function () { picked = []; renderLib(); updatePicked(); })
    ]);
    var favList = UI.el("div", { class: "ca-favs" });
    function renderFavs() {
      favList.innerHTML = "";
      favs.forEach(function (f, i) {
        var chip = UI.el("button", { class: "chip" }, [f.name + " (" + f.actions.length + ")"]);
        chip.addEventListener("click", function () { picked = f.actions.slice(); renderLib(); updatePicked(); });
        var del = UI.el("button", { class: "chip-x" }, ["✕"]);
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          favs.splice(i, 1);
          try { localStorage.setItem("ff.actions.favs", JSON.stringify(favs)); } catch (e2) {}
          renderFavs();
        });
        chip.appendChild(del);
        favList.appendChild(chip);
      });
    }

    /* 角色设定 */
    var descIn = UI.el("textarea", { class: "fg-prompt sm", placeholder: t("ca.desc.ph") });
    var refData = null;
    var refZone = UI.dropzone({
      accept: "image/*", main: t("ca.ref"), hint: t("ca.ref.hint"), height: "72px",
      onFiles: function (files) { fileToRef(files[0]).then(function (r) { refData = r; refHint.textContent = "✓"; }); }
    });
    var refHint = UI.el("div", { class: "hint-text" }, []);
    var bgRow = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, []);
    var bgColor = "#00FF00";
    COMMON_BG.forEach(function (c) {
      var b = UI.el("button", { class: "color-dot", title: c });
      b.style.background = c;
      b.addEventListener("click", function () {
        bgColor = c;
        bgRow.querySelectorAll(".color-dot").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        bgHex.value = c;
      });
      bgRow.appendChild(b);
    });
    var bgHex = UI.el("input", { type: "text", value: bgColor, style: { width: "90px" } });
    bgHex.addEventListener("change", function () { if (/^#[0-9a-fA-F]{6}$/.test(bgHex.value)) bgColor = bgHex.value; });

    var go = UI.btn(t("ca.go"), "btn-primary", function () {
      if (!picked.length) { status.textContent = t("ca.needAction"); status.style.color = "var(--danger)"; return; }
      if (!descIn.value.trim() && !refData) { status.textContent = t("ca.needChar"); status.style.color = "var(--danger)"; return; }
      var p = "生成一张像素角色多动作序列表（sprite sheet）。要求：" +
        "包含以下动作，每个动作占一行（从左到右为该动作的连续帧）：" +
        picked.map(function (n) {
          var a = ACTIONS.find(function (x) { return x.n === n; });
          return n + "（约 " + a.f + " 帧）";
        }).join("；") + "。" +
        "角色在各动作间大小、比例、配色完全一致；干净的 16-bit 像素风；背景为纯色 " + bgColor + "；" +
        "不要文字、水印、格线。" +
        (refData ? "严格以参考图角色为准生成。" : "") +
        (descIn.value.trim() ? "角色设定：" + descIn.value.trim() : "");
      runGen(status, go, p, refData, function (dataUrl) { showResult(dataUrl, t("ca.result")); });
    });
    var status = UI.el("div", { class: "hint-text mt8" }, []);
    var showResult = resultView(status, pane);

    pane.appendChild(UI.el("div", { class: "pb-title" }, [t("ca.lib")]));
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px" } }, [searchIn, catSel]));
    pane.appendChild(list);
    pane.appendChild(pickedInfo);
    pane.appendChild(favRow);
    pane.appendChild(favList);
    pane.appendChild(UI.el("div", { class: "pb-title mt14" }, [t("ca.charTitle")]));
    pane.appendChild(descIn);
    pane.appendChild(refZone);
    pane.appendChild(refHint);
    pane.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("ca.bg")]));
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "8px", alignItems: "center" } }, [bgRow, bgHex]));
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    pane.appendChild(status);
    renderLib(); updatePicked(); renderFavs();
    return { root: sk.root };
  };

  /* ================= 特效库 ================= */

  var EFFECTS = [
    { c: "攻击", e: "火", n: "火焰斩" }, { c: "攻击", e: "火", n: "火球爆发" }, { c: "攻击", e: "火", n: "烈焰冲击波" },
    { c: "攻击", e: "冰", n: "冰霜斩" }, { c: "攻击", e: "冰", n: "寒冰穿刺" }, { c: "攻击", e: "雷", n: "雷电斩" },
    { c: "攻击", e: "雷", n: "落雷" }, { c: "攻击", e: "风", n: "旋风斩" }, { c: "攻击", e: "暗", n: "暗影突袭" },
    { c: "攻击", e: "光", n: "圣光斩" }, { c: "攻击", e: "毒", n: "毒雾喷射" },
    { c: "防御", e: "光", n: "圣光护盾" }, { c: "防御", e: "冰", n: "冰甲" }, { c: "防御", e: "火", n: "火焰结界" },
    { c: "防御", e: "风", n: "风之屏障" },
    { c: "治疗", e: "光", n: "治愈之光" }, { c: "治疗", e: "自然", n: "生命绽放" }, { c: "治疗", e: "水", n: "净化水波" },
    { c: "元素", e: "火", n: "陨石坠落" }, { c: "元素", e: "冰", n: "冰封领域" }, { c: "元素", e: "雷", n: "雷暴" },
    { c: "元素", e: "水", n: "水龙卷" }, { c: "元素", e: "土", n: "大地尖刺" }, { c: "元素", e: "暗", n: "黑洞" },
    { c: "移动", e: "风", n: "疾风步" }, { c: "移动", e: "暗", n: "瞬影" }, { c: "移动", e: "光", n: "闪光跳跃" },
    { c: "状态", e: "火", n: "燃烧debuff" }, { c: "状态", e: "冰", n: "冰冻debuff" }, { c: "状态", e: "毒", n: "中毒气泡" },
    { c: "状态", e: "雷", n: "麻痹电弧" }, { c: "场景", e: "光", n: "传送阵" }, { c: "场景", e: "暗", n: "魔法阵召唤" },
    { c: "场景", e: "自然", n: "落叶飘零" }, { c: "场景", e: "水", n: "涟漪" }, { c: "场景", e: "火", n: "篝火" }
  ];
  var COLORS = [
    { id: "orig", label: "原配色", hex: null }, { id: "fire", label: "火焰橙", hex: "#ff7a1a" },
    { id: "red", label: "赤红", hex: "#ff2a2a" }, { id: "gold", label: "金黄", hex: "#ffc61a" },
    { id: "green", label: "翠绿", hex: "#37c837" }, { id: "teal", label: "青绿", hex: "#1fbf9f" },
    { id: "water", label: "水蓝", hex: "#2a9dff" }, { id: "ice", label: "冰蓝", hex: "#8fdcff" },
    { id: "deep", label: "深蓝", hex: "#2a3cff" }, { id: "purple", label: "紫色", hex: "#a04aff" },
    { id: "pink", label: "粉色", hex: "#ff5ad9" }, { id: "white", label: "纯白", hex: "#ffffff" }
  ];

  FF.Tools.effects = function () {
    var sk = UI.pageSkeleton("mod.effects.t", "mod.effects.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());

    var favs = [];
    try { favs = JSON.parse(localStorage.getItem("ff.effect.favs") || "[]"); } catch (e) {}
    var searchIn = UI.el("input", { type: "text", placeholder: t("ef.search.ph") });
    var catSel = UI.el("select", {});
    ["全部"].concat(EFFECTS.map(function (x) { return x.c; }).filter(function (c, i, a) { return a.indexOf(c) === i; }))
      .forEach(function (c) { catSel.appendChild(UI.el("option", { value: c }, [c])); });
    var list = UI.el("div", { class: "ef-grid" });
    var detail = UI.el("div", { class: "ef-detail mt14" });

    function renderList() {
      list.innerHTML = "";
      var q = searchIn.value.trim().toLowerCase();
      var showFav = q === "♥" || q === "fav";
      EFFECTS.forEach(function (ef) {
        var isFav = favs.indexOf(ef.n) >= 0;
        if (showFav && !isFav) return;
        if (!showFav) {
          if (catSel.value !== "全部" && ef.c !== catSel.value) return;
          if (q && (ef.n + ef.e + ef.c).toLowerCase().indexOf(q) < 0) return;
        }
        var card = UI.el("div", { class: "ef-card" + (isFav ? " fav" : "") }, [
          UI.el("div", { class: "ef-name" }, [ef.n]),
          UI.el("div", { class: "ef-meta" }, [ef.c + " · " + ef.e]),
          UI.el("button", { class: "ef-fav", title: t("ef.fav") }, [isFav ? "♥" : "♡"])
        ]);
        card.addEventListener("click", function () { showDetail(ef); });
        card.querySelector(".ef-fav").addEventListener("click", function (e) {
          e.stopPropagation();
          var i = favs.indexOf(ef.n);
          if (i >= 0) favs.splice(i, 1); else favs.push(ef.n);
          try { localStorage.setItem("ff.effect.favs", JSON.stringify(favs)); } catch (e2) {}
          renderList();
        });
        list.appendChild(card);
      });
      if (!list.children.length) list.appendChild(UI.el("div", { class: "hint-text" }, [t("ef.none")]));
    }

    function showDetail(ef) {
      detail.innerHTML = "";
      var colorSel;
      var colorRowEl = UI.el("div", { class: "row", style: { gap: "5px", flexWrap: "wrap" } }, []);
      var picked = COLORS[0];
      COLORS.forEach(function (c) {
        var b = UI.el("button", { class: "color-dot", title: c.label });
        if (c.hex) b.style.background = c.hex;
        else { b.textContent = "原"; b.style.background = "#555"; b.style.color = "#fff"; }
        b.addEventListener("click", function () {
          picked = c;
          colorRowEl.querySelectorAll(".color-dot").forEach(function (x) { x.classList.remove("on"); });
          b.classList.add("on");
        });
        colorRowEl.appendChild(b);
      });
      detail.appendChild(UI.el("div", { class: "pb-title" }, [ef.n + " · " + t("ef.color")]));
      detail.appendChild(colorRowEl);
      detail.appendChild(UI.el("div", { class: "hint-text mt8" }, [t("ef.genHint")]));
      var go = UI.btn(t("ef.goFreegen"), "btn-primary", function () {
        var colorTxt = picked.hex ? "整体配色改为 " + picked.label + "（" + picked.hex + "）为主色调" : "使用该特效的常规配色";
        var p = "生成一张像素游戏特效序列帧（sprite sheet，单行 6 帧）：动作「" + ef.n + "」（分类：" + ef.c + "，元素：" + ef.e + "）。" +
          colorTxt + "；纯黑背景（后期抠图用）；特效主体居中；帧间连贯；不要文字、水印、角色。";
        try {
          sessionStorage.setItem("ff.transferPrompt", p);
          location.hash = "#/freegen";
          FF.Toast.show(t("ef.sent"), "ok");
        } catch (e) { /* noop */ }
      });
      detail.appendChild(UI.el("div", { class: "mt8" }, [go]));
      detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    searchIn.addEventListener("input", renderList);
    catSel.addEventListener("change", renderList);
    pane.appendChild(UI.el("div", { class: "row", style: { gap: "6px" } }, [searchIn, catSel]));
    pane.appendChild(list);
    pane.appendChild(detail);
    renderList();
    return { root: sk.root };
  };

  /* ================= UI&图标 ================= */

  FF.Tools.uiicons = function () {
    var sk = UI.pageSkeleton("mod.uiicons.t", "mod.uiicons.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());

    var modeSel = UI.selectRow(t("ui.mode"), [
      { v: "btn", label: t("ui.mode.btn") }, { v: "panel", label: t("ui.mode.panel") },
      { v: "bar", label: t("ui.mode.bar") }, { v: "icon", label: t("ui.mode.icon") },
      { v: "gen", label: t("ui.mode.gen") }
    ], "btn", {});

    var refData = null;
    var refZone = UI.dropzone({
      accept: "image/*", main: t("ui.ref"), hint: t("ui.ref.hint"), height: "72px",
      onFiles: function (files) { fileToRef(files[0]).then(function (r) { refData = r; refHint.textContent = "✓"; }); }
    });
    var refHint = UI.el("div", { class: "hint-text" }, []);
    var descIn = UI.el("textarea", { class: "fg-prompt sm", placeholder: t("ui.desc.ph") });
    var ratioSel = UI.selectRow(t("ui.ratio"), [
      { v: "auto", label: "auto" }, { v: "1:1", label: "1:1" }, { v: "16:9", label: "16:9" }, { v: "4:3", label: "4:3" }
    ], "1:1", {});
    var transparentSw = UI.switchRow(t("ui.transparent"), true, function () {});

    var MODE_PROMPTS = {
      btn: "单独提取参考图中的主按钮 UI 元素。保留原有形状、配色、边框与装饰，移除按钮文字，完整居中呈现。",
      panel: "单独提取参考图中的主面板。保留面板底板、边框、材质和装饰，去掉其中的文字、物品、按钮及其他界面元素。",
      bar: "单独提取参考图中的生命/魔法状态条。保留条形框架、填充颜色和端部装饰，移除数值文字及周围无关内容。",
      icon: "单独提取参考图中指定的物品图标。保留原画风、配色和轮廓，移除格子底板、数量文字及其他界面内容。",
      gen: ""
    };

    var go = UI.btn(t("ui.go"), "btn-primary", function () {
      var mode = modeSel.value;
      var p;
      if (mode === "gen") {
        p = "生成一个像素游戏图标：" + descIn.value.trim() + "。" +
          "16-bit 像素游戏风格，硬边轮廓，轮廓清晰，居中构图。" +
          (refData ? "参考所附图片的画风、配色、材质和描边风格（不要复制其界面布局）。" : "") +
          (transparentSw.value ? "透明或纯色背景。" : "") + "不要文字与水印。";
      } else {
        p = MODE_PROMPTS[mode] + (descIn.value.trim() ? " 补充：" + descIn.value.trim() : "") +
          (refData ? "严格基于参考图。" : "（此类提取任务需要参考图）") +
          (transparentSw.value ? " 输出为透明背景元素。" : "");
      }
      if (!refData && mode !== "gen") { status.textContent = t("ui.needRef"); status.style.color = "var(--danger)"; return; }
      if (!p.trim()) { status.textContent = t("ui.needDesc"); status.style.color = "var(--danger)"; return; }
      runGen(status, go, p, refData, function (dataUrl) { showResult(dataUrl, t("ui.result")); });
    });
    var status = UI.el("div", { class: "hint-text mt8" }, []);
    var showResult = resultView(status, pane);

    pane.appendChild(modeSel.el);
    pane.appendChild(refZone);
    pane.appendChild(refHint);
    pane.appendChild(descIn);
    pane.appendChild(UI.el("div", { class: "mt8" }, [ratioSel.el]));
    pane.appendChild(transparentSw.el);
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    pane.appendChild(status);
    return { root: sk.root };
  };

  /* ================= 生成大杂烩 ================= */

  var POTPOURRI = [
    { n: "吞食天地（S）", d: "FC 吞食天地风格角色" },
    { n: "RPG 骑马（潜墨千羽）", d: "骑马动作 RPG 角色" },
    { n: "RPGMakerXP", d: "RPG Maker XP 风格行走图" },
    { n: "RPGMakerVX", d: "RPG Maker VX 风格行走图" },
    { n: "横版剑士一套（小苏早睡）", d: "横版动作剑士全套" },
    { n: "RPGMaker V1", d: "VX 走图 3×4" },
    { n: "RPGMaker V1.1", d: "四方向完整走图" },
    { n: "RPGMaker V3", d: "大像素 V3 走图" },
    { n: "V2 预设", d: "上下右移动、倒地、攻击" },
    { n: "V2.2 预设", d: "V2 增强" },
    { n: "V3 预设", d: "增加斜方向与爬梯" },
    { n: "僵尸 B1", d: "像素僵尸怪物" },
    { n: "僵尸 B2", d: "像素僵尸变体" },
    { n: "V2.3OT", d: "大像素 2:1 角色" },
    { n: "正视角场景", d: "16-bit 正视角场景" },
    { n: "45 度场景", d: "斜 45 度场景" },
    { n: "泰拉场景", d: "泰拉瑞亚风格场景" },
    { n: "街机场景", d: "复古街机场景" },
    { n: "立绘生成", d: "像素立绘角色" },
    { n: "连生动作 V4Tx3", d: "A0/A1/A2 三套动作" },
    { n: "横版人物生成", d: "横版角色动作" },
    { n: "八方向 TopDown", d: "俯视八方向角色" },
    { n: "骑马动作", d: "骑马行走动作" },
    { n: "一图全动作", d: "单图全套动作" },
    { n: "一图全动作 2", d: "全动作续表" },
    { n: "狗", d: "像素狗（待机/走/跑）" },
    { n: "鸟怪", d: "像素鸟形怪物" },
    { n: "只因", d: "网络梗像素角色" }
  ];

  FF.Tools.potpourri = function () {
    var sk = UI.pageSkeleton("mod.potpourri.t", "mod.potpourri.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());
    var grid = UI.el("div", { class: "grid-lg pp-grid" });
    POTPOURRI.forEach(function (p) {
      var card = UI.el("div", { class: "card-sm clickable" }, [
        UI.el("div", { class: "card-title" }, [p.n]),
        UI.el("div", { class: "card-desc" }, [p.d])
      ]);
      card.addEventListener("click", function () {
        sessionStorage.setItem("ff.transferPrompt", "生成像素游戏素材（风格模板：" + p.n + "，" + p.d + "）。" +
          "严格按该模板的画风、像素规格与布局生成，纯色背景，不要文字、水印、网格线。内容按用户描述。");
        location.hash = "#/freegen";
      });
      grid.appendChild(card);
    });
    pane.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("pp.hint")]));
    pane.appendChild(grid);
    return { root: sk.root };
  };

  /* ================= 像素创造 ================= */

  var PC_PRESETS = [
    { c: "移动", n: "行走循环", p: "角色原地向右行走，固定镜头，角色居中，循环动画", f: 8 },
    { c: "移动", n: "奔跑循环", p: "角色原地奔跑，衣服与头发随风摆动，固定镜头", f: 8 },
    { c: "移动", n: "跳跃", p: "角色原地起跳并落地，固定镜头", f: 8 },
    { c: "攻击", n: "挥剑", p: "角色原地挥剑攻击，动作连贯有力，固定镜头", f: 8 },
    { c: "攻击", n: "施法", p: "角色举手施法，掌心出现魔法光效，固定镜头", f: 10 },
    { c: "攻击", n: "射箭", p: "角色拉弓射箭，箭矢飞出，固定镜头", f: 8 },
    { c: "待机", n: "呼吸待机", p: "角色原地轻微呼吸起伏待机，固定镜头", f: 6 },
    { c: "待机", n: "打坐", p: "角色盘腿打坐，周身有微微光点浮动", f: 8 },
    { c: "受击", n: "受击后退", p: "角色受击后仰再恢复，固定镜头", f: 6 },
    { c: "转身", n: "自转一圈", p: "角色原地自转一圈（八个朝向依次展现），固定镜头", f: 8 }
  ];

  FF.Tools.pixelcreate = function () {
    var sk = UI.pageSkeleton("mod.pixelcreate.t", "mod.pixelcreate.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());

    var refData = null;
    var dz = UI.dropzone({
      accept: "image/*", main: t("pc.choose"), hint: t("pc.hint"), height: "100px",
      onFiles: function (files) {
        fileToRef(files[0]).then(function (r) {
          refData = r;
          info.textContent = "✓ " + t("pc.refReady");
        });
      }
    });
    var info = UI.el("div", { class: "hint-text mt8" }, []);

    var promptIn = UI.el("textarea", { class: "fg-prompt", placeholder: t("pc.prompt.ph") });
    var presetList = UI.el("div", { class: "fg-preset-list" });
    var presetSearch = UI.el("input", { type: "text", placeholder: t("pc.preset.search") });
    function renderPresets() {
      presetList.innerHTML = "";
      var q = presetSearch.value.trim().toLowerCase();
      PC_PRESETS.forEach(function (p) {
        if (q && (p.n + p.p).toLowerCase().indexOf(q) < 0) return;
        var chip = UI.el("button", { class: "chip" }, [p.n + " · " + p.f + "帧"]);
        chip.addEventListener("click", function () {
          promptIn.value = "保持角色外观和像素风格一致。" + p.p + "。角色居中，纯色背景，不要文字与水印。";
          framesSel.set(String(p.f));
        });
        presetList.appendChild(chip);
      });
    }
    presetSearch.addEventListener("input", renderPresets);

    var framesSel = UI.selectRow(t("pc.frames"), [
      { v: "6", label: "6 帧" }, { v: "12", label: "12 帧" }, { v: "24", label: "24 帧" }, { v: "36", label: "36 帧" }, { v: "54", label: "54 帧" }
    ], "8", {});

    var matteSw = UI.switchRow(t("pc.matte"), true, function () {});
    var tolSlider = UI.slider(t("pc.tol"), 10, 150, 60, {});
    var bgSel = UI.selectRow(t("pc.bg"), [
      { v: "#00FF00", label: t("pc.bg.green") }, { v: "#0000FF", label: t("pc.bg.blue") },
      { v: "#FFFFFF", label: t("pc.bg.white") }, { v: "#000000", label: t("pc.bg.black") },
      { v: "#FF00FF", label: t("pc.bg.magenta") }
    ], "#00FF00", {});

    var go = UI.btn(t("pc.go"), "btn-primary", function () {
      if (!refData) { status.textContent = t("pc.needRef"); status.style.color = "var(--danger)"; return; }
      if (!promptIn.value.trim()) { status.textContent = t("pc.needPrompt"); status.style.color = "var(--danger)"; return; }
      var p = "参考图是一个像素游戏角色。请生成它做指定动作的像素动画序列表（sprite sheet，单行 " + framesSel.value + " 帧）。" +
        "要求：每帧角色大小、比例、配色与参考图完全一致；动作在帧间连贯流畅；干净的像素风；" +
        "背景为纯色 " + bgSel.value + "（便于后期抠图）；不要文字、水印、格线。" +
        "动作描述：" + promptIn.value.trim();
      runGen(status, go, p, refData, function (dataUrl) {
        showResult(dataUrl, t("pc.result"));
        showResult.stashIt && showResult.stashIt();
      });
    });
    var status = UI.el("div", { class: "hint-text mt8" }, []);
    var showResult = resultView(status, pane);

    pane.appendChild(dz);
    pane.appendChild(info);
    pane.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("pc.prompt")]));
    pane.appendChild(promptIn);
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px" } }, [presetSearch]));
    pane.appendChild(presetList);
    pane.appendChild(UI.el("div", { class: "mt8" }, [framesSel.el]));
    pane.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("pc.pre")]));
    pane.appendChild(matteSw.el);
    pane.appendChild(tolSlider.el);
    pane.appendChild(bgSel.el);
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    pane.appendChild(status);
    renderPresets();
    return { root: sk.root };
  };

  /* ================= API 生图（简单版，对齐原站「API 生图/武器配置」） ================= */

  var API_PRESETS = [
    { g: "三国风", n: "三国骑兵", d: "三国风骑兵角色" },
    { g: "三国风", n: "弓兵", d: "三国风弓箭手" },
    { g: "三国风", n: "枪兵", d: "三国风长枪兵" },
    { g: "三国风", n: "剑兵", d: "三国风剑士" },
    { g: "一图系列", n: "一图八项攻击", d: "八种攻击动作一张图" },
    { g: "一图系列", n: "一图钓鱼采集", d: "钓鱼与采集动作" },
    { g: "一图系列", n: "一图挖矿砍树", d: "挖矿与伐木动作" },
    { g: "创作工具", n: "自由序列", d: "自由描述动作生成序列帧" },
    { g: "创作工具", n: "快速换皮", d: "保留动作替换角色" },
    { g: "武器配置", n: "武器 1000+", d: "按武器编号生成持武器角色动作" }
  ];

  FF.Tools.apiimage = function () {
    var sk = UI.pageSkeleton("mod.apiimage.t", "mod.apiimage.d", null);
    var pane = sk.card;
    pane.appendChild(backBtn());

    var descIn = UI.el("textarea", { class: "fg-prompt", placeholder: t("ai.desc.ph") });
    var refData = null;
    var refZone = UI.dropzone({
      accept: "image/*", main: t("fg.ref.upload"), hint: t("ca.ref.hint"), height: "72px",
      onFiles: function (files) { fileToRef(files[0]).then(function (r) { refData = r; refHint.textContent = "✓"; }); }
    });
    var refHint = UI.el("div", { class: "hint-text" }, []);
    var drawSlider = UI.slider(t("ai.draws"), 1, 4, 1, {});
    var matteSw = UI.switchRow(t("ai.matte"), true, function () {});

    /* 预设卡 */
    var presetGrid = UI.el("div", { class: "grid-sm" });
    var activePreset = null;
    API_PRESETS.forEach(function (p) {
      var card = UI.el("div", { class: "card-sm clickable" }, [
        UI.el("div", { class: "card-title" }, [p.n]),
        UI.el("div", { class: "card-desc" }, [p.g + " · " + p.d])
      ]);
      card.addEventListener("click", function () {
        activePreset = p;
        presetGrid.querySelectorAll(".card-sm").forEach(function (x) { x.classList.remove("sel"); });
        card.classList.add("sel");
      });
      presetGrid.appendChild(card);
    });

    /* 结果（抽卡） */
    var drawResults = UI.el("div", { class: "mt14" }, []);
    var status = UI.el("div", { class: "hint-text mt8" }, []);

    var go = UI.btn(t("ai.go") + "（×N）", "btn-primary", function () {
      var n = drawSlider.value;
      var presetTxt = activePreset ? "（模板：" + activePreset.n + "，" + activePreset.d + "）" : "";
      var p = "生成像素游戏角色素材" + presetTxt + "。要求：干净的 16-bit 像素风、轮廓清晰、纯色背景" +
        (matteSw.value ? "（绿色 #00FF00 便于抠图）" : "") + "，不要文字、水印、网格线。" +
        (refData ? "严格以参考图角色为准。" : "") +
        "角色设定：" + (descIn.value.trim() || "随机设计一个有趣的角色");
      go.disabled = true;
      status.style.color = "";
      status.textContent = t("fg.generating");
      var done = 0;
      drawResults.innerHTML = "";
      for (var i = 0; i < n; i++) {
        (function (idx) {
          Ai.generate(p, refData)
            .then(function (r) {
              var img = UI.el("img", { class: "result-img sm", src: r.dataUrl });
              img.addEventListener("dblclick", function () { UI.lightbox(r.dataUrl, "抽卡 " + (idx + 1)); });
              var cell = UI.el("div", { class: "canvas-frame" }, [img]);
              cell.appendChild(UI.el("div", { class: "frame-note" }, ["#" + (idx + 1)]));
              var ops = UI.el("div", { class: "btn-row mt8" }, [
                UI.btn(t("common.download"), "btn-outline btn-sm", function () {
                  UI.download(dataUrlToBlob(r.dataUrl), "draw_" + (idx + 1) + ".png");
                }),
                UI.btn(t("common.toStash"), "btn-ghost btn-sm", function () { FF.Stash.add(r.dataUrl, "draw_" + (idx + 1) + ".png"); })
              ]);
              drawResults.appendChild(UI.el("div", { style: { display: "inline-block", margin: "6px", verticalAlign: "top" } }, [cell, ops]));
              Ai.pushHistory({ time: Date.now(), prompt: p.slice(0, 200), dataUrl: r.dataUrl });
            })
            .catch(function (e) {
              status.textContent = e.message === "NO_KEY" ? t("fg.needKey") : t("fg.fail") + e.message;
              status.style.color = "var(--danger)";
            })
            .finally(function () {
              done++;
              status.textContent = t("ai.progress") + done + "/" + n;
              if (done >= n) { go.disabled = false; if (!status.style.color) status.textContent = t("fg.done"); }
            });
        })(i);
      }
    });

    pane.appendChild(UI.el("div", { class: "pb-title" }, [t("ai.presets")]));
    pane.appendChild(presetGrid);
    pane.appendChild(UI.el("div", { class: "pb-title mt14" }, [t("ai.desc")]));
    pane.appendChild(descIn);
    pane.appendChild(refZone);
    pane.appendChild(refHint);
    pane.appendChild(UI.el("div", { class: "mt8" }, [drawSlider.el]));
    pane.appendChild(matteSw.el);
    pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    pane.appendChild(status);
    pane.appendChild(drawResults);
    return { root: sk.root };
  };
})();
