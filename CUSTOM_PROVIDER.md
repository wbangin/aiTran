# aiTran 自定义翻译服务

aiTran 支持两种自定义 HTTP 接口。AI 页面总结仅使用 OpenAI Chat Completions 兼容接口。

自 v0.3.19 起，公网和局域网服务必须使用 HTTPS。HTTP 仅允许 `localhost`、`127.0.0.0/8` 或 `[::1]` 本机回环地址，不能使用带账号密码的 URL。所有接口请求禁止重定向，请填写最终端点地址（否则连接会失败）。已有 HTTP 配置不会删除，但不符合要求的地址不会发送请求，需要自行改为 HTTPS。API Key 保存在浏览器本地扩展存储，通过请求头发送至配置的服务；它不会被构建脚本读取或放入发布 ZIP。本机服务是否将内容继续转发至外部，取决于该服务自身。

## 1. aiTran JSON 批量接口

请求：

```http
POST {配置的 URL}
Content-Type: application/json
Authorization: Bearer {API Key}
```

API Key 为空时不会发送 Authorization。

```json
{
  "sourceLanguage": "auto",
  "targetLanguage": "zh-CN",
  "texts": ["Hello", "World"],
  "scene": "page",
  "context": { "title": "Example page" }
}
```

响应：

```json
{
  "translations": ["你好", "世界"],
  "detectedLanguage": "en"
}
```

`translations` 的数量与顺序必须和 `texts` 一致。

## 2. OpenAI Chat Completions 兼容接口

适用于 OpenAI、OpenRouter、Ollama 以及实现兼容 API 的服务：

选择此协议后，请求 URL 可以填写基础地址（如 `https://example.com/v1`）或完整接口地址。扩展会自动补上 `/chat/completions`，已包含该后缀时不会重复添加；保留原有路径前缀、版本号和查询参数，处理尾部斜杠。此规则同时适用于翻译、测试连接和 AI 总结，不影响 aiTran JSON 协议。设置页在切换协议、离开 URL 输入框、测试或保存时会显示补全后的地址。

```http
POST https://api.openai.com/v1/chat/completions
Content-Type: application/json
Authorization: Bearer {API Key}
```

请求体包括：

```json
{
  "model": "gpt-4.1-mini",
  "temperature": 0,
  "messages": [
    { "role": "system", "content": "...渲染后的系统提示词..." },
    { "role": "user", "content": "...渲染后的任务提示词..." }
  ]
}
```

支持配置：

- 系统提示词
- 单段提示词
- Subtitle Prompt
- 多段提示词
- 模型
- Temperature
- 每次最大段落数
- 批量模式：兼容模式或逐段模式

### 提示词变量

- `{{to}}`：目标语言
- `{{from}}`：源语言
- `{{text}}`：待翻译文本
- `{{title}}`：页面标题或文档文件名
- `{{title_prompt}}`：有标题时生成上下文标题段
- `{{summary_prompt}}`：摘要上下文，目前没有摘要时为空
- `{{terms_prompt}}`：术语上下文，目前没有术语时为空
- `{{imt_style_guide}}`：风格说明，目前没有设置时为空

多段兼容模式使用一行独立的 `%%` 分隔输入和输出。如果模型返回的段落数不正确，aiTran 会自动降级为逐段请求。
