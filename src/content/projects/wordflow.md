---
title: "词序 · WordFlow"
published: 2026-11-18
draft: false
order: 91
description: "离线优先的 Android 通知背词应用，支持本地词库、快捷复习与完整数据备份。"
image: ""
status: "published"
tags:
  - Android
  - Kotlin
  - SQLite
  - Vocabulary
link:
  - label: "GitHub 源码"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/wordflow"
---

## 项目定位

WordFlow 是一个离线优先的 Android 通知背词工具，使用本地 SQLite 保存词库和学习状态，不依赖云端账号。

## 已实现能力

- 词条新增、编辑、搜索和删除。
- TXT、CSV 词库导入与 CSV 导出。
- 通知快捷操作：不会、记住、下一词。
- 顺序、随机和难词优先等出词模式。
- 完整 JSON 备份与恢复，包含词条、学习记录、复习排程和设置。
- 恢复前校验、原子安全副本与中断恢复保护。

## 明确限制

项目不宣称实现完整 FSRS；Android 官方 Live Updates 与 OPPO/星河岛适配仍未验收。CI 的 Robolectric 测试不能替代 Android 16 真机测试。升级前建议先导出完整 JSON 备份。
