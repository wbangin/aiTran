# aiTran {{VERSION}} 发布测试产物

构建日期：{{DATE}}。此包尚未上传商店、审核或签名；不是可直接双击安装的 Chrome 商店版。Chrome ZIP 已按商店上传结构打包（manifest.json 位于根目录），Firefox ZIP 未签名。

## 先测试 Chrome

1. 打开 `chrome://extensions`，开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择本目录下的 **chrome** 文件夹；不要选择本目录或 ZIP 文件。单独下载 Chrome ZIP 时，先解压再选择包含 manifest.json 的目录。
3. 确认扩展卡片和弹窗的版本是 **{{VERSION}}**。先用自己的 API 验证翻译、页面 AI 总结。

如果已经加载开发版：继续在 Chrome 点旧插件「重新加载」也能测试项目最新 .output/chrome-mv3；若改用这里的 chrome 目录，会生成另一个扩展 ID，其设置独立。建议暂时禁用旧插件，避免两个插件同时处理页面，不要卸载旧插件以免丢失原配置。原 API Key 不包含在分发包内，新安装需自行填写。

测试后不要移动或删除已加载的 chrome 文件夹；路径变化可能改变扩展 ID。本包不会复用或导出你的个人登录、API Key 或配对密钥。

## 产物清单

- `aiTran-{{VERSION}}-chrome.zip`：Chrome 商店上传结构的生产构建 ZIP。
- `aiTran-{{VERSION}}-firefox-unsigned.zip`：Firefox 未签名生产构建 ZIP；可在 about:debugging → 此 Firefox → 临时载入附加组件中选择 firefox/manifest.json 测试。正式安装需要 Mozilla 签名。
- `chrome/`、`firefox/`：以上包的展开内容，可直接测试。
- `SHA256SUMS.txt`：两个 ZIP 的 SHA-256 校验值；在本目录可运行 `shasum -a 256 -c SHA256SUMS.txt`。
- `release.json`：版本、构建时间、产物大小和校验值。
- `PRIVACY.md`、`CHANGELOG.md`、`LICENSE`：隐私说明、变更记录和许可证。

本版只使用自定义 API 进行 AI 总结，不包含本机助手，不需要安装 Node 或登录本机账号。旧版系统助手不会自动卸载；如需停用，请使用旧版助手包的卸载入口。已有本机服务配置在升级时移除，其他 API 配置保留。

## 发布边界

本次只生成本地产物，不自动上传商店，不注册开发者账号，不生成或读取发布私钥。正式发布仍需填写商店资料、隐私链接与截图，并完成平台审核/签名；Firefox 如要求构建源码，须另提交对应源码和锁文件。发布内容不得包含个人配置。

结构参考：[Chrome 打包说明](https://developer.chrome.com/docs/webstore/prepare)、[Firefox 打包说明](https://extensionworkshop.com/documentation/publish/package-your-extension/)。
