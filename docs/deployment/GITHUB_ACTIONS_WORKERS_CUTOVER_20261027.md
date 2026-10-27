# Firefly | GitHub Actions + Wrangler 零 Workers Builds 分钟发布

更新日期：2026-10-27。此流程仅迁移 **构建位置**，不迁移 Worker、本机域名、前台/后台代码或存储。

## 已审计的现状

- Cloudflare Worker 名称：`firefly`。
- GitHub 代码分支：`07xh/Firefly@master`；此前的 GitHub Actions `.github/workflows/deploy-cloudflare.yml` 已具备 `pnpm run build` + `wrangler deploy --config dist/server/wrangler.json`。
- Astro 构建使用 `CF_WORKERS=1`，Cloudflare adapter 输出实际 Worker 配置到 `dist/server/wrangler.json`；**不要**用仓库根目录的 `wrangler.toml` 覆盖生成输出。
- 动态后台依赖原 Worker 的 `FIREFLY_SESSIONS`、`SESSION` KV、管理员密码、GitHub Contents Token；若线上另有 R2、D1、图床配置/运行时 Secrets，必须逐项核对。
- 域名 `0701000.xyz` 的实际 Cloudflare 绑定类型（Custom Domain 还是 Route）、Active 部署与额外存储绑定无法仅由 GitHub 文件权威确认，**不要未经检查直接发布**。

## 首次切换：先人工验收，再启用自动发布

1. 在 Cloudflare Workers & Pages → `firefly` → **Deployments** 记录 Active Version / 配置；在 **Settings → Domains & Routes** 记录 `0701000.xyz` 具体绑定类型；在 **Settings → Variables and Secrets / Bindings** 记录绑定名称（不要导出 Secret 明文）。
2. Workers & Pages → `firefly` → **Settings → Builds → Disconnect**。只断开源仓库自动构建；**不要**删除 Worker、域名、DNS、KV、R2、D1 或 Secrets。额度耗尽导致 Cloudflare Builds 自动暂停，但不自动关闭 GitHub Actions。
3. GitHub → `07xh/Firefly` → Settings → Secrets and variables → Actions。核对 **Secrets**：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`FIREFLY_CONTENTS_TOKEN`；需要重新写入实际值时在 GitHub 安全设置操作，绝不写在 Git 仓库中。`FIREFLY_ADMIN_PASSWORD` 等运行时 Secrets 必须在 Cloudflare Worker 中已存在，本 GitHub Workflow 不调用 `wrangler secret put` 来偷跑一次生产部署。
4. GitHub **Variables** 先只设置 `FIREFLY_WORKERS_BUILDS_DISCONNECTED=true`；**暂不**设置 `ENABLE_FIREFLY_GHA_DEPLOY`。通过 GitHub Actions 手动运行 **Deploy to Cloudflare Workers**，做首轮受控 GitHub 构建和 Wrangler 发布。此操作仍需真实部署权限，并会发布到线上现有 Worker；设置前核对资源绑定。
5. 核实 Actions 的构建日志、实际 Active Worker 版本、原域名首页、后台登录保护、`/api/admin/articles/` 未授权返回 401、KV 登录、图片上传、文章后台与原已使用功能；确认与 `master` SHA 一致。遇到验证失败，应停止发布并使用 Cloudflare 版本历史回滚，核对差异，而不是删除 KV 或重新建 Worker。
6. 首次生产验收成功后，在 GitHub Actions **Variables** 设置 `ENABLE_FIREFLY_GHA_DEPLOY=true`；之后只有 `master` 的 GitHub Actions（以及到期文章触发的重建）发布，不占 Cloudflare **Workers Builds** 分钟。不要同时恢复 Cloudflare Git Builds，以防竞争发布。

这次迁移不做域名改绑。没有 `ENABLE_CUSTOM_DOMAIN_ROUTE` 时保留 Astro 生成的路由/Workers.dev 设置，不强行清除；如果当前 Worker 原有域名绑定属于 Cloudflare 面板自定义 Route，须在部署后单独实测。Wrangler `--keep-vars` 用于保留面板普通环境变量；现有 Secrets 默认保留；KV/R2/D1 等**资源绑定**必须先核验，不应理解为 `--keep-vars` 会保护所有绑定。

## 恢复原 Cloudflare Builds

1. 首先将 GitHub Actions Variables `ENABLE_FIREFLY_GHA_DEPLOY` 设为 `false`，停止自动 GitHub 发布。定时发布调度会相应跳过派发。
2. Cloudflare Worker → **Settings → Builds → Connect**，重新关联原仓库 `07xh/Firefly` 和生产分支 `master`，恢复迁移前记录的构建环境、构建命令和部署命令。
3. 做一次 Cloudflare Builds 正式验证，核对 Active 版本、`0701000.xyz`、KV、R2、后台登录和图片服务。
4. 若不再使用 GitHub Actions 发布，将 `FIREFLY_WORKERS_BUILDS_DISCONNECTED` 保持为 `false`；不必删除 Workflow 及其历史记录。

## 未改变的安全门禁

- 不自动新建 Worker、域名、KV、R2、D1；保持原 Worker 名称和已有数据。
- 不上传密钥，不打印 Secrets，不将后台 Token 暴露给客户端。
- `deploy-worker.yml` 旧工作流继续默认关闭；`deploy.yml` 属于另外的 GitHub Pages 发布流程，不得把 Pages 产物误当动态 Worker。
- PR 构建测试并不等于 Cloudflare **Active Deployment**；CI 失败必须在最新 HEAD 真正修好，不能跳过审核。
