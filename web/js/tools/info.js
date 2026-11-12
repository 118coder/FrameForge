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
      "做一个红袍魔法师，直接给我八方向的走路、奔跑、待机和攻击。角色和动作参数用默认值。",
      "把这三张角色参考图各做一张一图 Max+1 和 Max+2，先核对整批费用，按授权执行后交付六张 PNG。",
      "用标准 HD2D 的一图 Max 做一个红袍魔法师，检查动作并导出 PNG。",
      "帮我用快速换皮替换这套动作的外观，每个完整单帧必须在 64×64 以内，超限先等比缩小副本并重新预览。",
      "把这张动作 GIF 换成红袍魔法师。先给我切帧预览和费用估算，按我授权的预算执行，最后返回序列图、GIF 和逐帧 PNG。",
      "在本站自由生图生成一张像素风剑士，纯绿色背景，并自动接去背 + 等比缩放节点。",
      "全套 32 组八方向动作包：走、跑、待机、攻击各生成正面、背面和三个左侧方向，再逐帧镜像补齐右侧三向。",
      "从一张图到可用素材：自由生图导入 → 蓝图节点处理（去背/裁切/缩放/像素化/量化）→ 结果检查 → 下载与保存。"
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
  /* 首页「关注入口」补齐（对齐原站 A 按钮 4 外链） */

  /* ================= /tut 使用手册（对齐原站 57 项说明库，7 类筛选 + 本地路由映射） ================= */
  FF.Tools.tut = function () {
    var sk = UI.pageSkeleton("mod.tut.t", "mod.tut.d", null);
    var root = sk.root, card = sk.card;

    var CATS = [
      { id: "gen", label: "生图与角色动作", items: [
        { n: "自由生图", r: "#/freegen", e: "首页快捷键 Z", s: "画面描述+负面词 → 参考图/风格参考 → 生成落画布 → 下载或保存画布" },
        { n: "AI 生图 / 自由序列", r: "#/ai", e: "首页快捷键 X", s: "选预设模板（RPG Maker/八方向/全动作）→ 补充描述 → 生成" },
        { n: "API 生图 / 抽卡", r: "#/apiimage", e: "首页卡片", s: "角色描述 → 抽卡次数 → 生成 N 张（自动抠图可开）" },
        { n: "完美八方向", r: "#/eightdir", e: "首页卡片", s: "上传角色图 → 九宫格八方向生成" },
        { n: "像素创造", r: "#/pixelcreate", e: "首页卡片", s: "参考图+动作描述 → 序列帧 sprite sheet" },
        { n: "一图自定义动作", r: "#/customactions", e: "首页卡片", s: "动作库多选 → 角色设定 → 生成动作序列表" },
        { n: "特效库", r: "#/effects", e: "首页卡片", s: "36 模板×12 配色 → 送自由生图" },
        { n: "UI&图标", r: "#/uiicons", e: "首页卡片", s: "提取 UI 元素或生成图标（透明背景）" },
        { n: "生成大杂烩", r: "#/potpourri", e: "首页卡片", s: "28 预设模板 → 送自由生图" },
        { n: "RpgMaker 大全", r: "#/lab?tool=rpgall", e: "像素实验区", s: "21 张模板卡 → 拼 #00FF00 背景提示词" },
        { n: "场景生成", r: "#/freegen", e: "预设-地图", s: "正视角/45 度/泰拉/街机四预设" }
      ]},
      { id: "clean", label: "图片清理与像素优化", items: [
        { n: "抠图去背", r: "#/chroma", e: "首页快捷键 K", s: "绿/蓝/白/连通域/双背景/半透明特效；抑色/侵蚀可调" },
        { n: "完美像素", r: "#/pixel?tab=perfect", e: "首页快捷键 W", s: "FFT 网格检测还原歪网格 AI 图" },
        { n: "像素转化优化", r: "#/pixel", e: "首页快捷键 W", s: "像素块/合并色/16 色/色表对标/高级像素化" },
        { n: "一键处理", r: "#/pixelplus", e: "首页快捷键 F", s: "缩放 144 → 连通域抠图 → 内描边" }
      ]},
      { id: "seq", label: "视频、GIF 与序列图", items: [
        { n: "视频转序列帧", r: "#/video", e: "首页快捷键 V", s: "FPS/最大宽/帧数上限 → 抽帧 → 抠图/像素化 → Sheet/GIF/ZIP" },
        { n: "GIF 处理", r: "#/gif", e: "首页快捷键 G", s: "拆帧排序 / 多图合成单图 / 批量裁剪 / 简易拼接" },
        { n: "Sprite Sheet", r: "#/sheet", e: "首页快捷键 S", s: "拆分（自动猜网格）/ 合成（列数+延时）" }
      ]},
      { id: "pro", label: "RoninPro 进阶工具", items: [
        { n: "统一大小", r: "#/pro?tab=1", e: "RoninPro", s: "多图以最大宽高为格 → 对齐补透明 → 合成一张图" },
        { n: "自定义切图", r: "#/pro?tab=2", e: "RoninPro", s: "固定网格 / 智能检测 / L7 接缝（带内最小 alpha）" },
        { n: "单图调整 Pro", r: "#/pro?tab=3", e: "RoninPro", s: "切块 → 逐帧平移/裁边 → 重组合导出" },
        { n: "简易裁剪", r: "#/pro?tab=4", e: "RoninPro", s: "四边正裁负扩透明" },
        { n: "扩图与缩图", r: "#/pro?tab=5", e: "RoninPro", s: "N×M 格心裁切合并" },
        { n: "正斜转化", r: "#/pro?tab=6", e: "RoninPro", s: "方形瓦片 → 等距菱形（单应矩阵）" },
        { n: "零散切图", r: "#/pro?tab=7", e: "RoninPro", s: "背景色距离识别 + 排序 + 手动框选 → ZIP" },
        { n: "大图切分", r: "#/pro?tab=8", e: "RoninPro", s: "等距重叠切分 tileLen=len/(n−(n−1)ov)" },
        { n: "重复帧查找", r: "#/pro?tab=9", e: "RoninPro", s: "RGBA 全等/轮廓分组 → dedupe/copyFirst" },
        { n: "序列压缩", r: "#/pro?tab=10", e: "RoninPro", s: "空白列检测紧凑重排 + 跳过完全重复帧" },
        { n: "音频压缩", r: "#/pro?tab=11", e: "RoninPro", s: "WAV → MP3（lamejs，批量）" },
        { n: "光流补帧", r: "#/pro?tab=12", e: "RoninPro", s: "双向块匹配插帧 → ZIP（原站为 OpenCV Farneback）" },
        { n: "像素引擎", r: "#/pro?tab=13", e: "RoninPro", s: "网格检测/区域合并/量化/合并七步流水线" },
        { n: "流程蓝图", r: "#/flow", e: "首页快捷键 T", s: "节点管线：色键/连通域/行列编辑/区域复制/完美像素等" },
        { n: "Rseprite", r: "#/rseprite", e: "首页快捷键 E", s: "多帧多图层像素编辑 → Sheet/GIF" },
        { n: "模型对话", r: "#/chat", e: "首页快捷键 C", s: "闲聊/提示词助手，可带参考图" }
      ]},
      { id: "map", label: "地图、场景与模型", items: [
        { n: "地图拼接", r: "#/map", e: "首页快捷键 M", s: "多图拖放拼合 + 网格吸附 + AI 生成地图落板" },
        { n: "瓦片调整", r: "#/tile", e: "首页卡片", s: "tileset 图章绘制（RoninTile 简版）" },
        { n: "建筑生成器", r: "#/building", e: "资源区", s: "原站外挂应用" },
        { n: "地形插件", r: "#/terrain", e: "资源区", s: "Roninterr 地形插件（原站）" },
        { n: "HD2D 模型优化", r: "#/hd2d", e: "资源区", s: "GLB/GLTF 优化（原站）" },
        { n: "无限地图 demo", r: "#/lab?tool=infmap", e: "像素实验区", s: "程序化地形透视卷动" }
      ]},
      { id: "lab", label: "像素实验区", items: [
        { n: "相机视角提示词", r: "#/lab?tool=cameraview", e: "像素实验区", s: "五参数轴测预览 → 复制镜头提示词" },
        { n: "控制测试", r: "#/lab?tool=control", e: "像素实验区", s: "WASD 手感 + 障碍绘制" }
      ]},
      { id: "res", label: "素材、保存与帮助", items: [
        { n: "暂存框", r: "#/", e: "右下角", s: "会话暂存/本地双存储，拖出即用" },
        { n: "免费角色库", r: "#/freechars", e: "资源区", s: "20 套角色动作素材（原站下载）" },
        { n: "素材与源码分享", r: "#/assets", e: "资源区", s: "开源仓库/Godot/indieloop" },
        { n: "技能（智能体）", r: "#/skills", e: "顶栏", s: "Codex / DeepSeek 技能包说明" },
        { n: "使用说明", r: "#/guide", e: "顶栏", s: "8 步上手引导" },
        { n: "在线 PS", r: "#/onlineps", e: "资源区", s: "Photopea（图层/蒙版/PSD）" }

      ]}
    ];

    var list = UI.el("div", { class: "mt8" }, []);
    function render(catId) {
      list.innerHTML = "";
      CATS.forEach(function (cat) {
        if (catId && cat.id !== catId) return;
        list.appendChild(UI.el("div", { class: "pb-title mt14" }, [cat.label + " · " + cat.items.length]));
        cat.items.forEach(function (it) {
          var row = UI.el("div", { class: "card-link", style: { cursor: "pointer" } }, [
            UI.el("div", {}, [
              UI.el("strong", {}, [it.n]),
              UI.el("div", { class: "hint-text" }, [it.s])
            ]),
            UI.el("span", { class: "hint-text", style: { whiteSpace: "nowrap" } }, [it.e])
          ]);
          row.addEventListener("click", function () { location.hash = it.r; });
          list.appendChild(row);
        });
      });
    }
    var chips = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, []);
    var mk = function (label, id) {
      var c = UI.el("button", { class: "chip" }, [label]);
      c.addEventListener("click", function () {
        chips.querySelectorAll(".chip").forEach(function (x) { x.style.borderColor = ""; });
        c.style.borderColor = "var(--accent)";
        render(id);
      });
      chips.appendChild(c);
    };
    mk("全部 " + CATS.reduce(function (a, c) { return a + c.items.length; }, 0), null);
    CATS.forEach(function (c) { mk(c.label + " " + c.items.length, c.id); });

    card.appendChild(UI.el("p", { class: "hint-text" }, ["按用途找模块 · 分清本地处理与 AI 消耗 · 点击任意条目直达对应功能"]));
    card.appendChild(chips);
    card.appendChild(list);
    render(null);
    return { root: root };
  };
})();