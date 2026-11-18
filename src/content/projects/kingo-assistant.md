---
title: "KingoAssistant · 青果选课辅助"
published: 2026-11-18
draft: false
order: 89
description: "面向华北水利水电大学青果教务系统的 Windows 选课辅助客户端与协议研究项目。"
image: ""
status: "developing"
tags:
  - Windows
  - Python
  - HTTP
  - State Machine
  - NCWU
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/kingo-assistant"
---

## 项目定位

KingoAssistant 是面向个人使用的 Windows 青果教务选课辅助客户端，研究课程读取、会话状态、查询延迟和可靠的状态确认。

## 当前可用方向

- Windows 三页导航、桌面选课计划与只读监控。
- 离线选课计划预检与独立状态机测试。
- 分阶段记录等待、请求、解码、解析和总耗时。
- 超时后进入待核验流程，避免将不确定回执直接判为成功。

## 线上写入门禁

自动提交依赖四项证据门禁，每项都必须有哈希校验、有效期和对应证明材料。公开 README 当前记录为 **0/4 项已登记**，因此真实线上自动提交保持关闭。离线测试通过不代表学校端选课可用。

## 当前状态

当前重点是完成华水只读目录和真实字段验收；未完成的线上提交能力不会在项目页中标记为已交付。
