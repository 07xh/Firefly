# 私人草稿 D1 原子存储：预览验证与安全迁移

此功能为 **未合并的开发 PR**；不会自动切换后台存储，也不会删除任何旧 KV 草稿。博客前台 UI、路由、样式和文章原文不受影响。

## 为什么引入 D1

Cloudflare Workers KV 的读写具有最终一致性。原来的 `get -> 版本比对 -> put` 并不是原子的：不同地区/设备可以同时读到同一旧版本而相互覆盖。D1 使用 SQLite SQL 的 `UPDATE ... WHERE version = ?` 和 `DELETE ... WHERE version = ?` 实现单条语句级的原子版本检查。

新模块 `src/lib/private-draft-d1.ts` 兼容原私人草稿接口的数据形式；它把当前稿、历史版本分别保存在 D1 的独立表中。在修改主草稿前，仍必须把备份写入私有 R2 并确认。

**这不是 R2 + D1 跨服务事务**。如果 R2 写入成功而 D1 CAS 失败，会留下可追溯的孤立 R2 版本，不会把旧稿覆盖。单独的 KV 数据和 D1 数据不会自动合并。

## 启用前必须完成

1. 在 Cloudflare D1 创建专用数据库（例如 `firefly-private-drafts`），在**预览/测试数据库**先执行 `migrations/0001_private_drafts_d1.sql`，成功后再考虑生产数据库。
2. 保证独立 R2 Bucket 已绑定为 `FIREFLY_PRIVATE_DRAFT_BACKUPS`；保留原 KV `FIREFLY_PRIVATE_DRAFTS`，不能直接删除旧命名空间。
3. GitHub Actions Variables 添加：
   - `FIREFLY_PRIVATE_DRAFT_D1_DATABASE_ID`：独立 D1 Database UUID
   - `FIREFLY_PRIVATE_DRAFT_D1_DATABASE_NAME`：实际 D1 数据库名称
   - `FIREFLY_PRIVATE_DRAFT_BACKEND=kv`
   - `FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE=true`：迁移维护期间
4. 使用预览 Worker 环境验证：普通保存和删除请求均返回 503（处于迁移写入冻结期）；未登录任何 /api/admin/* 都应该返回 401。
5. 使用受登录保护的 `/api/admin/private-draft-migration/` 检查并逐篇迁移：
   - `GET ?slug=<原草稿名>`：读取旧 KV 版本摘要和是否存在 D1 副本，不返回全文。
   - `POST { "slug": "...", "version": "<GET 返回的 sourceVersion>" }`：核对旧稿版本，向 R2 备份，复制到 D1，回读内容做核验；旧 KV 原文绝不删除。
   - 同名 D1 文章已存在时返回 409，不会覆盖。出现任何错误，应保留维护模式并停止切换。
6. 将 KV / D1 两边的草稿数量和内容逐篇对比，确认所有历史稿以及可能的附图都已备份。备份测试与恢复演练必须成功。
7. **仅在迁移完成并已审核的情况下**设置 `FIREFLY_PRIVATE_DRAFT_BACKEND=d1`，并将 `FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE=false`，重新部署预览 Worker。
8. 在 D1 模式验证 CRUD、R2 恢复、版本冲突、可视化 MDX 保真；完成权限与回滚演练后才允许考虑正式环境。

## 关键安全边界

- `FIREFLY_PRIVATE_DRAFT_D1_DATABASE_ID` 仅用于绑定，**并不会导致自动切换 D1**；只读到 `FIREFLY_PRIVATE_DRAFT_BACKEND=d1` 才切换。
- **不要在旧稿还未迁移时切换 D1**。D1 与 KV 是相互独立的主存储，未迁移的旧稿届时不会显示在 D1 列表里。
- 切换之后不建议继续使用旧 KV 编辑；旧 KV 应留存为只读恢复来源，直到完成可验证的异地备份。
- 迁移 API 只在 KV 后端和维护模式同时开启时可用，避免误将线上编辑中的数据复制为旧版本。
- R2 包含私人文章原文，不能开启公共 r2.dev、公共自定义域名或公开读取策略。
- 仍需进一步实现真正跨账号/跨云备份、清理策略和恢复演练。
- 不合并 PR、不执行真实迁移、不自动修改正式站点。

## 验收项目

- [ ] 真实 D1 / KV / R2 预览连接
- [ ] SQL migration 预览环境运行与检查
- [ ] 维护模式阻止普通编辑写入
- [ ] 旧 KV 草稿批次迁移，源文件逐字节对比
- [ ] D1 模式并发 UPDATE/DELETE 返回 409、成功编辑后保留 R2 旧版本
- [ ] 误删恢复不覆盖其他版本
- [ ] 配置丢失、R2 不可用、D1 失败时拒绝写入且无正文丢失
- [ ] 前台 UI、已发布文章正文与主题完全不变
