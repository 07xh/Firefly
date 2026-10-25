# Firefly 可选 Cloudflare R2 图床（兼容旧 GitHub 图床）

> 此功能仅增加后台上传通道，不迁移、不删除、不修改既有 GitHub 图片、原图床图片 URL、文章及游客前台主题。现有 `/api/admin/upload/` 和原管理员登录流程保持不变。未显式选择 R2 时始终走旧 GitHub 上传。
>
> **状态区分**：GitHub PR 代码/CI 成功不等于 R2 实际开通。真正上传前还须在 Cloudflare 账户手动创建 R2 存储桶、绑定 Worker，并设置可访问的图片域名。不要在仓库里提交 R2 API Key。

## 两种后端上传通道

| 图床 | 触发条件 | 存储路径 | 写入权限 |
| --- | --- | --- | --- |
| GitHub（原有，默认） | 不提供 `provider` 或 `provider=github` | `src/assets/images/<YYYYMMDD>-<random>.<ext>` | 原 Worker Secret `FIREFLY_CONTENTS_TOKEN` |
| Cloudflare R2（新增） | 上传 FormData 包含 `provider=r2` | `firefly/YYYY/MM/DD/<UUID>.<ext>` | Worker 的 R2 bucket binding `FIREFLY_IMAGE_R2`，**无需 R2 Access Key** |

唯一上传入口仍是 `POST /api/admin/upload/`，文件字段 `file`。两种通道共用管理员 KV 会话、Origin 验证、PNG/JPEG/WebP/GIF 类型与文件头检查、4 MiB 文件限制和 5 MiB 请求限制。R2 上传成功返回 `{ ok:true, storage:"r2", imageUrl, path, filename, commitSha:null, commitUrl:null }`；GitHub 响应保留原有 `commitSha`，另外返回 `storage:"github"`。

正文源码模式的图片粘贴/拖入和可视化编辑器的图片上传共用后台的“新图片上传到”选项。默认 GitHub；选择 R2 只影响**当前页面的后续新上传**。历史 Markdown URL 不会被改写。R2 存储失败只显示错误，绝不静默切回 GitHub 写入，以免误判图片位置。

## Cloudflare 管理控制台必须做的配置

1. 在 **R2 对象存储**中新建独立存储桶，如 `firefly-images`。不要选用于私人草稿或其他站点备份的 R2 存储桶，不要清空旧图床。
2. 为该存储桶配置 **公共自定义域名**，例如 `img.0701000.xyz`（只是示例，必须实际绑定、验证 DNS/HTTPS 已生效）。**不要直接把当前仍用于其他图床的 `tu.0701000.xyz` 切换走**，否则老图床图片可能失效。生产环境优先使用单独的 R2 自定义域名。
3. 打开部署博客的 **Cloudflare Worker `firefly` → Settings → Bindings → Add binding → R2 bucket**，变量名填写 **`FIREFLY_IMAGE_R2`**，选择刚创建的真实存储桶。
4. 在 Worker 的变量中增加 **`FIREFLY_R2_PUBLIC_BASE_URL`**，值填写第 2 步真正可访问的 HTTPS 根 URL（例如 `https://img.0701000.xyz`），不要追加凭空猜测的对象目录，也不要提供私有 API Endpoint 或带 Access Key 的地址。
5. **先在独立预览/测试环境验证以上绑定，再考虑正式启用。** 已有 GitHub 上传无需新增配置。

**关于持续部署的重要限制**：当前 `.github/workflows/deploy-cloudflare.yml` 在部署时重建 `dist/server/wrangler.json` 然后执行 `wrangler deploy`。仅在 Cloudflare 控制台临时手动添加 R2 binding，不保证下一次 GitHub 自动部署后仍存在。请在确认 bucket 名称后，将 R2 binding 和公开 URL **作为可选配置纳入正式部署生成流程**，然后才进行生产启用；禁止为了启用 R2 强制创建不存在的 bucket、改动原有 KV、覆盖旧环境。此 PR 刻意不修改生产部署工作流，防止消耗额外 Cloudflare 构建/部署额度或破坏现有发布链。

## 验收与回退

- 先在独立 Worker 预览中确认匿名访问 `/api/admin/upload/` 返回 401，跨源携带有效 Cookie 的 POST 返回 403，非图片返回 415，超过大小限制返回 413。
- 登录后上传一张小 PNG 选择 R2，确认 HTTP 201 且 `storage=r2`、公开 `imageUrl` 返回 200 并确实显示图片；存储桶中应出现新的 `firefly/YYYY/MM/DD/<UUID>.png` 对象。
- 上传另一张小图片选择 GitHub，确认原始 GitHub Contents 写入和 commit SHA 仍工作；旧文章图片 URL 前后对比应一致。
- 移除 R2 绑定/公开 URL 时，R2 选择会得到 503，GitHub 默认上传依旧正常；**不对旧 R2 对象做删除或自动迁移**。
- 独立联调之前不能宣称 R2 已经能够对外正常上传或旧外链已经迁移。

### 权限与安全

上传接口经现有管理员登录 KV Session 和同源请求门禁保护。R2 的写权限来自 Worker binding，不能在前端或 GitHub 明文放置 Token。公开 URL 仅从 Worker 部署变量读取，要求 HTTPS 域名；上传端校验图片类型、字节数和魔数，不开放 SVG、HTML 或其他脚本内容。上传后的图片 URL 是公开可见资源，不适合保存私人草稿或敏感内容。
