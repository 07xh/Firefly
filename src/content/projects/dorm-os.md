---
title: "校序 · Academic OS"
published: 2026-11-18
draft: false
order: 95
description: "面向个人校园学习场景的 Android 学业操作系统，整合课表、任务与校园信息。"
image: "https://raw.githubusercontent.com/07xh/dorm-os/main/apps/xiaoxu-android/docs/ui-verify/268/home-393dp-imported.webp"
status: "developing"
tags:
  - Android
  - Kotlin
  - Cloudflare
  - 学业管理
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/dorm-os"
---

## 项目定位

校序是个人学业操作系统。当前产品主入口是原生 Android App，网站承担共用后端和辅助入口，目标是把课程、任务、考试与校园信息组织成连续的个人工作流。

## 核心方向

- **学业总览**：课表、课程任务、截止时间和通知的统一入口。
- **数据连接**：通过独立授权连接青果教务、学习通和第二课堂。
- **本地优先**：保留本地课程、离线查看、手动更新与数据备份能力。
- **统一体验**：各平台复用一致的导航、卡片、状态和错误反馈规范。

## 当前边界

仓库代码中已有多个连接器和后端模块，但学校平台的真实登录、课程与任务读取仍须按真实账号逐项验收。不能把适配器存在、CI 通过或网站部署成功当作本人账号已连接。校园跑等扩展也以只读接入和明确授权为边界。

## 技术基础

Android 原生应用与 Cloudflare Pages Functions、D1 等服务端能力协作。具体版本和验收状态以仓库 README、开发规范及最新 CI 为准。
