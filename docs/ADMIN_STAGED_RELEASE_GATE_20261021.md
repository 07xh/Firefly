# Firefly 后台统一集成与分阶段上线门禁（2026-10-21）

> **状态：开发候选版，不是生产发布。** 已有真实生产 Worker 基线烟雾测试，但新功能未完成独立 Cloudflare 预览环境实测。不得以 GitHub Actions 编译通过代替在线验证。

## 1. 集成范围与可追溯性

- 核心候选以 [PR #68](https://github.com/07xh/Firefly/pull/68) 的累计后台安全分支为基础，覆盖会话保护、私人草稿 KV/D1/R2、并发检查、历史和恢复、MDX 原文保护、管理员健康诊断、文章按需加载及备份审计等。
- 图床部分以 [PR #56](https://github.com/07xh/Firefly/pull/56) 为基准，采用**侧路集成**，避免覆盖核心候选的 MDX 编辑器和既有 `/api/admin/upload/` 逻辑。
- 新增 `/api/admin/imgbed/` 用于独立 ImgBed API，`/admin/images/` 用于后台图片库；页面仍要求原有管理员会话。**没有改变访客前台 UI 和已发布文章正文。**
- 此候选分支包含大量叠加提交：**只将该候选视为一条集成提交线**。不得再把 #43–#63 等祖先 PR 逐一机械合并到 master。

## 2. 严格的媒体功能分阶段开关

| 后端变量 | 默认值 | 作用 |
| --- | --- | --- |
| `FIREFLY_IMGBED_ENABLED` | 未配置，即关闭 | 允许读图库，但不自动允许上传、删除 |
| `FIREFLY_IMGBED_UPLOAD_ENABLED` | 未配置，即关闭 | 仅在图库已启用且单独通过联调后允许上传 |
| `FIREFLY_IMGBED_DELETE_ENABLED` | 未配置，即关闭 | 仅在图库已启用且完成引用扫描真实验收后允许删除 |

- 原有 `/api/admin/upload/` GitHub 图片上传机制**不替换、不重定向、不依赖** ImgBed 开关。
- 新接口只有在收到字符串 `"true"` 时才放行；否则返回 503（保护性关闭）。
- 图床访问 Token 仅允许通过受保护 Worker Secret 传递给 `https://tu.0701000.xyz`，不向任意可配置域名发出凭据。
- 图床本身是公开图片托管。**私人草稿的图片不会因为正文被存入私人 KV/D1 而自动变私密**；禁止使用该公开图床承载需要保密的图片。

## 3. 环境现状（已验证的证据）

- 2026-10-21 的 `master` GitHub Actions `Deploy to Cloudflare Workers` 工作流 [run 39538625215](https://github.com/07xh/Firefly/actions/runs/39538625215) 返回 success。
- 该工作流在实际 Worker 上完成了首页 HTTP 200、登录页 HTTP 200、未登录后台跳转、未登录管理 API HTTP 401、运行时密码/KV 配置及自定义域名路由检查。**这仅证明当时的生产基础版本可访问，不证明当前候选的新功能已部署。**
- GitHub Actions 的 Node 22/23 Astro Check、Build、Cloudflare 构建（不部署）已在 #68 通过。
- Cloudflare 独立 `Workers Builds: firefly` 针对多个 PR 返回 failure，**具体日志未通过当前连接取得**。在排查前不得将该状态解释为通过。

## 4. 上线前的强制发布阻断

**警告：正式仓库 `.github/workflows/deploy-cloudflare.yml` 仍对 `master` 的 push 自动部署。Cloudflare Workers Builds 也可能独立在 push 后执行部署。** 因此合并代码等同于可能触发正式发布。

除非以下条件均满足，**禁止合并或重新启用自动发布**：

- [ ] 核实并暂停 GitHub Actions 自动生产发布；同时在 Cloudflare Dashboard 确认 Workers Builds 的生产分支自动部署已暂停（或已改为 upload-only）。
- [ ] 记录当前生产版本 SHA、Worker Deployment/Version ID、回滚路径，确认可以回到该版本。
- [ ] 在 Cloudflare 建立独立的预览 Worker、SESSION KV、FIREFLY_SESSIONS KV、PRIVATE_DRAFTS KV、专用 D1 与不公开 R2 Bucket，名称/ID 与生产完全不同。
- [ ] 从真实 Cloudflare 账户核对预览 Worker 实际绑定及访问限制，保证没有指向生产 KV/D1/R2、生产域名和密钥。
- [ ] 在独立资源中执行 `scripts/verify-private-preview-isolation.mjs` 配置检查和 `migrations/0001_private_drafts_d1.sql`。
- [ ] 完成预览 Worker 的真实 HTTP 登录/未登录 401、合成 Markdown/MDX 保存读取、D1 CAS 并发 409、KV/R2 历史恢复、损坏拒绝、备份列表分页和故障模拟。
- [ ] Android 平板打开、撤销、编辑、保存复杂 MDX（尤其 JSX、公式、`$$`、导入语法）并逐字校验；预览网站前台与生产前台比对布局和已发布文章内容。
- [ ] 分别对 ImgBed 的只读图库、测试图片上传、已引用图片删除保护做真实联调。正式资源或真实用户图片不得用于破坏性测试。
- [ ] 完成取消部署、回滚旧 Worker、确认旧 KV 原文及历史、恢复成功后的数据核对。
- [ ] 整合分支所有 CI 检查通过，Cloudflare 外部构建异常已解释或修复。

## 5. 分阶段上线顺序

1. **阶段 0：冻结发布机制与备份基线。** 先保证任何合并都不会绕过审查自动发布。该阶段可独立发布部署策略，但需先处理 Cloudflare 另一套自动部署。
2. **阶段 1：会话认证与后台只读诊断。** 不开启 D1 私人存储切换，不激活图床新 API；在预览 Worker 验证认证、退出和密码轮换会话失效。
3. **阶段 2：MDX 无损编辑与后台列表性能。** 仅开放已通过复杂原文往返测试的编辑路径；保留源码模式与手工导出。
4. **阶段 3：私人草稿 KV + R2 独立备份。** 完成真实写入和故障恢复前，一律禁止把旧 GitHub 公开草稿视为自动私密化。禁止未经确认导入旧正文。
5. **阶段 4：D1 原子写入与历史迁移。** 迁移窗口冻结写入、逐篇对账、旧 KV 不删除。只有 D1+R2 实际恢复演练通过后切换后端。
6. **阶段 5：图床只读 → 上传 → 删除。** 三个开关分别验收后启用；删除最后开放，任何引用检查不完整则拒绝删除。

每个阶段分别保留：合并 SHA、部署版本、实际 HTTP 证据、合成数据测试报告、失败回滚结果。遇到失败立即暂停，不继续下一阶段。

## 6. 尚无法直接完成的外部条件

当前可用的 GitHub 连接可以修改代码、检查 CI、读取生产部署日志，但**没有 Cloudflare 账户管理 API 权限，也无法取得 Cloudflare 私有 Workers Builds 日志或预览资源绑定**。因此不能在此连接里创建并验证真正隔离的 KV/D1/R2，也不能宣称已完成真实预览验收。

在可授权的 Cloudflare 会话或具备相应权限的专用连接中，先做只读资源核验，确认隔离以后再执行合成数据测试。不要把生产 Token、密码、Namespace ID、私人文章正文粘贴进公开 PR 或聊天。
