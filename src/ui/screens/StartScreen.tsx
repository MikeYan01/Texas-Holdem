/**
 * One button, no configuration.
 *
 * No difficulty setting on purpose (issue 13): a knob sounds cheap but means
 * tuning and validating every notch against real play. One of each personality
 * is itself the design — it guarantees a tight player, a loose one, a station and
 * a maniac at every table, which tells you far more than a slider would.
 *
 * The line-up is deliberately not listed here either. Naming each Bot's style up
 * front hands you the read for free, and working out who is tight and who is
 * bluffing is most of what there is to learn at this table.
 */
export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen screen--start">
      <h1 className="screen__title">德州扑克</h1>
      <p className="screen__lead">六人桌,你对五个 Bot。打满五圈共三十手,按净胜负排名。</p>

      <button type="button" className="btn btn--primary btn--large" onClick={onStart}>
        开始新局
      </button>
    </main>
  );
}
