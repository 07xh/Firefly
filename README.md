# 07xh Space

个人网站，用来展示正在做的软件项目，也记录开发过程和学习笔记。

**[访问网站](https://0701000.xyz/)** · [项目](https://0701000.xyz/projects/) · [博客](https://0701000.xyz/posts/) · [GitHub](https://github.com/07xh)

## 网站内容

网站以项目为主，博客是其中的一部分。

- **首页**：简短介绍网站，并提供项目与博客入口。
- **项目页面**：每个重点项目有独立页面，向下阅读功能与实现说明；在支持的设备上可左右切换项目，也可以使用页面导航。
- **公开仓库**：项目列表可从 GitHub 获取公开仓库信息，不展示私有仓库。公开仓库数据通过服务端接口读取并缓存。
- **博客与学习笔记**：记录开发问题、技术实践，以及 Python、工程制图等学习内容。

## 重点项目

| 项目 | 简介 | 项目页面 |
| --- | --- | --- |
| **校序 · Academic OS** | Android 校园学习工具，围绕课表、教务与作业管理持续开发 | [查看](https://0701000.xyz/projects/dorm-os/) |
| **学序 · StudyFlow** | Windows 多学习平台客户端，整合课程、章节与进度查看 | [查看](https://0701000.xyz/projects/studyflow/) |
| **MomoFlow** | 在 Android 通知中查看待复习单词的实验项目 | [查看](https://0701000.xyz/projects/momoflow/) |
| **绘序 · DraftAI** | 工程制图辅助学习，展示投影、圆弧及辅助线的作图过程 | [查看](https://0701000.xyz/projects/engineering-drawing-study/) |

更多项目及其 GitHub 仓库见 [项目列表](https://0701000.xyz/projects/)。部分项目仍在开发或测试，实际可用功能、构建与发布状态以对应仓库为准。

## 技术实现

- **前端**：Astro 7、TypeScript、Tailwind CSS，部分交互使用 Svelte。
- **内容**：项目介绍与博客文章保存在仓库中，通过 Astro 生成对应页面。
- **数据**：公开 GitHub 仓库列表通过 `/api/portfolio/repositories.json` 获取；接口只返回公开仓库信息，并设置短时缓存。
- **部署**：项目包含 Cloudflare 适配器和服务端 API。项目内容页与动态接口采用不同的渲染方式，不能把它理解成所有内容都实时从 GitHub 更新。

主要代码位置：

```text
src/
├── pages/index.astro          # 个人网站首页
├── pages/projects/            # 项目列表、独立详情页
├── pages/api/portfolio/       # 公开仓库接口
├── content/projects/          # 项目介绍
├── content/posts/             # 博客文章
├── components/portfolio/      # 项目展示组件
└── config/                    # 网站配置
```

## 本地开发

需要 Node.js 22.23+ 和 pnpm 11（以仓库 `package.json` 为准）。

```bash
pnpm install
pnpm dev
```

常用检查与构建命令：

```bash
pnpm check
pnpm type-check
pnpm build
```

站点名称、域名与页面配置见 `src/config/siteConfig.ts`，重点项目顺序见 `src/config/portfolioConfig.ts`。

## 来源与许可

本项目起初基于 [Firefly](https://github.com/CuteLeaf/Firefly) 博客主题进行修改；Firefly 基于 [Fuwari](https://github.com/saicaca/fuwari) 开发。感谢原作者与贡献者。

本仓库保留原项目的 MIT 许可证及相应版权声明，详见 [LICENSE](./LICENSE)。使用或再分发相关代码时，请遵守许可证要求并保留必要的版权与许可信息。

---

网站仍在持续调整。这里展示的是实际项目、代码和学习记录，而不是原版 Firefly 主题的演示站。
