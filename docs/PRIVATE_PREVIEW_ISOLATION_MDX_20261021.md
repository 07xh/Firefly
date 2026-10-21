# 第四批：隔离预览 Worker 与 MDX 无损验收

> 状态：仅开发与静态验收。**不执行 Cloudflare 预览部署，不访问生产存储，不合并主分支。**

## 1. 当前障碍

正式仓库的 `wrangler.jsonc` 目前只有基础 Worker 会话 KV 绑定，不包含可直接验证的独立预览 KV/D1/R2 资源。Cloudflare 项目本身尚未通过当前连接授予可检查/创建这些资源的权限。

因此不能拿正式 `firefly` Worker 或生产 KV/R2/D1 来跑“试试看”的写入实验，也不能宣称已经做完真实预览验收。

## 2. 部署前隔离门禁（代码已提交）

`scripts/verify-private-preview-isolation.mjs` 仅进行 **本地只读配置审查**，不会调用 Cloudflare API，也没有任何部署操作。要求：

- 预览 Worker 名称明确包含 preview、staging 或 pr-编号，且不得与生产同名
- 只能采用独立 workers.dev，不能绑定正式自定义域名、route 或 zone
- 必须明确绑定独立的 `FIREFLY_SESSIONS`、`FIREFLY_PRIVATE_DRAFTS` KV、`FIREFLY_PRIVATE_DRAFT_DB` D1、`FIREFLY_PRIVATE_DRAFT_BACKUPS` R2
- 预览 R2 Bucket 名称必须有 preview/staging 等标识
- 将所有预览存储标识与**非公开的生产资源清单**逐一比较，完全不同才可继续
- 预览只允许 `FIREFLY_PRIVATE_DRAFT_BACKEND=d1` 和 `FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE=false`，不允许把 Token/密码写进 vars
- 不能凭占位符、格式错误或缺少生产资源清单通过检查；错误按失败处理

这项门禁**不是** Cloudflare 后台实际绑定核验，最终必须在 Cloudflare 控制台/接口核对资源。

### 本地独立配置要求

1. 在 Cloudflare 中创建一组与正式网站不同的 Worker、两个 KV Namespace、一个 D1 数据库和一个非公开 R2 Bucket
2. 在本地 `wrangler.preview.local.jsonc` 填写测试资源绑定及以上非敏感运行标志；不要改 `wrangler.jsonc` 的正式 Worker 名称及绑定
3. 在本地 `.firefly-production-resource-ids.json` 写入生产环境的 **两个 KV namespace ID、D1 database ID、R2 Bucket 名称**组成的字符串数组；文件已被 `.gitignore` 保护，不能上传到仓库或聊天
4. 在本地终端运行：

```sh
FIREFLY_PREVIEW_WRANGLER_PATH=wrangler.preview.local.jsonc \
FIREFLY_PRODUCTION_RESOURCE_MANIFEST=.firefly-production-resource-ids.json \
node scripts/verify-private-preview-isolation.mjs
```

5. 门禁通过后，也必须先确认 Cloudflare 仪表盘里的**实际** Worker 路由和绑定均为预览资源；将 `migrations/0001_private_drafts_d1.sql` 只应用到预览 D1
6. 只用人工构造的非敏感 MDX 内容测试匿名 401、版本 CAS 409、历史恢复、R2 备份及失效恢复；不要直接导入生产草稿

**禁止**：在 GitHub Actions Secrets 里将生产账户 Token 用于自动创建预览资源、向公开 Workflow 输出生产存储标识、将 `FIREFLY_PRIVATE_DRAFT_BACKEND` 切换为正式 D1。

## 3. MDX 编辑器无损改动

原编辑器在打开可视化编辑模式时，会自动移除顶部特定 Firefly MDX 组件的 `import`，并立即写回编辑器原文。这不符合“打开文章不主动改写原文”的要求。

本批已调整 `public/admin-wysiwyg.js`：可视化载入仅读取 `split.body` 并生成受保护块，**不再在打开文章时自动删改 import**。复杂 import、MDX 表达式、组件仍由保留语法块处理。

自动测试验证：

- 编辑器载入函数不包含自动删除 `import` 的写回代码
- 普通段落可编辑，嵌套 MDX 组件及 LaTeX 保留块保持原样
- 丢失或重复保留标记时阻止损坏的同步，不覆盖安全版本

该自动测试仅覆盖源码约束及保留语法函数，**不能代替**真正的 Android 平板 Tiptap 浏览器 E2E；浏览器的撤销、图片拖拽、不同输入法仍为待验收。

## 4. 交付门槛

- [ ] Node 22/23 Markdown/MDX 与预览隔离门禁全部通过
- [ ] Astro 22/23 检查、构建和 Cloudflare 无部署构建通过
- [ ] 实际 Cloudflare 预览资源核对与合成数据生命周期测试（当前无法在 GitHub connector 内完成）
- [ ] Android 平板编辑与视觉比对
- [ ] PR 依赖拆分审查：本开发分支基于 #67，包含 #64 的历史代码，不允许不经审核直接合并到 master

**前台主题、公共文章和正式存储均不在此次交付范围内。**


## 5. Cloudflare Worker Previews 的独立验收门禁（2026-10-21 增补）

### 与上面的独立 staging Worker 不同

Cloudflare 2026 年 9 月推出的 **Worker Previews** 使用与生产相同的 Worker 名称和顶层 Wrangler 配置，但在本地 \`wrangler.preview.local.jsonc\` 的 \`previews\` 块内指定隔离的资源；使用 \`npx wrangler preview\` 而不是 \`wrangler deploy\`。这与独立部署的 staging Worker 模式互斥，不能把两个检查脚本当成同一种环境。

- \`scripts/verify-private-preview-isolation.mjs\`：用于独立命名的 staging Worker。
- **\`scripts/verify-worker-previews-isolation.mjs\`：用于 Cloudflare Worker Previews 的 \`previews\` 配置块。**

Cloudflare 官方明确指出：Previews 的代码/URL/观测信息独立，但 KV、D1、R2 等账号级资源只在绑定不同 ID/名称时隔离；此外，Previews **不继承**正式绑定。参考官方：[Previews configuration](https://developers.cloudflare.com/workers/previews/configuration/) 与 [Resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)。

### 本地安全验证的流程

1. 将正式 \`wrangler.jsonc\` 内容复制到已忽略的 \`wrangler.preview.local.jsonc\`（禁止修改生产顶层配置），只在副本的 \`previews\` 中添加以下独立绑定：
   - 测试用 \`FIREFLY_SESSIONS\` KV ID
   - 测试用 \`FIREFLY_PRIVATE_DRAFTS\` KV ID
   - 测试用 \`FIREFLY_PRIVATE_DRAFT_DB\` D1 database_id 和带 preview 字样的数据库名称
   - 测试用 \`FIREFLY_PRIVATE_DRAFT_BACKUPS\` R2 Bucket 名称，且名称带 preview 标识
   - \`vars\` 中显式 \`FIREFLY_PRIVATE_DRAFT_BACKEND=d1\` 和 \`FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE=false\`
2. 用独立的私有生产资源清单（已经在 \`.gitignore\` 中忽略）收集正式账户所有现有绑定 ID/名称。请在自己的安全设备上操作，不要将它们粘贴进聊天、PR 或 CI 日志。
3. **先运行下面的静态门禁**；如果任何数据项缺失或与生产资源重合，必须停止：

\`\`\`sh
FIREFLY_PREVIEW_WRANGLER_PATH=wrangler.preview.local.jsonc \
FIREFLY_PRODUCTION_RESOURCE_MANIFEST=.firefly-production-resource-ids.json \
node scripts/verify-worker-previews-isolation.mjs
\`\`\`

4. 只有在 Cloudflare 控制台进一步核实 **实际预览绑定**、完成隔离数据库和 Bucket 的创建且具备 Cloudflare 登录授权之后，才考虑创建 Preview。使用 \`--config\` 选择经过检查的本地文件，并使用 \`--ignore-base-config\`，避免意外叠加仪表盘中未审计的 Preview Base：

\`\`\`sh
npx wrangler preview --config wrangler.preview.local.jsonc --ignore-base-config --name firefly-qa-private
\`\`\`

此处只是通过 Cloudflare 文档核对过的**待执行命令**，不是部署日志，也不表示预览 URL 存在。

5. 预览部署之后，必须再次在 Cloudflare 后台核对该 Preview **实际解析到的**会话 KV、草稿 KV、D1、R2 都不与生产重合，然后才可运行合成数据的 HTTP 验收。
6. 后续对测试用 D1 单独应用迁移，并验证匿名 401、写入、CAS 409、R2 备份、删除、历史恢复、MDX 原文字节一致性。禁止使用任何生产草稿/上传图片做测试。

### 自动化通过与真实验收的差别

新增 \`scripts/verify-worker-previews-isolation.test.mjs\` 已接入 Node 22/23 构建检查。它检测**本地文件**是否误修改正式 Worker 顶层参数、是否缺少预览绑定或复用生产 ID，以及是否意外开启迁移写入。

这不是账户级实际资源核对：如果私有生产资源清单不完整或 Cloudflare 仪表盘状态与本地文件不同，静态检测不能保证隔离。因此必须把真实验证保持为“待完成”，不能为此合并目前叠加的私人草稿 PR。

- [ ] 安全 CI 检查
- [ ] Cloudflare 连接可用
- [ ] 实际账户级资源逐个核对
- [ ] 独立 Preview URL 已创建
- [ ] 合成数据的 D1/KV/R2 生命周期验收
- [ ] Android 平板编辑器浏览器测试

最终交付必须同时覆盖静态与实际 Cloudflare 两个层级。
