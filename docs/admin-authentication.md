# Firefly 后台身份认证部署说明

Firefly 的 `/admin/*` 与 `/api/admin/*` 应通过 Cloudflare Access 身份认证，并由 Worker 中间件再次验证 Access JWT 的签名、签发方、应用 Audience 和有效期。未带有效身份的页面请求会跳转登录；API 请求会返回 401，避免把登录 HTML 当成 API 响应。认证配置缺失时后台会返回 503，验证失败返回 403；不会退化为前端口令或仅检查一个请求头。

## 1. 在 Cloudflare 创建 Access 应用

1. 登录 Cloudflare Zero Trust 控制台，进入 **Access → Applications → Add an application → Self-hosted**。
2. 应用域名选择实际用于管理后台的站点，例如 `0701000.xyz`，路径覆盖 `/admin`、`/admin/*`、`/api/admin` 和 `/api/admin/*`。不要只保护登录页面。
3. 建立 **Allow** 策略，仅允许你控制的邮箱地址或组织身份；不要配置对所有人的公开 Allow 规则。
4. 保存应用，并复制该应用的 **Application Audience (AUD) Tag**。
5. 如果你还有 GitHub Pages 域名，后台不应从该域名公开访问；本仓库的 Pages 工作流会在上传前移除 `dist/admin`。

## 2. 设置 Worker 环境变量

在 Cloudflare Dashboard → Workers & Pages → `firefly` → Settings → Variables and Secrets，为生产环境设置：

- `CF_ACCESS_TEAM_DOMAIN`：你的 Zero Trust 团队域名，例如 `example.cloudflareaccess.com`，不要带协议或路径。
- `CF_ACCESS_AUD`：上一步复制的 Application Audience (AUD) Tag。

这两个值需要来自你自己的 Cloudflare 账户，不能从仓库推断。保存后重新部署 Worker，使变量生效。也可在 wrangler 的环境变量设置中配置，但不要将账号密钥写进 Git。

## 3. 验证

1. 用无痕窗口访问 `https://你的域名/admin/index.html`，应跳转到 Cloudflare Access 登录。
2. 使用允许策略中的身份登录后，应能打开后台。
3. 用未获允许的邮箱测试，应被 Access 拒绝。
4. 直接访问 GitHub Pages 域名的 `/admin/index.html` 应返回 404（该部署不再包含后台文件）。
5. 若变量未配置，Worker 后台返回 503；如果 JWT 无效或 AUD 不匹配，则返回 403。

## 安全边界

- 中间件现在同时拦截 `/admin/*` 和 `/api/admin/*`，但这只是认证门禁，不代表文章写入 API 已经实现。新增 API 仍须校验请求方法、输入字段、文章路径、请求大小和并发更新，并且只能操作 `src/content/posts`。
- 后台响应还会设置 `X-Frame-Options: DENY`、限制 iframe 嵌入的 CSP、`Permissions-Policy` 与 `Cross-Origin-Opener-Policy`；这些是纵深防御，不能替代 Cloudflare Access。
- GitHub Token 只能存放在 Cloudflare Worker Secret 中。不得放进前端代码、HTML、浏览器存储、普通环境变量文件或 Git 提交。
- 写入操作应在专用分支执行；提交审核时创建 Pull Request。禁止后台 API 直接向 `master` 写入或绕过审核发布。删除也必须通过 PR。
- 对写请求校验 `Origin` 和内容类型，设置请求大小限制与速率限制；CORS 不是认证机制。错误响应不得泄露密钥或堆栈。
- 在文章 API 实现并测试前，后台仍不能视为具备在线增删改能力。
- Cloudflare Access 应用与 Allow 策略、Worker 环境变量属于账户级配置，需在你的 Cloudflare 账户中完成。代码提交或 CI 构建通过不等于生产身份认证已经生效。


## 管理员邮箱白名单

- Worker 必须设置 `CF_ACCESS_ALLOWED_EMAILS`，值为允许进入后台的邮箱地址，多个邮箱用英文逗号分隔，例如 `admin@example.com,editor@example.com`。请替换为真实的管理员邮箱，不要使用示例地址。
- 中间件仅在 Cloudflare Access JWT 签名、签发方、Audience、有效期验证通过后，读取 JWT 中的 `email` 字段并与白名单进行不区分大小写的精确匹配。
- 白名单缺失或为空时，后台会 fail-closed 返回 503；邮箱不在名单中时返回 403。应同时在 Cloudflare Access 策略中限制身份，白名单是第二道防线，不替代 Access 策略。
- 不要把管理员邮箱写进前端配置；通过 Worker 环境变量设置，并在生产环境测试允许和拒绝的账号。
