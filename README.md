# FrameForge 像素工具箱

一站式像素游戏素材处理工具箱（frameronin.com 的功能复刻版），采用 **Rust + WebAssembly** 高性能内核，全部处理在浏览器本地完成，**数据不出本机**。已移除原站所有广告推广类内容（充值、代充说明、推广悬浮按钮、外链等）。

AI 生图模块参考了 [FrameRonin 开源仓库](https://github.com/systemchester/FrameRonin) 的后处理管线（连通域抠图容差/羽化参数、RPG Maker 转换需求），但比原站更进一步：原站 nanobanana 系列是跳转到 Gemini 网页 Gems，本工具箱支持**填入自己的 Gemini API Key 浏览器直连生成**。

![模块](https://img.shields.io/badge/%E6%A8%A1%E5%9D%97-9%E4%B8%AA%E5%85%A8%E5%8A%9F%E8%83%BD-b64a2e) ![内核](https://img.shields.io/badge/WASM-104KB-4a7c59)

## 快速开始（推荐：双击 exe）

**双击项目根目录的 `FrameForge.exe`** —— 完事。它会：

1. 自动探测端口（8123 被占则依次尝试到 8140）
2. 启动内置 HTTP 服务（**全部网页资源已嵌入 exe，单文件即可分发**）
3. 自动打开默认浏览器

保持黑色控制台窗口开着即可（关掉窗口 = 停止服务）。exe 约 660KB，无任何外部依赖，拷到别的 Windows 电脑也能直接用。

```powershell
# 重新构建 exe（改了 web/ 资源后需要）
cd server && cargo build --release
copy target\release\frameforge-server.exe ..\FrameForge.exe
```

## 开发模式（改代码实时生效）

```bash
node server.js     # 需 Node.js，直接伺服 web/ 目录
```

```bash
# 重新构建 WASM 像素内核 —— 需要 Rust + wasm32 目标
build.sh          # Linux / macOS / Git Bash
./build.ps1       # Windows PowerShell
rustup target add wasm32-unknown-unknown   # 如缺目标
```

## 功能模块（9 个全功能 + 快捷键）

| 快捷键 | 模块 | 功能 |
|---|---|---|
| **Z** | AI 生图 | 自定义 API 直连生成，**18 个分组预设覆盖原站全部 AI 生成模块**：RPG Maker 角色生成 V1/V1.1/V3、完美八方向（含九宫格）、自由序列、一图全动作、nanob 全人物动作、快速换皮、场景生成（正视角/45度/泰拉/街机）、零基础角色、大像素 2:1、立绘——结果一键转 RPG Maker 走图或送入像素化/抠图 |
| **C** | 模型对话 | 闲聊 / 提示词助手（同一 API 设置的文本模型，OpenAI 兼容或 Gemini 原生） |
| **V** | 视频转序列帧 | 视频 → 按 FPS 逐帧提取 → 可选色键去背/像素化 → 导出帧包 ZIP / Sprite Sheet / GIF |
| **K** | 抠图去背 | 绿幕/蓝幕/白底/左上角连通域（AI 生成图专用）/双色键/**双背景差分**（同一主体黑底+白底两张照片逐像素求解 alpha 并恢复前景色，含去碎片与边缘收缩），容差·抑色·羽化可调，实时预览，取色器 |
| **S** | Sprite Sheet | 拆分（行列/单元格，跳空帧，勾选帧，动画预览 **A/D 键切帧**）+ 合成（多图→Sheet/GIF） |
| **G** | GIF 处理 | GIF 解帧 → 拖拽排序/删除/改延时 → 重新合成 GIF / 导出帧 ZIP / **上下·左右拼接** |
| **W** | 像素图片的转化和优化 | V5 六大功能：像素块风格 / **合并临近色**（LAB 感知）/ **16色像素图**（RGB·LAB 双算法+抖动）/ **完美像素**（FFT 倍周期+Sobel 网格细化+中心·中位数·双聚类采样，对齐 AI"歪网格"图）/ **超级完美像素**（网格对齐+任意色数量化）/ **色表对标**（模板色表 LAB 映射） |
| **R** | RoninPro 效率工具 | 自定义缩放（最近邻 1-16x）/ 统一尺寸（多图统一画布+ZIP）/ 自定义切片（按尺寸切块+ZIP）/ **单图调整 Pro**（N×M 切块 → 逐帧平移、四边裁边 → 重组合导出 Sheet+ZIP） |
| **F** | 一键处理、精细处理 | 一键管线（硬缩放 144/128/256 → 左上角连通域抠图 → 内描边）+ 精细修图（画笔/橡皮/超级橡皮/取色，Ctrl+Z 撤销） |
| **T** | 节点工作流蓝图 | 拖拽节点连线搭建处理管线：色键/连通域/像素化/量化(LAB)/合并临近色/色彩调整/内描边/硬缩放/裁边/网格删列 共 12 种节点；**内置 RPGMakerVX 等 3 条预设管线**，蓝图可保存/加载/导入导出 JSON；支持 Ctrl+V 与拖拽直接注入图片 |
| — | 瓦片调整 | 载入 tileset（16-64px 块），图章式绘制瓦片地图，导出大图 |
| **L** | 智能图层合成 | 多图层混合（7 种混合模式）、拖放定位、不透明度、导出 PNG |
| **M** | 地图拼接 | 多图拖放、网格吸附、缩放平移（滚轮/空格+拖动）、裁边导出 |

首页支持 **自定义界面**（拖拽排序、localStorage 持久化）、**最近使用**、**模块搜索**、**深浅色主题**、**中/EN 双语**、右下角**快捷键面板**（可折叠）。任意工具内按 **B** 返回首页、按 **?** 查看快捷键与技巧。

### 体验细节（十项优化）

1. **全局 Toast 通知** —— 导出/下载/错误即时反馈
2. **全局错误捕获** —— 异常不再静默，直接弹提示（含 Promise 未处理拒绝）
3. **Ctrl+V 粘贴图片** —— 抠图/像素化/一键处理/AI 生图页直接粘贴剪贴板图片
4. **全局拖拽路由** —— 拖图片到页面任意位置自动送入当前工具；拖到首页弹出工具选择
5. **双击灯箱放大** —— 所有预览图双击放大细看像素（棋盘格透明背景）
6. **输出尺寸标注** —— 每个预览框左下角显示 W×H
7. **AI 历史增强** —— 双击灯箱放大、右键回填提示词重发
8. **首页最近使用** —— 最近 3 个模块一键直达
9. **首页模块搜索** —— 按名称/描述/快捷键实时过滤卡片
10. **? 键帮助** —— 快捷键总表 + 通用技巧弹窗

## AI 生图配置（支持自定义 API / 中转站）

1. 顶栏「**API 设置**」→ 填写 **API 地址** + **Key** → 保存（可先"测试连接"）
2. **Z** 进入 AI 生图：选预设/写提示词 → 生成 → 结果可下载、转 RPG Maker 走图、或一键送入像素化/抠图继续加工

### 支持三种协议（自动识别，也可手动指定）

| 协议 | 适用 | 地址写法（均可识别） |
|---|---|---|
| **Gemini 原生** | Google 官方 / Gemini 格式中转 | `https://generativelanguage.googleapis.com`、`https://xxx/v1beta`、甚至完整 `…/models/gemini-…:generateContent` 端点 |
| **OpenAI 兼容 · Chat** | OneAPI/NewAPI 等中转站（最常见） | `https://xxx`、`https://xxx/v1`、`https://xxx/v1/chat/completions` |
| **OpenAI 兼容 · Images** | `/v1/images/generations` 类服务 | `https://xxx`、`https://xxx/v1`（图生图自动走 `images/edits` multipart） |

- Key/地址仅存本机 localStorage；请求浏览器直连目标服务，无中间服务器
- 模型名自由输入（下拉含常见建议：`gemini-2.5-flash-image`、`gpt-image-1`、`dall-e-3` 等）
- 响应解析兼容多种形态：Gemini `inlineData`、OpenAI `b64_json`/`url`、NewAPI `message.images[]`、markdown 内嵌 dataURI
- 官方 Gemini Key 获取：aistudio.google.com/apikey；中转站直接填服务商给的地址与密钥即可
- `server.js` 内置 `/mock/*` 模拟端点，可在无真实 Key 时自测三协议链路

## 架构

```
├── wasm/                  Rust 内核 crate（原生 extern "C" 导出，无 bindgen）
│   ├── Cargo.toml         依赖仅 gif + color_quant
│   └── src/lib.rs         色键/像素化/量化/HSV调整/内描边/Sheet合成拆分/GIF编解码
├── web/
│   ├── index.html         SPA 外壳（hash 路由）
│   ├── css/style.css      深浅双主题（CSS 变量）
│   ├── js/
│   │   ├── main.js        路由/首页/快捷键/主题/弹窗/API设置
│   │   ├── i18n.js        中/EN 词典
│   │   ├── ai.js          Gemini API 直连 + Key 管理 + 预设/历史
│   │   ├── wasm.js        Worker 池 + Promise 封装
│   │   ├── worker.js      WASM 加载与执行（可多实例并行）
│   │   ├── zip.js         零依赖 ZIP 打包（store）
│   │   ├── ui.js          组件库（步骤条/上传区/滑杆/胶片条/对比视图…）
│   │   └── tools/*.js     8 个工具页
│   └── wasm/core.wasm     构建产物（~104KB）
├── server.js              零依赖静态服务器（正确 MIME: application/wasm）
└── build.sh / build.ps1   cargo build + 复制产物
```

**性能设计**：像素级运算（色键、量化、Floyd-Steinberg 抖动、GIF LZW）全部在 WASM 内完成；Worker 池（按 CPU 数量）并行处理帧序列，主线程零阻塞；内存经 `ff_alloc` 手动管理，帧数据以 Transferable 零拷贝往返。

## WASM 内存协议

```text
ff_alloc(len) → ptr          JS 申请输入缓冲
ff_free(ptr, len)            释放
ff_chroma_key(ptr,w,h,mode,tol,feather,sup,c1,c2) → 0/err
ff_pixelate / ff_quantize / ff_adjust / ff_outline
ff_sheet_assemble(ptr,len)   → 结果写入结果区
ff_sheet_split / ff_gif_decode → 序列化帧 [magic][count][w,h,delay,len,data]...
ff_gif_encode(ptr,len)       → GIF 字节到结果区
ff_result_ptr / ff_result_len / ff_result_clear
```

## 已验证

- **完美像素算法**（V5 对齐）：合成"歪网格"放大图（12×12 源 10 倍放大 + 相位偏移）→ 自动检测网格 → 重采样，center/median/众数 majority 三种采样 **144/144、121/121、169/169 全部像素命中原调色板**，耗时 ~20ms
- **双背景差分**：黑/白底合成对 → alpha 精确求解（中心 255 / 背景 0）+ 前景色精确恢复（180,60,40 逐通道还原）
- **LAB 量化**：任意色数（2-64）+ LAB/RGB 双距离；合并临近色不误合并、色表对标 14400/14400 全映射
- WASM 回归：色键全模式（绿幕/连通域）、像素化、量化、调整、描边、GIF 编解码往返、Sheet 合成拆分往返 —— 全部通过
- AI 模块：三协议 URL 构造、自动识别、Gemini/OpenAI-Chat/OpenAI-Images mock 全链路 —— 通过
- 视频管线：WebM duration 修复 → 逐帧提取 → 并行处理 → Sheet/GIF —— 通过
- 九大路由渲染、深浅主题、中/EN、快捷键 —— 通过

## 说明

- 视频提取依赖浏览器原生解码能力（MP4/WebM 等浏览器可解码格式）；MOV/AVI/MKV 能否支持取决于系统编解码器。
- 「在线 PS / HD2D 模型优化」为占位卡片（原站为完整图像编辑器 / Three.js 模块，规模超出工具箱定位）。
- 原站的 Gemini 水印去除 / Seedance 视频去水印 / rembg 服务端抠图（Python + Redis + U2Net 模型）依赖后端或涉及去水印合规，未纳入；纯前端场景下「左上角连通域」+ 色键 + 双背景差分已覆盖绝大多数素材去背需求。
- 原站 AI 生成模块（RpgMaker 角色生成/完美八方向/自由序列等）在原站需跳转 Gemini 网页 Gems，本工具箱以**本地 API 直连 + 提示词预设**实现同等工作流。
