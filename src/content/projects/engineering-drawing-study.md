---
title: "绘序"
slug: engineering-drawing-study
subtitle: "DraftAI"
published: 2026-11-18
order: 96
description: "看三视图怎么投影，跟着步骤画圆弧和辅助线。"
status: "developing"
repository: "07xh/engineering-drawing-study"
image: "/project-media/draftai-projection.webp"
tags: ["工程制图", "几何求解", "JavaScript"]
link:
  - label: "GitHub"
    icon: "fa7-brands:github"
    value: "https://github.com/07xh/engineering-drawing-study"
---

## 点的三面投影

输入空间点坐标，观察正面、水平面和侧面投影之间的位置关系。这个基础工具用于理解 V / H / W 三视图怎样相互对应，不需要先猜出整个复杂立体的样子。

## 圆弧连接与辅助作图

在部分已支持的几何条件下，可以调整尺寸、查看圆心、切点以及构造过程中用到的辅助线。目标是让每条线有明确来源，而不是只给出最后一张完成图。

## 逐笔作图工作台

项目已包含受限题型的几何求解和 V5 动态作图主链，按几何结果组织绘制步骤。暂停、速度和回退等工作台能力属于持续开发、整合与验证的范围，不能把演示功能等同于完整题型覆盖。

## 还在推进的完整解题流程

长远目标是“题图导入 → 条件确认 → 数学求解 → 逐笔演示”。任意陌生图片的自动识别、通用解题、完整文件导入导出及真机验收目前尚未全面完成。遇到欠约束、冲突或不支持的题型，应明确提示，而不是生成看似正确的动画。
