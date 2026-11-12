/* FrameForge · 模型对话（对齐 frameronin v5：模型下拉 / 图片参考 / 预设提问 / 新建对话） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  var MAX_CHARS = 20000;
  var MAX_IMG = 5 * 1024 * 1024; // 每张 ≤5MB
  var MODELS = ["gemini-3.1-pro", "gemini-2.5-flash", "gemini-2.5-pro", "gpt-4o", "gpt-4o-mini", "deepseek-chat", "deepseek-reasoner"];
  var PRESETS = [
    "帮我写一段像素风森林场景的提示词",
    "设计一个有趣的游戏 NPC 和三句台词",
    "如何让角色的行走动画更自然？",
    "基于图片生成动画提示词"
  ];

  FF.Tools.chat = function () {
    var sk = UI.pageSkeleton("mod.chat.t", "mod.chat.d", null);
    var root = sk.root, card = sk.card;

    var SYSTEM = t("chat.system");
    var baseMessages = [{ role: "user", content: SYSTEM }, { role: "assistant", content: "OK" }];
    var messages = baseMessages.slice();

    /* ---------- 侧栏设置 ---------- */
    var side = UI.el("div", { class: "chat-side" }, []);
    var modelIn = UI.el("input", {
      list: "ff-chat-models", placeholder: "gemini-3.1-pro",
      style: { width: "100%", background: "var(--input-bg)", color: "var(--text)", border: "1.5px solid var(--input-border)", borderRadius: "8px", padding: "8px 10px", fontSize: "13px" }
    });
    var dl = UI.el("datalist", { id: "ff-chat-models" }, []);
    MODELS.forEach(function (m) { dl.appendChild(UI.el("option", { value: m })); });
    // 恢复上次模型（会话内记忆，不对齐原站的仅页面保留语义也无妨）
    try { modelIn.value = sessionStorage.getItem("ff.chat.model") || "gemini-3.1-pro"; } catch (e) {}
    modelIn.addEventListener("change", function () {
      try { sessionStorage.setItem("ff.chat.model", modelIn.value.trim()); } catch (e) {}
      if (modelIn.value.trim()) FF.Ai.setModel(modelIn.value.trim());
      refreshKey();
    });
    side.appendChild(UI.el("div", { class: "pb-title" }, ["对话设置"]));
    side.appendChild(UI.el("div", { class: "param-row" }, [UI.el("label", {}, ["模型"]), modelIn]));
    side.appendChild(dl);
    side.appendChild(UI.el("p", { class: "hint-text" }, ["选择或输入对话模型，默认 gemini-3.1-pro，自动使用全局 API 设置中的 Key。"]));
    side.appendChild(UI.el("p", { class: "hint-text" }, ["对话仅保留在当前页面，离开或刷新后清空。"]));
    side.appendChild(UI.el("p", { class: "hint-text" }, ["图片仅作为视觉参考，PNG / JPG / WebP，每张不超过 5 MB。"]));

    /* ---------- 对话区 ---------- */
    var log = UI.el("div", {
      class: "canvas-frame",
      style: { display: "flex", minHeight: "420px", maxHeight: "58vh", overflowY: "auto", padding: "14px", flexDirection: "column", alignItems: "stretch", gap: "10px" }
    }, []);

    function contentText(c) {
      if (typeof c === "string") return c;
      return c.map(function (p) { return p.text || (p.img ? "[图片]" : ""); }).join(" ");
    }
    function bubble(role, content) {
      var mine = role === "user";
      var b = UI.el("div", {
        style: {
          maxWidth: "82%", padding: "9px 13px", borderRadius: "10px",
          fontSize: "13px", lineHeight: "1.65", whiteSpace: "pre-wrap",
          alignSelf: mine ? "flex-end" : "flex-start",
          background: mine ? "var(--accent-soft)" : "var(--card-bg2)",
          border: "1.2px solid var(--card-border)",
          color: "var(--text)"
        }
      }, []);
      if (Array.isArray(content)) {
        content.forEach(function (p) {
          if (p.img && p.img.dataUrl) {
            var im = UI.el("img", { src: p.img.dataUrl, style: { maxWidth: "220px", maxHeight: "160px", borderRadius: "8px", display: "block", marginBottom: "6px", cursor: "zoom-in" } });
            im.addEventListener("dblclick", function () { UI.lightbox(p.img.dataUrl, "参考图"); });
            b.appendChild(im);
          }
        });
        var txt = contentText(content);
        if (txt) b.appendChild(document.createTextNode(txt));
      } else {
        b.textContent = content;
      }
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
      return b;
    }

    var keyHint = UI.el("div", { class: "hint-text mb8" }, []);
    function refreshKey() {
      keyHint.textContent = FF.Ai.getKey()
        ? "✓ " + FF.Ai.TYPE_LABELS[FF.Ai.effectiveType()] + " · " + (modelIn.value.trim() || FF.Ai.getModel())
        : "⚠ " + t("ai.nokey");
      keyHint.style.color = FF.Ai.getKey() ? "var(--green)" : "var(--accent)";
    }
    refreshKey();

    /* 输入区（文本 + 附件） */
    var pendingImgs = []; // [{mime, base64, dataUrl}]
    var attachRow = UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap", display: "none" } }, []);
    function renderAttach() {
      attachRow.innerHTML = "";
      attachRow.style.display = pendingImgs.length ? "flex" : "none";
      pendingImgs.forEach(function (p, i) {
        var chip = UI.el("span", { class: "chip", style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, []);
        var th = UI.el("img", { src: p.dataUrl, style: { width: "28px", height: "28px", objectFit: "cover", borderRadius: "4px" } });
        var x = UI.el("button", { class: "btn-ghost btn-xs", title: "移除" }, ["✕"]);
        x.addEventListener("click", function () { pendingImgs.splice(i, 1); renderAttach(); });
        chip.appendChild(th); chip.appendChild(x);
        attachRow.appendChild(chip);
      });
    }
    var imgInput = UI.el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", multiple: "", style: { display: "none" } });
    imgInput.addEventListener("change", function () {
      Array.prototype.forEach.call(imgInput.files || [], function (f) {
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { FF.Toast.show("仅支持 PNG / JPG / WebP", "warn"); return; }
        if (f.size > MAX_IMG) { FF.Toast.show("图片超过 5 MB", "warn"); return; }
        var fr = new FileReader();
        fr.onload = function () {
          pendingImgs.push({ mime: f.type, base64: String(fr.result).split(",")[1], dataUrl: String(fr.result) });
          renderAttach();
        };
        fr.readAsDataURL(f);
      });
      imgInput.value = "";
    });
    var btnAttach = UI.btn(t("chat.attach") || "添加图片", "btn-outline btn-sm", function () { imgInput.click(); }, "image");

    var input = UI.el("textarea", {
      rows: "3", maxLength: String(MAX_CHARS),
      placeholder: "输入问题，或描述你想了解的图片…",
      style: {
        width: "100%", background: "var(--input-bg)", color: "var(--text)",
        border: "1.5px solid var(--input-border)", borderRadius: "8px",
        padding: "10px", fontSize: "13.5px", fontFamily: "inherit", resize: "vertical"
      }
    });
    var counter = UI.el("div", { class: "hint-text", style: { textAlign: "right", marginTop: "2px" } }, ["0 / 20,000"]);
    input.addEventListener("input", function () {
      counter.textContent = input.value.length + " / " + MAX_CHARS.toLocaleString();
    });

    var sendBtn = UI.btn(t("chat.send"), "btn-primary", send);
    var newBtn = UI.btn(t("chat.new") || "新建对话", "btn-outline btn-sm", function () {
      messages = baseMessages.slice();
      log.innerHTML = "";
      bubble("assistant", t("chat.hello"));
    });
    var busy = false;

    // 预设提问
    var presetRow = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap", marginBottom: "8px" } }, []);
    PRESETS.forEach(function (p) {
      presetRow.appendChild(UI.el("button", { class: "chip", style: { cursor: "pointer" } , title: p }, [p]));
    });
    presetRow.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      input.value = chip.textContent;
      input.dispatchEvent(new Event("input"));
      input.focus();
    });

    function send() {
      var txt = input.value.trim();
      if ((!txt && !pendingImgs.length) || busy) return;
      if (!FF.Ai.getKey()) { bubble("assistant", t("ai.nokey")); return; }
      var parts = [];
      if (pendingImgs.length) {
        pendingImgs.forEach(function (p) { parts.push({ img: p }); });
      }
      if (txt) parts.push({ text: txt });
      var content = parts.length === 1 && parts[0].text ? txt : parts;
      input.value = "";
      pendingImgs = [];
      renderAttach();
      counter.textContent = "0 / 20,000";
      bubble("user", content);
      messages.push({ role: "user", content: content });
      busy = true;
      sendBtn.disabled = true;
      var wait = bubble("assistant", "…");
      FF.Ai.chat(messages).then(function (reply) {
        wait.textContent = reply;
        messages.push({ role: "assistant", content: reply });
      }).catch(function (e) {
        wait.textContent = "Error: " + (e.message === "NO_KEY" ? t("ai.nokey") : e.message);
        messages.pop(); // 失败回退
      }).finally(function () {
        busy = false;
        sendBtn.disabled = false;
        log.scrollTop = log.scrollHeight;
      });
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    bubble("assistant", t("chat.hello"));

    var inputWrap = UI.el("div", { style: { position: "relative" } }, [input]);
    var btnRow = UI.el("div", { class: "mt8", style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
      [btnAttach, sendBtn, newBtn, counter]);

    card.appendChild(UI.el("div", { class: "chat-layout" }, [
      log,
      UI.el("div", { class: "mt8" }, [presetRow, attachRow, inputWrap, btnRow, UI.el("div", { class: "hint-text mt4" }, ["Enter 发送 · Shift + Enter 换行"])])
    ]));
    card.appendChild(side);

    return { root: root };
  };
})();
