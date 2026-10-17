# Firefly 后台独立登录认证

Firefly 后台使用独立密码登录，不依赖 Cloudflare Zero Trust。所有 `/admin/*` 页面和 `/api/admin/*` 文章/部署接口均由 Worker 中间件校验签名会话；只有登录、登出和会话状态接口允许匿名访问。未登录的页面请求跳转到 `/admin/login/`，未登录 API 请求返回 401。

## 1. 配置 Cloudflare Worker Secrets

进入 Cloudflare Dashboard → Workers & Pages → `firefly` → Settings → Variables and Secrets → Production，添加以下 **Secrets（机密）**：

- `ADMIN_PASSWORD`：后台登录密码，至少 12 个字符。建议使用密码管理器生成的长随机密码；不要与网站、邮箱或 GitHub 密码重复。
- `ADMIN_SESSION_SECRET`：至少 32 字节的随机秘密，用于 HMAC-SHA-256 签名会话。使用密码管理器生成随机值，或在可信终端运行 `openssl rand -base64 32` 生成。不要将生成值发到聊天、提交到 Git 或放进前端文件。

文章写入仍需要以下 Worker Secret：

- `GITHUB_CONTENTS_TOKEN`：只授予 Firefly 仓库必要内容读写权限的 GitHub Token。
- `GITHUB_CONTENTS_REPO`（可选普通变量）：例如 `07xh/Firefly`。
- `GITHUB_CONTENTS_BRANCH`（可选普通变量）：当前 API 默认 `master`；如果你配置为其他分支，请确保部署工作流与分支策略一致。

保存后重新部署 Worker，使新 Secrets 生效。请勿再配置或依赖 `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`、`CF_ACCESS_ALLOWED_EMAILS`；独立登录流程不使用这些变量。

## 2. 登录与会话行为

- 访问 `https://你的域名/admin/` 会在未登录时跳转到 `/admin/login/`。
- 登录密码仅发送至同源的 `/api/admin/auth/login`，由 Worker 与 Secret 中的密码比较；前端不保存密码。
- 成功登录后，服务端设置 `HttpOnly; Secure; SameSite=Strict; Path=/` 的 `__Host-firefly_admin` Cookie。
- Cookie 内容是 HMAC-SHA-256 签名的短期会话，默认 8 小时过期；会话秘密缺失时拒绝所有后台访问。
- 登出接口会清除会话 Cookie。清除浏览器 Cookie 也可结束本地会话。
- 后台 API 继续校验同源 Origin、JSON Content-Type、请求体大小及文章路径；GitHub Token 仅在 Worker 服务端使用。
- 所有后台页面响应都设置禁止缓存、禁止 iframe 嵌入等安全响应头。

## 3. 验证清单

1. 配置上述 Worker Secrets 并重新部署。
2. 使用无痕窗口访问 `/admin/`，应跳转到登录页。
3. 输入正确密码后应进入文章编辑页；错误密码应被拒绝。
4. 未登录直接请求 `/api/admin/articles` 应返回 401，而不是文章数据。
5. 登录后测试读取、新建、编辑、删除和部署状态查询。
6. 测试结束后点击登出（如果当前页面尚无登出按钮，可清除该站点 Cookie），再确认后台 API 返回 401。

## 安全边界与限制

- 密码登录没有 Cloudflare Access 的组织身份、MFA 或集中策略能力。请使用高强度唯一密码，并在 Cloudflare 为登录端点配置可用的速率限制规则；Worker 内存限流不适合作为跨全球边缘的可靠防暴力破解机制。
- HMAC 会话是无状态会话，无法在过期前逐个服务端撤销；登出通过删除浏览器 Cookie 结束该浏览器的会话。如怀疑会话密钥泄露，请轮换 `ADMIN_SESSION_SECRET` 并重新部署，这会使旧会话全部失效。
- 此实现不会把密码或会话密钥存进仓库，也不使用浏览器 localStorage 存储登录凭据。
- 当前文章 API 仍根据 `GITHUB_CONTENTS_BRANCH` 默认向 `master` 写入。若需要强制审核，后续应改为专用分支和 Pull Request 流程；登录认证本身不等于内容审核。
- 生产环境必须通过 HTTPS 访问；会话 Cookie 带有 `Secure` 和 `__Host-` 前缀。
