/* FrameForge · 视频生成（对齐 frameronin v5：Wan 3.0 / Agnes Video 2.5）
 * 付费后端等价替代：走全局 API 设置的 OpenAI 兼容视频端点（{base}/videos 提交+轮询），
 * 填入支持视频生成的 API Key 即可用；任务记录本地保存可续查。 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  var MODELS = [
    { v: "wan-3.0", label: "Wan 3.0", perSec: 5.5 },
    { v: "agnes-video-2.5", label: "Agnes Video 2.5", perSec: 4.5 }
  ];
  var RATIOS = ["16:9", "9:16", "21:9", "4:3", "1:1", "3:4"];
  var RESOS = [
    { v: "480p", k: 0.6 }, { v: "720p", k: 1.0 }, { v: "1080p", k: 1.6 }
  ];
  var RATIO_SIZE = { "16:9": [1280, 720], "9:16": [720, 1280], "21:9": [1344, 576], "4:3": [960, 720], "1:1": [960, 960], "3:4": [720, 960] };
  var RESO_H = { "480p": 480, "720p": 720, "1080p": 1080 };
  var JOBS_KEY = "ff.videogen.jobs";

  function loadJobs() {
    try { return JSON.parse(localStorage.getItem(JOBS_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveJobs(j) {
    try { localStorage.setItem(JOBS_KEY, JSON.stringify(j.slice(0, 20))); } catch (e) { /* 满则忽略 */ }
  }

  FF.Tools.videogen = function () {
    var sk = UI.pageSkeleton("mod.videogen.t", "mod.videogen.d", null);
    var root = sk.root, card = sk.card;

    var modelSel = UI.selectRow(t("vg.model"), MODELS.map(function (m) { return { v: m.v, label: m.label }; }), "wan-3.0", {});
    var promptIn = UI.el("textarea", {
      rows: "6", maxLength: "20000", placeholder: t("vg.prompt.ph"),
      style: { width: "100%", background: "var(--input-bg)", color: "var(--text)", border: "1.5px solid var(--input-border)", borderRadius: "8px", padding: "10px", fontSize: "13.5px", fontFamily: "inherit", resize: "vertical" }
    });
    var counter = UI.el("div", { class: "hint-text", style: { textAlign: "right" } }, ["0 / 20,000"]);
    promptIn.addEventListener("input", function () { counter.textContent = promptIn.value.length.toLocaleString() + " / 20,000"; });

    var ratioSel = UI.selectRow(t("vg.ratio"), RATIOS.map(function (r) { return { v: r, label: r }; }), "16:9", {});
    var resoSel = UI.selectRow(t("vg.reso"), RESOS.map(function (r) { return { v: r.v, label: r.v }; }), "720p", {});
    var durIn = UI.el("input", { type: "number", value: "5", min: "2", max: "30", style: { width: "80px" } });
    var seedIn = UI.el("input", { type: "number", placeholder: t("vg.seed.ph"), style: { width: "140px" } });
    var cost = UI.el("div", { class: "hint-text" }, []);
    function refreshCost() {
      var m = MODELS.find(function (x) { return x.v === modelSel.value; }) || MODELS[0];
      var k = (RESOS.find(function (x) { return x.v === resoSel.value; }) || RESOS[1]).k;
      var sec = Math.max(2, Math.min(30, Number(durIn.value) || 5));
      var est = m.perSec * k * sec;
      cost.innerHTML = "<b style='color:var(--gold)'>" + t("vg.cost") + " " + est.toFixed(1) + " 次</b> · " + t("vg.cost.note");
    }
    [modelSel, resoSel].forEach(function (s) { s.el.addEventListener && s.el.addEventListener("change", refreshCost); });
    durIn.addEventListener("input", refreshCost);
    refreshCost();

    /* 参考方式 */
    var refMode = UI.selectRow(t("vg.refmode"), [
      { v: "text", label: t("vg.ref.text") },
      { v: "image", label: t("vg.ref.image") },
      { v: "frames", label: t("vg.ref.frames") }
    ], "text", {});
    var refZone = UI.dropzone({ accept: "image/*", main: t("vg.ref.drop"), hint: "PNG/JPG/WebP", style: { display: "none" } });
    var refZone2 = UI.dropzone({ accept: "image/*", main: t("vg.ref.drop2"), hint: "PNG/JPG/WebP", style: { display: "none" } });
    var refData = null, refData2 = null;
    refZone.onFiles = function (files) {
      UI.fileToImage(files[0]).then(function (r) {
        var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
        c.getContext("2d").drawImage(r.img, 0, 0);
        refData = c.toDataURL("image/png"); r.release();
      });
    };
    refZone2.onFiles = function (files) {
      UI.fileToImage(files[0]).then(function (r) {
        var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
        c.getContext("2d").drawImage(r.img, 0, 0);
        refData2 = c.toDataURL("image/png"); r.release();
      });
    };
    function refreshRef() {
      var v = refMode.value;
      refZone.style.display = v === "text" ? "none" : "";
      refZone2.style.display = v === "frames" ? "" : "none";
    }
    refMode.el.addEventListener("change", refreshRef);

    var status = UI.el("div", { class: "hint-text mt8" }, []);
    var resultArea = UI.el("div", { class: "mt8" }, []);
    var goBtn;

    /* OpenAI 兼容视频端点：POST {base}/videos → GET {base}/videos/{id} 轮询 */
    function apiBase() { return (localStorage.getItem("ff.aibase") || "https://api.openai.com").replace(/\/+$/, ""); }
    function apiKey() { return localStorage.getItem("ff.aikey") || ""; }
    function apiUrl(path) {
      var b = apiBase();
      if (/\/v\d+$/.test(b)) return b + path;
      return b + "/v1" + path;
    }

    function bodyFor() {
      var size = RATIO_SIZE[ratioSel.value] || [1280, 720];
      var h = RESO_H[resoSel.value] || 720;
      // 以短边为准缩放比例尺寸
      var ratio = size[0] / size[1];
      var w2 = Math.round(h * ratio / 2) * 2, h2 = h;
      if (ratio < 1) { w2 = h; h2 = Math.round(h / ratio / 2) * 2; }
      var body = {
        model: modelSel.value,
        prompt: promptIn.value.trim(),
        seconds: String(Math.max(2, Math.min(30, Number(durIn.value) || 5))),
        size: w2 + "x" + h2
      };
      if (seedIn.value) body.seed = Number(seedIn.value);
      if (refMode.value === "image" && refData) body.input_reference = refData;
      if (refMode.value === "frames" && refData) {
        body.input_reference = refData;
        if (refData2) body.last_frame = refData2;
      }
      return body;
    }

    function videoUrlOf(j) {
      if (!j) return "";
      if (j.video_url) return j.video_url;
      if (j.url) return j.url;
      if (j.data && j.data[0]) return j.data[0].url || (j.data[0].b64_json ? "data:video/mp4;base64," + j.data[0].b64_json : "");
      if (j.output && typeof j.output === "string") return j.output;
      if (j.result && j.result.video_url) return j.result.video_url;
      return "";
    }

    function submit() {
      var txt = promptIn.value.trim();
      if (!txt) { status.textContent = t("vg.need.prompt"); return; }
      if (!apiKey()) { status.textContent = t("ai.nokey"); status.style.color = "var(--danger)"; return; }
      goBtn.disabled = true;
      status.style.color = "";
      status.textContent = t("vg.submitting");
      var job = { id: "job_" + Date.now(), remoteId: "", model: modelSel.value, prompt: txt.slice(0, 120), status: "submitting", time: Date.now(), url: "" };
      fetch(apiUrl("/videos"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey() },
        body: JSON.stringify(bodyFor())
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (x) { throw new Error("HTTP " + r.status + " " + x.slice(0, 200)); });
        return r.json();
      }).then(function (j) {
        var url = videoUrlOf(j);
        job.remoteId = j.id || j.task_id || "";
        if (url) { finish(job, url); return; }
        job.status = "processing";
        persist(job);
        status.textContent = t("vg.processing") + (job.remoteId ? " · " + t("vg.taskid") + " " + job.remoteId : "");
        poll(job, 0);
      }).catch(function (e) {
        status.textContent = t("vg.fail") + e.message;
        status.style.color = "var(--danger)";
        goBtn.disabled = false;
      });
    }

    function persist(job) {
      var jobs = loadJobs();
      var i = jobs.findIndex(function (x) { return x.id === job.id; });
      if (i >= 0) jobs[i] = job; else jobs.unshift(job);
      saveJobs(jobs);
    }

    function poll(job, n) {
      if (n > 120) { status.textContent = t("vg.timeout"); goBtn.disabled = false; return; }
      setTimeout(function () {
        fetch(apiUrl("/videos/" + job.remoteId), { headers: { "Authorization": "Bearer " + apiKey() } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var st = (j.status || "").toLowerCase();
            var url = videoUrlOf(j);
            if (url || st === "completed" || st === "succeeded") {
              if (url) { finish(job, url); return; }
              status.textContent = t("vg.done.nourl");
              goBtn.disabled = false;
              return;
            }
            if (st === "failed" || j.error) {
              status.textContent = t("vg.fail") + (typeof j.error === "string" ? j.error : JSON.stringify(j.error || "").slice(0, 200));
              status.style.color = "var(--danger)";
              goBtn.disabled = false;
              return;
            }
            status.textContent = t("vg.processing") + " (" + (n + 1) + ")" + (job.remoteId ? " · " + t("vg.taskid") + " " + job.remoteId : "");
            poll(job, n + 1);
          })
          .catch(function () { poll(job, n + 1); });
      }, n < 2 ? 3000 : 10000);
    }

    function finish(job, url) {
      job.status = "done"; job.url = url;
      persist(job);
      status.textContent = t("vg.done");
      status.style.color = "var(--green)";
      goBtn.disabled = false;
      renderResult(url);
    }

    function renderResult(url) {
      resultArea.innerHTML = "";
      var v = UI.el("video", { src: url, controls: "", style: { maxWidth: "100%", maxHeight: "420px", borderRadius: "10px", border: "1.2px solid var(--card-border)", background: "#000" } });
      var row = UI.el("div", { class: "btn-row mt8" }, [
        UI.btn(t("common.download"), "btn-primary", function () {
          var a = document.createElement("a");
          a.href = url; a.download = "video_" + Date.now() + ".mp4";
          document.body.appendChild(a); a.click(); a.remove();
        }),
        UI.btn(t("vg.toVideo"), "btn-outline", function () {
          // 发送到视频切帧：下载为 blob → ff.transferVideoUrl
          fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
            return new Promise(function (res) {
              var fr = new FileReader();
              fr.onload = function () { res(String(fr.result)); };
              fr.readAsDataURL(blob);
            });
          }).then(function (dataUrl) {
            sessionStorage.setItem("ff.transferVideoUrl", dataUrl);
            location.hash = "#/video";
          });
        })
      ]);
      resultArea.appendChild(v);
      resultArea.appendChild(row);
    }

    /* 历史任务续查 */
    var jobsWrap = UI.el("div", { class: "mt14" }, []);
    function renderJobs() {
      jobsWrap.innerHTML = "";
      var jobs = loadJobs();
      if (!jobs.length) return;
      jobsWrap.appendChild(UI.el("div", { class: "pb-title" }, [t("vg.jobs")]));
      var row = UI.el("div", { class: "row", style: { gap: "6px", flexWrap: "wrap" } }, []);
      jobs.slice(0, 8).forEach(function (j) {
        var label = (j.remoteId || j.id).slice(0, 22) + " · " + (j.status === "done" ? "✓" : j.status);
        var b = UI.btn(label, "btn-outline btn-sm", function () {
          if (j.url) { renderResult(j.url); return; }
          if (!j.remoteId) return;
          goBtn.disabled = true;
          status.textContent = t("vg.querying");
          fetch(apiUrl("/videos/" + j.remoteId), { headers: { "Authorization": "Bearer " + apiKey() } })
            .then(function (r) { return r.json(); })
            .then(function (rj) {
              var u = videoUrlOf(rj);
              if (u) { finish(j, u); } else { status.textContent = t("vg.processing"); goBtn.disabled = false; }
            })
            .catch(function (e) { status.textContent = t("vg.fail") + e.message; status.style.color = "var(--danger)"; goBtn.disabled = false; });
        });
        row.appendChild(b);
      });
      jobsWrap.appendChild(row);
    }

    goBtn = UI.btn(t("vg.go"), "btn-primary", submit);
    var goWrap = UI.el("div", { class: "mt14" }, [goBtn]);

    card.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("vg.hint")]));
    card.appendChild(modelSel.el);
    card.appendChild(UI.el("div", { class: "pb-title mt8" }, [t("vg.prompt")]));
    card.appendChild(promptIn);
    card.appendChild(counter);
    card.appendChild(UI.el("div", { class: "param-grid mt8" }, [
      ratioSel.el, resoSel.el,
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("vg.dur")]), durIn, UI.el("span", { class: "hint-text" }, ["2–30 s"])]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("vg.seed")]), seedIn])
    ]));
    card.appendChild(UI.el("div", { class: "mt8" }, [refMode.el]));
    card.appendChild(UI.el("div", { class: "mt8" }, [refZone, refZone2]));
    card.appendChild(cost);
    card.appendChild(goWrap);
    card.appendChild(status);
    card.appendChild(resultArea);
    card.appendChild(jobsWrap);
    renderJobs();
    refreshRef();

    return { root: root };
  };
})();
