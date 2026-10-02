/**
 * German for the `kit.*` ids: what this site's own components say for themselves.
 *
 * One file per id namespace, as the app's own catalogue is ([ADR
 * 0050](../../../../../../adr/0050-the-workbench-gets-a-second-audience.md) §3), and `kit` is the
 * namespace of `src/ui/kit/` — the primitives every page builds its furniture out of, rather
 * than anything to do with the app's `src/components/ui/`, which is a different folder in a
 * different package and has its own ids under `components.*`.
 *
 * There is one string here and it is the same shape as the one the block picker and the
 * component page both print: a card that cannot show all of what it draws says so, in words,
 * with the number measured in the browser rather than written down here.
 */
export const kit: Record<string, string> = {
  'kit.previewCard.clipped': 'Beschnitten · {height} px hoch',
};
