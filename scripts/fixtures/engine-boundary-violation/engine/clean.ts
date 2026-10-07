// A clean engine-side file: pure, no imports outside the engine, no ambient state.
// The checker must report nothing here, otherwise it would be useless as a guard.
export function addBlinds(smallBlind: number, bigBlind: number): number {
  return smallBlind + bigBlind;
}
