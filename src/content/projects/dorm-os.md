---
title: "校序"
subtitle: "Academic OS"
published: 2026-11-09
order: 200
status: "测试版"
description: "在手机上看课表、查教务、记作业。"
repository: "07xh/dorm-os"
tags: ["Android", "Kotlin", "Cloudflare"]
image: "/project-media/dorm-os-tablet.webp"
link:
  - label: "下载 Android 版"
    value: "https://github.com/07xh/dorm-os/releases/tag/xiaoxu-android-v0.8.14"
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/dorm-os"
---

## 课表：本地导入，离线查看

从本机导入课表后，即使没有网络也能查看已有课程。课表采用手动更新方式，避免在校园平台尚未连接成功时显示虚构的实时数据。导入识别结果仍需按实际课程核对。

## 任务：课程之外要做的事

把个人任务集中记录，支持任务整理和状态管理。项目同时保留了原有的本地数据能力与云端个人任务相关实现；不同来源的数据是否已经成功同步，应以实际连接结果为准。

## 我的 → 数据连接

教务、学习通与第二课堂分别通过独立连接入口管理。仓库已经包含相应的登录适配与会话代码，但“写有连接器”不等于学校账号已真实接通；课表、作业、活动与积分都需要本人账号逐项验收。

## 当前能用到哪一步

原生 Android 五个主要页面和离线课表流程是现阶段的重点。青果真实教务、学习通待办、第二课堂积分等跨平台数据仍处于接入与验证中。下载前可到 GitHub 查看最新版本和已知问题，不把构建成功当作所有平台已可用。
