/* FrameForge · 全站暂存侧栏（对齐原站「暂存」面板）：
 * 拖入图片暂存 → 会话持久化 → 任意工具可取用 / 下载 / 清空 / 收起 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  var KEY = "ff.stash";
  var items = [];   // { url, name, time }
  var expanded = false;

  try { items = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch (e) { items = []; }
  function persist() {
    try { sessionStorage.setItem(KEY, JSON.stringify(items.slice(0, 60))); } catch (e) { /* 超容忽略 */ }
  }

  var panel, body, countBadge, toggleBtn;

  function render() {
    body.innerHTML = "";
    countBadge.textContent = String(items.length);
    if (!items.length) {
      body.appendChild(UI.el("div", { class: "stash-empty" }, [t("stash.empty")]));
      return;
    }
    items.forEach(function (it, i) {
      var cell = UI.el("div", { class: "stash-cell", title: it.name || "" }, [
        UI.el("img", { src: it.url, draggable: "true" }),
        UI.el("button", { class: "stash-x", title: t("stash.remove") }, ["✕"])
      ]);
      cell.querySelector("img").addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/ff-stash", String(i));
        e.dataTransfer.setData("text/uri-list", it.url);
      });
      cell.querySelector(".stash-x").addEventListener("click", function (e) {
        e.stopPropagation();
        items.splice(i, 1); persist(); render();
      });
      cell.addEventListener("dblclick", function () {
        UI.lightbox(it.url, it.name);
      });
      body.appendChild(cell);
    });
    var bar = UI.el("div", { class: "stash-bar" }, [
      UI.btn(t("stash.downloadAll"), "btn-ghost btn-xs", function () {
        items.forEach(function (it, i) {
          setTimeout(function () {
            var a = document.createElement("a");
            a.href = it.url; a.download = it.name || ("stash_" + (i + 1) + ".png");
            document.body.appendChild(a); a.click(); a.remove();
          }, i * 180);
        });
      }),
      UI.btn(t("stash.clear"), "btn-ghost btn-xs", function () {
        if (!items.length || confirm(t("stash.clear.confirm"))) { items = []; persist(); render(); }
      })
    ]);
    body.appendChild(bar);
  }

  function add(url, name) {
    items.unshift({ url: url, name: name || "stash_" + (items.length + 1) + ".png", time: Date.now() });
    persist(); render();
    FF.Toast.show(t("stash.added"), "ok");
  }

  function toggle(open) {
    expanded = open === undefined ? !expanded : open;
    panel.classList.toggle("open", expanded);
    toggleBtn.querySelector("span").textContent = expanded ? t("stash.collapse") : t("stash.expand");
  }

  function init() {
    // 悬浮按钮（右下角）
    toggleBtn = UI.el("button", { class: "stash-toggle", title: t("stash.title") }, [
      UI.el("span", {}, [t("stash.title")]),
      countBadge = UI.el("span", { class: "stash-count" }, ["0"])
    ]);
    toggleBtn.addEventListener("click", function () { toggle(); });

    panel = UI.el("div", { class: "stash-panel" }, [
      UI.el("div", { class: "stash-head" }, [
        UI.el("strong", {}, [t("stash.title")]),
        UI.el("span", { class: "hint-text" }, [t("stash.hint")])
      ]),
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
    add: add,
    getAll: function () { return items.slice(); },
    /** 取最近一张（很多工具的「从暂存取图」按钮用） */
    latest: function () { return items[0] || null; },
    toggle: toggle
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
