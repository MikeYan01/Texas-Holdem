# Bot balance rests on measurement, not on intuition while tuning

Any change to the five Bots' personality parameters only counts once it has been measured with `npm run measure:bots`, and `src/bots/balance.slow.test.ts` guards a floor: no personality loses more than **2 BB** per Hand, and the spread across the field stays under **4 BB/hand**.

The unit is big blinds rather than chips, and that was discovered when the stakes moved from 1/2 blinds to 2/5 blinds: the same "−4 chips" bound is 2.5× stricter under one than under the other. **A guard whose meaning quietly changes with the stakes is not a guard.**

There is exactly one experiment, in `src/bots/measure-balance.ts`, shared by the tuning tool and the regression guard. This is not about saving a few lines — **the measurement tool and the assertion it guards have to be measuring the same thing**, and a copy on each side drifts into two different experiments sooner or later.

The rule was forced out by a bug that had already shipped. The fifth personality used to be `Maniac`, whose threshold sat below the Pot Odds — `postflopCallMargin: -0.08` means it demanded 4% Equity where the Pot Odds asked for 20%, so **every call it made was -EV**. Measured over 400 Sessions:

| | chips/hand | BB/hand |
| --- | --- | --- |
| LAG | +3.89 | +1.94 |
| TAG | +3.48 | +1.74 |
| Rock | +2.19 | +1.10 |
| Calling Station | +0.67 | +0.33 |
| **Maniac** | **−10.23** | **−5.11** |

The other four were all winners. At a zero-sum table that admits one explanation: they were all feeding off the same Seat. The Player's own words were "it's basically just handing everyone money", and that is not an impression, it is a measurable fact.

## Considered Options

**Guard balance with the personality-ordering tests.** They already exist, and every one of them was passing at the time — what they assert is relative ordering (Rock enters pots less often than Calling Station, Bluffer raises more often than TAG), and **the ordering was right the whole time the table was broken**. That is not a mistake in the tests: ADR-0003 requires asserting relative ordering rather than specific numbers, or the tests would lock down tuning. Balance therefore needs a **separate guard, based on measurement**, rather than a tightened version of those tests.

**Play a few Sessions and judge by feel.** Rejected: single-Hand variance in NLHE dwarfs the gap between the styles. The noise in an eighteen-Hand Session is enough to bury a systematic 1 BB/hand difference, and tuning by feel only chases that noise.

**Force every personality's expectation to zero.** Rejected: that demands five equally good styles, when "loose and passive is a losing style" is exactly the fact this game wants the Player to see. Winners and losers are allowed; a cash machine is not.

## Consequences

Tuning got more expensive: changing one constant now means running the 300-Session measurement (about 3 seconds) instead of changing it and committing. That is deliberate.

The bounds in `balance.slow.test.ts` are deliberately loose (−2 BB/hand, spread 4). They do not pin the balance down; they assert only that nobody is playing a strategy that cannot win. The old `Maniac` measured −5.11 BB/hand, which is well past that floor, and when the guard trips it names the offending personality and its BB/hand.

A flaw in the shared model got fixed along the way: `bluffFrequency` used to be a constant, so a Bot bluffed as often six-handed as it would heads-up. A bluff only works if everyone folds, and its success rate decays with the number of opponents, so it now scales as `bluffFrequency / opponentCount`. That applies to every personality; it is not a patch aimed at one of them.
