# Texas

A browser-based Texas Hold'em game: one Player against five Bots, eighteen Hands, ranked
on Score. Runs locally, no real money.

## Language

The terms below are the project's vocabulary. They are used verbatim in code, in tests and
in these documents.

The parenthetical after each term is its **Chinese rendering**, kept because the interface
is bilingual (ADR-0008): it is what `src/ui/text/` must say when the locale is `zh`, so
this file is the authority for both languages at once. An `_Avoid_` list may therefore
name words to avoid in either language.

### The variant

**No-Limit Hold'em (NLHE)**:
The only variant and betting structure in this project. No-limit means any action may push
a Seat's entire Stack into the middle.
_Avoid_: poker, Hold'em on its own (neither pins down the betting structure), 德扑

### Who is at the table

**Seat(座位)**:
One of the six fixed places at the table. It holds chips and acts when the action reaches
it. Humans and Bots alike occupy a Seat.
_Avoid_: position (see below — it means something entirely different), slot

**Player(玩家)**:
The Seat occupied by the one human participant.
_Avoid_: user, human, hero

**Bot**:
A Seat played by an opponent driven by fixed heuristics. It does not learn and it does not
train; it decides by threshold.
_Avoid_: AI, CPU, opponent, 机器人 (which suggests a learning AI)

### The geometry of the table

**Button(庄家位)**:
The Seat marking the nominal dealer. It moves one Seat clockwise every Hand, and it decides
who posts the blinds and in what order everyone acts.
_Avoid_: dealer (there is no dealer role in this project — dealing is the engine's job)

**Position(位置)**:
Where a Seat stands relative to the Button in the order of action (UTG, CO, BTN, SB, BB and
so on). Because the Button moves every Hand, a given Seat's Position changes every Hand —
Position is not a seat number.
_Avoid_: seat index, 座位号

**Blind(盲注)**:
The chips two Seats to the Button's left are forced to put in before each Hand: the small
blind (SB) and the big blind (BB). Fixed at **2 / 5** here, and they never go up.

BB doubles as a unit of measurement ("a 20 BB Stack"), and it is the right unit for
measuring Bot strength — it does not distort when the stakes move, which is why
`balance.slow.test.ts` states its bounds in it. **The interface does not use it that way.**
To a Player it is just a second name for a quantity already on screen, and putting it beside
the number on the Seat makes the two read as a contradiction. The interface always shows
chip counts.
_Avoid_: ante (a different forced bet, not used here)

### Units of time

All four of these can be called "一轮" in Chinese, and "a round" in English. They must be
kept strictly apart.

**Street(下注圈)**:
One betting stage within a Hand: preflop, flop, turn, river. A Hand has exactly four.
_Avoid_: round, betting round, 轮

**Hand(一手牌)**:
One complete deal, from the hole cards going out to a showdown or to everyone but one
folding.
_Avoid_: round, game, deal, 局

**Orbit(一圈)**:
The six Hands it takes the Button to travel once around the table. It is the unit of
fairness — within one Orbit every Seat has been the Button, the small blind and the big
blind exactly once.
_Avoid_: lap, cycle, 轮

**Session(一局)**:
One complete playthrough of this game: three Orbits, so eighteen Hands. It ends with a
ranking on Score.
_Avoid_: game, match, tournament, 比赛

**Showdown(摊牌)**:
The moment, once a Hand has run through the river with two or more Seats still unfolded,
when those Seats turn their hole cards over and compare. It is a rule of Hold'em and it does
**not** happen every Hand — a bet that drives everybody out ends the Hand without one.
_Avoid_: reveal, 亮牌

**Reveal(复盘亮牌)**:
This game's own addition: after every Hand, **unconditionally**, every Seat's hole cards are
turned face up, **including those of everyone who already folded**. It is not a Showdown.
A Showdown is a rule of the game; a Reveal is a learning tool for the Player, and it happens
after the Hand has already been settled.
_Avoid_: showdown, 摊牌

### Scoring

**Stack(码量)**:
The chips a Seat has in front of it for the **current Hand**. **Bounded.** It is what makes
all-in mean something, and it is the only reason side pots exist.
_Avoid_: chips, balance, 筹码 on its own (which blurs into Score)

**Side Pot(边池)**:
When a Seat is all-in but its Stack cannot cover what others have bet, the excess forms a
pot of its own. The all-in Seat has no claim on it. A single Hand can hold several side pots
at once, and this is the easiest thing on a six-handed table to get wrong.
_Avoid_: split pot (that is a tie at showdown, a different thing)

**Score(净胜负)**:
A Seat's cumulative net win/loss across the **whole Session**. May be negative. It is the
sole basis for the final ranking. At every moment the six Scores sum to zero.
_Avoid_: points, chips, balance, 分数 on its own (which blurs into Stack)

**Rebuy(补码)**:
Automatically buying back in to the starting Stack once a Stack hits zero. The Stack goes up
and that Seat's Score goes down by exactly the same amount, which is what keeps the sum at
zero. There is no limit on how many times, and nobody is ever knocked out of the game.
_Avoid_: reload, top-up, respawn

**Equity(胜率)**:
The probability of winning the current Hand, given the hole cards and the community cards
known so far. **Only Bots use it, and it is never displayed.** What the Player is shown is
Hand Odds (below), because "what am I going to make" builds intuition better than a lone
percentage.
_Avoid_: odds (a different thing), win rate, 胜算

**Pot Odds(底池赔率)**:
The minimum Equity that makes calling mathematically worthwhile: the call divided by
(pot + call). A Bot compares its Equity against this to decide whether to fold, call or
raise.
_Avoid_: odds, 赔率 on its own (it does not say which side you are on)

**Kicker(踢脚)**:
The spare card that separates two hands of the same category. Two Seats each holding a pair
of aces are separated by their kickers; if those match too, they split the pot. The
interface spells it out ("two pair, aces and kings, kicker Q"), because it is very often the
thing that decides who takes the Hand.
_Avoid_: side card, 副牌, 单张

**Hand Odds(成牌概率)**:
The probability distribution over which hand category a Seat will finish with, given its
hole cards and the community cards so far. It is a different question from Equity: Equity
asks "am I going to win", so it has to account for opponents; Hand Odds only asks "what am I
going to end up holding", which is opponent-independent and therefore computable exactly —
preflop from an exhaustively enumerated table, and after that by counting every remaining
run-out. The interface shows only the five likeliest.
_Avoid_: Equity, 胜率 (that is the probability of winning, not of making a hand)

### The five Bot personalities

All five Bots share one strategy and differ only in threshold parameters. Two dimensions:
**loose/tight** is how many starting hands they play, **passive/aggressive** is whether they
lean towards calling or raising.

**TAG**: tight and aggressive. Plays few hands, but bets them when it does.

**LAG**: loose and aggressive. Enters pots widely and applies pressure often.

**Calling Station(跟注站)**: loose and passive. Wants to see everything, almost never raises.

**Rock(岩石)**: tight and passive. Plays only the strongest starting hands and hardly ever
bluffs.

**Bluffer(诈唬手)**: bets and raises far more than its cards can support, but **does not pay
for it** — its calling threshold is the highest at the table. Its job is to generate noise
and force the question "is this a bluff?", and the fact that it will not call off losing
hands is what separates it from a cash machine.
_Avoid_: Maniac (its predecessor, whose threshold sat below the Pot Odds, making every call
-EV and losing 5 BB per Hand to the rest of the table)

### The Bots' display names

The five Bots are labelled with the **surnames of real players** (Brunson, Ivey, Negreanu,
Dwan, Hellmuth), and the names are **unrelated to personality and reshuffled every Session**.
Two reasons. First, "Calling Station" is a losing style, and pinning it on a real person is
both impolite and untrue. Second, working out who is tight and who is loose is the most
valuable thing there is to learn at this table — bind a name to a personality and you have
given it away after two Sessions.
