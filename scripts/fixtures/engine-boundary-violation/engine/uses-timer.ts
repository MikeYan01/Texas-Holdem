export function think(then: () => void): void {
  setTimeout(then, 900);
}
