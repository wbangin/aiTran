# aiTran 自定义翻译服务

aiTran 支持两种自定义接口模式。

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
