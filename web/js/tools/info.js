/* FrameForge · 信息页合集（对齐 frameronin v5）：
 * 素材和源码分享 / 技能(Codex) / 使用说明 / 免费角色库 / 外链插件页（建筑生成器/NPC/地形/HD2D） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  function shell(titleKey, descKey) {
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("common.backhome")])]);
    back.addEventListener("click", function () { location.hash = "#/"; });
    var card = UI.el("div", { class: "page-card" }, [
      back,
      UI.el("div", { class: "page-title" }, [t(titleKey)]),
      descKey ? UI.el("div", { class: "page-desc" }, [t(descKey)]) : null
    ]);
    return { root: UI.el("div", {}, [card]), card: card };
  }
  function linkCard(parent, title, desc, url, btnLabel) {
    var c = UI.el("div", { class: "info-card" }, [
      UI.el("div", { class: "info-t" }, [title]),
      UI.el("div", { class: "info-d" }, [desc])
    ]);
    var row = UI.el("div", { class: "btn-row mt8" }, []);
    (url || []).forEach(function (u, i) {
      var a = UI.el("a", { class: "btn btn-outline btn-sm", href: u.url, target: "_blank", rel: "noopener noreferrer" }, [u.label || btnLabel || "打开"]);
      row.appendChild(a);
    });
    if (row.children.length) c.appendChild(row);
    parent.appendChild(c);
  }

  /* ================= 素材和游戏源码分享 ================= */

  FF.Tools.assets = function () {
    var sk = shell("mod.assets.t", "mod.assets.d");
    var grid = UI.el("div", { class: "info-grid" });
    linkCard(grid, t("as.repo"), t("as.repo.d"), [
      { url: "https://github.com/systemchester/FrameRonin", label: "GitHub →" }
    ]);
    linkCard(grid, t("as.art"), t("as.art.d"), [
      { url: "https://github.com/systemchester/FrameRonin/releases", label: "Releases →" }
    ]);
    linkCard(grid, t("as.godot"), t("as.godot.d"), [
      { url: "https://github.com/systemchester/FrameRonin", label: "GitHub →" }
    ]);
    linkCard(grid, t("as.indie"), t("as.indie.d"), [
      { url: "https://www.indieloop.com", label: "indieloop.com →" }
    ]);
    sk.card.appendChild(grid);
    sk.card.appendChild(UI.el("div", { class: "hint-text mt14" }, [t("as.note")]));
    return { root: sk.root };
  };

  /* ================= 技能（AI 智能体技能包） ================= */

  FF.Tools.skills = function () {
    var sk = shell("mod.skills2.t", "mod.skills2.d");
    sk.card.appendChild(UI.el("div", { class: "hint-text" }, [t("sk.intro")]));
    var list = UI.el("div", { class: "info-grid mt8" });
    linkCard(list, t("sk.codex"), t("sk.codex.d"), [
      { url: "https://github.com/systemchester/FrameRonin/tree/main/docs", label: "查看文档 →" }
    ]);
    sk.card.appendChild(list);
    /* 技能指令示例 */
    var exTitle = UI.el("div", { class: "pb-title mt14" }, [t("sk.examples")]);
    sk.card.appendChild(exTitle);
    var EXAMPLES = [
      "做一个红袍魔法师，直接给我八方向的走路、待机和攻击。角色和动作参数用默认值。",
      "用标准 HD2D 的一图 Max 做一个红袍魔法师，检查动作并导出 PNG。",
      "帮我用快速换皮替换这套动作的外观，每个完整单帧必须在 64×64 以内。",
      "把这张动作序列换成红袍魔法师，保留原动作和法杖，先展示切帧预览。",
      "在本站自由生图生成一张像素风剑士，纯绿色背景，并自动接去背 + 等比缩放节点。"
    ];
    var ul = UI.el("ul", { class: "sk-examples" });
    EXAMPLES.forEach(function (e) { ul.appendChild(UI.el("li", {}, [e])); });
    sk.card.appendChild(ul);
    return { root: sk.root };
  };

  /* ================= 使用说明（/tut 对齐） ================= */

  FF.Tools.guide = function () {
    var sk = shell("mod.guide.t", "mod.guide.d");
    var SECTIONS = [
      { t: "gd.s1.t", d: "gd.s1.d", route: "#/freegen", btn: "mod.freegen.t" },
      { t: "gd.s2.t", d: "gd.s2.d", route: "#/apiimage", btn: "mod.apiimage.t" },
      { t: "gd.s3.t", d: "gd.s3.d", route: "#/pixelcreate", btn: "mod.pixelcreate.t" },
      { t: "gd.s4.t", d: "gd.s4.d", route: "#/eightdir", btn: "mod.eightdir.t" },
      { t: "gd.s5.t", d: "gd.s5.d", route: "#/chroma", btn: "mod.chroma.t" },
      { t: "gd.s6.t", d: "gd.s6.d", route: "#/pixel", btn: "mod.pixel.t" },
      { t: "gd.s7.t", d: "gd.s7.d", route: "#/video", btn: "mod.video.t" },
      { t: "gd.s8.t", d: "gd.s8.d", route: "#/pro", btn: "mod.pro.t" }
    ];
    var steps = UI.el("div", { class: "gd-steps" });
    SECTIONS.forEach(function (s, i) {
      var row = UI.el("div", { class: "gd-row" }, [
        UI.el("div", { class: "gd-n" }, [String(i + 1)]),
        UI.el("div", { class: "gd-body" }, [
          UI.el("div", { class: "info-t" }, [t(s.t)]),
          UI.el("div", { class: "info-d" }, [t(s.d)])
        ]),
        UI.btn(t(s.btn), "btn-outline btn-sm", function () { location.hash = s.route; })
      ]);
      steps.appendChild(row);
    });
    sk.card.appendChild(steps);
    sk.card.appendChild(UI.el("div", { class: "hint-text mt14" }, [t("gd.privacy")]));
    return { root: sk.root };
  };

  /* ================= 免费角色库 ================= */

  FF.Tools.freechars = function () {
    var sk = shell("mod.freechars.t", "mod.freechars.d");
    sk.card.appendChild(UI.el("div", { class: "hint-text" }, [t("fc.note")]));
    var grid = UI.el("div", { class: "grid-sm mt8" });
    // 20 套角色占位卡（本地无素材文件，提供命名规范 + 外链）
    for (var i = 1; i <= 12; i++) {
      var card = UI.el("div", { class: "card-sm" }, [
        UI.el("div", { class: "card-title" }, ["角色包 " + i]),
        UI.el("div", { class: "card-desc" }, [t("fc.pack.d")])
      ]);
      grid.appendChild(card);
    }
    sk.card.appendChild(grid);
    sk.card.appendChild(UI.el("div", { class: "mt14" }, [
      UI.el("a", { class: "btn btn-outline btn-sm", href: "https://frameronin.com/free-character-library/index.html", target: "_blank", rel: "noopener noreferrer" }, [t("fc.origin") + " →"])
    ]));
    return { root: sk.root };
  };

  /* ================= 外链插件页（建筑生成器 / NPC 插件 / 地形插件 / HD2D / 在线PS / 瓦片16） ================= */

  function pluginPage(titleKey, descKey, url, note) {
    return function () {
      var sk = shell(titleKey, descKey);
      sk.card.appendChild(UI.el("div", { class: "hint-text" }, [note || t("pl.note")]));
      sk.card.appendChild(UI.el("div", { class: "mt14" }, [
        UI.el("a", { class: "btn btn-primary btn-sm", href: url, target: "_blank", rel: "noopener noreferrer" }, [t("pl.open") + " →"])
      ]));
      return { root: sk.root };
    };
  }
  FF.Tools.building = pluginPage("mod.building.t", "mod.building.d", "https://frameronin.com/ronin-building/index.html");
  FF.Tools.npcplugin = pluginPage("mod.npc.t", "mod.npc.d", "https://frameronin.com/ai-resource-library-showcase/index.html");
  FF.Tools.terrain = pluginPage("mod.terrain.t", "mod.terrain.d", "https://frameronin.com/roninterr-showcase/index.html");
  FF.Tools.hd2d = pluginPage("mod.hd2d.t", "mod.hd2d.d", "https://frameronin.com/hd2d-model-optimizer-new/index.html");
  FF.Tools.onlineps = pluginPage("mod.ps2.t", "mod.ps2.d", "https://www.photopea.com/", t("pl.ps.note"));
})();
