/* FrameForge · 模型对话（闲聊 / 提示词助手） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.chat = function () {
    var sk = UI.pageSkeleton("mod.chat.t", "mod.chat.d", null);
    var root = sk.root, card = sk.card;

    var SYSTEM = t("chat.system");
    var messages = [{ role: "user", content: SYSTEM }, { role: "assistant", content: "OK" }];

    var log = UI.el("div", {
      class: "canvas-frame",
      style: { display: "block", height: "420px", overflowY: "auto", padding: "14px", flexDirection: "column", alignItems: "stretch", gap: "10px" }
    }, []);

    function bubble(role, text) {
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
      }, [text]);
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
    }

    var keyHint = UI.el("div", { class: "hint-text mb8" }, []);
    function refreshKey() {
      keyHint.textContent = FF.Ai.getKey()
        ? "✓ " + FF.Ai.TYPE_LABELS[FF.Ai.effectiveType()] + " · " + FF.Ai.getModel()
        : "⚠ " + t("ai.nokey");
      keyHint.style.color = FF.Ai.getKey() ? "var(--green)" : "var(--accent)";
    }
    refreshKey();

    var input = UI.el("textarea", {
      rows: "3",
      placeholder: t("chat.ph"),
      style: {
        width: "100%", background: "var(--input-bg)", color: "var(--text)",
        border: "1.5px solid var(--input-border)", borderRadius: "8px",
        padding: "10px", fontSize: "13.5px", fontFamily: "inherit", resize: "vertical"
      }
    });
    var sendBtn = UI.btn(t("chat.send"), "btn-primary", send);
    var busy = false;

    function send() {
      var txt = input.value.trim();
      if (!txt || busy) return;
      if (!FF.Ai.getKey()) { bubble("assistant", t("ai.nokey")); return; }
      input.value = "";
      bubble("user", txt);
      messages.push({ role: "user", content: txt });
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

    card.appendChild(keyHint);
    card.appendChild(log);
    card.appendChild(UI.el("div", { class: "mt14" }, [input]));
    card.appendChild(UI.el("div", { class: "mt8 btn-row" }, [sendBtn]));

    return { root: root };
  };
})();
