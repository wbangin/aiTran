# aiTran

aiTran 是一个免费、无会员、隐私优先的浏览器翻译扩展，使用 TypeScript + WXT 构建。

## v0.3.21 功能

- 增加常见页面元素分类测试矩阵，覆盖文章、文档、表格、卡片、导航、表单、代码、折叠内容、iframe 边界、Shadow DOM、动态加载、批量翻译、失败重试及显示模式。详细范围和局限见 `docs/TRANSLATION_TEST_MATRIX.md`。
- 修复开放 Shadow DOM 中的漏译和动态更新、恢复原文；折叠内容、隐藏或不可交互内容不进入翻译队列；较长文章段落（最多 6,000 字符）可翻译，普通布局容器仍限制为 1,800 字符。

- Chrome Web Store 开发者控制台翻译补齐导航、操作按钮和短设置标签；保留输入框与编辑内容不翻译，保持操作控件可点击。仅对该控制台启用此界面翻译规则，普通网页的原有正文识别规则不变。

- 精简权限为 `storage`、`contextMenus` 及网页主机权限，不再申请 `tabs`、`activeTab`。自定义公网和局域网接口要求 HTTPS，HTTP 仅允许本机回环地址；请求不跟随重定向，请填写最终接口地址。已有不安全 HTTP 配置保留但不会发送请求，需手动改为 HTTPS。
- 隐私说明完整披露自动翻译、备用服务、API Key 和第三方数据处理。打包不读取 Chrome 本地设置或用户配置。

- Chrome/Firefox 扩展图标、标签页图标、各页面品牌标识与总结面板统一采用 AiT。矢量母版位于 `src/ui/ait-monogram.svg`；运行 `npm run icons:generate` 可重新生成品牌 SVG 和各尺寸 PNG（使用依赖树中的 `@napi-rs/canvas`）。

- 更小的 30px AiT 悬浮球：默认底色透明度 40%，可在“设置 → 页面增强”调节并实时预览；悬停、聚焦或展开时清晰显示。

- 弹窗将双语模式、翻译按钮、语言和服务合并成完整翻译区；AI 总结位于其后，页面功能优先于独立工具。
- AI 总结浮窗不预览原文，生成后收起配置并突出开头结论；支持调整配置、重新总结和复制。
- 统一 AiT 单悬浮球，点击展开翻译、双语切换和总结三个纯图标操作，支持悬停说明、键盘操作和错误提示。

### 网页翻译

- 内容优先识别：只硬过滤脚本、表单控件和明确的交互控件，尽量保留邮件、README、提交说明、仓库简介等可读内容
- 支持 iframe、about:blank 和 srcdoc 内的邮件正文与嵌入式文章
- 适配 GitHub 等复杂 Flex/Grid 页面，避免译文挤压原布局
- 跳过 README fenced code、GitHub 源码行和网页代码编辑器，并保护段落中的行内代码
- 译文采用低干扰卡片样式，不再使用密集的左侧竖线
- 网页双语对照翻译
- 仅显示译文
- 动态网页内容监听
- 一键翻译 / 恢复原文（Windows/Linux：`Alt+A`；macOS：`⌘⇧L`）
- 页面右侧 AiT 悬浮入口，可翻译网页 / 恢复原文
- 翻译结果 IndexedDB 本地缓存

### 交互翻译

- 划词翻译：选中文本后显示翻译按钮，调用当前选中的 Google、Microsoft 或自定义翻译服务；不是本地词库
- 鼠标悬停翻译：Windows/Linux 按住 `Alt`；macOS 按住 `⌥ Option`
- 输入框翻译：Windows/Linux 使用 `Alt+I`；macOS 使用 `⌘⇧I`
- 右键菜单：网页、选中文本、输入框、文本翻译

### AI 页面总结

- 从扩展弹窗的「AI 总结当前页面」、网页右侧「AI」按钮或右键菜单打开总结面板
- 在面板中选择 AI 服务和输出语言，点击「生成总结」，提取核心结论与关键要点
- 支持复制、重新总结、失败重试和关闭后继续查看
- 使用已启用且填写了模型名称的 OpenAI 兼容自定义 API；Google/Microsoft 免费翻译服务不支持总结
- 优先读取当前页面已加载的正文，排除导航、输入框和 aiTran 译文；超长页面截取前 24,000 个字符并显示提示
- 页面标题和正文仅在点击生成时发送到所选 AI 服务，总结不写入翻译缓存；跨域 iframe、浏览器内置 PDF 暂不支持

### 文本与文档

- 独立长文本翻译工作台
- PDF 本地文本提取与翻译
- TXT / Markdown / HTML 翻译
- SRT / VTT 字幕翻译，保留序号和时间轴
- 译文下载

### 翻译服务

免费组：

- Google Translate Free（无需 API Key）
- Microsoft Translate Free（无需 API Key）
- 免费服务失败时可自动切换备用服务

自定义组：

- 用户自己的 URL
- 可选 API Key
- aiTran JSON 批量协议
- OpenAI Chat Completions 兼容协议
- 可配置模型、Temperature、系统提示词、单段提示词、Subtitle Prompt 和多段提示词
- 支持多个自定义服务
- 设置页可测试连接

aiTran 没有账号、会员、订阅、广告、行为分析或 aiTran 中转服务器。

## 升级说明

v0.3.12 已移除本机助手与旧桥接协议，AI 总结只使用自定义 OpenAI 兼容 API。升级时会清除不再支持的服务配置，保留其他 API 的 URL、Key、模型和提示词；若原默认服务被移除，会选择现有可用 API（没有时回到默认翻译服务），并关闭自动翻译和自动回退，待用户确认后再启用。不会卸载系统里的旧助手或删除登录数据。

旧版发布目录保留用于恢复；若已安装旧助手，可使用旧版助手包的卸载入口自行停用。本版不再包含或调用本机助手。

## 安装开发版

### 发布测试包

开发者运行 `npm run release`，会校验类型、构建 Chrome/Firefox 并在 `releases/aiTran-版本号/` 生成两个独立 ZIP（Chrome、未签名 Firefox）、可直接加载的展开目录、安装说明、SHA-256 校验表与构建清单。打包需要系统 `zip` / `unzip` 命令。已有同版本目录不会覆盖，需先保留/移动原目录再重打包。

测试用户无需源码或 npm install：Chrome 加载产物的 `chrome/` 目录，填写自己的 API 即可。没有本机助手安装步骤，不依赖 Node 或 Codex。

此产物尚未上架、审核、签名或公证。ZIP 不等于可直接安装的商店版，Firefox 正式安装还需签名。换目录加载的 Chrome 扩展 ID 和设置可能不同，请保留原配置、暂时禁用旧插件避免重复翻译，并重新填写所需 API 配置。详见 `distribution/RELEASE_README.md`。

```bash
npm install
npm run build
```

在 Chrome 或 Edge 的扩展管理页面开启开发者模式，然后加载：

```text
.output/chrome-mv3
```

Firefox 开发版可通过 `npm run build:firefox` 构建并加载 `.output/firefox-mv2`。Firefox 构建要求 140.0 或更高版本，以使用内置的数据传输授权提示。

## 常用命令

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm run zip
```

## 自定义服务协议

请求：

```http
POST https://your-service.example/translate
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

API Key 为空时不会发送 `Authorization` 请求头。

```json
{
  "sourceLanguage": "auto",
  "targetLanguage": "zh-CN",
  "texts": ["Hello", "World"]
}
```

响应：

```json
{
  "translations": ["你好", "世界"],
  "detectedLanguage": "en"
}
```

详细说明见 `CUSTOM_PROVIDER.md`。

## 隐私

扩展设置、API Key 和翻译缓存保存在浏览器本地。待翻译文本会直接发送到用户选择的 Google、Microsoft 或自定义翻译服务。PDF 和其他文档在浏览器本地解析，原始文件不会上传到 aiTran 服务器。

详见 `PRIVACY.md`。
