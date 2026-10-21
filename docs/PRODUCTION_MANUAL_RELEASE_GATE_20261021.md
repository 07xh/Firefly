# Firefly 生产发布手动门禁（尚未上线）

> **这是一份部署保护修改，不是立即发布。** 如 Cloudflare Workers Builds 还在监听 master 自动部署，仅修改 GitHub Actions 工作流**不能**保证停止自动发布。务必先在 Cloudflare Workers & Pages → firefly → Settings → Builds 中核对并暂时关闭生产自动部署，或改为只上传版本而不激活。

## 为什么需要锁定

当前 Firefly 的 `master` push 会触发至少两条 GitHub Actions：
- `.github/workflows/deploy-cloudflare.yml`：构建并直接部署到 Cloudflare Workers。
- `.github/workflows/deploy.yml`：构建并发布到 GitHub Pages。

仓库还同时连接了 Cloudflare Workers Builds。**即使 GitHub Actions 完全通过，未完成真实预览验收时合并大量后台功能也可能导致直接上线。**

## 本 PR 的保护范围

- Cloudflare Worker: 只保留 `workflow_dispatch`，不接受 `master` push 触发。必须手动选择 `release_confirmation = DEPLOY_VERIFIED`，且 GitHub Actions Repository Variable `FIREFLY_RELEASE_READY = true` 才运行生产部署。
- GitHub Pages: 只保留 `workflow_dispatch`，且需要 `FIREFLY_RELEASE_READY = true`。新后台不会被发布到 GitHub Pages 的静态目录。
- 旧的独立 Worker 发布工作流仍默认禁用。
- `scripts/check-deploy-workflows.mjs` 和对应测试同步调整为**拒绝主分支自动部署**的策略。

## 对现有功能的影响

**重要：** 已有定时文章发布流程可能向 Cloudflare Worker 发布工作流发送不含 `release_confirmation` 的 dispatch 请求。因此在本发布锁生效期间，该类请求将**不能触发自动生产部署**。这可能暂时延迟定时文章对外可见的时间。恢复定时发布功能前，必须另行设计独立的、经过审批的最小发布权限和触发条件，不能无条件取消发布锁。

## 分阶段部署顺序

1. **预备阶段（不能跳过）**：在 Cloudflare 仪表盘确认 Workers Builds 的生产自动发布已暂停，记录当前正式版本/可回滚 Worker Version ID；保存配置与原文备份。
2. 先合并本 PR 的**部署策略**；检查 GitHub Actions/Cloudflare 没有因这一提交意外发布生产。
3. 在**独立的预览 Worker 和 KV/D1/R2** 中测试核心后台、MDX 原文、备份历史恢复与图床开关；禁止用生产数据库做故障演练。
4. 每个通过验收的阶段单独合并到 master，并利用手动部署审批开关执行，部署后立即跑 HTTP 登录/权限/文章读写/前台比对烟测。
5. 若失败：停用 `FIREFLY_RELEASE_READY`、暂停额外推送、将 Cloudflare Worker 回滚到记录的上一个稳定版本，检查 KV/D1/R2 当前数据及历史没有被覆盖。回滚代码**不会自动撤销任何已经写入的数据**。

## 验收证据状态

- 现有生产基线 [GitHub Actions 39538625215](https://github.com/07xh/Firefly/actions/runs/39538625215)：主页、登录页、未登录 API 返回 401 等基本烟测通过（对应旧 master，不包含待上线功能）。
- 新集成候选 [PR #69](https://github.com/07xh/Firefly/pull/69) 仍在 CI 和预览环境验收中。
- Cloudflare 外部 Workers Builds 的 PR 构建失败日志无法通过当前 GitHub 连接读取，真实 Worker Previews 资源隔离尚未核实。
- 因此本 PR 不应在 Cloudflare 构建分支控制未确认的情况下合并。

本 PR 只更改部署工作流、审计脚本和相应测试/文档，不修改任何访客页面或文章。
