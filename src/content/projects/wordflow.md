---
title: "词序"
subtitle: "WordFlow"
published: 2026-11-09
order: 170
status: "测试版"
description: "把自己的单词表导入手机，通过 Android 通知复习。词库和学习记录保存在本机，不用云端账号。"
repository: "07xh/wordflow"
tags: ["Android", "SQLite"]
highlights:
  - title: "导入自己的词库"
    detail: "支持 TXT、CSV 导入与 CSV 导出，可编辑和搜索词条。"
    state: "implemented"
  - title: "通知里直接背词"
    detail: "「不会」「记住」「下一词」三个按钮，轮换间隔可调整。"
    state: "implemented"
  - title: "完整学习数据备份"
    detail: "JSON 备份包括词条、复习记录、排程和设置。"
    state: "implemented"
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/wordflow"
---

## WordFlow 是做什么的？

WordFlow 是一款**离线优先的 Android 通知背词工具**。你自己决定要背哪些单词，把词库导入后就能在通知中复习，不需要注册额外账号或连接云端服务。

## 主要功能

### 管理自己的单词表

- 支持 TXT、CSV 格式的词表导入，以及 CSV 导出。
- 在手机上新增、编辑、搜索和删除词条。
- 词库使用 SQLite 存储在本机，没有云端账号和联网权限。

### 不打开 App 也能复习

开始学习后，通知中显示当前词条，提供「不会」「记住」「下一词」三个操作。可以设置顺序、随机或难词优先，调整 **10～300 秒**的词条轮换间隔，以及只显示英文、中文、英中同时显示、先英文再显示中文等模式。

### 保存与恢复学习记录

设置页可以导出完整 JSON 备份，包括词条、学习记录、复习排程和设置。恢复时先校验文件并显示统计，再由用户确认；原有数据会留下本地安全副本。导入中断后的恢复保护也有自动化测试。

## 怎么开始

1. 在词库页面导入自己的 TXT 或 CSV 词表。
2. 设置展示方式、轮换间隔并开始通知背词。
3. 学习一段时间后，从设置页导出完整 JSON 备份；普通 CSV 导出**不包含完整复习历史**。

## 当前限制

采用简化的间隔复习逻辑，**不是完整 FSRS**。官方 Android Live Updates、OPPO 流体云/星河岛效果，以及 Android 真机中断恢复仍待验证。不同 CI 生成的 Debug 包签名可能变化，升级前请先备份。
