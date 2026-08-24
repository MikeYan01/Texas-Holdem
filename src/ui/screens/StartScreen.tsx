import { PERSONALITY_KEYS } from '../../bots/personalities.ts';
import { PERSONALITY_BLURBS, PERSONALITY_NAMES } from '../text/labels.ts';

/**
 * One button, no configuration.
 *
 * No difficulty setting on purpose (issue 13): a knob sounds cheap but means
 * tuning and validating every notch against real play. One of each personality
 * is itself the design — it guarantees a tight player, a loose one, a station and
 * a maniac at every table, which tells you far more than a slider would.
 */
export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen screen--start">
      <h1 className="screen__title">德州扑克</h1>
      <p className="screen__lead">
        六人桌，你对五个 Bot。打满五圈共三十手，按净胜负排名。
      </p>

      <ul className="lineup">
        {PERSONALITY_KEYS.map((key) => (
          <li key={key} className="lineup__item">
            <span className="lineup__name">{PERSONALITY_NAMES[key]}</span>
            <span className="lineup__blurb">{PERSONALITY_BLURBS[key]}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn--primary btn--large" onClick={onStart}>
        开始新局
      </button>

      <p className="screen__foot">
        轮到你行动时会显示当前胜率;每手结束后会亮出所有人的底牌,包括早已弃牌的人。
      </p>
    </main>
  );
}
