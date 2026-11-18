---
title: "Reqable Bridge"
published: 2026-11-18
draft: false
order: 90
description: "将 Windows Reqable 已完成的 HTTP 会话转发到 Android 端查看和管理。"
image: ""
status: "developing"
tags:
  - Windows
  - Android
  - Python
  - HAR
  - Network Debugging
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/reqable-bridge"
---

## 项目定位

Reqable Bridge 连接 Windows Reqable 与 Android 接收端，让已完成的 HTTP 会话能够跨设备查看、保存和导出。

## 工作方式

- Windows 桥接端配置 Reqable Report Server，并提供受认证的启动/暂停控制。
- Android 接收端接收已完成的 HTTP Session JSON，处理 Gzip 并保存到本地 SQLite。
- 手机端可以请求 Windows 桥接端开始或暂停 Reqable 捕获。

## 能力边界

这不是原始 TCP/IP 数据包镜像，而是对 Reqable 已完成 HTTP 会话的转发。Report Server 上传失败不会自动重试；接收端和控制桥接端需要在热点网络中可达。

## 当前状态

源码重建、Windows 桥接端测试和 Debug APK 构建有 CI 支持。目标设备上的热点连通性与端到端 HAR 转发仍需实机验收。
