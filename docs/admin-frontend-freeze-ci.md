# Firefly 后台专属 PR：前台文件冻结检查

适用分支：私人草稿、D1/R2、图床后台、安全修复、后台状态和后台专属 CI/文档分支。

`.github/workflows/build.yml` 的 **Astro Check for Node.js 22/23** 在运行测试前会执行 `scripts/check-admin-only-changes.mjs`。它比较 PR 与目标分支（通常 `master`）的文件变化：

- **禁止**：博客公开页面、组件、布局、主题样式、公开文章内容、静态资源、网站配置（例如 `astro.config.mjs`、`src/data/settings.json`、`package.json`）发生改动。
- **允许**：`/admin` 后台、`/api/admin`、登录 API、服务端模块、数据库迁移、测试、GitHub Actions 配置、开发文档。
- 一旦发现禁止改动，CI 直接失败并列出文件路径。不能以构建成功代替这项检查。

## 风险边界

1. 这是**文件路径级**冻结，不是自动截图像素对比。改动后台的共享服务端模块仍可能影响前台行为，需要后续 E2E 与页面快照验证。
2. 目前仅特定后台分支名称触发检查，其他类型 PR 的前台改动不能被这项规则拦截；若以后需要强制保护所有分支，应在仓库规则集中添加更广的保护。
3. 本策略不执行部署，不修改主分支，也不会自动合并草稿 PR。
4. 如果前台确实需要功能变更，必须另建专用 PR 并明确授权，不能偷偷混入后台 PR。

开发验证命令：`node --test scripts/check-admin-only-changes.test.mjs`。GitHub PR 中自动对比的前提是 Checkout 保留完整 Git 历史。

## 当前前台承诺

保持 `0701000.xyz` 现有前台 UI、样式、主题、导航和公开文章内容不变。所有工作在独立开发分支，PR 经真实 Cloudflare 预览环境验收再决定是否上线。
