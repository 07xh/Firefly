# Firefly 预览 Worker 的匿名只读验收（开发版）

本检查仅用于**隔离的 Cloudflare 预览 Worker**，不会上传或读取私人正文，不使用后台密码/Token，不进行登录、保存、发布、删除或迁移。它不会改变正式网站、前台 UI 或仓库文章。

## 检查内容

`scripts/verify-private-preview-auth.mjs` 使用 **GET + credentials: omit + redirect: manual**，对已部署的预览 Worker 核对：

- 匿名访问 `/admin/login/`：返回 HTML 登录表单。
- 匿名访问 `/admin/` 和 `/admin/system/`：返回 302 跳转登录且有 no-store。
- 匿名访问后台公开文章 API、AI 服务商 API、系统健康 API、私人草稿 API、历史 API、R2 恢复 API、备份审计 API：必须返回 401 JSON 且 no-store。
- **只检查 HTTP 状态码和必要响应头，不打印私人正文。** 如果 API 错误地返回 200，应立即失败，而且不读取其正文。

## 执行条件

1. **先创建真正隔离的预览 Worker**，名称明确包含 `preview`、`staging` 或 `pr-数字`，并绑定独立 KV/D1/R2 测试资源；不能绑定生产私人数据。
2. 确认预览域名为 HTTPS 的 `*.workers.dev` 或 `*.pages.dev`，且不是正式 workers.dev 或 `0701000.xyz`。
3. 在有 Node 22 的已检出代码环境执行：

   `FIREFLY_PREVIEW_URL=https://firefly-preview.example.workers.dev/ node scripts/verify-private-preview-auth.mjs`

   上面是**格式示例，不是已存在的预览地址**。需要替换为实际已部署且可访问的测试域名。
4. GitHub Actions 内提供 `Read-only admin preview checks` 的手动运行入口，但 **workflow_dispatch 在 GitHub 默认分支具备该工作流后才能直接使用**。在独立 PR 未合并期间先以命令行验证，不能把工作流按钮尚不可用误判为云端已验收。
5. 无实际预览 URL 时此任务 **保持待验收**；CI 模拟网络响应的单元测试通过并不代表真实 Worker 安全。

## 尚未覆盖

- 已登录 CRUD、D1 多地并发、R2 备份恢复、KV→D1 迁移和强一致性。
- 已发布文章的正文无损以及前台视觉像素级一致性。
- Android 平板 MDX 编辑器的真实交互。
- 生产路由、真实 Cloudflare Secrets、GitHub Pages 的使用情况。

这些仍需单独验收，不能据本脚本通过宣布完成上线。
