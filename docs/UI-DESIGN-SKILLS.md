# UI 设计 Agent Skills（项目级安装）

本仓库以 Git 子模块固定 [Taste Skill](https://github.com/Leonxlnx/taste-skill) 与 [Impeccable](https://github.com/pbakaus/impeccable)，为 Codex / Claude Code 提供项目技能，不作为网站生产依赖。

## 首次启用

在本仓库根目录运行：

```bash
git submodule update --init --recursive
test -f .agents/skills/design-taste-frontend/SKILL.md
test -f .agents/skills/impeccable/SKILL.md
```

重启本地 Codex / Claude Code 会话即可读取项目下的 `.agents/skills/`、`.claude/skills/` 符号链接。Windows 环境建议 WSL 或支持符号链接的 Git；否则按上游 README 在本地 Agent skills 目录安装。默认不启用自动 Hook、Live Apply、外部下载执行或沙箱绕过；若要启用，必须单独审查脚本和权限。

## 固定上游版本

- Taste Skill：`12af471f627f866411b4bd785b19646d3672784c`，MIT 许可证，适合构思设计方向与界面重设计。
- Impeccable：`9fadc41729c38fd47d7ae622b501558653f9d2e9`，Apache-2.0 许可证，适合 `critique`、`audit`、`distill`、`adapt`、`polish`。

更新上游只能通过独立 PR 修改子模块的 gitlink，核查维护状态、兼容性和权限后再合并。不要自动拉取上游 main。

## Firefly 个人博客 使用边界

1. 保留 Astro 7 + Svelte 现有结构、蓝白品牌和长文阅读体验；先审查实际页面，不随意重置全站布局或替换主题。
2. 针对手机阅读、代码块、步骤图、目录和导航统一设计，不擅自改动文章事实、访问控制、部署配置或原有内容。
3. 只用 `pnpm` 管理站点；提交视觉改动前依照现有 AGENTS.md 运行 `pnpm check`、`pnpm type-check`、`pnpm build`，并附真实截图。
4. 不因安装技能直接发布文章、修改图片、触发生产部署或自动合并。

此安装不等于完成 UI 改版，也不能代替真实浏览器和功能回归验收。
