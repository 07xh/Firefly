---
title: "知到学习助手"
subtitle: "Windows 学习工具"
published: 2026-11-14
order: 140
status: "测试版"
description: "在 Windows 上统一查看知到课程、章节和最近的进度核验结果，保留登录、播放器与任务记录入口。"
repository: "07xh/zhidao-assistant"
tags: ["Windows", "WPF", "Python"]
highlights:
  - title: "课程总览与章节状态"
    detail: "课程卡片、章节详情和最近核验时间集中展示。"
    state: "implemented"
  - title: "多种登录入口"
    detail: "支持扫码、Cookie 导入等方式；真实连接要由服务器确认。"
    state: "verifying"
  - title: "播放与任务记录"
    detail: "保留原有播放器和运行记录，和服务器进度分开显示。"
    state: "implemented"
link:
  - label: "下载 Windows 测试版"
    value: "https://github.com/07xh/zhidao-assistant/releases/tag/v5.2.9-beta.2"
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/zhidao-assistant"
---

## 这个 Windows 工具可以做什么？

知到学习助手是一个独立的 Windows 桌面客户端，用来查看本人知到课程和章节状态，管理本机登录入口，并保留原版播放器与任务运行记录。它也是后来多平台客户端「学序 StudyFlow」的技术前身。

## 主要功能

### 课程和章节集中查看

课程总览把课程名称、章节详情和最近一次服务器核验状态整理在同一个窗口里。界面可按窗口宽度切换单列或双列课程卡片。

### 登录与账号管理

软件提供扫码、本人 Cookie 文本或文件导入、官方 WebView2 网页登录等入口。登录是否有效需由服务器只读检查确认；不能把软件显示“已导入”视为平台已登录。

### 保留原有播放器与运行记录

客户端保留官方 WebView2 播放器和原有任务进程的管理入口，记录本机播放位置与运行状态。**本机播放过某个位置**和**知到服务端已经记录完成**是两回事，界面会尽量区分，避免进度误判。

## 使用方式

1. 安装 Windows x64 测试版，进入设置与隐私选择登录方式。
2. 验证本人的平台会话后，进入课程总览并选择课程或章节。
3. 需要判断服务器是否更新时，查看最近一次核验时间和对应的服务器状态。

## 已知限制

这是非官方预发布版本。ZHS 0.1.5 依赖仍可能在本机以明文文件保存 Cookie，**不要把 Cookie 上传到 GitHub、聊天或公开日志**。CI 使用的模拟数据和界面测试不能代表真实平台账号已完成端到端验收。后续多平台统一接入以 StudyFlow 为主。
