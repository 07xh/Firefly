---
title: "学序 · StudyFlow"
published: 2026-11-18
draft: false
order: 93
description: "基于 React、Tauri 2 与 Python sidecar 的 Windows 多学习平台统一客户端。"
image: "https://raw.githubusercontent.com/07xh/StudyFlow/main/packaging/icon.svg"
status: "developing"
tags:
  - Windows
  - React
  - Tauri
  - Python
  - Learning Platforms
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/StudyFlow"
---

## 项目定位

学序是面向个人学习场景的 Windows 桌面客户端，将知到、长江雨课堂、学习通和 U 校园等平台接入统一导航、账号入口和课程界面。

## 架构

- React 负责统一界面、导航和平台通用视图。
- Tauri 2 管理 Windows 桌面窗口与 Python sidecar 生命周期。
- Python adapter 负责平台会话、只读数据与本地配置适配。
- 原平台业务模块通过独立进程承载，避免把不同平台的执行逻辑混成一套模拟实现。

## 进度可信原则

本机播放器位置、任务进程状态、日志中的模拟片段和服务端已核验进度是不同证据。界面必须分别呈现，不能把本地事件或发送回执伪装成平台完成状态。

## 当前状态

知到、雨课堂等模块持续整合；学习通与 U 校园仍需真实账号端到端验收。CI 成功只说明代码和安装包构建通过，不代表所有平台登录、课程读取和服务端进度已经通过真机验收。
