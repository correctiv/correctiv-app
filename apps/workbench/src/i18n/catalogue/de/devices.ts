/**
 * German for the `devices.*` ids: the sizes the framed app can be drawn at.
 *
 * One namespace for one table, `preview/devices.ts`, which two selects read: the
 * bar above `/preview` and the device picker on a component's own page.
 *
 * **Most of that table is not here, and that is the decision.** `iPhone SE`,
 * `iPhone 15 Pro`, `Pixel 8`, `iPad mini`, `iPad Pro 11"` and `iPad Pro 13"` are
 * the manufacturers' own names for those machines, so they are not ids at all,
 * which is the same exemption `frame.ts` grants `Portrait` and `Settings.tsx`
 * grants `Deutsch`. What is here is the five entries this site named itself,
 * because the thing behind them has no name of its own.
 *
 * The sizes beside each name are digits and a `×`, assembled by `deviceOption()`
 * and the same in every language, so they are in no message.
 */
export const devices: Record<string, string> = {
  'devices.host': 'Dieser Bildschirm, volle Größe',
  'devices.breakpoint': 'Tablet-Breakpoint (48rem)',
  'devices.laptop': 'Laptop',
  'devices.desktop': 'Desktop',
  'devices.custom': 'Eigene Größe',
};
