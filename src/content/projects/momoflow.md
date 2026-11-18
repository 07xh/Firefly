---
title: "MomoFlow"
subtitle: "Android 通知背词"
published: 2026-11-18
order: 180
status: "测试版"
description: "在 Android 通知里看墨墨待复习的单词。"
repository: "07xh/MomoFlow"
tags: ["Android", "Kotlin"]
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/MomoFlow"
---

## 把当天单词带到通知栏

通过墨墨的公开 API 读取本人当天词表，在 Android 展开式通知中查看单词，不必每次打开完整的单词列表。数据取自真实账号授权，不使用虚构的背词进度。

## 释义与本地缓存

通知可以使用本机缓存的释义辅助查看；离线词典的内容不保证与墨墨应用内的释义完全一致。项目保留 Token 的本地加密存储，不要求把账号凭据提交到公开仓库。

## 认识、模糊、忘记：反馈验证

通知里的反馈入口可以启动一次受控验证：读取官方记录基线，打开墨墨应用完成对应操作，再回到 MomoFlow 核对学习记录。部分版本还有需要用户单独授权的前台辅助尝试，它与服务器实际提交结果并不是一回事。

## 目前没有完成的功能

墨墨私有 Cortex 接口的认证、请求体和回读闭环仍未完成；不能把通知按钮或前台点击直接称为“已经修改官方记忆进度”。ColorOS 原生流体云的完整按钮展示也需要真实设备验收。
