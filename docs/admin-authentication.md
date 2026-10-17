# Firefly 后台身份认证部署说明

Firefly 的 `/admin/*` 通过 Cloudflare Access 身份认证，并由 Worker 中间件再次验证 Access JWT 的签名、签发方、应用 Audience 和有效期。认证配置缺失时后台会返回 503，验证失败返回 403；不会退化为前端口令或仅检查一个请求头。

## 1. 在 Cloudflare 创建 Access 应用

1. 登录 Cloudflare Zero Trust 控制台，进入 **Access → Applications → Add an application → Self-hosted**。
2. 应用域名选择实际用于管理后台的站点，例如 `0701000.xyz`，路径覆盖 `/admin` 和 `/admin/*`。不要只保护登录页面。
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

- 这是后台页面的身份门禁。当前文章管理的写操作仍通过 GitHub 自身的登录和仓库权限完成；任何未来新增的写入 API 也必须验证身份，不能仅依赖页面被保护。
- Cloudflare Access 应用与 Allow 策略、Worker 环境变量属于账户级配置，需在你的 Cloudflare 账户中完成。代码提交或 CI 构建通过不等于生产身份认证已经生效。
