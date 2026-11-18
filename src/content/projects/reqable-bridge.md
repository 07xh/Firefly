---
title: "Reqable Bridge"
subtitle: "跨设备网络调试"
published: 2026-11-12
order: 150
status: "developing"
description: "把 Windows 上完成的 Reqable 抓包记录转到 Android 查看。"
repository: "07xh/reqable-bridge"
tags: ["Windows", "Android", "HAR"]
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/reqable-bridge"
---

## 跨设备查看

Windows 端转发已完成的 HTTP 会话，Android 接收端读取 HAR 并用 SQLite 保存记录。

## 采集控制

手机可向经过认证的桥接端请求启动或暂停。设备之间需要有可达的网络连接。
