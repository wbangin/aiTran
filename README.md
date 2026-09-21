# aiTran

aiTran 是一个免费、无会员、隐私优先的浏览器翻译扩展，使用 TypeScript + WXT 构建。

## v0.3.8 功能

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
- 页面右侧“译 / 原”悬浮按钮
- 翻译结果 IndexedDB 本地缓存

### 交互翻译

- 划词翻译：选中文本后显示翻译按钮，调用当前选中的 Google、Microsoft 或自定义翻译服务；不是本地词库
- 鼠标悬停翻译：Windows/Linux 按住 `Alt`；macOS 按住 `⌥ Option`
- 输入框翻译：Windows/Linux 使用 `Alt+I`；macOS 使用 `⌘⇧I`
- 右键菜单：网页、选中文本、输入框、文本翻译

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

## 安装开发版

```bash
npm install
npm run build
```

在 Chrome 或 Edge 的扩展管理页面开启开发者模式，然后加载：

```text
.output/chrome-mv3
```

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
