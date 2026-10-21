# 私人草稿独立 R2 备份接入说明（开发阶段）

本功能基于 PR #47 的私人草稿 KV 和版本历史，加入**额外的私有 Cloudflare R2 存储桶**。只修改后台、Worker API、Actions 可选绑定与测试，**完全不修改前台 UI 或原文章**。

## 目标及不可混淆的安全边界

- 私人草稿正文当前保存在 `FIREFLY_PRIVATE_DRAFTS` KV，历史快照也在该 KV 的其他键。单个 KV namespace 损坏时，KV 内历史无法充当独立备份。
- 新增 `FIREFLY_PRIVATE_DRAFT_BACKUPS` R2 存储桶绑定，保存按随机版本 UUID 区分的不可变 JSON 副本。保存到 KV 当前键之前，必须先写入并读回验证 R2 副本。
- **只要部署了这一批代码，未绑定 R2 时所有私人草稿写入、修改、删除及历史恢复都会返回 503，且不会改写 KV 当前稿。** 列表/读取旧文章仍然可用。
- R2 备份不与 KV 使用相同存储服务，但仍在 Cloudflare 平台内，**尚不能替代跨账号/跨云的灾难备份**，也不能实现 R2+KV 原子事务。
- R2 对 Worker API 读写和列举提供强一致性，但 Worker 的 R2/KV 跨服务修改没有共同事务。跨设备并发编辑仍需 D1 或 Durable Objects 提供原子版本协调。

## 配置

1. 在 Cloudflare Dashboard → R2 创建**专用于私人草稿备份的私有 Bucket**，不要配置公用 r2.dev URL、公开自定义域名或未经授权的访问策略。
2. 在 GitHub 仓库 Actions → Variables 添加 `FIREFLY_PRIVATE_DRAFT_BACKUP_BUCKET`，其值是**已存在的 R2 bucket 名**（只是一串名称，不是密钥）。
3. 工作流 `.github/workflows/deploy-cloudflare.yml` 在生成的 Worker Wrangler 配置中可选添加：
   - binding: `FIREFLY_PRIVATE_DRAFT_BACKUPS`
   - bucket_name: 来自 `FIREFLY_PRIVATE_DRAFT_BACKUP_BUCKET` 的值
4. 同时保持独立 KV 绑定 `FIREFLY_PRIVATE_DRAFTS`。不要与 `FIREFLY_SESSIONS` 或公开图片图床复用。
5. **在预览环境先验证**：R2 未绑定 → 503；绑定后保存草稿 → R2 新备份可读取 → KV 正文写入；故障时 KV 不变；删除后备份仍能恢复。无需，也不应在正式生产环境使用真实敏感资料进行首轮测试。

## API

既有 `/api/admin/private-drafts/` 和 `/api/admin/private-draft-history/` 的写入/恢复操作增加了 R2 备份强制校验。

新接口 `/api/admin/private-draft-backups/` 继承原有 `/api/admin/` 登录及同源写保护：

| 操作 | 方法 | 说明 |
| --- | --- | --- |
| R2 备份列表 | `GET ?slug=name` | 返回所选私人草稿的备份版本号，支持 cursor |
| R2 版本详情 | `GET ?slug=name&version=uuid` | 读取受登录保护的完整备份原文 |
| 从 R2 恢复 | `POST` | `{ slug, version, expectedVersion? }`；产生新版本，已有同名稿需要当前版本号 |

不向公开 GitHub 写入私人正文，不暴露 R2 公网下载链接。R2 对象放在 `private-draft-backups/v1/<slug>/<version>.json` 内；随机版本可以避免常规同名覆盖。

## 备份对象本体校验

- 恢复与备份一致性核验会验证 schema、slug、UUID 版本、`md/mdx` 扩展名、ISO 时间戳，以及必须为 `draft: true` 的 Markdown frontmatter。**即使 JSON 格式合法，也不能把公开文章、缺少草稿标记或时间戳无效的文件当作私人备份恢复。**
- 已知 R2 对象 `size` 超限时，在调用 `text()` 前拒绝读取；对缺少 size 的模拟或旧适配器，则在实际读取文本后再次核对字节数。
- 单个序列化的 JSON 备份对象设定 **1.2 MB 上限**；原始 Markdown 正文仍遵守原有 500 KB 限制。创建备份、检查已有快照和写入后核对，都适用同一大小限制。
- 这是保守的结构与大小检查，**不是加密签名**。针对内容可被同权限人员恶意替换的场景，仍需要独立身份验证、跨账号备份和恢复演练。

## 仍需补完

- [ ] 真实 R2 + KV 预览 Worker 联调、R2 Bucket 权限与公网开关检查
- [ ] 备份文件批量导出到异地，验证单独从备份恢复的完整性
- [ ] 考虑 D1/Durable Objects 原子版本控制，解决 KV 跨地区最终一致性导致的并发覆盖风险
- [ ] 正式上线前验证旧稿是否已存在 R2 备份；必要时人工迁移，不能假设旧稿自动备份
- [ ] 管理后台单独提供 R2 灾难恢复操作入口与更直观的状态反馈（API 已具备）
- [ ] 真实测试多设备并发、重复提交与恢复过程中的网络中断
- [ ] 保留现有前台视觉与文章内容的回归检查

请将所有改动保留在 Draft PR 内；**完成 CI 并不等于完成真实灾难恢复验证**。
