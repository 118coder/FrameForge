/* FrameForge · AI 生图：多协议 API 直连（Gemini 原生 / OpenAI 兼容）+ 本地密钥管理 */
(function () {
  "use strict";

  var FF = window.FF;

  var DEFAULT_BASE = "https://generativelanguage.googleapis.com";
  var DEFAULT_MODEL = "gemini-2.5-flash-image";

  /* ---------- 配置存取 ---------- */

  function getKey() { return localStorage.getItem("ff.aikey") || ""; }
  function setKey(k) { k ? localStorage.setItem("ff.aikey", k) : localStorage.removeItem("ff.aikey"); }
  function getBase() { return localStorage.getItem("ff.aibase") || DEFAULT_BASE; }
  function setBase(b) { b ? localStorage.setItem("ff.aibase", b) : localStorage.removeItem("ff.aibase"); }
  function getModel() { return localStorage.getItem("ff.aimodel") || DEFAULT_MODEL; }
  function setModel(m) { m ? localStorage.setItem("ff.aimodel", m) : localStorage.removeItem("ff.aimodel"); }
  // 类型: auto | gemini | openai-chat | openai-images
  function getType() { return localStorage.getItem("ff.apitype") || "auto"; }
  function setType(t) { t ? localStorage.setItem("ff.apitype", t) : localStorage.removeItem("ff.apitype"); }

  /* ---------- 接口类型识别 ---------- */

  var TYPE_LABELS = {
    gemini: "Gemini 原生",
    "openai-chat": "OpenAI 兼容 · Chat",
    "openai-images": "OpenAI 兼容 · Images"
  };

  function detectType(url, key) {
    var u = (url || "").toLowerCase();
    if (u.indexOf("generativelanguage.googleapis.com") >= 0 || u.indexOf("/v1beta") >= 0) return "gemini";
    if (u.indexOf("/images/generations") >= 0 || u.indexOf("/images/edits") >= 0 || u.indexOf("/images") >= 0) return "openai-images";
    if (u.indexOf("/chat/completions") >= 0 || u.indexOf("/completions") >= 0) return "openai-chat";
    if (u.indexOf("/v1") >= 0 || u.indexOf("/v2") >= 0 || u.indexOf("/openai") >= 0) return "openai-chat";
    // 无特征：按 Key 形状猜
    if ((key || "").indexOf("AIza") === 0) return "gemini";
    return "openai-chat";
  }

  function effectiveType() {
    var t = getType();
    return t === "auto" ? detectType(getBase(), getKey()) : t;
  }

  /* ---------- URL 归一化 ---------- */

  function trimBase(u) {
    return (u || "").trim().replace(/\?.*$/, "").replace(/\/+$/, "");
  }

  // 兼容用户粘贴的多种形态：裸域名 / 到 /v1beta / 到 /models / 完整 :generateContent
  function buildGeminiUrl(base, model, key) {
    var b = trimBase(base);
    if (/\/models\/[^/]+:generatecontent$/i.test(b)) return b + "?key=" + encodeURIComponent(key);
    b = b.replace(/:generatecontent$/i, "");
    if (/\/models\/[^/]+$/i.test(b)) return b + ":generateContent?key=" + encodeURIComponent(key);
    b = b.replace(/\/models\/?$/i, "");
    if (/\/v1beta$/i.test(b) || /\/v1$/i.test(b)) {
      return b + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
    }
    if (/\/v1beta\/openai$/i.test(b)) b = b.replace(/\/openai$/i, "");
    return b + "/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
  }

  function buildOpenAIChatUrl(base) {
    var b = trimBase(base);
    if (/\/chat\/completions$/i.test(b)) return b;
    b = b.replace(/\/completions$/i, "");
    if (/\/openai$/i.test(b)) return b + "/chat/completions";
    if (/\/v1$/i.test(b) || /\/v1beta$/i.test(b)) return b + "/chat/completions";
    return b + "/v1/chat/completions";
  }

  function buildOpenAIImagesUrl(base, isEdit) {
    var b = trimBase(base);
    b = b.replace(/\/images\/(generations|edits)$/i, "");
    b = b.replace(/\/images$/i, "");
    var tail = isEdit ? "/images/edits" : "/images/generations";
    if (/\/v1$/i.test(b)) return b + tail;
    return b + "/v1" + tail;
  }

  /* ---------- 响应图像提取 ---------- */

  function firstImageFromChat(j) {
    try {
      var msg = j.choices && j.choices[0] && j.choices[0].message;
      if (!msg) return null;
      // NewAPI / OneAPI 扩展: message.images = [{image_url:{url}}] 或 [string]
      if (msg.images && msg.images.length) {
        var it = msg.images[0];
        var u = it && (it.image_url && it.image_url.url || it.url || (typeof it === "string" ? it : null));
        if (u) return u;
      }
      if (typeof msg.content === "string") {
        var md = msg.content.match(/!\[[^\]]*\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)/i);
        if (md) return md[1];
        var raw = msg.content.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i);
        if (raw) return raw[0];
      } else if (Array.isArray(msg.content)) {
        for (var i = 0; i < msg.content.length; i++) {
          var p = msg.content[i];
          if (p && p.image_url && p.image_url.url) return p.image_url.url;
          if (p && p.type === "image_url" && typeof p.image_url === "string") return p.image_url;
        }
      }
      // 兜底：OpenAI Images 形状混在 chat 里
      if (j.data && j.data.length) return firstImageFromImages(j);
    } catch (e) { /* noop */ }
    return null;
  }

  function firstImageFromImages(j) {
    try {
      var d = j.data && j.data[0];
      if (!d) return null;
      if (d.b64_json) return "data:image/png;base64," + d.b64_json;
      if (d.url) return d.url;
    } catch (e) { /* noop */ }
    return null;
  }

  function urlToDataUrl(u) {
    if (u.indexOf("data:") === 0) return Promise.resolve(u);
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " (拉取图片)");
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(new Error("读取图片失败")); };
        fr.readAsDataURL(blob);
      });
    });
  }

  function errText(status, j) {
    var m = null;
    try {
      m = (j && j.error && (j.error.message || j.error.code)) ||
          (j && j.message) ||
          (j && j.choices && j.choices[0] && j.choices[0].error && j.choices[0].error.message) || null;
    } catch (e) { /* noop */ }
    return m || ("HTTP " + status);
  }

  /* ---------- 三种协议的生成实现 ---------- */

  function genGemini(prompt, refImage) {
    var key = getKey();
    var url = buildGeminiUrl(getBase(), getModel(), key);
    var parts = [{ text: prompt }];
    if (refImage && refImage.base64) {
      parts.push({ inline_data: { mime_type: refImage.mime || "image/png", data: refImage.base64 } });
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: parts }],
        generationConfig: { responseModalities: ["IMAGE"] }
      })
    }).then(handleHttp).then(function (j) {
      var cands = (j && j.candidates) || [];
      for (var ci = 0; ci < cands.length; ci++) {
        var ps = ((cands[ci].content || {}).parts) || [];
        for (var pi = 0; pi < ps.length; pi++) {
          var inline = ps[pi].inlineData || ps[pi].inline_data;
          if (inline && inline.data) {
            var mime = inline.mimeType || inline.mime_type || "image/png";
            return finish(mime, inline.data);
          }
        }
      }
      var txt = "";
      cands.forEach(function (c) { ((c.content || {}).parts || []).forEach(function (p) { if (p.text) txt += p.text; }); });
      throw new Error(txt ? ("未返回图像: " + txt.slice(0, 160)) : "未返回图像");
    });
  }

  function genOpenAIChat(prompt, refImage) {
    var key = getKey();
    var url = buildOpenAIChatUrl(getBase());
    var content = refImage && refImage.base64
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: "data:" + (refImage.mime || "image/png") + ";base64," + refImage.base64 } }
        ]
      : prompt;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model: getModel(), messages: [{ role: "user", content: content }], stream: false })
    }).then(handleHttp).then(function (j) {
      var img = firstImageFromChat(j);
      if (!img) {
        var txt = (j.choices && j.choices[0] && j.choices[0].message && (j.choices[0].message.content || "")) || "";
        throw new Error(typeof txt === "string" && txt ? ("未返回图像: " + txt.slice(0, 160)) : "未返回图像");
      }
      return urlToDataUrl(img).then(function (dataUrl) {
        return finish(dataUrl.slice(5, dataUrl.indexOf(";")), dataUrl.split(",")[1], dataUrl);
      });
    });
  }

  function genOpenAIImages(prompt, refImage) {
    var key = getKey();
    var model = getModel();
    var headers = { "Authorization": "Bearer " + key };
    var p;
    if (refImage && refImage.base64) {
      // images.edits：multipart
      var bin = atob(refImage.base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var fd = new FormData();
      fd.append("model", model);
      fd.append("prompt", prompt);
      fd.append("image", new Blob([bytes], { type: refImage.mime || "image/png" }), "reference.png");
      p = fetch(buildOpenAIImagesUrl(getBase(), true), { method: "POST", headers: headers, body: fd });
    } else {
      var body = { model: model, prompt: prompt, n: 1 };
      if (/dall-e/i.test(model)) body.response_format = "b64_json";
      p = fetch(buildOpenAIImagesUrl(getBase(), false), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify(body)
      });
    }
    return p.then(handleHttp).then(function (j) {
      var img = firstImageFromImages(j);
      if (!img) throw new Error("未返回图像");
      return urlToDataUrl(img).then(function (dataUrl) {
        return finish(dataUrl.slice(5, dataUrl.indexOf(";")), dataUrl.split(",")[1], dataUrl);
      });
    });
  }

  function handleHttp(res) {
    return res.json().catch(function () { return {}; }).then(function (j) {
      if (!res.ok) {
        var e = new Error(errText(res.status, j));
        e.code = res.status;
        throw e;
      }
      return j;
    });
  }

  function finish(mime, base64, dataUrl) {
    return {
      mime: mime || "image/png",
      base64: base64,
      dataUrl: dataUrl || ("data:" + (mime || "image/png") + ";base64," + base64)
    };
  }

  /**
   * 生成图像。prompt: string；refImage: 可选 {mime, base64}
   * 无 Key reject Error("NO_KEY")
   */
  function generate(prompt, refImage) {
    if (!getKey()) return Promise.reject(new Error("NO_KEY"));
    var type = effectiveType();
    var fn = type === "gemini" ? genGemini : (type === "openai-images" ? genOpenAIImages : genOpenAIChat);
    return fn(prompt, refImage);
  }

  /** 测试连通性 */
  function testKey() {
    return generate("A single red square, 8x8 pixels.").then(function (r) {
      return { ok: true, sizeKB: Math.round((r.base64 || "").length * 3 / 4 / 1024) };
    });
  }

  /** 文本/图文对话（模型对话模块用）：messages = [{role, content}]
   *  content 为 string，或 [{t:"文本"}|{img:{mime,base64,dataUrl}}] 混合数组 */
  function chat(messages) {
    if (!getKey()) return Promise.reject(new Error("NO_KEY"));
    var type = effectiveType();
    function toParts(c) {
      if (typeof c === "string") return [{ text: c }];
      var out = [];
      c.forEach(function (p) {
        if (p.text) out.push({ text: p.text });
        else if (p.img) out.push({ inline_data: { mime_type: p.img.mime, data: p.img.base64 } });
      });
      if (!out.length) out.push({ text: "" });
      return out;
    }
    if (type === "openai-chat" || type === "openai-images") {
      var url = buildOpenAIChatUrl(getBase());
      var om = messages.map(function (m) {
        if (typeof m.content === "string") return { role: m.role, content: m.content };
        var parts = [];
        m.content.forEach(function (p) {
          if (p.text) parts.push({ type: "text", text: p.text });
          else if (p.img && p.img.dataUrl) parts.push({ type: "image_url", image_url: { url: p.img.dataUrl } });
        });
        return { role: m.role, content: parts };
      });
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getKey() },
        body: JSON.stringify({ model: getModel(), messages: om, stream: false })
      }).then(handleHttp).then(function (j) {
        var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (typeof c !== "string") throw new Error("未返回文本");
        return c;
      });
    }
    // Gemini 原生
    var contents = messages.map(function (m) {
      return { role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) };
    });
    var url2 = buildGeminiUrl(getBase(), getModel(), getKey());
    return fetch(url2, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: contents })
    }).then(handleHttp).then(function (j) {
      var txt = "";
      ((j.candidates && j.candidates[0] && j.candidates[0].content || {}).parts || [])
        .forEach(function (p) { if (p.text) txt += p.text; });
      if (!txt) throw new Error("未返回文本");
      return txt;
    });
  }

  /* ---------- 生成历史（localStorage，最多 12 张，超容自动降级） ---------- */

  var HKEY = "ff.aihist";
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HKEY) || "[]"); } catch (e) { return []; }
  }
  function pushHistory(item) {
    var h = getHistory();
    h.unshift(item);
    h = h.slice(0, 12);
    try {
      localStorage.setItem(HKEY, JSON.stringify(h));
    } catch (e) {
      while (h.length > 1) {
        h.pop();
        try { localStorage.setItem(HKEY, JSON.stringify(h)); break; } catch (e2) { /* continue */ }
      }
    }
    return h;
  }
  function clearHistory() { localStorage.removeItem(HKEY); }

  /* ---------- 内置预设提示词（对齐 V5 全部 AI 生成模块；{input} = 用户补充描述） ---------- */

  var PRESETS = [
    /* -- RPG Maker 角色生成 -- */
    { group: "rpg", id: "rpgmaker_v1", needRef: false, inputPlaceholder: "角色描述（外貌 / 发型 / 服装 / 配色，如：红发女剑士，绿色披风，银色铠甲）",
      label: "RPG Maker 角色生成 V1（3×4 行走图）",
      prompt: "生成一张 RPG Maker VX 风格的像素角色行走图（sprite sheet）：单一角色，3 行 × 4 列网格排布在一张图上，每格一个行走动画帧（约 48×48 像素）。第 1 行朝下（面向读者）、第 2 行朝左、第 3 行朝右，每行按「左脚-站立-右脚-站立」四帧循环。要求：干净的 16-bit 像素风、轮廓清晰、角色在每格中居中、大小一致；纯色背景；画面中不要出现文字、水印、网格线和格线。角色设定：{input}" },
    { group: "rpg", id: "rpgmaker_v11", needRef: false, inputPlaceholder: "角色描述（外貌 / 服装 / 配色）",
      label: "RPG Maker 角色生成 V1.1（四方向完整）",
      prompt: "生成一张 RPG Maker 风格的像素角色行走图（sprite sheet）：单一角色，4 行 × 4 列网格，每格一个行走帧。第 1 行朝下、第 2 行朝左、第 3 行朝右、第 4 行朝上，每行四帧步行循环。要求：清晰的 16-bit 像素风、四方向造型一致、角色居中、纯色背景；不要文字、水印、网格线。角色设定：{input}" },
    { group: "rpg", id: "rpgmaker_v3", needRef: false, inputPlaceholder: "角色描述（外貌 / 服装 / 配色）",
      label: "RPG Maker 角色生成 V3（大像素）",
      prompt: "生成一张 RPG Maker 风格的大像素角色行走图（sprite sheet）：单一角色，3 行 × 4 列网格，每格一个行走帧（下/左/右三个方向行），使用更大的像素颗粒（chunky pixel）与粗描边，复古感强烈。角色居中、比例一致、纯色背景；不要文字、水印、网格线。角色设定：{input}" },
    /* -- 方向图生成 -- */
    { group: "dir", id: "walk_8dir", needRef: false, inputPlaceholder: "角色描述（外貌 / 服装 / 配色）",
      label: "完美八方向（24 格）",
      prompt: "生成一张俯视角像素角色八方向行走图（sprite sheet）：单一角色，8 个方向 × 每方向 3 帧，共 24 格网格排布。方向依次为：下、左下、左、左上、上、右上、右、右下。16-bit 复古 RPG 风、角色一致、纯色背景；不要文字、水印、网格线。角色设定：{input}" },
    { group: "dir", id: "dir9grid", needRef: true, inputPlaceholder: "",
      label: "八方向九宫格（参考图）",
      prompt: "参考图中的角色，生成它的八方向九宫格像素图（3×3 网格）：中心格为正面立绘，周围 8 格分别为朝上、右上、右、右下、下、左下、左、左上的造型。必须严格保持参考图的像素风格、配色和比例，角色大小一致，纯色背景，不要文字与水印。" },
    /* -- 动作与序列 -- */
    { group: "seq", id: "action_seq", needRef: true, inputPlaceholder: "动作描述（如：挥剑攻击 / 跳跃 / 施法）",
      label: "自由序列（参考图 + 动作描述）",
      prompt: "参考图中的角色，生成它做指定动作的像素序列帧（sprite sheet）：单行 4 帧，每帧是动作的一个关键步骤，角色大小与比例完全一致，严格保持参考图的像素风格与配色。纯色背景，不要文字与水印。动作：{input}" },
    { group: "seq", id: "all_actions", needRef: true, inputPlaceholder: "补充说明（可选：额外需要的动作）",
      label: "一图全动作 · 2000（满级全动作）",
      prompt: "参考图中的角色，生成一张完整的全套动作像素表（sprite sheet），网格排布：待机 2 帧、行走 4 帧、奔跑 4 帧、攻击 3 帧、受击 1 帧、死亡 2 帧{input}。每帧角色大小一致，严格保持参考图的像素风格与配色，纯色背景，不要文字与水印。" },
    { group: "seq", id: "nano_fullchar", needRef: true, inputPlaceholder: "补充说明（可选）",
      label: "nanob 全人物动作生成",
      prompt: "参考图中的角色，生成一张多动作像素表（sprite sheet），网格排布：站立、行走、跳跃、攻击、坐下等动作，每个动作独立一格或一行。严格保持参考图的角色设计、像素风格与配色，纯色背景，不要文字与水印。{input}" },
    { group: "seq", id: "reskin", needRef: true, inputPlaceholder: "新外观描述（如：换成蓝袍法师 / 机械风格）",
      label: "快速换皮（保留动作换外观）",
      prompt: "参考图是一张角色动作表（sprite sheet）。请生成一张布局与姿势、帧数完全相同的新表，但把角色外观替换为：{input}。保持像素尺寸、比例与配色风格不变，纯色背景，不要文字与水印。" },
    /* -- 场景生成 -- */
    { group: "scene", id: "scene_front", needRef: false, inputPlaceholder: "场景描述（如：黄昏的渔村 / 雪山小镇）",
      label: "场景生成 · 正视角",
      prompt: "生成一张正视角的 16-bit 像素游戏场景：{input}。要求细节丰富、SNES 时代画风、光影自然，画面中不要出现文字与水印。" },
    { group: "scene", id: "scene_45", needRef: false, inputPlaceholder: "场景描述（如：45 度视角的农田村庄）",
      label: "场景生成 · 45 度",
      prompt: "生成一张 45 度斜视角的 16-bit 像素游戏场景：{input}。要求建筑与地形结构清晰、SNES 时代画风，画面中不要出现文字与水印。" },
    { group: "scene", id: "scene_terra", needRef: false, inputPlaceholder: "场景描述（如：丛林神庙 / 地下洞穴）",
      label: "场景生成 · 泰拉风",
      prompt: "生成一张泰拉瑞亚（Terraria）风格的 2D 像素游戏场景：{input}。分层地形、鲜艳配色、横版平台审美，画面中不要出现文字与水印。" },
    { group: "scene", id: "scene_arcade", needRef: false, inputPlaceholder: "场景描述（如：太空站走廊 / 竞技场）",
      label: "场景生成 · 街机",
      prompt: "生成一张复古街机风格的像素游戏场景：{input}。使用大胆有限的调色板、高对比度，适合 CRT 扫描线显示的机台美术，画面中不要出现文字与水印。" },
    /* -- 基础生成 -- */
    { group: "basic", id: "zero_basic", needRef: false, inputPlaceholder: "角色描述（一句话即可，如：戴眼镜的小法师）",
      label: "零基础像素角色生成",
      prompt: "生成一个简单的像素游戏角色：全身、正面站立、干净的 16-bit 像素风、剪影清晰易读、纯色背景，不要文字与水印。角色：{input}" },
    { group: "basic", id: "nano_v23ot", needRef: false, inputPlaceholder: "角色描述（外貌 / 服装 / 配色）",
      label: "nanobanana V2.3OT（大像素 2:1）",
      prompt: "生成一张大像素颗粒的像素角色图，2:1 横向构图：左侧为角色正面、右侧为角色背面，两视图造型与配色完全一致，chunky pixel 风格、粗描边，纯色背景，不要文字、水印与网格线。角色设定：{input}" },
    { group: "basic", id: "portrait", needRef: false, inputPlaceholder: "角色描述（表情 / 服饰 / 气质）",
      label: "像素立绘头像",
      prompt: "生成一张像素风角色半身头像立绘：16-bit JRPG 对话框风格，面部细节丰富、轮廓干净，深色纯色背景，不要文字与水印。角色：{input}" },
    { group: "basic", id: "scene", needRef: false, inputPlaceholder: "场景描述",
      label: "自由像素场景",
      prompt: "生成一张 16-bit 像素游戏场景，细节丰富、氛围到位，画面中不要出现文字与水印。内容：{input}" },
    { group: "basic", id: "none", needRef: false, inputPlaceholder: "", label: "自由输入（无预设）", prompt: "" }
  ];
  function getPresets() { return PRESETS; }

  FF.Ai = {
    getKey: getKey, setKey: setKey,
    getBase: getBase, setBase: setBase,
    getModel: getModel, setModel: setModel,
    getType: getType, setType: setType,
    detectType: detectType, effectiveType: effectiveType, TYPE_LABELS: TYPE_LABELS,
    DEFAULT_BASE: DEFAULT_BASE, DEFAULT_MODEL: DEFAULT_MODEL,
    generate: generate, testKey: testKey, chat: chat,
    getHistory: getHistory, pushHistory: pushHistory, clearHistory: clearHistory,
    getPresets: getPresets,
    _buildGeminiUrl: buildGeminiUrl, _buildOpenAIChatUrl: buildOpenAIChatUrl, _buildOpenAIImagesUrl: buildOpenAIImagesUrl
  };
})();
