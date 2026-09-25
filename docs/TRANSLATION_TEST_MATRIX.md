# aiTran 网页翻译测试矩阵

版本：v0.3.21 · 2026-09-25

运行 `npm test` 执行自动测试；`npm run release` 同时执行类型检查并构建 Chrome、Firefox 安装包。下列 DOM 测试使用合成页面及本地假翻译响应，不会向外部翻译服务发送测试文字。

| 页面类别 | 覆盖的结构与行为 | 主要测试 |
| --- | --- | --- |
| 文章与新闻 | 标题、正文、引文、图注、较长段落、正文里保留的行内代码 | `page-surface-matrix`, `page-translator-dynamic`, `dom-collector` |
| 文档、清单、表格 | 有序／无序列表、定义列表、表头、单元格、分批处理 25 个段落 | `page-surface-matrix`, `page-translator-dynamic` |
| 社交／仓库卡片 | Flex、Grid、侧栏文字叶节点；图标与按钮分离，布局容器不当作正文 | `dom-collector`, `page-translator-dynamic` |
| 应用后台 | Chrome 开发者控制台导航、短标签、按钮、单选项；点击与恢复原文 | `dom-collector`, `page-translator-dynamic` |
| 表单与隐私 | 输入框、密码框、可编辑草稿、代码编辑器、隐藏和 inert 内容不进入翻译队列 | `page-surface-matrix`, `dom-collector` |
| 折叠区域 | `<summary>`、`<legend>` 可读，未展开的 `<details>` 正文跳过；操作控件保持可见 | `page-surface-matrix` |
| 代码与非正文 | `pre/code`、源码行、SVG、Canvas、URL、文件名、纯符号、扩展自身 UI 跳过 | `page-surface-matrix`, `dom-collector` |
| 内嵌页面／组件 | iframe 由独立内容脚本处理；开放与嵌套 Shadow DOM 可扫描；扩展自有根跳过 | `page-surface-matrix`, `page-translator-dynamic` |
| 生命周期 | 自动识别后续内容、替换过期译文、批量请求、服务失败后重试、双语／仅译文切换、恢复原文与状态计数 | `page-translator-dynamic`, `display-mode`, `page-status` |
| 弹窗及服务 | 弹窗操作、设置迁移、API URL／传输安全、自定义服务与 AI 总结 | `popup`, `options`, `providers`, `provider-url`, `summary-service` |

## 已知边界

- 以上是 DOM 和交互逻辑的自动测试，不是对所有真实网站像素级排版的证明。曾尝试用独立临时 Chrome 配置运行本机网页和假服务；当前安装的 Google Chrome 未暴露测试扩展的后台进程，因此未取得真实浏览器渲染结果。未访问用户登录的发布者后台。
- 封闭 Shadow DOM 无法通过网页脚本读取，测试明确验证不会声称翻译这部分；跨域 iframe 由扩展在受支持的框架中分别运行，不能由父页面直接读取。
- 浏览器内部页面、扩展商店受保护页面以及没有访问许可的页面仍受浏览器限制；网页自己的 React/Vue 等运行时可能在后续重渲染时改变结构，动态更新测试覆盖常见增删与文字替换，但无法穷举每个站点。
- 无法在当前环境中替用户验证 Google、Microsoft 真实服务的在线响应及其配额。模拟服务覆盖请求分批、错误恢复和结果渲染；真实服务可用性取决于网络及服务方。

## 发布前人工抽查建议

在 v0.3.21 的 Chrome 展开目录重新加载扩展，刷新网页后抽查一篇文章、一篇技术文档、一张带按钮的卡片、一个含表单的后台页面，以及 Chrome Web Store 开发者控制台。每页分别检查双语、仅译文和恢复原文；点击原有链接、按钮与折叠区，确认交互和列宽没有异常。涉及个人账号的页面只在用户自己的浏览器里检查，不提交页面正文或密钥给测试脚本。
