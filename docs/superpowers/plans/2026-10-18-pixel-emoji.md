# 彩色像素表情 Implementation Plan

> **For agentic workers:** Use the test-driven implementation steps below in the current clean checkout. Request read-only code review before publication.

**Goal:** 将用户已确认的所有内置表情统一为保留原色的像素点阵，支持普通文字、营业状态、快捷按钮、离线和滚动。

**Architecture:** 保留现有 Twemoji 原始 SVG 与组合表情识别。浏览器按需在 12×12 原生网格采样，裁掉低透明度边缘并简化颜色，再以整数像素绘制放大点阵。图形像素数据全局复用，每个已用表情在显示画布只缓存当前尺寸的一张点阵图；滚动帧不重复读回像素。按钮复用同一采样结果生成小图，CSS 最近邻放大。

**Tech Stack:** 原生 JavaScript、Canvas 2D、Node 单元测试、Playwright / Chrome。

## 本地验收记录

- 新单元测试先以缺少 pixelCells 失败，浏览器测试先以缺少 pixelURL 失败；实现后 33 项单元测试全部通过。
- 像素渲染测试通过：12×12 采样、透明边缘裁切、量化彩色、点阵间隙、按钮小图、禁缩放平滑、静态异步加载。
- 审查指出分数坐标导致外框半透明。回归先复现 DPR 1/1.25/1.5 分别出现 8/12/16 个半透明像素；修复最终绘制坐标与尺寸对齐设备像素后，DPR 1/1.25/1.5/2 均为 0。
- 缓存测试：重复滚动不创建画布；字号及 DPR 变化替换并释放旧画布；最多保留 32 个大图，淘汰后可由已缓存的微型源像素恢复。上限测试先以 34 != 32 失败，添加 LRU 后通过。
- pixel-emoji-browser、business-browser、browser、update、wake-browser 均通过；PWA 断网与单文件零网络通过。
- upgrade：71d372c / v1.3.0 → v1.3.1，保留旧文字，断网奶龙与像素营业图标通过。
- 936/780/640 横屏截图已检查；独立只读复审未发现剩余需修复问题。真机仍需用户在坚果 Pro 3 上确认。

## Task 1：采样与渲染

Files: emoji.js, app.js, tests/emoji.test.cjs

- [ ] 写失败测试：透明边缘、颜色量化、固定网格坐标与纯色保留；执行 node --test tests/emoji.test.cjs，确认新增接口未实现。
- [ ] 实现 pixelCells、共享采样 Promise、按钮小图 URL、按尺寸缓存点阵画布；不调用外部资源，不改组合表情匹配。
- [ ] 主画布使用同文字一致的 .72 点阵占比；整数设备像素边界、关闭缩放平滑，不修改文字排版和计时/常亮/奶龙。
- [ ] 单元测试通过。

## Task 2：界面与离线

Files: app.js, styles.css, index.html, package.json, sw.js, LICENSES/Twemoji-NOTICE.md, README.md

- [ ] 图标按钮使用同一离线像素版本；提示文字更新为像素表情。
- [ ] 版本及 SW 缓存升为 1.3.1。许可说明原始素材未改、运行时生成了像素风展示。
- [ ] node scripts/build.mjs 同时更新单文件；不增加素材库体积。

## Task 3：验收与发布

Files: tests/pixel-emoji-browser.cjs, tests/upgrade.cjs

- [ ] 新浏览器测试先验证旧渲染不满足：像素小图、点阵间隙、无平滑颜色、采样/缩放缓存、单色文字不干扰彩色表情。
- [ ] 测试普通文字/营业状态、七状态、3 横屏尺寸、静态加载后刷新、滚动、PWA 断网与 file:// 零网络。
- [ ] 执行 node --test tests/*.test.cjs 与原 business-browser / update / wake-browser 回归；视觉检查截图。
- [ ] 验证 1.3.0 → 1.3.1 旧缓存升级、设置保留、断网表情。
- [ ] 请求只读代码审查并处理问题；git diff --check，提交与推送；确认 Pages 构建和线上像素表情。
- [ ] 更新离线包并发布 v1.3.1；告知用户关闭旧标签页重开，不清数据。
