---
title: "学序"
subtitle: "StudyFlow"
published: 2026-11-17
order: 190
status: "测试版"
description: "在 Windows 上看知到、雨课堂、学习通和 U 校园的课程。"
repository: "07xh/studyflow"
tags: ["Windows", "React", "Tauri", "Python"]
link:
  - label: "下载 Windows 测试版"
    value: "https://github.com/07xh/StudyFlow/releases/tag/v0.1.1-rc.42"
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/studyflow"
---

## 一个客户端，多个学习平台

把知到、雨课堂、学习通和 U 校园放在同一套 Windows 桌面界面里。左侧是紧凑的平台导航，各平台保留自己的登录、课程和设置入口，不必用完全不同的窗口来找功能。

## 课程和章节怎么查看

各平台的适配器负责读取自己的课程、章节和学习任务；界面使用统一的课程列表和状态展示方式。课程能否成功同步取决于对应平台的实际授权与接口状态。

## 播放、运行与进度分开看

在知到和雨课堂模块中，原有业务任务由独立进程运行。界面将本地播放器位置、任务运行记录和服务端核验状态区分显示，避免把“本地播放过”误写成“平台已经完成”。

## 测试版的边界

Windows 安装包的构建、课程接口的接入、真实账号登录和平台进度核验是不同的验收环节。尤其 U 校园仍有实验性模块需要真实账号验证；具体可用范围以 GitHub 当前版本和对应平台说明为准。
