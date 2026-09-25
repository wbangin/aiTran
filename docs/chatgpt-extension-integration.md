# ChatGPT 浏览器扩展集成调研

日期：2026-09-24。调研对象是 OpenAI 官方 ChatGPT 浏览器扩展；若用户指另一款同名第三方扩展，需要其商店链接与接口文档另行核验。本轮没有修改、探测或调用用户已安装的 ChatGPT 扩展。

## 结论

没有在已查阅的官方公开文档中找到“让 aiTran 嵌入 ChatGPT 扩展聊天界面、自动提交提示词并取回总结”的受支持接口。这不等于证明内部没有相关能力，而是目前不能把它当作可维护的公开接口来发布。

官方扩展本身支持侧边聊天、当前页面上下文、选中文字及页面提问。用户可以直接在它的侧栏里要求总结。[OpenAI 浏览器扩展说明](https://learn.chatgpt.com/docs/chrome-extension)

## 三种需求要分开

1. **嵌入另一个扩展的 UI**：不能仅凭扩展 ID 或复制其页面 URL 实现受支持的集成。对方需要允许访问对应资源，还需满足其页面安全策略与接口约定。Chrome 的 sidePanel 路径要求是本扩展内的资源，不是把另一扩展侧栏挂进来。[Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)、[Web Accessible Resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)
2. **自动发送提示词、接收结果**：Chrome 支持跨扩展消息，但接收方必须实现 onMessageExternal/onConnectExternal 等处理器并接受调用。没有查到 ChatGPT 扩展对第三方公开的消息协议，不能猜测私有消息或调用内部认证服务。[跨扩展消息](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#cross-extension-messaging)
3. **把提示词交给用户继续操作**：可设计复制提示词按钮，让用户粘贴到官方侧栏；这是人工交接，不会自动回传结果。本轮仅建议，未实现。

## 官方提供的替代交接方式

桌面 ChatGPT 的官方命令文档支持 `codex://new?prompt=<编码后的提示词>`。虽然使用兼容性的 codex:// 名称，它是桌面应用深链接，不是调用本机 CLI 或恢复 aiTran 的旧桥接。链接仅在输入框预填内容，用户须自行点击发送；文档没有承诺将结果返回发起链接的浏览器扩展。[官方深链接说明](https://learn.chatgpt.com/docs/reference/commands#deep-links)

如果以后实现：使用用户明确点击触发；编码参数；优先传短提示词与页面 URL，不把完整敏感正文塞进链接；避免误用 originUrl（该参数指 Git remote，不是网页上下文）。长正文可提供用户明确触发的复制功能。需要验证用户机器上实际处理该 scheme 的应用，不能把这种交接描述成 Chrome 侧栏接口。

另外，MCP Apps 可以把我们的工具/UI 放入 ChatGPT，方向与“把 ChatGPT 放进我们的扩展”相反；组件中的 window.openai 等能力属于 ChatGPT 宿主环境，不能直接拿到普通扩展页面里调用。[官方 MCP UI 文档](https://developers.openai.com/plugins/build/chatgpt-ui)

WebMCP site tools 是让 ChatGPT 在其内置浏览器里发现并调用网站工具，也不是外部 Chrome 扩展发起推理和收取总结的替代接口。[Site tools](https://learn.chatgpt.com/docs/webmcp)

## 本次实现决定

- aiTran 内置总结只使用用户配置的 OpenAI Chat Completions 兼容 API。
- 删除本机桥接、Native Messaging 权限及其协议，不新增 ChatGPT 嵌入、自动化点击或令牌读取功能。
- 不修改 CSP、安全响应头或使用私有端点绕过对方集成边界。
- 若以后需要轻量联动，先考虑“复制总结提示词”，或独立评估官方桌面深链接预填；都清楚标注需用户发送、结果留在 ChatGPT。
