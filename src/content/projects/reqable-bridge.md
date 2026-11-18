---
title: "Reqable Bridge"
subtitle: "跨设备网络调试"
published: 2026-11-12
order: 150
status: "developing"
description: "电脑用 Reqable 抓 HTTP 请求，手机接收已完成的会话和 HAR 记录；还能从手机控制电脑端开始或暂停抓包。"
repository: "07xh/reqable-bridge"
tags: ["Windows", "Android", "HAR"]
highlights:
  - title: "电脑抓包，手机查看"
    detail: "转发 Reqable 已完成的 HTTP 会话，不是原始 TCP/IP 镜像。"
    state: "verifying"
  - title: "手机保存调试记录"
    detail: "Android 接收端解析 HAR/Gzip 数据，保存到本地 SQLite。"
    state: "implemented"
  - title: "远程开始与暂停"
    detail: "通过手机控制 Windows 桥接服务，实机网络仍需验证。"
    state: "verifying"
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/reqable-bridge"
---

## 为什么做这个工具？

在电脑上用 Reqable 调试网络请求时，想离开电脑、在手机上继续查看记录会很不方便。Reqable Bridge 的目标是把**电脑已经捕获并完成的 HTTP 会话**送到 Android 接收端，而不是让手机重新抓一次包。

## 功能与使用场景

### 从 Windows 转发 HTTP 会话

Windows 桥接端连接 Reqable Report Server。Reqable 完成一条 HTTP 会话后，桥接服务将对应记录发给 Android 接收端；手机能够查看请求和响应相关信息。

### 手机本地记录

Android 端可以接收 HTTP 会话的 HAR JSON，处理 Gzip 压缩并把记录保存到 SQLite。适合在自己的设备之间回看调试会话，不需要把个人会话公开发布到网络上。

### 手机上控制电脑的捕获状态

手机端还可以请求 Windows 桥接服务开始或暂停 Reqable 捕获。这里的操作由电脑端执行，移动端只是控制入口。

## 连接方式

1. 在 Windows 上运行 Reqable 与桥接服务。
2. 让 Windows 与 Android 接收端处于可互通的热点网络。
3. 在 Android 端连接桥接地址，接收并查看已完成的会话，按需启动或暂停电脑端捕获。

## 当前限制与安全

本项目传输的是 Reqable **已完成的 HTTP 会话**，并非实时复制所有 TCP/IP 原始数据包。Report Server 上传失败不会自动重试。当前已有源码构建和 Windows 测试，但**热点连通性、实机接收和端到端转发仍未完成验收**。

HAR 里可能包含 Cookie、授权令牌和个人数据，应只用于自己有权限的调试，真实记录不要上传到公开仓库。
