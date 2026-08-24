# Texas

A web-based Texas Hold'em poker game.

## Conventions

### 语言

代码里的标识符、类型名和注释一律用英文,并使用 `CONTEXT.md` 里定下的术语(`Seat`、`Stack`、`Score`、`Street`、`Orbit`…)。

面向用户的界面文案是**中文**,只存在于渲染层。这有一个必须遵守的后果:**引擎模块里不允许出现任何用户可见的文案** —— 引擎吐出的是结构化事件和错误码,由渲染层翻译成中文。这条和 ADR-0001(引擎不碰 IO)是同一条约束的两面。

`all-in` 在界面上保留原文,因为中文译法反而不通用。

**界面上的筹码一律用筹码计数,不用 BB。** BB 是衡量 Bot 强弱的正确单位(不随赌注失真),但对玩家而言它只是同一个数量的第二种说法——「20 BB」和座位上的「100」并排出现,读起来是矛盾而不是补充信息。

Bot 在界面上用真实牌手的姓氏(Brunson、Ivey…),性格名(TAG / LAG / Rock…)只存在于代码里——见 `CONTEXT.md`。

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, used verbatim (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
