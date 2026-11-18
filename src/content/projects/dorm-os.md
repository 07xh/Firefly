---
title: "校序"
subtitle: "Academic OS"
published: 2026-11-09
order: 200
status: "测试版"
description: "把课表、任务、教务与校园信息放进同一个学习空间。"
repository: "07xh/dorm-os"
tags: ["Android", "Kotlin", "Cloudflare"]
image: "/project-media/dorm-os-tablet.webp"
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/dorm-os"
---

## 课程与任务

Android 应用提供总览、课表、任务、教务和个人页面。课表支持本地导入、离线查看和手动更新。

## 数据连接

青果、学习通和第二课堂使用独立的数据连接。各平台的首次登录与真实账号验收以仓库记录为准。

## 技术实现

Android 端采用 Kotlin，网站作为辅助入口，使用 Cloudflare Pages、Functions 和 D1。

截图来自校序仓库的 268 号界面验证记录，展示 Android 模拟器中运行的应用总览页。

[查看截图及验证记录](https://github.com/07xh/dorm-os/tree/c4ad22d1038847e9fdeda3f2cd98d24bbdbd70b5/apps/xiaoxu-android/docs/ui-verify/268)
