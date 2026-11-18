---
title: "07xh Space · 个人数字空间"
slug: firefly
published: 2026-11-18
draft: false
order: 100
description: "基于 Astro 与 Cloudflare 的个人数字空间，使用 CuteLeaf/Firefly 作为上游模板并进行持续定制。"
image: ""
status: "developing"
tags:
  - Astro
  - TypeScript
  - Cloudflare
  - Personal Website
link:
  - label: "我的源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/Firefly"
  - label: "上游模板"
    icon: "fa7-brands:github"
    value: "https://github.com/CuteLeaf/Firefly"
---

## 项目定位

07xh Space 是个人数字空间，用于展示公开软件项目、技术研究、学习笔记与开发记录。它不再把首页限制为单一文章列表，而是把项目展示、博客、知识专题和个人介绍组织为独立入口。

## 本轮重构方向

- **首页双轴浏览**：左右切换不同公开项目，上下阅读当前项目的背景、功能方向和开发状态。
- **项目数据来源**：通过服务端公开接口读取 GitHub 公共仓库；不使用具备私有仓库权限的 Token，私有仓库不会进入前端数据。
- **项目档案**：为重点项目提供独立说明页，展示技术路线、已实现范围和明确的未完成项。
- **内容分区**：博客负责文章阅读，知识专题负责体系化内容，关于页负责站点和作者介绍。
- **响应式交互**：分别适配桌面、平板和手机，提供键盘、触摸和项目索引导航。

## 技术基础与来源

本站基于 Astro 构建，并以 Cloudflare 作为部署运行环境。网站主题与部分既有能力来自 [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly)，本仓库是其 Fork；本项目的定制开发与上游模板保持清晰区分。

## 当前状态

双轴首页、公开项目接口、博客与知识专题入口正在独立分支开发。**本轮改造尚未合并到主分支，也尚未部署到生产站点**；构建通过只表示代码可构建，不代表线上页面已经更新。
