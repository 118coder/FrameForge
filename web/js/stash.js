/* FrameForge · 全站暂存侧栏（对齐原站「暂存/本地」双存储面板）：
 * 拖入图片暂存 → 会话/本地持久化 → 任意工具拖出取用 / 下载 / 清空 / 收起 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  var KEY = "ff.stash";          // 会话暂存
  var KEY_LOCAL = "ff.stash.local"; // 本地（刷新不丢）
  var MAX = 60;
  var stores = { session: { list: [], get: sessionStorage, key: KEY }, local: { list: [], get: localStorage, key: KEY_LOCAL } };
  var active = "session";
  var expanded = false;

  function load() {
    Object.keys(stores).forEach(function (k) {
      var s = stores[k];
      try { s.list = JSON.parse(s.get.getItem(s.key) || "[]"); } catch (e) { s.list = []; }
    });
  }
  function cur() { return stores[active]; }
  function persist() {
    var s = cur();
    try { s.get.setItem(s.key, JSON.stringify(s.list.slice(0, MAX))); } catch (e) { /* 超容忽略 */ }
  }

  var panel, body, countBadge, toggleBtn, tabSession, tabLocal;

  function render() {
    var s = cur();
    body.innerHTML = "";
    countBadge.textContent = String(s.list.length);
    tabSession.classList.toggle("on", active === "session");
    tabLocal.classList.toggle("on", active === "local");
    if (!s.list.length) {
      body.appendChild(UI.el("div", { class: "stash-empty" }, [t("stash.empty")]));
      return;
    }
    s.list.forEach(function (it, i) {
      var cell = UI.el("div", { class: "stash-cell", title: it.name || "" }, [
        UI.el("img", { src: it.url, draggable: "true" }),
        UI.el("button", { class: "stash-x", title: t("stash.remove") }, ["✕"])
      ]);
      cell.querySelector("img").addEventListener("dragstart", function (e) {
        // 拖出协议对齐原站：application/x-frameronin-stash-url + 兼容 text/ff-stash
        e.dataTransfer.setData("application/x-frameronin-stash-url", it.url);
        e.dataTransfer.setData("text/ff-stash", it.url);
        e.dataTransfer.setData("text/uri-list", it.url);
        if (it.name) { try { e.dataTransfer.setData("stash-name", it.name); } catch (err) {} }
      });
      cell.querySelector(".stash-x").addEventListener("click", function (e) {
        e.stopPropagation();
        s.list.splice(i, 1); persist(); render();
      });
      cell.addEventListener("dblclick", function () {
        UI.lightbox(it.url, it.name);
      });
      body.appendChild(cell);
    });
    var bar = UI.el("div", { class: "stash-bar" }, [
      UI.btn(t("stash.downloadAll"), "btn-ghost btn-xs", function () {
        s.list.forEach(function (it, i) {
          setTimeout(function () {
            var a = document.createElement("a");
            a.href = it.url; a.download = it.name || ("stash_" + (i + 1) + ".png");
            document.body.appendChild(a); a.click(); a.remove();
          }, i * 180);
        });
      }),
      UI.btn(t("stash.clear"), "btn-ghost btn-xs", function () {
        if (!s.list.length || confirm(t("stash.clear.confirm"))) { s.list = []; persist(); render(); }
      })
    ]);
    body.appendChild(bar);
  }

  function add(url, name, toLocal) {
    var s = stores[toLocal ? "local" : active];
    s.list.unshift({ url: url, name: name || "stash_" + (s.list.length + 1) + ".png", time: Date.now() });
    active = toLocal ? "local" : active;
    persist(); render();
    FF.Toast.show(t("stash.added"), "ok");
  }

  function toggle(open) {
    expanded = open === undefined ? !expanded : open;
    panel.classList.toggle("open", expanded);
    toggleBtn.querySelector("span").textContent = expanded ? t("stash.collapse") : t("stash.expand");
  }

  function init() {
    load();
    // 悬浮按钮（右下角）
    toggleBtn = UI.el("button", { class: "stash-toggle", title: t("stash.title") }, [
      UI.el("span", {}, [t("stash.title")]),
      countBadge = UI.el("span", { class: "stash-count" }, ["0"])
    ]);
    toggleBtn.addEventListener("click", function () { toggle(); });

    tabSession = UI.el("button", { class: "stash-tab on", type: "button" }, [t("stash.tab.session")]);
    tabLocal = UI.el("button", { class: "stash-tab", type: "button" }, [t("stash.tab.local")]);
    tabSession.addEventListener("click", function () { active = "session"; render(); });
    tabLocal.addEventListener("click", function () { active = "local"; render(); });

    panel = UI.el("div", { class: "stash-panel" }, [
      UI.el("div", { class: "stash-head" }, [
        UI.el("strong", {}, [t("stash.title")]),
        UI.el("span", { class: "hint-text" }, [t("stash.hint")])
      ]),
      UI.el("div", { class: "stash-tabs" }, [tabSession, tabLocal]),
      body = UI.el("div", { class: "stash-body" })
    ]);
    // 面板接收拖入
    panel.addEventListener("dragover", function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) e.preventDefault();
    });
    panel.addEventListener("drop", function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      e.preventDefault(); e.stopPropagation();
      Array.prototype.forEach.call(files, function (f) {
        if (!/image\//.test(f.type)) return;
        var fr = new FileReader();
        fr.onload = function () { add(fr.result, f.name); };
        fr.readAsDataURL(f);
      });
    });

    document.body.appendChild(panel);
    document.body.appendChild(toggleBtn);
    render();
  }

  /* 暴露 API：任何工具可把图片加入暂存 / 读取暂存 */
  FF.Stash = {
    add: add,                       // add(url, name, toLocal)
    getAll: function () { return cur().list.slice(); },
    /** 取最近一张（很多工具的「从暂存取图」按钮用） */
    latest: function () { return cur().list[0] || null; },
    toggle: toggle
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
