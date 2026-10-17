# Firefly 后台独立登录认证

Firefly 后台采用独立密码登录，不依赖 Cloudflare Zero Trust。Worker 中间件使用 `SESSION` KV 命名空间验证服务端会话；所有 `/admin/*` 页面和 `/api/admin/*` 内容/部署接口都需要有效会话。未登录页面会跳转至 `/admin/login/`，未登录 API 返回 401。认证配置缺失时后台 fail-closed 返回 503。

## 1. Worker 配置

进入 Cloudflare Dashboard → Workers 和 Pages → `firefly` → Settings → Variables and Secrets → Production。

添加以下 **Secret**：

- `ADMIN_PASSWORD`：后台登录的唯一强密码，至少 12 个字符。建议使用密码管理器生成并保存；不要与网站或邮箱密码重复。

确认已有 **KV Namespace Binding**：

- Binding name：`SESSION`
- KV namespace：你当前绑定的 `firefly-session`

此前 Worker 页面已经显示 `SESSION` 绑定。如果该绑定仍然存在，不必再创建一个 KV 命名空间。保存配置后重新部署 Worker。

文章读写仍需现有的服务端 Secret：

- `GITHUB_CONTENTS_TOKEN`：仅在 Worker 服务端使用的 GitHub Token。
- `GITHUB_CONTENTS_REPO`（可选普通变量）：默认 `07xh/Firefly`。
- `GITHUB_CONTENTS_BRANCH`（可选普通变量）：默认 `master`。

此实现不需要 `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`、`CF_ACCESS_ALLOWED_EMAILS` 或 `ADMIN_SESSION_SECRET`。不要把密码或 Token 写进 Git、HTML、前端脚本或浏览器存储。

## 2. 服务端会话行为

- 未登录访问 `https://你的域名/admin/` 时，会跳转至 `/admin/login/`。
- 密码只发送至同源 `/api/admin/auth/login`，由 Worker 与 Secret 中的密码比较。
- 登录成功时生成 256 位随机会话令牌；浏览器只获得 `HttpOnly; Secure; SameSite=Strict; Path=/` Cookie。
- KV 中保存会话记录，键使用令牌的 SHA-256 摘要，不直接保存原始 Cookie 令牌。默认 8 小时过期，KV 项也设置过期 TTL。
- 登出会从 KV 删除该会话记录并清除 Cookie。
- 会话认证失效或 KV 无法读取时，后台受保护路由不应降级为匿名访问。
- 内容写入 API 仍校验同源 Origin、JSON Content-Type、请求体大小和文章路径；GitHub Token 只在 Worker 服务端使用。

## 3. 验证清单

1. 确认生产环境存在 `SESSION` KV 绑定，并设置 `ADMIN_PASSWORD` Secret。
2. 重新部署后，用无痕窗口访问 `/admin/`，应跳转到登录页。
3. 输入错误密码应被拒绝；正确密码应进入后台。
4. 未登录时直接调用 `/api/admin/articles` 应返回 401，而不是文章数据。
5. 登录后测试文章读取、新建、编辑、删除和部署状态查询。
6. 点击“退出登录”，确认后台 API 再次返回 401。
7. 如果删除或换绑 `SESSION`，所有已有会话会失效；这是预期的安全行为。

## 安全边界与限制

- 独立密码登录没有 Cloudflare Access 的组织身份和 MFA 能力。请使用高强度唯一密码，并在 Cloudflare 配置登录端点可用的速率限制。KV 不是强一致性数据库；它适合短期会话存储，但不应把基于 KV 的计数器当作完美的防暴力破解机制。
- 生产环境必须通过 HTTPS 访问；会话 Cookie 使用 `Secure` 和 `__Host-` 前缀。
- 当前文章 API 默认会向 `master` 写入。若需要强制审核，后续应改为专用分支和 Pull Request 流程；登录认证不等于内容审核。
- CI 构建通过不等于生产环境配置已完成；必须在 Cloudflare Worker 中配置 Secret、确认 KV 绑定并重新部署后，再验证线上行为。
