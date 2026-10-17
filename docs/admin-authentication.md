# Firefly 后台独立登录配置

Firefly 后台已改为应用自己的密码登录，不依赖 Cloudflare Zero Trust / Access。后台页面和后台 API 由 Worker 中间件统一保护，登录后签发 HttpOnly、Secure、SameSite=Strict 的会话 Cookie；服务端会话记录保存在 Cloudflare Workers KV 中，8 小时后过期。登录失败会按来源 IP 限制尝试频率。

## 部署前必须配置

### 1. 设置管理员密码

在 Cloudflare Dashboard 中打开 Workers & Pages → firefly → Settings → Variables and Secrets，在 Production 环境添加 Secret：

- 名称：FIREFLY_ADMIN_PASSWORD
- 值：设置一个独立、随机且至少 16 个字符的管理员密码；建议使用密码管理器生成更长的密码。

不要把密码写入仓库、HTML、普通变量、截图或聊天记录。密码 Secret 需要在部署新代码前设置。

### 2. 配置会话 KV

wrangler.toml 和 wrangler.jsonc 都定义了 FIREFLY_SESSIONS 绑定。Cloudflare 部署工作流会先查找标题为 `FIREFLY_SESSIONS` 的 KV 命名空间；如果不存在，则创建一个，并在部署任务运行时将其 ID 写入两份配置。该 ID 不包含密码，但无需手动提交到仓库。

GitHub Actions 使用的 `CLOUDFLARE_API_TOKEN` 必须具有 Workers 部署权限及 Workers KV Storage Read、Write 权限。若命名空间创建或查询失败，部署会停止，不会继续发布缺少会话存储的 Worker。

### 3. 检查 GitHub 写入 Token

在线文章增删改由 Worker 服务端调用 GitHub API。继续在 Worker 的 Variables and Secrets 中设置：

- Secret：GITHUB_CONTENTS_TOKEN
- 可选变量：GITHUB_CONTENTS_REPO，默认 07xh/Firefly
- 可选变量：GITHUB_CONTENTS_BRANCH，默认 master

GitHub Token 不会发送到浏览器。请只授予目标仓库所需的内容读写权限。

## 登录地址与验收

1. 部署完成后访问 https://你的域名/admin/login/。
2. 使用刚才配置的管理员密码登录，应进入文章管理页面。
3. 部署工作流成功后，在 Cloudflare Zero Trust 中停用或移除原先覆盖这些后台路径的 Access 应用，再测试应用自己的登录。旧 Access 应用通常也会拦截 /admin/login/，因此不移除就无法看到独立登录页面。
4. 未登录直接访问 /admin/ 或 /api/admin/articles 时，页面应跳转登录或 API 返回 401。
5. 登录后应能读取文章列表；新建、保存草稿、发布、编辑及删除都应经由后台 API 写入 GitHub。发布或删除产生的提交会触发仓库中已配置的部署工作流。
6. 点击“退出登录”后，应清除会话，重新打开后台必须再次登录。

## 安全行为

- 会话 Cookie 使用 HttpOnly、Secure、SameSite=Strict，并设定 8 小时有效期。
- Worker 校验服务端 KV 会话记录；会话记录只保存随机会话 token 的 SHA-256 键，不把原始 token 写入 KV。
- 登录接口要求同源 JSON 请求，登录失败后按 IP 限制尝试次数。
- 后台写请求要求 Origin 与当前站点完全一致、Content-Type 为 application/json，正文上限为 1 MiB。
- 后台页面和 API 设置 no-store、nosniff、禁止 iframe 嵌入等安全响应头。
- 认证缺失或会话存储不可用时采用 fail-closed 行为：后台返回 503，不会退化为公开访问或前端口令校验。

首次部署前务必设置 FIREFLY_ADMIN_PASSWORD；如果 KV 绑定或密码未配置，后台会拒绝登录，而不会开放访问。
