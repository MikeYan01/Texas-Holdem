// The single place the render layer binds to an Equity implementation.
//
// ADR-0005 keeps the interface asynchronous even though the work runs on the main
// thread, precisely so this file is the only one that has to change if it ever
// moves into a Web Worker.

import { getEquity } from '../poker-math/equity.ts';
import type { EquityProvider } from '../bots/types.ts';

export const equityProvider: EquityProvider = async (request) =>
  (await getEquity(request)).equity;
