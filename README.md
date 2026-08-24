# Texas

网页版单机德州扑克:一名 Player 对五个 Bot,两个 Orbit(十二手 Hand)决出 Score 排名。
纯前端、无后端、无真钱。术语一律以 [`CONTEXT.md`](CONTEXT.md) 为准。

## 跑起来

```sh
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建,产物在 dist/
npm run preview  # 预览生产构建
```

## 测试

```sh
npm test              # 全部测试,含穷举验证(慢,约 1 分钟)
npm run test:fast     # 只跑快的那批,开发时用这个
npm run test:slow     # 只跑慢的那批(穷举求值器、十万手 Hand 属性测试)
npm run typecheck     # tsc
npm run check:boundary # 引擎边界检查(见下)
npm run check:all     # 上面三样一起跑,CI 用这个
```

慢测试的文件名是 `*.slow.test.ts`,`test:fast` 会跳过它们。它们必须进 CI:
穷举验证是"自己写求值器"(ADR-0004)这个决定的全部依据,零和属性测试是引擎的主验证手段。

## 目录

| 路径 | 是什么 |
| --- | --- |
| `src/poker-math/` | 求值器与 Equity。纯计算,无状态。**引擎侧** |
| `src/engine/` | 纯状态机:`createSession` / `reduce`。**引擎侧** |
| `src/bots/` | Bot 决策函数。**引擎侧** |
| `src/ui/` | React 渲染层。所有中文文案只存在于这里 |
| `scripts/` | 离线脚本:翻牌前 Equity 表生成、引擎边界检查 |

## 引擎边界

ADR-0001 要求引擎侧是零依赖的纯模块。`npm run check:boundary` 是这条约束的自动化守卫,
它扫描 `src/poker-math`、`src/engine`、`src/bots`,在下列情形下失败:

- import 任何非相对路径的模块(即任何依赖)
- 相对 import 逃出引擎侧(例如 `../ui/...`)
- 访问 `window`、`document`、`navigator`、`localStorage` 等 DOM/浏览器 API
- 使用 `fetch`、`XMLHttpRequest`、`WebSocket`
- 使用 `setTimeout`、`setInterval`、`requestAnimationFrame` 等计时器——**引擎从不 sleep**
- 使用 `Math.random`、`Date.now`、`new Date`、`performance.now`、`process.*`
  ——随机源与时钟必须注入,否则失败的测试无法复现

`scripts/fixtures/engine-boundary-violation/` 里放着六个故意违规的例子,
`scripts/engine-boundary.test.mjs` 断言检查器确实会抓到它们——守卫本身也要被守卫。

检查跳过 `*.test.*`:测试合法地 import 测试框架,而需要保持纯粹的是会被打包进产物的引擎代码。

## `phe`

`phe` 只是 **dev 依赖**,用于对我们自己的求值器做差分测试(ADR-0004),永远不进运行时。
`src/types/phe.d.ts` 补上了它缺失的类型声明。`npm run build` 之后 `dist/` 里不含 `phe`。

## 翻牌前 Equity 表

`src/poker-math/preflop-equity-table.json` 是**生成的数据**,不是转录的。生成方式:

```sh
node scripts/generate-preflop-table.ts   # 845 格,约 118 秒
```

169 个规范起手牌 × 1–5 名对手,每格用**本项目自己的求值器**跑 200,000 次种子化蒙特卡洛,
最坏情况 1σ 误差约 0.112%。种子固定,重跑逐字节复现。
**没有转录任何出自版权书籍的表格**(ADR-0005)。

实测值:AA 单挑 85.09%、KK 单挑 82.39%、AKs 单挑 66.81%、AA 六人 49.26%。

## 实测性能

| | Node v26.7 | 浏览器(Chromium) |
| --- | --- | --- |
| 翻牌 2000 次迭代(六人) | 3.45 ms | 1.30 ms |
| 五个 Bot 各算一次 | 9.36 ms | 6.60 ms |
| 翻牌前查表 × 1000 | — | 0.00 ms |
| 河牌精确枚举(990 手) | — | 0.10 ms |
| `evaluate7` | 约 410 万次/秒 | 约 600 万次/秒 |
| 穷举全部 133,784,560 手牌 | 24.6 s | — |
| 十万手 Hand 属性测试 | 4.9 s | — |

浏览器不比 Node 慢,五个 Bot 合计仍在一帧(16.7 ms)之内——spec
「已知的不确定性」里那条待验证项已经验过了。

## 与 spec 不一致的一处

河牌的精确枚举是 **C(45,2) = 990**,不是 spec 与 ADR-0005 写的 C(44,2) = 946:
已知牌是七张(底牌两张 + 公共五张),剩 45 张未知。按 946 枚举会漏掉 44 种可能。
代码按 990 实现,详见 `.scratch/holdem-v1/issues/06-equity.md` 的 Comments。
