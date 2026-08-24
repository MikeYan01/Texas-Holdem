# Texas

一个网页德州扑克游戏:一名 Player 对五个 Bot,十二手牌决出 Score 排名,单机运行,没有真钱。

## Language

### 游戏形态

**No-Limit Hold'em (NLHE)**:
本项目唯一的变体与下注结构。无限注意味着任何一次行动都可以推入自己面前的全部筹码。
_Avoid_: 德扑, poker, Hold'em(单独使用时不明确下注结构)

### 牌桌上的角色

**Seat(座位)**:
牌桌上六个固定位置之一,持有筹码并在轮到时行动。人类和 bot 都占据一个 Seat。
_Avoid_: position(见下,含义完全不同)、slot

**Player(玩家)**:
唯一的人类参与者所占的 Seat。
_Avoid_: user, human, hero

**Bot**:
由固定启发式策略驱动的对手所占的 Seat。它不学习、不训练,只按阈值决策。
_Avoid_: AI, CPU, opponent, 机器人(与"学习型 AI"混淆)

### 牌桌上的几何

**Button(庄家位)**:
标记名义庄家的 Seat。每手牌顺时针移动一位,决定盲注归属与行动顺序。
_Avoid_: dealer(本项目里没有荷官这个角色,发牌是引擎的事)

**Position(位置)**:
一个 Seat 相对 Button 的先后手关系(UTG、CO、BTN、SB、BB 等)。因为 Button 每手牌移动,同一个 Seat 的 Position 每手都在变——Position 不是座位编号。
_Avoid_: seat index, 座位号

**Blind(盲注)**:
每手 Hand 开始前由 Button 左侧两个 Seat 强制投入的筹码:小盲(SB)一份,大盲(BB)两份。本项目固定为 1 / 2,全程不涨。大盲同时是筹码深度的计量单位——起始 Stack 200 即"100 BB"。
_Avoid_: ante(前注是另一种强制投注,本项目不用)

### 时间单位

这四个词在中文里都可能被叫成"一轮",必须严格区分。

**Street(下注圈)**:
一手牌内的一个下注阶段:preflop、flop、turn、river。一手牌恰好有四个。
_Avoid_: round, 轮, betting round

**Hand(一手牌)**:
从发底牌到摊牌或只剩一人为止的一次完整牌局。
_Avoid_: round, game, 局, deal

**Orbit(一圈)**:
Button 绕桌一周所经过的六手牌。它是公平单位——一圈之内每个 Seat 各当过一次 Button、小盲和大盲。
_Avoid_: lap, cycle, 轮

**Session(一局)**:
本游戏的完整一次游玩:两个 Orbit,即十二手 Hand。结束时按 Score 排名。
_Avoid_: game, match, tournament, 比赛

**Showdown(摊牌)**:
一手 Hand 走完 river 且仍有两人以上未弃牌时,这些人亮出底牌比大小的时刻。它是德扑的规则事件,并非每手都会发生——有人下注把所有人赶走时就没有 Showdown。
_Avoid_: reveal, 亮牌

**Reveal(复盘亮牌)**:
本游戏额外加的环节:每手 Hand 结束后**无条件**展开所有 Seat 的底牌,**包括早已弃牌的人**。它与 Showdown 不是一回事——Showdown 是牌局规则,Reveal 是给 Player 看的学习工具,发生在牌局已经结算之后。
_Avoid_: showdown, 摊牌

### 计分

**Stack(码量)**:
一个 Seat 在**当前 Hand** 面前的筹码,**有限**。它定义了 all-in 的上限,也是边池存在的唯一原因。
_Avoid_: chips, balance, 筹码(单独使用时与 Score 混淆)

**Side Pot(边池)**:
当一个 Seat all-in 但 Stack 盖不住其他人的下注时,超出的部分单独形成的池子。原 all-in 者无权争夺它。一手 Hand 里可以同时存在多个边池,这是六人桌最容易实现错的地方。
_Avoid_: split pot(平分底池是另一回事,指摊牌打平)

**Score(净胜负)**:
一个 Seat 在**整个 Session** 内累计的净输赢,可以为负。它是最终排名的唯一依据。任何时刻六个 Score 之和恒为零。
_Avoid_: points, chips, balance, 分数(单独使用时与 Stack 混淆)

**Rebuy(补码)**:
Stack 归零后自动补回起始 Stack 的动作。Stack 增加多少,该 Seat 的 Score 就减少多少,因此零和成立。次数不设上限,没有人会被淘汰离桌。
_Avoid_: reload, top-up, respawn

**Equity(胜率)**:
在当前底牌与已知公共牌之下,赢得这手 Hand 的概率。Bot 用它决策,Player 在轮到自己行动时也能看到。
_Avoid_: odds(赔率是另一回事)、win rate、胜算

**Pot Odds(底池赔率)**:
跟注在数学上划算所需的最低 Equity,等于 跟注额 ÷ (底池 + 跟注额)。Bot 把 Equity 与它相比,决定弃牌、跟注还是加注。
_Avoid_: odds, 赔率(单独使用时不指明是哪一侧)

**Kicker(踢脚)**:
牌型相同时用来分高下的闲牌。两人同为一对 A,就比各自的踢脚;踢脚也相同才平分底池。界面上的牌型文案会把它写出来(「两对,A 和 K,踢脚 Q」),因为它经常就是决定这手牌归谁的那张。
_Avoid_: 副牌, side card, 单张

**Hand Odds(成牌概率)**:
在当前底牌与已知公共牌之下,最终会做成每种牌型的概率分布。它与 Equity 是两个问题:Equity 问"我会不会赢",所以必须把对手算进去;Hand Odds 只问"我最后会拿到什么",与对手完全无关,因此可以精确算出——翻牌前查一张穷举过的表,之后逐一枚举剩余的发牌。界面上只显示概率最高的五种。
_Avoid_: Equity, 胜率(那是赢的概率,不是成牌的概率)

### Bot 的五种性格

五个 Bot 共用一套策略,只是阈值参数不同。两个维度:**松/紧**指玩多少起手牌,**被动/激进**指倾向跟注还是加注。

**TAG**:紧且激进。玩的手少,但一旦入池就主动下注。

**LAG**:松且激进。入池范围宽,施压频繁。

**Calling Station(跟注站)**:松且被动。什么牌都想看,但极少主动加注。

**Rock(岩石)**:紧且被动。只玩最强的起手牌,几乎从不诈唬。

**Maniac(疯子)**:LAG 的极端形态,阈值近乎无视牌力。它的作用是制造噪声,逼迫对"这是不是诈唬"的判断。
