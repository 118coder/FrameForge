/* FrameForge · 像素实验区（对齐 frameronin v5 实验区）：
 * 相机视角提示词（本地 3D 预览） / 控制测试（canvas 小游戏） / rpgmaker 大全 / 子模块入口 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  /* ================= 实验区容器 ================= */

  var LAB_SLOTS = [
    { id: "cameraview", icon: "hd2d", t: "lab.camera.t", d: "lab.camera.d", route: "#/lab?tool=cameraview", local: true },
    { id: "control", icon: "video", t: "lab.control.t", d: "lab.control.d", route: "#/lab?tool=control", local: true },
    { id: "rpgall", icon: "grid", t: "lab.rpgall.t", d: "lab.rpgall.d", route: "#/lab?tool=rpgall", local: true },
    { id: "pixelcreate", icon: "ai", t: "mod.pixelcreate.t", d: "mod.pixelcreate.d", route: "#/pixelcreate" },
    { id: "eightdir", icon: "ai", t: "mod.eightdir.t", d: "mod.eightdir.d", route: "#/eightdir" },
    { id: "chat", icon: "ai", t: "mod.chat.t", d: "mod.chat.d", route: "#/chat" },
    { id: "uiicons", icon: "ps", t: "mod.uiicons.t", d: "mod.uiicons.d", route: "#/uiicons" },
    { id: "infmap", icon: "map", t: "lab.infmap.t", d: "lab.infmap.d", route: "#/lab?tool=infmap", local: true }
  ];

  FF.Tools.lab = function (q) {
    var sk = UI.pageSkeleton("mod.lab.t", "mod.lab.d", null);
    var pane = sk.card;
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("common.backhome")])]);
    back.addEventListener("click", function () { location.hash = "#/"; });
    // 子工具直达
    if (q && q.tool) {
      if (q.tool === "cameraview") return LabCamera(sk);
      if (q.tool === "control") return LabControl(sk);
      if (q.tool === "rpgall") return LabRpgAll(sk);
      if (q.tool === "infmap") return LabInfMap(sk);
    }
    var grid = UI.el("div", { class: "grid-lg" });
    LAB_SLOTS.forEach(function (s) {
      var card = UI.el("div", { class: "card clickable" }, [
        UI.el("div", { class: "card-icon" }, [UI.icon(s.icon)]),
        UI.el("div", { class: "card-title" }, [t(s.t)]),
        UI.el("div", { class: "card-desc" }, [t(s.d)])
      ]);
      card.addEventListener("click", function () { location.hash = s.route; });
      grid.appendChild(card);
    });
    pane.appendChild(grid);
    return { root: sk.root };
  };

  /* ================= 相机视角提示词（本地 Three 风格预览，纯 canvas 2D 轴测投影） ================= */

  function LabCamera(sk) {
    var pane = sk.card;
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("lab.back")])]);
    back.addEventListener("click", function () { location.hash = "#/lab"; });

    var cv = UI.makeCanvas(420, 300);
    cv.style.background = "#1a2233";
    // 场景参数：一个立方体建筑 + 地面网格
    var params = { yaw: 35, pitch: 30, dist: 8, fov: 60, h: 2.0 };

    function drawScene() {
      var ctx = cv.getContext("2d");
      var W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#1a2233"; ctx.fillRect(0, 0, W, H);
      var cy = Math.cos(params.pitch * Math.PI / 180), sy = Math.sin(params.pitch * Math.PI / 180);
      var cz = Math.cos(params.yaw * Math.PI / 180), sz = Math.sin(params.yaw * Math.PI / 180);
      function project(x, y, z) { // y-up 世界
        // 绕 Y 轴旋转 yaw，再绕 X 轴 pitch
        var x1 = x * cz + z * sz, z1 = -x * sz + z * cz;
        var y2 = y * cy - z1 * sy, z2 = y * sy + z1 * cy;
        var d = Math.max(0.1, params.dist);
        var f = (W / 2) / Math.tan(params.fov * Math.PI / 360);
        var s = f / (d + z2);
        return { x: W / 2 + x1 * s, y: H / 2 - y2 * s + 20, s: s };
      }
      // 地面网格 8×8
      ctx.strokeStyle = "rgba(120,160,220,0.35)"; ctx.lineWidth = 1;
      for (var i = -4; i <= 4; i++) {
        var a = project(i, 0, -4), b = project(i, 0, 4);
        var c = project(-4, 0, i), d2 = project(4, 0, i);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
      }
      // 立方体（单位 1，高 h）
      var h = params.h;
      var corners = [
        [-0.6, 0, -0.6], [0.6, 0, -0.6], [0.6, 0, 0.6], [-0.6, 0, 0.6],
        [-0.6, h, -0.6], [0.6, h, -0.6], [0.6, h, 0.6], [-0.6, h, 0.6]
      ].map(function (p) { return project(p[0], p[1], p[2]); });
      var faces = [
        { idx: [0, 1, 2, 3], col: "#3a5a8c" },   // 底(不画)
        { idx: [4, 5, 6, 7], col: "#6fa8dc" },   // 顶
        { idx: [0, 1, 5, 4], col: "#4a7ab8" },
        { idx: [1, 2, 6, 5], col: "#5c8cc8" },
        { idx: [2, 3, 7, 6], col: "#4a7ab8" },
        { idx: [3, 0, 4, 7], col: "#5c8cc8" }
      ];
      faces.slice(1).forEach(function (f) {
        ctx.fillStyle = f.col;
        ctx.beginPath();
        f.idx.forEach(function (ix, k) {
          if (k === 0) ctx.moveTo(corners[ix].x, corners[ix].y);
          else ctx.lineTo(corners[ix].x, corners[ix].y);
        });
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(20,30,50,0.6)"; ctx.stroke();
      });
      // 参数水印
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "11px monospace";
      ctx.fillText("yaw " + params.yaw.toFixed(0) + "°  pitch " + params.pitch.toFixed(0) + "°  dist " + params.dist.toFixed(1) + "  fov " + params.fov.toFixed(0) + "°", 10, H - 10);
    }
    drawScene();

    var yawS = UI.slider(t("cam.yaw"), 0, 360, 35, { onInput: function (v) { params.yaw = v; drawScene(); updPrompt(); } });
    var pitchS = UI.slider(t("cam.pitch"), 0, 89, 30, { onInput: function (v) { params.pitch = v; drawScene(); updPrompt(); } });
    var distS = UI.slider(t("cam.dist"), 2, 30, 8, { step: 0.5, onInput: function (v) { params.dist = v; drawScene(); updPrompt(); } });
    var fovS = UI.slider(t("cam.fov"), 20, 110, 60, { onInput: function (v) { params.fov = v; drawScene(); updPrompt(); } });
    var hS = UI.slider(t("cam.h"), 0.5, 6, 2, { step: 0.1, onInput: function (v) { params.h = v; drawScene(); } });

    var promptBox = UI.el("textarea", { class: "fg-prompt sm", readonly: "readonly", style: { height: "72px" } });
    function updPrompt() {
      var angleH = params.yaw.toFixed(0);
      var elev = params.pitch.toFixed(0);
      var shot = params.pitch < 15 ? "平视（eye-level shot）" : params.pitch < 40 ? "低俯视角（slightly elevated view）" : params.pitch < 65 ? "俯视角（high-angle view）" : "顶视角（top-down view）";
      var lens = params.fov < 40 ? "长焦镜头压缩感（telephoto）" : params.fov < 75 ? "标准镜头（standard lens）" : "广角镜头（wide-angle）";
      promptBox.value = "相机视角：水平方位角约 " + angleH + "°，仰角约 " + elev + "°（" + shot + "），" +
        "相机距离 " + params.dist + " 个单位，" + lens + "（FOV " + params.fov.toFixed(0) + "°），物体高度约 " + params.h + " 单位。";
    }
    updPrompt();
    var copyBtn = UI.btn(t("cam.copy"), "btn-primary", function () {
      navigator.clipboard.writeText(promptBox.value).then(function () { FF.Toast.show(t("cam.copied"), "ok"); });
    });

    pane.appendChild(back);
    pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "14px", flexWrap: "wrap", alignItems: "flex-start" } }, [
      cv,
      UI.el("div", { style: { flex: "1 1 220px", minWidth: "220px" } }, [yawS.el, pitchS.el, distS.el, fovS.el, hS.el])
    ]));
    pane.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("cam.out")]));
    pane.appendChild(promptBox);
    pane.appendChild(UI.el("div", { class: "mt8" }, [copyBtn]));
    return { root: sk.root };
  }

  /* ================= 控制测试（topdown canvas 小游戏） ================= */

  function LabControl(sk) {
    var pane = sk.card;
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("lab.back")])]);
    back.addEventListener("click", function () { location.hash = "#/lab"; });

    var cv = UI.makeCanvas(480, 320);
    cv.style.imageRendering = "pixelated";
    var ctx = cv.getContext("2d");
    var player = { x: 40, y: 40, w: 24, h: 24, speed: 2.2, run: 3.6, dir: 0, frame: 0 };
    var obstacles = [{ x: 150, y: 90, w: 80, h: 40 }, { x: 300, y: 200, w: 100, h: 36 }];
    var keys = {};
    var editing = false, editStart = null, editCur = null;
    // 原站 controlTest 增强：自定义精灵 sheet（3×3=252×252）+ 背景/前景/音乐 + I/J/K
    var spriteImg = null, bgImg = null, fgImg = null, musicAudio = null;
    var invOpen = false, shieldUntil = 0, magnetUntil = 0;
    function uploadRow() {
      var row = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap", marginBottom: "8px" } }, []);
      function mkUpload(label, accept, cb) {
        var inp = UI.el("input", { type: "file", accept: accept, style: { display: "none" } });
        inp.addEventListener("change", function () {
          var f = inp.files && inp.files[0];
          if (f) cb(f);
        });
        var b = UI.btn(label, "btn-outline btn-sm", function () { inp.click(); });
        row.appendChild(b);
        row.appendChild(inp);
      }
      mkUpload(t("lab.ct.sprite"), "image/*", function (f) {
        UI.fileToImage(f).then(function (r) {
          spriteImg = r.img; r.release();
          player.w = Math.floor(spriteImg.naturalWidth / 3 * 0.8) || 24;
          player.h = Math.floor(spriteImg.naturalHeight / 3 * 0.8) || 24;
        });
      });
      mkUpload(t("lab.ct.bg"), "image/*", function (f) {
        UI.fileToImage(f).then(function (r) { bgImg = r.img; r.release(); });
      });
      mkUpload(t("lab.ct.fg"), "image/*", function (f) {
        UI.fileToImage(f).then(function (r) { fgImg = r.img; r.release(); });
      });
      mkUpload(t("lab.ct.music"), "audio/*", function (f) {
        if (musicAudio) musicAudio.pause();
        musicAudio = new Audio(URL.createObjectURL(f));
        musicAudio.loop = true;
        musicAudio.volume = 0.35;
        musicAudio.play().catch(function () { /* 需手势后再点上传即有手势 */ });
      });
      return row;
    }
    pane.insertBefore(uploadRow(), pane.firstChild);

    function draw() {
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, cv.width, cv.height);
      } else {
        ctx.fillStyle = "#2d4a2d"; ctx.fillRect(0, 0, cv.width, cv.height);
      }
      // 网格
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      for (var x = 0; x < cv.width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
      for (var y = 0; y < cv.height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }
      // 障碍
      obstacles.forEach(function (o) {
        ctx.fillStyle = "#6b4a2a"; ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = "#3a2a18"; ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
      });
      // 编辑框
      if (editCur) {
        ctx.strokeStyle = "#ffb04b"; ctx.setLineDash([4, 3]);
        ctx.strokeRect(Math.min(editStart.x, editCur.x), Math.min(editStart.y, editCur.y),
          Math.abs(editCur.x - editStart.x), Math.abs(editCur.y - editStart.y));
        ctx.setLineDash([]);
      }
      // 角色：自定义精灵（3×3 sheet 行=方向 下/左/右，列=步帧）或像素小人
      if (spriteImg) {
        var fw = Math.floor(spriteImg.naturalWidth / 3), fh = Math.floor(spriteImg.naturalHeight / 3);
        ctx.drawImage(spriteImg, player.frame * fw, player.dir * fh, fw, fh, player.x, player.y, player.w, player.h);
      } else {
        ctx.fillStyle = "#e8b04b";
        ctx.fillRect(player.x, player.y, player.w, player.h);
        ctx.fillStyle = "#b64a2e";
        ctx.fillRect(player.x + 4, player.y + 4, 6, 6);
      }
      // K 防御护盾 / J 吸引光环（原站 controlTest 行为）
      if (Date.now() < shieldUntil) {
        ctx.strokeStyle = "rgba(110,190,255,0.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w, 0, Math.PI * 2); ctx.stroke();
      }
      if (Date.now() < magnetUntil) {
        ctx.strokeStyle = "rgba(255,210,110,0.6)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w * 2, 0, Math.PI * 2); ctx.stroke();
      }
      // 前景
      if (fgImg) ctx.drawImage(fgImg, 0, 0, cv.width, cv.height);
      // I 物品栏
      if (invOpen) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(8, 8, 24 * 4 + 10, 34);
        for (var ii = 0; ii < 4; ii++) {
          ctx.strokeStyle = "#a08e71"; ctx.strokeRect(13 + ii * 24 + 0.5, 13.5, 20, 20);
        }
      }
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "10px monospace";
      ctx.fillText("WASD 移动 · Shift 跑步 · I 物品 · J 吸引 · K 防御 · 拖拽障碍 · C 清空", 8, cv.height - 8);
    }

    function step() {
      var sp = keys["shift"] ? player.run : player.speed;
      var nx = player.x + (keys["d"] ? sp : 0) - (keys["a"] ? sp : 0);
      var ny = player.y + (keys["s"] ? sp : 0) - (keys["w"] ? sp : 0);
      nx = Math.max(0, Math.min(cv.width - player.w, nx));
      ny = Math.max(0, Math.min(cv.height - player.h, ny));
      // 碰撞
      var hit = obstacles.some(function (o) {
        return nx < o.x + o.w && nx + player.w > o.x && ny < o.y + o.h && ny + player.h > o.y;
      });
      if (!hit) {
        if (nx !== player.x || ny !== player.y) player.frame = (player.frame + 1) % 3;
        player.x = nx; player.y = ny;
        if (keys["s"]) player.dir = 0; else if (keys["a"]) player.dir = 1; else if (keys["d"]) player.dir = 2; else if (keys["w"]) player.dir = 0;
      }
      draw();
      raf = requestAnimationFrame(step);
    }
    var raf = requestAnimationFrame(step);

    function keyTo(k) {
      var kk = k.toLowerCase();
      if (kk === "shift") return "shift";
      if (["w", "a", "s", "d"].indexOf(kk) >= 0) return kk;
      return null;
    }
    function onDown(e) {
      if (e.key === "c" || e.key === "C") { obstacles = []; return; }
      var kk = keyTo(e.key);
      if (kk) { keys[kk] = true; e.preventDefault(); return; }
      var lk = e.key.toLowerCase();
      if (lk === "i") { invOpen = !invOpen; e.preventDefault(); }
      else if (lk === "j") { magnetUntil = Date.now() + 3000; e.preventDefault(); }
      else if (lk === "k") { shieldUntil = Date.now() + 3000; e.preventDefault(); }
    }
    function onUp(e) {
      var kk = keyTo(e.key);
      if (kk) keys[kk] = false;
    }
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);

    function pt(e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
    }
    cv.addEventListener("pointerdown", function (e) { editing = true; editStart = pt(e); editCur = pt(e); });
    cv.addEventListener("pointermove", function (e) { if (editing) editCur = pt(e); });
    window.addEventListener("pointerup", function () {
      if (editing && editStart && editCur) {
        var x = Math.min(editStart.x, editCur.x), y = Math.min(editStart.y, editCur.y);
        var w = Math.abs(editCur.x - editStart.x), h = Math.abs(editCur.y - editStart.y);
        if (w > 8 && h > 8) obstacles.push({ x: x, y: y, w: w, h: h });
      }
      editing = false; editStart = editCur = null;
    });

    var sw = UI.switchRow(t("control.edit"), false, function () {});
    pane.appendChild(back);
    pane.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("control.hint")]));
    pane.appendChild(UI.canvasFrame(cv, "480×320"));
    pane.appendChild(sw.el);
    var view = {
      root: sk.root,
      cleanup: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onDown);
        document.removeEventListener("keyup", onUp);
      }
    };
    return view;
  }

  /* ================= rpgmaker 大全（21 模板选择 → 自由生图） ================= */

  function LabRpgAll(sk) {
    var pane = sk.card;
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("lab.back")])]);
    back.addEventListener("click", function () { location.hash = "#/lab"; });

    var TPL = [
      "RPG Maker VX 走图 3×4（下左右）", "RPG Maker VX 走图 4×4（四方向）", "RPG Maker XP 走图（大像素）",
      "RPG Maker MZ 走图", "战斗图（正面 SV）", "战斗图（侧面横版）",
      "八方向行走图", "待机/行走/攻击三动作", "待机/行走/攻击/受击/死亡 全套",
      "二头身 Q 版走图", "三头身走图", "四头身走图",
      "骑马行走图", "坐姿图", "睡觉图",
      "施法序列", "射箭序列", "挥剑序列",
      "NPC 商店老板（站桩+对话手势）", "怪物图（斜方向+爬梯）", "动物图（狗/猫走图）"
    ];
    var grid = UI.el("div", { class: "grid-sm" });
    TPL.forEach(function (name, i) {
      var card = UI.el("div", { class: "card-sm clickable" }, [
        UI.el("div", { class: "card-title" }, [(i + 1) + ". " + name])
      ]);
      card.addEventListener("click", function () {
        sessionStorage.setItem("ff.transferPrompt",
          "生成一张 RPG Maker 模板像素角色素材（模板：" + name + "）。" +
          "严格按该模板的网格规格与画风，角色居中、帧间一致，纯色背景 #00FF00，不要文字、水印、网格线。角色设定按用户描述。");
        location.hash = "#/freegen";
      });
      grid.appendChild(card);
    });
    pane.appendChild(back);
    pane.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("lab.rpgall.hint")]));
    pane.appendChild(grid);
    return { root: sk.root };
  }

  /* ================= 无限地图（简化 demo：程序化地形 + 透视卷动 + WASD） ================= */

  function LabInfMap(sk) {
    var pane = sk.card;
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("lab.back")])]);
    back.addEventListener("click", function () { location.hash = "#/lab"; });

    var cv = UI.makeCanvas(560, 320);
    var ctx = cv.getContext("2d");
    var TILE = 24, ROWS = 9;
    var world = {};          // "x,y" -> 0水 1草 2山 3树
    function seed(x, y) {
      var k = x + "," + y;
      if (world[k] !== undefined) return world[k];
      var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      var v = n - Math.floor(n);
      var r = v;
      var key = k;
      world[key] = r < 0.18 ? 0 : (r < 0.85 ? 1 : (r < 0.93 ? 2 : 3));
      return world[key];
    }
    var px = 0, py = 0;
    var keys = {};
    var COLORS = ["#2a6ad8", "#4a9a3a", "#7a7a72", "#1e5a28"];
    var drawY = 0;

    function draw() {
      ctx.fillStyle = "#14202e"; ctx.fillRect(0, 0, cv.width, cv.height);
      var W = cv.width, H = cv.height;
      var rowH = H / ROWS;
      var startRow = Math.floor(py);
      for (var ri = 0; ri < ROWS + 2; ri++) {
        var wy = startRow + ri;
        var depth = ri / ROWS;
        var scale = 0.45 + depth * 0.85;                 // 近大远小
        var h = rowH * scale;
        var y = H - (ri * rowH) - h / 2 - ((py % 1) * rowH * scale);
        var cols = Math.ceil(W / (TILE * scale)) + 2;
        var cx0 = Math.floor(px) - Math.floor(cols / 2);
        for (var ci = 0; ci < cols; ci++) {
          var wx = cx0 + ci;
          var v = seed(wx, wy);
          var x = W / 2 + (wx - px) * TILE * scale - TILE * scale / 2;
          ctx.fillStyle = COLORS[v];
          ctx.fillRect(x, y, TILE * scale + 1, h + 1);
          if (v === 3) { // 树
            ctx.fillStyle = "#153a1a";
            ctx.fillRect(x + TILE * scale * 0.3, y - h * 0.5, TILE * scale * 0.4, h * 0.8);
          }
        }
      }
      // 玩家标记
      ctx.fillStyle = "#e8b04b";
      ctx.fillRect(W / 2 - 8, H * 0.72, 16, 16);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "11px monospace";
      ctx.fillText("WASD 移动 · 透视卷动 · 程序化地形（水/草/山/树）", 8, H - 8);
    }
    function step() {
      var sp = keys["shift"] ? 0.25 : 0.12;
      if (keys["w"]) py -= sp;
      if (keys["s"]) py += sp;
      if (keys["a"]) px -= sp;
      if (keys["d"]) px += sp;
      draw();
      raf = requestAnimationFrame(step);
    }
    var raf = requestAnimationFrame(step);
    function onDown(e) {
      var kk = e.key.toLowerCase();
      if (["w", "a", "s", "d", "shift"].indexOf(kk) >= 0) { keys[kk] = true; e.preventDefault(); }
    }
    function onUp(e) { keys[e.key.toLowerCase()] = false; }
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);

    var seaS = UI.slider(t("inf.sea"), 0, 60, 18, { onInput: function (v) { world = {}; seaLevel = v; } });
    var seaLevel = 18;
    // 覆盖 seed 用海平面（简化：seaLevel 控制水的比例）
    var _seed = seed;
    seed = function (x, y) {
      var k = x + "," + y;
      if (world[k] !== undefined) return world[k];
      var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      var v = n - Math.floor(n);
      world[k] = v < seaLevel / 100 ? 0 : (v < 0.85 ? 1 : (v < 0.93 ? 2 : 3));
      return world[k];
    };

    pane.appendChild(back);
    pane.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("inf.hint")]));
    pane.appendChild(UI.canvasFrame(cv, "560×320"));
    pane.appendChild(seaS.el);
    var view = {
      root: sk.root,
      cleanup: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onDown);
        document.removeEventListener("keyup", onUp);
      }
    };
    return view;
  }
})();
