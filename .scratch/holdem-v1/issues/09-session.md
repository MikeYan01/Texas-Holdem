# 09: Session

**What to build:** 把一手一手的 Hand 变成一"局"。打满五个 Orbit(三十手 Hand)之后进入结算屏,六个 Seat 按 Score 排名。中途有人输光了 Stack 就自动 Rebuy 继续打——**没有人会被淘汰离桌**,所以你不会在第八手破产然后干坐着看完剩下二十二手。

这一票兑现 ADR-0002 的那条不变量:任意时刻六个 Score 之和恒为零。它是本项目最重要的一条性质,也是这一票的主验证手段。

对手用脚本化策略即可完整验证,不依赖第 07、08 票。

**Blocked by:** 05

**Status:** ready-for-agent

- [x] 一个 Session 固定为五个 Orbit,即三十手 Hand
- [x] state 中可读出当前 Hand 序号与 Orbit 序号
- [x] **Stack 与 Score 是两个独立的量**:Stack 是当前 Hand 面前的有限筹码,Score 是整个 Session 的累计净胜负、可以为负
- [x] 任何 Seat 的 Stack 归零时自动 Rebuy 回起始 Stack 200,同时该 Seat 的 Score 等额减少
- [x] Rebuy 不设次数上限,任何 Seat 都不会离桌
- [x] Session 在第三十手 Hand 结算完毕后终止,**不因任何 Seat 破产而提前结束**
- [x] 结算屏显示六个 Seat 按 Score 从高到低排名
- [x] 界面把 Score 与 Stack 清楚地区分开显示
- [x] **属性测试(本票主验证)**:注入种子化 RNG 与随机合法行动,跑十万手 Hand,每手结束断言:
  - [x] 六个 Seat 的 Score 之和恒为 0
  - [x] 所有 Stack 非负
  - [x] 筹码总额守恒
- [x] 该属性测试在 Node 下运行,不需要浏览器
- [x] 任一断言失败时,失败的种子可被记录并原样复现

## Comments

**Session 长度从三十手(五个 Orbit)改为十二手(两个 Orbit)** —— 用户试玩后的决定:三十手一口气打太长。

spec、CONTEXT.md 与本票原文都写的是「五个 Orbit,即三十手」,已一并更新。**这条改动没有触碰任何规则**:仍然是整数个 Orbit,所以「一圈之内每个 Seat 各当过一次 Button、小盲、大盲」这条公平性仍然成立;Rebuy、零和、结算全部不变。

长度只存在于一个地方——`DEFAULT_CONFIG.handsPerSession`。开始屏、结算屏、顶栏计数与相关测试现在全部**从 config 推导**,不再各自写死数字,所以下次要改回三十手只改一个常量。

`handsPerSession % seatCount === 0` 现在是一条显式断言(engine.session.test.ts),防止有人把它设成不能整除 Orbit 的数。
