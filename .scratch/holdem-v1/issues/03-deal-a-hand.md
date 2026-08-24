# 03: 一手牌能发完并显示出来

**What to build:** 第一次看得见的东西。打开页面,一张俯视的六人椭圆牌桌;点一下,六个 Seat 各拿到两张底牌,五张公共牌依次翻开,最强的牌赢走底池,Stack 相应变化。

**这一票不含任何下注** ——没有 check、没有 call、没有加注,底池只由固定投入构成。这是刻意的:它的真正任务是把引擎的 state 形状、reducer 契约、事件流,以及界面骨架**一次性钉死**,而不被下注规则的复杂度淹没。后面九张票都长在这一票定下的形状上。

**Blocked by:** 02

**Status:** ready-for-agent

- [x] `createSession(config)` 返回一个初始 state;`reduce(state, action)` 返回新 state。二者都是纯函数
- [x] state 是显式且可直接构造的:Seat 列表(含 Stack、底牌)、Button 位置、当前 Street、公共牌、底池、当前行动者、牌堆
- [x] 一手 Hand 依次经过 preflop、flop、turn、river 四个 Street,公共牌按 3/1/1 发出
- [x] Showdown 用求值器决出赢家,底池归赢家;打平则平分
- [x] **引擎从不 sleep、从不使用计时器**——推进由外部投递 action 驱动
- [x] RNG 由外部注入(返回 `[0,1)` 的无参函数);引擎内不出现 `Math.random`,并有检查保证
- [x] 洗牌用 Fisher-Yates;注入固定种子时,同一副牌堆可完全复现
- [x] 引擎**只吐结构化事件**,不含任何用户可见文案
- [x] 界面渲染六个 Seat 围成的俯视椭圆牌桌,CSS 定位,不使用 canvas
- [x] 界面显示:每个 Seat 的 Stack、Button 在谁那里、公共牌、底池金额、Player 自己的底牌
- [x] **整手 Hand 过程中看不到任何 Bot 的底牌**
- [x] 深色扁平视觉,牌面用高对比度符号,不用写实牌图
- [x] 界面文案为中文,引擎侧无文案(见 `AGENTS.md`)
- [x] 有测试直接构造一个中途 state 并断言 `reduce` 的结果,证明"可以从任意局面开始测"这条性质成立
