# 私人草稿存储 API：阶段一（未接入现有编辑按钮）

本功能位于独立开发分支，不影响前台 UI。**当前版本只是受后台认证保护的存储 API，尚未把原有“保存草稿”操作改为写入私人 KV，也不会自动迁移任何历史文章。**

## 为什么需要独立存储

`07xh/Firefly` 目前是公开 GitHub 仓库。将草稿或带密码的 Markdown/MDX 文件提交到 `src/content/posts/`，会公开原始内容，`draft: true` 只能控制前台构建，不是机密保护。已公开的 Git 历史也不能通过简单删除当前文件恢复保密性。

这次新增 `FIREFLY_PRIVATE_DRAFTS` 独立 Cloudflare KV namespace。它只供后端 Worker 的已登录管理员 API 读写。**不能用现有 `FIREFLY_SESSIONS` 会话命名空间来存储文章**。

## 可选配置（仅在正式接入/测试前操作）

1. 在 Cloudflare KV 中新建一个独立命名空间，例如 `FIREFLY_PRIVATE_DRAFTS`。
2. 复制其 **Namespace ID**，在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 中创建 `FIREFLY_PRIVATE_DRAFTS_NAMESPACE_ID`，填写 32 位命名空间 ID。它不是访问密钥。
3. 下一次 `deploy-cloudflare.yml` 构建时，工作流将检查 ID 格式并在生成的 Worker 配置里加入 `FIREFLY_PRIVATE_DRAFTS` 绑定。如果没有设置变量，会维持原有部署配置。
4. 先通过预览环境和专用测试文章验证接口，确认成功后再实施编辑器接入。

此设置**不会自动修改或删除 GitHub 的旧草稿**，也不会修改现有网站布局、外观或文章渲染。

## API（后台登录后使用）

所有接口路径均为 `/api/admin/private-drafts/`，受到已有 `src/middleware.ts` 的会话校验。同源写请求需使用 `application/json`，响应不缓存。

| 操作 | 方式 | 说明 |
| --- | --- | --- |
| 草稿目录 | GET | 返回元数据、版本与分页 cursor，不返回正文 |
| 草稿详情 | GET ?slug=example | 返回指定私人草稿的原始完整内容 |
| 新建 | POST | `{ slug, content }`，其中 content 必须是有 `draft: true` 的完整 Markdown/MDX 源文 |
| 修改 | PUT | `{ slug, content, version }`，需要已有版本号 |
| 删除 | DELETE | `{ slug, version }`，需当前版本号 |

- slug 必须是单层安全文件名（字母、数字、连字符和下划线，支持中文）。
- 草稿最大为 500 KB（按 UTF-8 字节计算）。
- 如果没有绑定独立 KV，所有操作返回 503，**不会回退为公开 GitHub 写入**。
- 如版本号不一致，则返回 409，避免常见的误覆盖。
- KV 数据损坏时拒绝覆盖，避免误删原文。

## 重要限制

- Cloudflare Workers KV 是**最终一致性**存储：多地区间可能延迟同步；`get` + 版本号校验不是原子的比较交换，**不能保证并发编辑绝对安全**。单人单设备编辑基本适合，跨设备或多人并发应升级为 D1/Durable Objects/R2 原子版本控制。
- KV 不是自动版本备份。正式接入前必须实现独立备份/导出、恢复演练与意外删除保护。
- 正文中引用的公开图床图片仍然可能公开。私人图片需要另外的受保护媒体存储。
- 新 API 尚不承诺私密文章的前台密码页面或发布能力；这两项需要独立方案以保持前台 UI 不变。
- 不要用真实敏感资料做首次联调。若公开仓库已包含真实密码或隐私文本，应评估历史记录、Fork 和缓存暴露，更换已公开密码。

## 下一阶段门槛

1. 测试 Worker KV 绑定、未认证返回 401、已认证读写、异常重试和数据导出。
2. 设计将原有“保存草稿”改成私人存储的事务流程：先确认私有写入成功，再选择是否清理公开现有内容；失败不能丢原稿。
3. 实现正式发布的显式确认及私有稿清理流程；禁止把原稿密码直接写入公开 GitHub。
4. 测试完成后合并，不修改前台 CSS/HTML/组件，也不影响已有公开文章。
