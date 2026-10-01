/**
 * German for the `articlePath.*` ids: the sixth drawing, where an article comes
 * from.
 *
 * **Two ids, and that is the whole of this drawing's translation today.** Every
 * label inside the picture, its caption and the list under it are still English
 * literals in `src/diagrams/ArticlePath.tsx`, which
 * `test/rendered-literals.test.ts` counts.
 * `test/diagrams-article-path.test.ts` reads that English prose out of the
 * drawing and holds its figures to what `packages/app-core` holds, so moving
 * the labels means deciding what that check reads instead.
 *
 * "Sprosse" is this drawing's own word for one step of the cascade, and the
 * lede is the only place it is said in German so far.
 */
export const articlePath: Record<string, string> = {
  'articlePath.title': 'Woher ein Artikel kommt',
  'articlePath.lede':
    'Fünf Sprossen, der Reihe nach versucht; die erste, die antwortet, gilt. Zuerst kommt der in die App eingebaute Schnappschuss, denn das Versprechen lautet: Ein Artikel öffnet sich auch ohne WLAN. Der Cache hinter der zweiten und der fünften Sprosse hat drei Grenzen. Auf dem Bildschirm kommt ein einziger String an, den eine WebView bekommt.',
};
