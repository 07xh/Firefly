---
title: "MomoFlow · 墨墨流云助手"
published: 2026-11-18
draft: false
order: 92
description: "围绕墨墨背单词通知、今日词表、离线释义和前台反馈验证开发的 Android 工具。"
image: ""
status: "developing"
tags:
  - Android
  - Kotlin
  - Notifications
  - Offline Dictionary
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/MomoFlow"
---

## 项目定位

MomoFlow 研究如何把每日词汇、释义和快捷反馈组织成更连贯的 Android 通知体验。

## 当前功能方向

- 读取官方开放数据并保留现有通知与前台反馈。
- 使用离线词典补充音标和中文释义。
- 在用户明确触发并授权的前台流程中，尝试对当前词条进行一次受控交互。
- 返回应用后通过官方只读数据核对反馈结果。

## 安全与真实性边界

Cortex 私有写回协议仍缺少完整认证、请求结构、checkpoint 生命周期和服务端回读证据。发送器保持阻断，不发送未验证的私有请求。无障碍操作被系统接受也不等于服务端记录已经更新。

## 当前状态

公开 README 标注 v0.5.5 为受控前台反馈实验版；真实墨墨 UI、ColorOS 通知表现和端到端服务器结果仍需目标设备验收。
