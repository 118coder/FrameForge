/* FrameForge · 场景抽角色（对齐 frameronin v5 SceneCharacter）
 * 在测试场景中单抽/十连抽生成新手尺寸角色并入场。
 * 付费后端等价替代：走全局 API 设置直连生图；花名册本地持久化。 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  /* 30 职业 × 制服描述（对齐原站职业清单） */
  var JOBS = [
    ["护士", "白色护士服、护士帽、胸前挂听诊器"],
    ["医生", "白大褂、内搭浅蓝衬衫、佩戴工作牌"],
    ["警官", "深蓝色警服、肩章、腰带配装备"],
    ["消防员", "深色消防制服、反光条、头戴安全帽"],
    ["空乘", "航空制服套装、丝巾、翼形胸章"],
    ["飞行员", "深色机长制服、四道杠袖标、大檐帽"],
    ["列车乘务员", "铁路制服套装、制帽、领巾"],
    ["船长", "白色船长礼服、双排扣、肩章"],
    ["秘书", "商务套装、衬衫、细框眼镜"],
    ["律师", "黑色律师袍、白色领饰、公文包"],
    ["教师", "针织衫、及膝裙、胸牌"],
    ["图书管理员", "背带裙、白衬衫、袖套"],
    ["科研人员", "白色实验服、护目镜挂颈、工作证"],
    ["工程师", "工装夹克、安全帽挂腰、工具腰带"],
    ["机械维修师", "连体工装、手套、扳手挂腰"],
    ["快递员", "统一配送制服、臂章、肩背包"],
    ["园艺师", "背带裤、草帽、园艺手套"],
    ["兽医", "白大褂、动物图案徽章、听诊器"],
    ["考古学家", "卡其探险装、护腿靴、软尺挂腰"],
    ["摄影师", "多口袋摄影马甲、相机挂颈"],
    ["舞台歌手", "演出礼服、手持麦克风、亮片点缀"],
    ["健身教练", "运动背心、护腕、哨子挂颈"],
    ["赛车手", "连体赛车服、刺绣徽章、头盔手持"],
    ["女仆", "女仆装、围裙、白色头饰"],
    ["餐厅服务员", "餐厅制服、围裙、托盘"],
    ["调酒师", "马甲衬衫配领结、调酒壶"],
    ["咖啡师", "咖啡师围裙、卷袖衬衫、布帽"],
    ["厨师", "白色厨师服、高帽、围裙"],
    ["甜点师", "粉色围裙、厨帽、裱花袋"],
    ["酒店经理", "深色西装、胸牌、领带"]
  ];

  var BASE = "成年女性像素游戏角色，全身正面站立像，16-bit 像素风，清晰的硬边轮廓，纯白背景，居中构图，单个角色";
  var SIZE_SPEC = "，竖直单角色立绘，比例约 1:2，背景必须纯白 #FFFFFF";

  /* 10 个站位（桌面端坐标，原站 v 表） */
  var STANDS = [
    [0.60, 0.755], [0.51, 0.775], [0.69, 0.79], [0.42, 0.805], [0.79, 0.82],
    [0.375, 0.95], [0.277, 0.94], [0.473, 0.95], [0.17, 0.945], [0.572, 0.925]
  ];
  var STAND_SCALE = [0.20, 0.20, 0.20, 0.20, 0.20, 0.26, 0.26, 0.26, 0.26, 0.26];

  var ROSTER_KEY = "ff.scenechar.roster";

  function loadRoster() {
    try { return JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveRoster(r) {
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(r.slice(-10))); } catch (e) { /* noop */ }
  }

  FF.Tools.scenechar = function () {
    var sk = UI.pageSkeleton("mod.scenechar.t", "mod.scenechar.d", null);
    var root = sk.root, card = sk.card;

    /* 抽卡历史（洗牌不重复，抽完重置——原站 Fisher-Yates 语义） */
    var bag = [];
    function drawJobs(n) {
      var out = [];
      while (out.length < n) {
        if (!bag.length) {
          bag = JOBS.slice();
          for (var i = bag.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
          }
        }
        out.push(bag.pop());
      }
      return out;
    }

    var roster = loadRoster();   // [{job, name, url, stand}]
    var pending = 0;

    /* ---------- 舞台 ---------- */
    var stage = UI.makeCanvas(918, 512);
    stage.style.maxWidth = "100%";
    stage.style.borderRadius = "10px";
    stage.style.border = "1.2px solid var(--card-border)";
    var sctx = stage.getContext("2d");
    var charImgs = [];  // {img, stand}

    function drawStage() {
      var W = 918, H = 512;
      // 房间背景（程序化 lounge）
      var g = sctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#3a2f3e"); g.addColorStop(0.62, "#2c2430"); g.addColorStop(0.63, "#4a3a30"); g.addColorStop(1, "#3a2d24");
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, W, H);
      // 窗光
      sctx.fillStyle = "rgba(240,220,160,0.10)";
      sctx.fillRect(W * 0.08, H * 0.12, W * 0.16, H * 0.38);
      sctx.fillRect(W * 0.76, H * 0.12, W * 0.16, H * 0.38);
      // 聚光灯（5 组，原站 It 语义简化）
      for (var li = 0; li < 5; li++) {
        var lx = W * (0.14 + li * 0.18);
        var lg = sctx.createRadialGradient(lx, 40, 4, lx, H * 0.7, 150);
        lg.addColorStop(0, "rgba(255,240,200,0.16)");
        lg.addColorStop(1, "rgba(255,240,200,0)");
        sctx.fillStyle = lg;
        sctx.fillRect(lx - 150, 0, 300, H);
      }
      // 地板线
      sctx.strokeStyle = "rgba(0,0,0,0.18)";
      sctx.lineWidth = 2;
      for (var fy = 0; fy < 4; fy++) {
        sctx.beginPath();
        sctx.moveTo(0, H * 0.63 + fy * (H * 0.37 / 4));
        sctx.lineTo(W, H * 0.63 + fy * (H * 0.37 / 4));
        sctx.stroke();
      }
      // 角色
      charImgs.forEach(function (ci) {
        var st = STANDS[ci.stand], sc = STAND_SCALE[ci.stand];
        var dispH = Math.min(106, H * sc / 4 * 0.88 + 60);
        var w = ci.img.naturalWidth / ci.img.naturalHeight * dispH * 0.5;
        var h = dispH;
        sctx.drawImage(ci.img, W * st[0] - w / 2, H * st[1] - h, w, h);
      });
      // 等待占位（portal 光柱）
      roster.forEach(function (r, i) {
        if (!r.url && r.stand !== undefined) {
          var st = STANDS[r.stand];
          sctx.fillStyle = "rgba(180,220,255,0.25)";
          sctx.fillRect(W * st[0] - 12, H * st[1] - 70, 24, 70);
          sctx.fillStyle = "#fff";
          sctx.font = "12px sans-serif";
          sctx.textAlign = "center";
          sctx.fillText(t("sc.waiting"), W * st[0], H * st[1] - 78);
        }
      });
    }

    /* ---------- 生成 ---------- */
    var status = UI.el("div", { class: "hint-text mt8" }, []);
    var countIn = UI.el("input", { type: "number", value: "1", min: "1", max: "10", style: { width: "72px" } });
    var descIn = UI.el("textarea", {
      rows: "2", maxLength: "1000", placeholder: t("sc.desc.ph"),
      style: { width: "100%", background: "var(--input-bg)", color: "var(--text)", border: "1.5px solid var(--input-border)", borderRadius: "8px", padding: "8px", fontSize: "13px", resize: "vertical" }
    });

    function promptFor(job) {
      var extra = descIn.value.trim();
      return BASE + "；职业：" + job[0] + "；制服：" + job[1] + (extra ? "；补充：" + extra : "") + SIZE_SPEC;
    }

    function findFreeStand() {
      var used = roster.map(function (r) { return r.stand; });
      for (var i = 0; i < 10; i++) if (used.indexOf(i) < 0) return i;
      return -1;
    }

    function draw(n) {
      if (pending + roster.length >= 10 && n > 10 - roster.length - pending) {
        status.textContent = t("sc.full");
        return;
      }
      var jobs = drawJobs(n);
      if (!FF.Ai.getKey()) { status.textContent = t("ai.nokey"); status.style.color = "var(--danger)"; return; }
      status.style.color = "";
      jobs.forEach(function (job) {
        var stand = findFreeStand();
        if (stand < 0) { status.textContent = t("sc.full"); return; }
        var entry = { job: job[0], name: job[0], url: "", stand: stand };
        roster.push(entry);
        pending++;
        drawStage();
        FF.Ai.generate(promptFor(job), null).then(function (r) {
          entry.url = r.dataUrl;
          var img = new Image();
          img.onload = function () {
            charImgs.push({ img: img, stand: stand });
            drawStage();
            status.textContent = t("sc.arrived") + " " + job[0];
            status.style.color = "var(--green)";
          };
          img.src = r.dataUrl;
        }).catch(function (e) {
          roster = roster.filter(function (r) { return r !== entry; });
          status.textContent = job[0] + " " + t("vg.fail") + (e.message === "NO_KEY" ? t("ai.nokey") : e.message);
          status.style.color = "var(--danger)";
        }).finally(function () {
          pending--;
          saveRoster(roster);
        });
      });
      saveRoster(roster);
    }

    /* ---------- 工具栏 ---------- */
    var btnGacha = UI.el("div", { class: "row mt8", style: { gap: "8px", flexWrap: "wrap" } }, [
      UI.el("span", { class: "hint-text" }, [t("sc.count")]), countIn,
      UI.btn(t("sc.draw"), "btn-primary", function () { draw(Math.max(1, Math.min(10, Number(countIn.value) || 1))); }),
      UI.btn(t("sc.clear"), "btn-ghost btn-sm", function () {
        if (!roster.length || confirm(t("sc.clear.confirm"))) {
          roster = []; charImgs = []; saveRoster(roster); drawStage();
        }
      })
    ]);

    /* 预览弹层（点击角色） */
    stage.addEventListener("click", function (e) {
      var rect = stage.getBoundingClientRect();
      var mx = (e.clientX - rect.left) * 918 / rect.width;
      var my = (e.clientY - rect.top) * 512 / rect.height;
      for (var i = 0; i < charImgs.length; i++) {
        var ci = charImgs[i];
        var st = STANDS[ci.stand];
        var px = 918 * st[0], py = 512 * st[1];
        if (Math.abs(mx - px) < 40 && my > py - 130 && my < py + 10) {
          var entry = roster.find(function (r) { return r.stand === ci.stand && r.url; });
          if (entry) {
            var im = UI.el("img", { src: entry.url, style: { maxWidth: "220px", imageRendering: "pixelated" } });
            var box = UI.el("div", { style: { textAlign: "center" } }, [im, UI.el("p", {}, [entry.name])]);
            box.appendChild(UI.btn(t("common.download"), "btn-outline btn-sm", function () {
              UI.download(dataUrlToBlob(entry.url), entry.name + ".png");
            }));
            UI.modal(t("sc.preview"), box);
          }
          return;
        }
      }
    });

    function dataUrlToBlob(u) {
      var bin = atob(u.split(",")[1]);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: "image/png" });
    }

    card.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("sc.hint")]));
    card.appendChild(stage);
    card.appendChild(UI.el("div", { class: "mt8" }, [descIn]));
    card.appendChild(btnGacha);
    card.appendChild(status);
    drawStage();

    return { root: root };
  };
})();
