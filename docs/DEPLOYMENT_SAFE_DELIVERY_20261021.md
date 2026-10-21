# Firefly 发布通道安全验收（2026-10-21）

## 变更性质

独立 **待审阅 PR**，从 `master` 建立，和累计近 200 次提交的后台开发分支分开。不触碰前台组件/布局、已有文章、生产 KV/D1/R2 数据或 Cloudflare Secret；**本 PR 不能代表已经发布到线上**。

## 两个既有目标各保留一个默认自动发布通道

| 工作流 | PR 中策略 | 验收预期 |
| --- | --- | --- |
| `deploy-cloudflare.yml` | 保持 master push + 手动 dispatch | 唯一默认自动部署 Worker，继续供定时文章发布调用 |
| `deploy-worker.yml` | 仅手动且需 `ENABLE_LEGACY_WORKER_DEPLOY=true` | 默认跳过；与主 Worker 部署共享 `cloudflare-workers` 并发组 |
| `deploy.yml` | **保持既有 master push + 手动触发** | GitHub Pages 正在正常发布；保留构建 `dist`、排除 `dist/admin` 的发布路径，不因不确定 Pages 用途中断现有服务 |
| `static.yml` | 仅手动，全部 job 恒为跳过 | 不再直接把整个公开仓库当作 Pages 网站部署 |
| `jekyll-gh-pages.yml` | 仅手动，全部 job 恒为跳过 | 避免错误 Jekyll 模板抢占 Pages 发布 |
| `publish-scheduled-posts.yml` | 保持原样 | 定时文章仍指向 `deploy-cloudflare.yml` |

旧 Worker 备用路径的 opt-in **不会自动新建或改变 GitHub Actions Variables**。正常的 GitHub Pages 发布通道继续按原样工作，不增加 Pages opt-in 门槛。由于 Pages 近期确有成功部署记录，不能未经核验就关闭这一既有发布通道。

## 自动门禁

新增 `scripts/check-deploy-workflows.mjs`、回归测试以及 `deployment-policy-audit.yml`。

- 拒绝两个重复的旧 Pages 模板和备用 Worker 自动触发，但保留现有 `deploy.yml` 对 Pages 的正常 master 发布。
- 拒绝备用 Worker 缺少显式启用条件。
- 要求正常 Pages 工作流仍从 `master` 触发、上传 `dist` 构建产物并排除后台页面；阻止模板直接上传仓库目录。
- 拒绝两个 Worker 发布入口不共享并发组，或主发布缺少正常触发。
- 拒绝定时发布转向旧 Worker。
- 对缺失工作流返回失败，而非默许。

本门禁是对**当前工作流形状**的保守静态检查，不能证明 Cloudflare 路由、KV、R2、真实部署和浏览器端行为。要配合 GitHub 分支保护、Cloudflare 权限和预览环境实际验收。

## 真实环境需要执行的验收（未执行）

- [ ] 核对 `0701000.xyz` 与 workers.dev 的实际 Cloudflare 绑定及最后正常生产部署。
- [ ] 核对 GitHub Pages 是否服务于其他实际使用的域名；本批保留原 Pages 自动发布以避免服务中断。
- [ ] 对比正式网站主页、文章、后台登录路由和静态资源。
- [ ] 单独创建 Cloudflare 预览 Worker（不同 Worker 名称 / KV / D1 / R2），先在预览环境验证发布、回滚。
- [ ] 私人草稿迁移与真实数据操作前另行批准；不在此 PR 处理。
- [ ] 对生产发布流程更改执行变更审核、记录回滚 commit、确认所有 required checks 通过。

## 回滚

1. 保留当前 `master` 和历史 GitHub Actions 工作流的 commit。
2. 如果 GitHub Pages 服务受到影响，先核对是否确实依赖自动 Pages 发布，再回滚本 PR 的相应工作流改动。
3. 如果生产 Worker 异常，回退到已知安全 Worker 版本，保留数据（**切勿直接回滚数据库模式或删除原 KV**）。
4. 验证正式网站游客前台 UI、文章与后台认证，才宣布恢复完成。

## 不合并规则

任何门禁失败、无法证明当前自动发布入口未被额外引入、或回滚不可行时，保持 PR 为草稿。由于本批不关闭既有 Pages 发布，仍需合并后核对 Pages 和 Cloudflare 工作流结果；**CI 通过不代表站点行为已验收**。
