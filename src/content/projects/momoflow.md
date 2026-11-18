---
title: "MomoFlow"
subtitle: "Android 通知背词"
published: 2026-11-18
order: 180
status: "测试版"
description: "把墨墨当天要复习的单词显示在 Android 通知里，不进入 App 也能查看词条；反馈仍通过墨墨本身确认。"
repository: "07xh/MomoFlow"
tags: ["Android", "Kotlin"]
highlights:
  - title: "同步当天的待复习单词"
    detail: "使用墨墨开放 API 读取本人今日词表。"
    state: "implemented"
  - title: "通知看词与释义"
    detail: "展开通知浏览单词，离线词典释义仍需设备验收。"
    state: "verifying"
  - title: "核对记忆反馈"
    detail: "从通知进入墨墨反馈，再对照官方学习记录；自动反馈仍在实验。"
    state: "verifying"
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/MomoFlow"
---

## MomoFlow 和普通背词 App 有什么不同？

它不是重新做一套陌生词库，而是围绕你在**墨墨背单词**里当天需要学习的词条，尝试用 Android 通知提供更快捷的查看入口。

## 它可以做什么

### 把今日词条带到通知里

连接个人墨墨开放 API 后，读取当天未完成的单词，展示在 Android 通知中。展开后可在通知内查看当前词；通知和本地操作不会被当成墨墨服务器已完成记录。

### 为通知补充释义

项目支持从本地词典准备中文释义和音标，减少每次打开 App 才能看释义的次数。不过词典构建、具体设备上的通知显示效果仍需验收，离线词典和墨墨官方释义也可能不同。

### 反馈后检查结果

通知提供「认识 / 模糊 / 忘记」的验证入口：可以打开墨墨原 App 操作，再返回 MomoFlow 查看同一词条的官方记录是否发生符合预期的变化。较新版本还有**用户主动授权的单次前台反馈实验**，但实际成功与否必须通过墨墨官方记录核实。

## 首次使用

1. 在墨墨官方 App 内准备自己的开放 API 授权。
2. 在 MomoFlow 中连接账号、同步今日词表。
3. 查看通知，或按需进入官方 App 完成反馈，再返回查看记录。

## 当前明确限制

- 不能宣称已经完成墨墨的私有 Cortex 接口后台写回；该发送器仍处于阻断状态。
- Android 无障碍点击被接收不代表墨墨服务器已记录。
- ColorOS 原生流体云、三按钮显示和一加设备真机效果仍需要独立验收。
