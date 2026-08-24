# 01: 项目脚手架

**What to build:** 一个能跑起来的空壳。`npm run dev` 打开浏览器能看到页面,`npm test` 能跑测试并通过。这一票不产生任何德扑功能,它的价值是把后面十二张票赖以存在的地基和边界立起来——尤其是引擎的零依赖边界:此后任何人往引擎里 import React 或访问 `window`,应该立刻有东西报警。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] TypeScript + Vite + React 项目可以 `npm run dev` 启动并渲染一个页面
- [ ] Vitest 可以 `npm test` 运行,且至少有一条真实通过的测试
- [ ] 源码分为若干模块目录,至少区分出「引擎」与「界面」两侧
- [ ] 存在一条自动化检查,能阻止引擎侧 import 界面框架、DOM API、`window`、网络或计时器(lint 规则或依赖边界检查皆可),并有一个故意违规的例子证明它确实会失败
- [ ] 引擎侧的测试可以在 Node 环境下运行,不需要浏览器或 jsdom
- [ ] `phe` 作为 **dev 依赖**安装,并有一条测试证明它可被导入(它只用于后续的差分测试,永远不进运行时)
- [ ] README 或等价位置写明如何启动、如何测试
