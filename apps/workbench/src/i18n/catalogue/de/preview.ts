/**
 * German for the `preview.*` ids: the preview view's own furniture, which is the
 * frame while it is not drawing anything and the status line under it.
 *
 * One namespace for two files, because it is one area. `preview/AppFrame.tsx`
 * holds the two `preview.frame.*` ids and `preview/ui/Readout.tsx` the
 * `preview.status.*` ones. The six tools in the rail beside them are `tools.*`,
 * the bar above the frame is `frame.*`, and the app inside the frame speaks for
 * itself out of `packages/catalogue`.
 *
 * **What the status line reports is not translated.** `light`, `dark` and
 * `system` arrive as the literal contents of the app's own appearance setting and
 * of what the device reports, and are printed in bold in their own spelling; only
 * „unbekannt“, where one of them could not be read at all, is a word this site
 * chose. `%` and `×` are signs rather than words.
 */
export const preview: Record<string, string> = {
  'preview.frame.booting': 'Die App startet …',
  'preview.frame.stuck': 'Die App wurde nicht geladen. Die Vorschau hat ihre Konsole.',

  'preview.status.app': 'Die App ist <b>{scheme}</b>',
  'preview.status.setting': 'Einstellung <b>{setting}</b>, Gerät meldet <b>{scheme}</b>',
  'preview.status.combination': 'Kombination <b>{which}</b>',
  'preview.status.combination.default': 'Kombination <b>{which}</b>, die Voreinstellung',
  'preview.status.combination.n': '{n} von {total}',
  'preview.status.unknown': 'unbekannt',
  'preview.status.size': '{width} × {height} bei {percent}%',
  'preview.status.published': 'Veröffentlichter Build, kein Dev-Handle',
};
