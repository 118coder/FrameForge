/* FrameForge · 全局 Toast 通知 */
(function () {
  "use strict";

  var container = null;

  function ensure() {
    if (container) return container;
    container = document.createElement("div");
    container.className = "toast-wrap";
    document.body.appendChild(container);
    return container;
  }

  /**
   * FF.Toast.show(msg, type)
   * type: "info" | "ok" | "warn" | "err"
   */
  function show(msg, type) {
    var wrap = ensure();
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "info");
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 300);
    }, 2600);
  }

  window.FF = window.FF || {};
  FF.Toast = { show: show };
})();
