---
title: "知到学习助手"
published: 2026-11-18
draft: false
order: 88
description: "知到平台的 Windows 桌面学习工具，是后续 StudyFlow 多平台架构的技术前身。"
image: ""
status: "published"
tags:
  - Windows
  - WPF
  - PowerShell
  - Python
  - Learning
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/zhidao-assistant"
  - label: "更新记录"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/zhidao-assistant/releases"
---

## 项目定位

知到学习助手是独立的 Windows x64 桌面工具，围绕知到平台的登录、课程读取、播放器与任务运行记录展开。后续统一多平台 UI 与架构由 StudyFlow 承接。

## 主要能力

- 提供扫码登录、Cookie 文本或文件导入等登录入口。
- 课程总览、课程详情和真实数据读取诊断。
- 保留官方 WebView2 播放器与原版 ZHS 任务进程。
- 将本机播放器位置、任务进程状态、日志和服务端只读核验分开显示。
- 提供退出登录、清除本地学习数据和查看开源许可等管理入口。

## 安全提示

公开 README 说明 ZHS 0.1.5 仍会在用户目录中以明文保存 Cookie，尚未实现 DPAPI 加密。请勿把真实 Cookie 放入 Issues、聊天或日志；本地文件应按凭据妥善保护。

## 项目沿革

该仓库保留独立版本与历史功能；新功能和多平台统一架构以 StudyFlow 仓库为准。
