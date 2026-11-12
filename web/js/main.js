/* FrameForge · 应用入口：路由 / 首页 / 快捷键 / 主题 / 弹窗 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;

  /* ============================================================
   * 模块注册表
   * ============================================================ */

  var MODULES = [
    /* -- AI 生成区 -- */
    { id: "freegen", route: "#/freegen", icon: "ai", key: "Z", size: "lg", enabled: true, badges: ["badge.core"], cat: "ai" },
    { id: "ai",      route: "#/ai",      icon: "ai",  key: "X", size: "lg", enabled: true, badges: ["badge.new"], cat: "ai" },
    { id: "apiimage", route: "#/apiimage", icon: "ai", key: "", size: "lg", enabled: true, cat: "ai" },
    { id: "eightdir", route: "#/eightdir", icon: "grid", key: "", size: "lg", enabled: true, badges: ["badge.new"], cat: "ai" },
    { id: "pixelcreate", route: "#/pixelcreate", icon: "ai", key: "", size: "lg", enabled: true, cat: "ai" },
    { id: "customactions", route: "#/customactions", icon: "grid", key: "", size: "lg", enabled: true, cat: "ai" },
    { id: "effects", route: "#/effects", icon: "pixel", key: "", size: "lg", enabled: true, badges: ["badge.free"], cat: "ai" },
    { id: "uiicons", route: "#/uiicons", icon: "ps",   key: "", size: "lg", enabled: true, cat: "ai" },
    { id: "potpourri", route: "#/potpourri", icon: "ai", key: "", size: "sm", enabled: true, cat: "ai" },
    { id: "videogen",  route: "#/videogen",  icon: "video", key: "", size: "lg", enabled: true, cat: "ai" },
    { id: "scenechar", route: "#/scenechar", icon: "ai",    key: "", size: "lg", enabled: true, cat: "ai" },
    { id: "lab",     route: "#/lab",     icon: "hd2d",  key: "", size: "lg", enabled: true, badges: ["badge.new"], cat: "ai" },
    /* -- 图像处理区 -- */
    { id: "video",  route: "#/video",  icon: "video",   key: "V", size: "lg", enabled: true, cat: "tools" },
    { id: "map",    route: "#/map",    icon: "map",     key: "M", size: "lg", enabled: true, badges: ["badge.friendly"], cat: "tools" },
    { id: "chroma", route: "#/chroma", icon: "scissors", key: "K", size: "lg", enabled: true, cat: "tools" },
    { id: "sheet",  route: "#/sheet",  icon: "grid",    key: "S", size: "lg", enabled: true, cat: "tools" },
    { id: "gif",    route: "#/gif",    icon: "film",    key: "G", size: "lg", enabled: true, cat: "tools" },
    { id: "gifcomp", route: "#/gifcomposer", icon: "film",  key: "", size: "lg", enabled: true, cat: "tools" },
    { id: "pixel",  route: "#/pixel",  icon: "pixel",   key: "W", size: "lg", enabled: true, badges: ["badge.onekey"], cat: "tools" },
    { id: "layers", route: "#/layers", icon: "layers",  key: "L", size: "lg", enabled: true, cat: "tools" },
    { id: "pixelplus", route: "#/pixelplus", icon: "pixel", key: "F", size: "lg", enabled: true, cat: "tools" },
    { id: "tile",   route: "#/tile",   icon: "tile",    key: "",  size: "sm", enabled: true, cat: "tools" },
    /* -- 效率工具区 -- */
    { id: "pro",    route: "#/pro",    icon: "pixel",   key: "R", size: "lg", enabled: true, cat: "pro" },
    { id: "flow",   route: "#/flow",   icon: "hd2d",    key: "T", size: "lg", enabled: true, badges: ["badge.new"], cat: "pro" },
    { id: "gwm",    route: "#/gwm",    icon: "ps",      key: "", size: "lg", enabled: true, cat: "pro" },
    { id: "rseprite", route: "#/rseprite", icon: "ps",   key: "E", size: "lg", enabled: true, badges: ["badge.new"], cat: "pro" },
    { id: "chat",   route: "#/chat",   icon: "ai",      key: "C", size: "lg", enabled: true, cat: "pro" },
    /* -- 资源与说明区 -- */
    { id: "guide",     route: "#/guide",     icon: "video",  key: "P", size: "sm", enabled: true, cat: "res" },
    { id: "assets",    route: "#/assets",    icon: "layers", key: "", size: "sm", enabled: true, cat: "res" },
    { id: "freechars", route: "#/freechars", icon: "grid",   key: "", size: "sm", enabled: true, badges: ["badge.free"], cat: "res" },
    { id: "skills2",   route: "#/skills",    icon: "ai",     key: "", size: "sm", enabled: true, cat: "res" },
    { id: "building",  route: "#/building",  icon: "hd2d",   key: "", size: "sm", enabled: true, cat: "res" },
    { id: "npc",       route: "#/npc",       icon: "grid",   key: "", size: "sm", enabled: true, cat: "res" },
    { id: "terrain",   route: "#/terrain",   icon: "map",    key: "", size: "sm", enabled: true, cat: "res" },
    { id: "hd2d",      route: "#/hd2d",      icon: "hd2d",   key: "", size: "sm", enabled: true, cat: "res" },
    { id: "ps2",       route: "#/onlineps",  icon: "ps",     key: "", size: "sm", enabled: true, cat: "res" },
    { id: "tut",       route: "#/tut",       icon: "grid",   key: "", size: "sm", enabled: true, cat: "res" },
  ];

  var CATS = ["ai", "tools", "pro", "res"];

  function t(k) { return FF.I18N.t(k); }

  function moduleTitle(m) { return t("mod." + (m.ref || m.id) + ".t"); }
  function moduleDesc(m) { return t("mod." + (m.ref || m.id) + ".d"); }

  /* ============================================================
   * 主题 / 语言
   * ============================================================ */

  function initTheme() {
    var theme = localStorage.getItem("ff.theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
  }
  /* 6 套主题轮换（对齐原站：明亮纸白/经典废土/Gemini蓝紫/午夜深蓝/森林青绿/中国红） */
  var THEMES = ["light", "dark", "gemini", "midnight", "forest", "china"];
  var THEME_LABELS = { light: "明亮纸白", dark: "经典废土", gemini: "Gemini 蓝紫", midnight: "午夜深蓝", forest: "森林青绿", china: "中国红" };
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "light";
    var idx = THEMES.indexOf(cur);
    var next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ff.theme", next);
    FF.Toast.show("主题：" + (THEME_LABELS[next] || next), "ok");
  }

  function initLang() {
    FF.I18N.setLang(FF.I18N.getLang());
    document.querySelectorAll(".langbtn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === FF.I18N.getLang());
      b.addEventListener("click", function () {
        FF.I18N.setLang(b.dataset.lang);
        document.querySelectorAll(".langbtn").forEach(function (x) {
          x.classList.toggle("active", x.dataset.lang === b.dataset.lang);
        });
        renderApp(); // 整体重渲染
      });
    });
  }

  /* ============================================================
   * 全局：错误捕获 / 粘贴 / 拖拽 / 最近使用
   * ============================================================ */

  var currentView = null; // { onPaste?, onDrop? }

  function initGlobalErrorHook() {
    var lastMsg = "", lastT = 0;
    function report(msg) {
      var now = Date.now();
      if (msg === lastMsg && now - lastT < 1500) return; // 去重
      lastMsg = msg; lastT = now;
      if (window.FF && FF.Toast) FF.Toast.show("⚠ " + msg, "err");
    }
    window.addEventListener("error", function (e) {
      if (e && e.message && e.filename) report(e.message.slice(0, 120));
    });
    window.addEventListener("unhandledrejection", function (e) {
      var r = e && e.reason;
      if (r && r.message && r.message !== "NO_KEY") report(String(r.message).slice(0, 120));
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function initPaste() {
    document.addEventListener("paste", function (e) {
      if (!currentView || typeof currentView.onPaste !== "function") return;
      var items = (e.clipboardData || {}).items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          var blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            blobToDataUrl(blob).then(function (url) {
              currentView.onPaste(url);
              FF.Toast.show(t("toast.pasted"), "ok");
            });
          }
          return;
        }
      }
    });
  }

  function initGlobalDrop() {
    var depth = 0;
    document.addEventListener("dragenter", function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) depth++;
    });
    document.addEventListener("dragleave", function () { depth = Math.max(0, depth - 1); });
    document.addEventListener("dragover", function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) {
        e.preventDefault();
      }
    });
    document.addEventListener("drop", function (e) {
      depth = 0;
      // 暂存拖出（原站 MIME application/x-frameronin-stash-url；兼容 text/ff-stash）
      var stashUrl = "";
      try { stashUrl = e.dataTransfer.getData("application/x-frameronin-stash-url") || e.dataTransfer.getData("text/ff-stash") || ""; } catch (err) {}
      if (stashUrl && /^data:image\//.test(stashUrl)) {
        e.preventDefault();
        if (currentView && typeof currentView.onDrop === "function") currentView.onDrop(stashUrl);
        else if (currentView && typeof currentView.onPaste === "function") currentView.onPaste(stashUrl);
        else { sessionStorage.setItem("ff.transfer", stashUrl); FF.Toast.show(t("toast.transferred"), "ok"); }
        return;
      }
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      // 只拦截图片文件；其他交给页面内 dropzone 自己处理
      var isImage = Array.prototype.some.call(files, function (f) { return /image\//.test(f.type); });
      if (!isImage) return;
      // 页面内 dropzone（.dropzone）自己的 drop 监听优先：若目标在 dropzone 内则不抢
      var node = e.target;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains("dropzone")) return;
        if (node.classList && node.classList.contains("canvas-frame")) return; // map 画布等自有 drop
        node = node.parentElement;
      }
      var imgFile = Array.prototype.find.call(files, function (f) { return /image\//.test(f.type); });
      if (!imgFile) return;
      e.preventDefault();
      if (currentView && typeof currentView.onDrop === "function") {
        blobToDataUrl(imgFile).then(function (url) {
          currentView.onDrop(url);
          FF.Toast.show(t("toast.dropped"), "ok");
        });
      } else if (location.hash === "#/" || !location.hash) {
        blobToDataUrl(imgFile).then(function (url) {
          sessionStorage.setItem("ff.transfer", url);
          FF.UI.modal(t("toast.drop.title"), UI.el("p", {}, [t("toast.drop.body")]));
          // 弹窗内提供三个去向
          setTimeout(function () {
            var body = document.querySelector(".modal-body");
            if (!body) return;
            var row = UI.el("div", { class: "btn-row mt8" }, []);
            [["chroma", "mod.chroma.t"], ["pixel", "mod.pixel.t"], ["ai", "mod.ai.t"]].forEach(function (pair) {
              row.appendChild(UI.btn(t(pair[1]), "btn-outline btn-sm", function () {
                document.querySelector(".modal-close").click();
                location.hash = "#/" + pair[0];
              }));
            });
            body.appendChild(row);
          }, 0);
        });
      } else {
        FF.Toast.show(t("toast.drop.na"), "warn");
      }
    });
  }

  /* ---------- 最近使用 ---------- */

  function pushRecent(id) {
    try {
      var rec = JSON.parse(localStorage.getItem("ff.recent") || "[]");
      rec = [id].concat(rec.filter(function (x) { return x !== id; })).slice(0, 3);
      localStorage.setItem("ff.recent", JSON.stringify(rec));
    } catch (e) { /* noop */ }
  }
  function getRecent() {
    try { return JSON.parse(localStorage.getItem("ff.recent") || "[]"); } catch (e) { return []; }
  }

  /* ============================================================
   * 首页
   * ============================================================ */

  var defaultOrder = MODULES.map(function (m) { return m.id; });
  function getOrder() {
    try {
      var saved = JSON.parse(localStorage.getItem("ff.order") || "null");
      if (Array.isArray(saved)) {
        // 过滤掉不存在的模块并补上新增的
        var valid = saved.filter(function (id) { return defaultOrder.indexOf(id) >= 0; });
        defaultOrder.forEach(function (id) { if (valid.indexOf(id) < 0) valid.push(id); });
        return valid;
      }
    } catch (e) { /* noop */ }
    return defaultOrder.slice();
  }

  var customizing = false;

  function moduleCard(m) {
    var badges = (m.badges || []).map(function (b) {
      return FF.UI.el("span", { class: "badge outline" }, [t(b)]);
    });
    var card = FF.UI.el("div", {
      class: "card" + (m.size === "sm" ? "-sm " : " ") +
        (m.enabled ? "clickable" : " disabled") + (customizing ? " customizing" : ""),
      draggable: customizing ? "true" : "false",
      dataset: { mid: m.id }
    }, [
      customizing ? FF.UI.el("div", { class: "drag-handle" }, [FF.UI.el("span"), FF.UI.el("span"), FF.UI.el("span")]) : null,
      m.key ? FF.UI.el("div", { class: "card-kbd" }, [m.key]) : null,
      FF.UI.el("div", { class: "card-icon" }, [FF.UI.icon(m.icon)]),
      FF.UI.el("div", { class: "card-title" }, [moduleTitle(m)]),
      FF.UI.el("div", { class: "card-desc" }, [moduleDesc(m)]),
      m.enabled && badges.length ? FF.UI.el("div", { class: "card-badges" }, badges) : null,
      !m.enabled ? FF.UI.el("div", { class: "card-badges" }, [FF.UI.el("span", { class: "badge" }, [t("home.wip")])]) : null
    ]);
    if (m.enabled && !customizing) {
      card.addEventListener("click", function () { location.hash = m.route; });
    }
    if (customizing) {
      card.addEventListener("dragstart", function (e) {
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", m.id);
      });
      card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
      card.addEventListener("dragover", function (e) { e.preventDefault(); });
      card.addEventListener("drop", function (e) {
        e.preventDefault();
        var srcId = e.dataTransfer.getData("text/plain");
        if (!srcId || srcId === m.id) return;
        var order = getOrder();
        var si = order.indexOf(srcId);
        var di = order.indexOf(m.id);
        order.splice(si, 1);
        order.splice(di, 0, srcId);
        localStorage.setItem("ff.order", JSON.stringify(order));
        renderHome();
      });
    }
    return card;
  }

  function renderHome() {
    var app = document.getElementById("app");
    app.innerHTML = "";
    var order = getOrder();
    var catFilter = localStorage.getItem("ff.cat") || "all";

    /* ---------- ① Hero 行：引导 + 搜索 合并一行 ---------- */
    var searchInput = UI.el("input", { type: "text", placeholder: t("home.search.ph"), style: { minWidth: "200px", flex: "1" } });
    var hero = FF.UI.el("div", { class: "home-hero" }, [
      FF.UI.el("div", { class: "hh-text" }, [
        FF.UI.el("h3", {}, [t("home.guide.title")]),
        FF.UI.el("p", {}, [t("home.guide.desc")])
      ]),
      FF.UI.el("div", { class: "hh-actions" }, [
        UI.btn(t("home.guide.btn"), "btn-outline btn-sm", function () { location.hash = "#/guide"; }),
        (function () {
          var d = UI.el("div", { class: "search-wrap" });
          d.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
          d.appendChild(searchInput);
          return d;
        })()
      ])
    ]);

    /* ---------- ② 最近使用（紧凑单行） ---------- */
    var recent = getRecent();
    if (recent.length) {
      var recentRow = UI.el("div", { class: "recent-row" }, [
        UI.el("span", { class: "recent-label" }, [t("home.recent")])
      ]);
      recent.forEach(function (id) {
        var m = MODULES.find(function (x) { return x.id === id; });
        if (!m || !m.enabled) return;
        recentRow.appendChild(UI.el("span", { class: "recent-chip" }, [
          m.key ? UI.el("span", { class: "rc-key" }, [m.key]) : null,
          moduleTitle(m)
        ])).addEventListener("click", function () { location.hash = m.route; });
      });
      app.appendChild(recentRow);
    }

    /* ---------- ③ 分类筛选 chips（可换行，替代右侧悬浮栏） ---------- */
    var chipDefs = [{ id: "all", label: t("home.cat.all") }].concat(CATS.map(function (c) {
      return { id: c, label: t("home.cat." + c) };
    }));
    var chips = UI.el("div", { class: "cat-chips", role: "tablist", "aria-label": t("home.cat.all") });
    function renderChips() {
      chips.innerHTML = "";
      chipDefs.forEach(function (cd) {
        var n = cd.id === "all"
          ? MODULES.filter(function (m) { return m.enabled; }).length
          : MODULES.filter(function (m) { return m.enabled && m.cat === cd.id; }).length;
        var b = UI.el("button", {
          class: "cat-chip" + (catFilter === cd.id ? " on" : ""),
          role: "tab", "aria-selected": catFilter === cd.id ? "true" : "false"
        }, [cd.label + " " + n]);
        b.addEventListener("click", function () {
          catFilter = cd.id;
          localStorage.setItem("ff.cat", catFilter);
          renderChips();
          renderSections();
        });
        chips.appendChild(b);
      });
    }

    /* ---------- ④ 分组分区渲染 ---------- */
    var sectionsWrap = UI.el("div", { class: "home-sections" });
    function cardVisible(m, q) {
      if (catFilter !== "all" && m.cat !== catFilter) return false;
      if (q) {
        var hay = (moduleTitle(m) + moduleDesc(m) + (m.key || "")).toLowerCase();
        return hay.indexOf(q) >= 0;
      }
      return true;
    }
    function renderSections() {
      var q = searchInput.value.trim().toLowerCase();
      sectionsWrap.innerHTML = "";
      CATS.forEach(function (cat) {
        var mods = order
          .map(function (id) { return MODULES.find(function (x) { return x.id === id; }); })
          .filter(function (m) { return m && m.cat === cat; });
        mods.sort(function (a, b) { return (a.enabled === b.enabled) ? 0 : (a.enabled ? -1 : 1); });
        var visible = mods.filter(function (m) { return cardVisible(m, q); });
        if (!visible.length) return;
        var isRes = cat === "res";
        var sec = UI.el("section", { class: "home-sec" }, [
          UI.el("div", { class: "module-section-title" }, [
            UI.el("b", {}, ["▸ "]),
            t("home.cat." + cat),
            UI.el("span", { class: "sec-count" }, [String(visible.length)])
          ])
        ]);
        var grid = UI.el("div", { class: isRes ? "grid-res" : "grid-lg" });
        visible.forEach(function (m) { grid.appendChild(moduleCard(m, isRes)); });
        sec.appendChild(grid);
        sectionsWrap.appendChild(sec);
      });
      // 搜索无结果提示
      if (!sectionsWrap.children.length) {
        sectionsWrap.appendChild(UI.el("div", { class: "hint-text", style: { textAlign: "center", padding: "32px 0" } }, [t("home.search.none")]));
      }
    }
    searchInput.addEventListener("input", renderSections);

    /* ---------- 卡片（支持资源区轻量横排样式） ---------- */
    function moduleCard(m, isRes) {
      var badges = (m.badges || []).map(function (b) {
        return FF.UI.el("span", { class: "badge outline" }, [t(b)]);
      });
      var card = FF.UI.el("div", {
        class: (isRes ? "card-link" : "card") +
          (m.enabled ? " clickable" : " disabled") + (customizing ? " customizing" : ""),
        draggable: customizing ? "true" : "false",
        dataset: { mid: m.id }
      }, [
        customizing ? FF.UI.el("div", { class: "drag-handle" }, [FF.UI.el("span"), FF.UI.el("span"), FF.UI.el("span")]) : null,
        m.key ? FF.UI.el("div", { class: "card-kbd" }, [m.key]) : null,
        FF.UI.el("div", { class: isRes ? "cl-icon" : "card-icon" }, [FF.UI.icon(m.icon)]),
        FF.UI.el("div", { class: isRes ? "cl-body" : "cl-body" }, [
          FF.UI.el("div", { class: "card-title" }, [moduleTitle(m)]),
          FF.UI.el("div", { class: "card-desc" }, [moduleDesc(m)])
        ]),
        m.enabled && badges.length ? FF.UI.el("div", { class: "card-badges" }, badges) : null,
        !m.enabled ? FF.UI.el("div", { class: "card-badges" }, [FF.UI.el("span", { class: "badge" }, [t("home.wip")])]) : null
      ]);
      if (m.enabled && !customizing) {
        card.addEventListener("click", function () { location.hash = m.route; });
      }
      if (customizing) {
        card.addEventListener("dragstart", function (e) {
          card.classList.add("dragging");
          e.dataTransfer.setData("text/plain", m.id);
        });
        card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
        card.addEventListener("dragover", function (e) { e.preventDefault(); });
        card.addEventListener("drop", function (e) {
          e.preventDefault();
          var srcId = e.dataTransfer.getData("text/plain");
          if (!srcId || srcId === m.id) return;
          var src = MODULES.find(function (x) { return x.id === srcId; });
          if (!src || src.cat !== m.cat) return; // 只允许同分区内排序
          var order2 = getOrder();
          var si = order2.indexOf(srcId);
          var di = order2.indexOf(m.id);
          order2.splice(si, 1);
          order2.splice(di, 0, srcId);
          localStorage.setItem("ff.order", JSON.stringify(order2));
          renderHome();
        });
      }
      return card;
    }

    /* ---------- ⑤ 自定义排序栏 ---------- */
    var customizeBtn = FF.UI.btn(
      customizing ? t("home.customize.done") : t("home.customize"),
      customizing ? "btn-primary" : "btn-ghost",
      function () { customizing = !customizing; renderHome(); }
    );
    var resetBtn = FF.UI.btn(t("home.reset"), "btn-ghost btn-sm", function () {
      localStorage.removeItem("ff.order");
      renderHome();
    });
    var bar = FF.UI.el("div", { class: "customize-bar" }, [
      FF.UI.el("div", { class: "row", style: { justifyContent: "center" } }, [customizeBtn,
        customizing ? resetBtn : null]),
      customizing ? FF.UI.el("div", { class: "hint" }, [t("home.customize.hint")]) : null
    ]);

    /* ---------- 组装 ---------- */
    app.appendChild(hero);
    renderChips();
    app.appendChild(chips);
    app.appendChild(sectionsWrap);
    renderSections();
    app.appendChild(bar);

    /* 公告条（顶部） */
    var notice = FF.UI.el("div", { class: "home-notice" }, [
      FF.UI.el("span", {}, ["🍌 " + t("home.notice")]),
      FF.UI.el("button", { class: "btn-ghost btn-xs", onclick: function () { notice.remove(); } }, ["✕"])
    ]);
    app.insertBefore(notice, app.firstChild);
  }

  /* ============================================================
   * 快捷键面板
   * ============================================================ */

  function renderShortcuts() {
    var body = document.getElementById("shortcutBody");
    body.innerHTML = "";
    MODULES.filter(function (m) { return m.enabled && m.key; }).forEach(function (m) {
      body.appendChild(FF.UI.el("div", { class: "sc-item" }, [
        FF.UI.el("kbd", {}, [m.key]),
        FF.UI.el("span", {}, [moduleTitle(m)])
      ]));
    });
    body.appendChild(FF.UI.el("div", { class: "sc-item" }, [
      FF.UI.el("kbd", {}, ["Esc"]),
      FF.UI.el("span", {}, [t("common.back")])
    ]));
  }

  function initShortcutPanel() {
    var panel = document.getElementById("shortcutPanel");
    var collapsed = localStorage.getItem("ff.shortcuts") === "c";
    panel.classList.toggle("collapsed", collapsed);
    document.getElementById("shortcutHead").addEventListener("click", function () {
      var c = panel.classList.toggle("collapsed");
      localStorage.setItem("ff.shortcuts", c ? "c" : "o");
    });
  }

  /* ============================================================
   * 技能 / 使用说明弹窗
   * ============================================================ */

  function showSkills() {
    var grid = FF.UI.el("div", { class: "skills-grid" });
    MODULES.forEach(function (m) {
      grid.appendChild(FF.UI.el("div", { class: "skills-item" }, [
        FF.UI.el("div", { class: "si-name" }, [
          FF.UI.el("span", {}, [moduleTitle(m)]),
          m.key ? FF.UI.el("kbd", {}, [m.key]) : null,
          !m.enabled ? FF.UI.el("span", { class: "badge" }, [t("home.wip")]) : null
        ]),
        FF.UI.el("div", { class: "si-desc" }, [moduleDesc(m)])
      ]));
    });
    FF.UI.modal(t("skills.title"), grid);
  }

  function showApiSettings() {
    var body = FF.UI.el("div", {}, []);

    /* --- API 地址 --- */
    var baseIn = FF.UI.el("input", {
      type: "text",
      value: FF.Ai.getBase(),
      placeholder: t("api.base.ph"),
      style: { width: "100%" },
      spellcheck: "false"
    });
    var typeSel = FF.UI.selectRow(t("api.type"), [
      { v: "auto", label: t("api.type.auto") },
      { v: "gemini", label: t("api.type.gemini") },
      { v: "openai-chat", label: t("api.type.oai") },
      { v: "openai-images", label: t("api.type.oaiimg") }
    ], FF.Ai.getType(), { onChange: function () { refreshDetect(); } });

    var detectHint = FF.UI.el("div", { class: "hint-text mt8" }, []);
    function refreshDetect() {
      var url = baseIn.value.trim();
      var chosen = typeSel.value;
      var eff = chosen === "auto" ? (url ? FF.Ai.detectType(url, keyIn.value) : null) : chosen;
      detectHint.innerHTML = "";
      if (!url) {
        detectHint.textContent = t("api.detect.none");
        detectHint.style.color = "var(--text-dim)";
        return;
      }
      var label = eff ? FF.Ai.TYPE_LABELS[eff] : null;
      detectHint.textContent = chosen === "auto"
        ? (label ? "✓ " + t("api.detect.auto") + label : t("api.detect.fail"))
        : "✓ " + t("api.detect.manual") + label;
      detectHint.style.color = label ? "var(--green)" : "var(--accent)";
    }
    baseIn.addEventListener("input", refreshDetect);

    /* --- Key --- */
    var keyIn = FF.UI.el("input", {
      type: "password",
      value: FF.Ai.getKey(),
      placeholder: t("api.key.ph"),
      style: { width: "100%", marginBottom: "8px" }
    });
    keyIn.addEventListener("input", refreshDetect);
    var showSw = FF.UI.switchRow(t("api.show"), false, function (v) {
      keyIn.type = v ? "text" : "password";
    });

    /* --- 模型（自由输入 + 常见建议） --- */
    var dlId = "ff_model_datalist";
    var dl = FF.UI.el("datalist", { id: dlId }, []);
    ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview", "gemini-2.0-flash-exp-image-generation",
     "gpt-image-1", "dall-e-3", "grok-2-image"].forEach(function (m) {
      dl.appendChild(FF.UI.el("option", { value: m }));
    });
    var modelIn = FF.UI.el("input", {
      type: "text", value: FF.Ai.getModel(),
      list: dlId, spellcheck: "false",
      style: { width: "100%" }
    });

    body.appendChild(FF.UI.el("h4", {}, [t("api.base")]));
    body.appendChild(FF.UI.el("p", {}, [t("api.privacy")]));
    body.appendChild(baseIn);
    body.appendChild(FF.UI.el("div", { class: "mt8" }, [typeSel.el]));
    body.appendChild(detectHint);

    body.appendChild(FF.UI.el("h4", {}, [t("api.key")]));
    body.appendChild(keyIn);
    body.appendChild(showSw.el);

    body.appendChild(FF.UI.el("h4", {}, [t("api.model")]));
    body.appendChild(FF.UI.el("p", {}, [t("api.model.hint")]));
    body.appendChild(modelIn);
    body.appendChild(dl);

    var status = FF.UI.el("div", { class: "hint-text mt8" }, []);
    function persist() {
      FF.Ai.setKey(keyIn.value.trim());
      FF.Ai.setBase(baseIn.value.trim() || FF.Ai.DEFAULT_BASE);
      FF.Ai.setType(typeSel.value);
      var m = modelIn.value.trim();
      if (m) FF.Ai.setModel(m);
    }
    var testBtn = FF.UI.btn(t("api.test"), "btn-ghost btn-sm", function () {
      if (!keyIn.value.trim()) { status.textContent = t("api.needkey"); status.style.color = "var(--danger)"; return; }
      persist();
      status.textContent = t("api.testing");
      status.style.color = "";
      testBtn.disabled = true;
      FF.Ai.testKey().then(function () {
        status.textContent = t("api.testok") + "（" + FF.Ai.TYPE_LABELS[FF.Ai.effectiveType()] + " · " + FF.Ai.getModel() + "）";
        status.style.color = "var(--green)";
      }).catch(function (e) {
        status.textContent = t("api.testfail") + " " + e.message;
        status.style.color = "var(--danger)";
      }).finally(function () { testBtn.disabled = false; });
    });
    var saveBtn = FF.UI.btn(t("api.save"), "btn-primary btn-sm", function () {
      persist();
      status.textContent = t("api.saved") + "（" + FF.Ai.TYPE_LABELS[FF.Ai.effectiveType()] + "）";
      status.style.color = "var(--green)";
    });
    body.appendChild(FF.UI.el("div", { class: "btn-row mt14" }, [saveBtn, testBtn]));
    body.appendChild(status);
    body.appendChild(FF.UI.el("div", { class: "hint-text mt14" }, [t("api.getkey")]));
    FF.UI.modal(t("api.title"), body);
    refreshDetect();
  }

  function showHelp() {
    var body = FF.UI.el("div", {});
    body.appendChild(FF.UI.el("h4", {}, ["1. " + t("mod.video.t")]));
    body.appendChild(FF.UI.el("p", {}, [t("mod.video.d") + "。" + t("video.pick") + "。"]));
    body.appendChild(FF.UI.el("h4", {}, ["2. " + t("mod.chroma.t")]));
    body.appendChild(FF.UI.el("p", {}, [t("mod.chroma.d") + "。"]));
    body.appendChild(FF.UI.el("h4", {}, ["3. " + t("mod.sheet.t")]));
    body.appendChild(FF.UI.el("p", {}, [t("mod.sheet.d") + "。"]));
    body.appendChild(FF.UI.el("h4", {}, ["4. " + t("mod.gif.t")]));
    body.appendChild(FF.UI.el("p", {}, [t("mod.gif.d") + "。" + t("gif.reorder") + "。"]));
    body.appendChild(FF.UI.el("h4", {}, ["5. " + t("mod.pixel.t")]));
    body.appendChild(FF.UI.el("p", {}, [t("mod.pixel.d") + "。"]));
    body.appendChild(FF.UI.el("h4", {}, ["6. " + t("mod.layers.t") + " / " + t("mod.map.t")]));
    body.appendChild(FF.UI.el("p", {}, [t("mod.layers.d") + "；" + t("map.hint") + "。"]));
    body.appendChild(FF.UI.el("h4", {}, [t("shortcut.title")]));
    var ul = FF.UI.el("ul", {});
    MODULES.filter(function (m) { return m.enabled && m.key; }).forEach(function (m) {
      ul.appendChild(FF.UI.el("li", {}, [m.key + " → " + moduleTitle(m)]));
    });
    ul.appendChild(FF.UI.el("li", {}, ["Esc → " + t("common.back")]));
    body.appendChild(ul);
    FF.UI.modal(t("help.title"), body);
  }

  /* ============================================================
   * 路由
   * ============================================================ */

  var ROUTES = {
    "#/video": function (q) { return FF.Tools.video(q); },
    "#/chroma": function (q) { return FF.Tools.chroma(q); },
    "#/sheet": function (q) { return FF.Tools.sheet(q); },
    "#/gif": function (q) { return FF.Tools.gif(q); },
    "#/pixel": function (q) { return FF.Tools.pixel(q); },
    "#/pixelplus": function (q) { return FF.Tools.pixelplus(q); },
    "#/layers": function (q) { return FF.Tools.layers(q); },
    "#/map": function (q) { return FF.Tools.map(q); },
    "#/ai": function (q) { return FF.Tools.ai(q); },
    "#/chat": function (q) { return FF.Tools.chat(q); },
    "#/pro": function (q) { return FF.Tools.pro(q); },
    "#/tile": function (q) { return FF.Tools.tile(q); },
    "#/flow": function (q) { return FF.Tools.flow(q); },
    "#/freegen": function (q) { return FF.Tools.freegen(q); },
    "#/apiimage": function (q) { return FF.Tools.apiimage(q); },
    "#/eightdir": function (q) { return FF.Tools.eightdir(q); },
    "#/pixelcreate": function (q) { return FF.Tools.pixelcreate(q); },
    "#/customactions": function (q) { return FF.Tools.customactions(q); },
    "#/effects": function (q) { return FF.Tools.effects(q); },
    "#/uiicons": function (q) { return FF.Tools.uiicons(q); },
    "#/potpourri": function (q) { return FF.Tools.potpourri(q); },
    "#/lab": function (q) { return FF.Tools.lab(q); },
    "#/rseprite": function (q) { return FF.Tools.rseprite(q); },
    "#/assets": function (q) { return FF.Tools.assets(q); },
    "#/skills": function (q) { return FF.Tools.skills(q); },
    "#/guide": function (q) { return FF.Tools.guide(q); },
    "#/freechars": function (q) { return FF.Tools.freechars(q); },
    "#/building": function (q) { return FF.Tools.building(q); },
    "#/npc": function (q) { return FF.Tools.npcplugin(q); },
    "#/terrain": function (q) { return FF.Tools.terrain(q); },
    "#/hd2d": function (q) { return FF.Tools.hd2d(q); },
    "#/onlineps": function (q) { return FF.Tools.onlineps(q); },
    "#/tut": function (q) { return FF.Tools.tut(q); },
    "#/videogen": function (q) { return FF.Tools.videogen(q); },
    "#/scenechar": function (q) { return FF.Tools.scenechar(q); },
    "#/gifcomposer": function (q) { return FF.Tools.gifcomposer(q); },
    "#/gwm": function (q) { return FF.Tools.geminiwm(q); },

  };

  var currentCleanup = null;

  function route() {
    if (typeof currentCleanup === "function") {
      try { currentCleanup(); } catch (e) { /* noop */ }
      currentCleanup = null;
    }
    var hash = location.hash || "#/";
    if (hash === "#/" || hash === "#" || hash === "") {
      renderHome();
      return;
    }
    var base = hash.split("?")[0];
    var query = {};
    (hash.split("?")[1] || "").split("&").forEach(function (kv) {
      if (!kv) return;
      var p = kv.split("=");
      query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    var factory = ROUTES[base];
    var app = document.getElementById("app");
    app.innerHTML = "";
    if (!factory) {
      location.hash = "#/";
      return;
    }
    var view = factory(query);
    app.appendChild(view.root);
    app.firstElementChild && app.firstElementChild.classList.add("view-fade");
    currentView = view;
    if (typeof view.cleanup === "function") currentCleanup = view.cleanup;
    // 记录最近使用（排除首页与重复）
    var mid = base.replace("#/", "");
    var mrec = MODULES.find(function (x) { return x.route.split("?")[0] === base; });
    if (mrec) pushRecent(mrec.id);
    window.scrollTo(0, 0);
  }

  function renderApp() {
    FF.I18N.apply(document);
    renderShortcuts();
    route();
  }

  /* ============================================================
   * 键盘
   * ============================================================ */

  function initKeys() {
    document.addEventListener("keydown", function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        // 关闭弹窗优先
        var mask = document.querySelector(".modal-mask");
        if (mask) { mask.remove(); return; }
        if (location.hash && location.hash !== "#/") location.hash = "#/";
        return;
      }
      if (document.querySelector(".modal-mask")) return;
      // ? 键：快捷键帮助（Shift+/）
      if (e.key === "?" ) {
        showShortcutsHelp();
        e.preventDefault();
        return;
      }
      // B：任意功能内返回首页
      if (e.key === "b" || e.key === "B") {
        if (location.hash && location.hash !== "#/") { location.hash = "#/"; }
        return;
      }
      var k = e.key.toUpperCase();
      var m = MODULES.find(function (x) { return x.enabled && x.key === k; });
      if (m) {
        e.preventDefault();
        location.hash = m.route;
      }
    });
  }

  function showShortcutsHelp() {
    var body = UI.el("div", {});
    body.appendChild(UI.el("h4", {}, [t("shortcut.title")]));
    var grid = UI.el("div", { class: "skills-grid" }, []);
    MODULES.filter(function (m) { return m.enabled && m.key; }).forEach(function (m) {
      grid.appendChild(UI.el("div", { class: "skills-item" }, [
        UI.el("div", { class: "si-name" }, [
          UI.el("kbd", {}, [m.key]),
          UI.el("span", {}, [moduleTitle(m)])
        ])
      ]));
    });
    body.appendChild(grid);
    body.appendChild(UI.el("h4", {}, [t("shortcut.context")]));
    var ctx = UI.el("ul", {}, [
      UI.el("li", {}, ["B / Esc → " + t("common.back")]),
      UI.el("li", {}, [t("shortcut.ctx.paste")]),
      UI.el("li", {}, [t("shortcut.ctx.drop")]),
      UI.el("li", {}, [t("shortcut.ctx.zoom")]),
      UI.el("li", {}, [t("shortcut.ctx.sheetad")]),
      UI.el("li", {}, [t("shortcut.ctx.finez")])
    ]);
    body.appendChild(ctx);
    UI.modal(t("shortcut.help"), body);
  }

  /* ============================================================
   * 启动
   * ============================================================ */

  function boot() {
    try {
      initGlobalErrorHook();
      initPaste();
      initGlobalDrop();
      initTheme();
      document.getElementById("btnTheme").addEventListener("click", toggleTheme);
      document.getElementById("btnSkills").addEventListener("click", showSkills);
      document.getElementById("btnHelp").addEventListener("click", showHelp);
      document.getElementById("btnApi").addEventListener("click", showApiSettings);
      initLang();
      initShortcutPanel();
      initKeys();
      window.addEventListener("hashchange", route);
      renderApp();
    } catch (e) {
      var st = document.getElementById("splashStatus");
      if (st) {
        st.textContent = "启动失败: " + (e && e.message || e);
        st.style.color = "#a33b25";
      }
      console.error(e);
      return;
    }
    var splash = document.getElementById("splash");
    splash.classList.add("hide");
    setTimeout(function () { splash.remove(); }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
