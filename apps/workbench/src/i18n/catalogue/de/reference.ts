/**
 * German for the `reference.*` ids: the frame around the core's generated API.
 *
 * **What is NOT here is nearly everything on that page.** A module's subpath and
 * its prose, and a symbol's kind, name, summary, signature and doc comment are
 * TypeDoc out of `packages/app-core`, read through `virtual:api`, and they stay
 * English because a developer wrote them for a developer
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * A German reader therefore gets a German heading, lede and filter around an
 * English reference, which is the seam that record decided on rather than a
 * translation somebody abandoned halfway.
 *
 * `packages/app-core`, `apps/mobile`, `loadArticle` and `stores/` are left in
 * their own spelling. They are paths and identifiers, and a reader of this page
 * has the code open.
 */
export const reference: Record<string, string> = {
  'reference.title': 'Referenz',
  'reference.lede':
    'Jedes exportierte Symbol aus <code>packages/app-core</code>, aus dem Quelltext und seinen Doc-Kommentaren extrahiert.',
  'reference.lede.more':
    'Der Core hat kein Barrel, jedes Modul hier ist also der Subpfad, den Sie importieren. Diese Seite ist zum Nachschlagen da, der Einstieg sind die Architekturseiten. Die Komponenten der App haben einen eigenen Bereich, <components>Komponenten</components>, und nur <code>apps/mobile</code> kann sie importieren.',

  'reference.filter': 'Module und Symbole filtern',
  'reference.filter.placeholder': 'Filtern, zum Beispiel loadArticle oder stores/',
  'reference.filter.summary':
    '{modules, plural, one {# Modul} other {# Module}}, {symbols, plural, one {# Symbol} other {# Symbole}}',

  'reference.empty': 'Dazu passt nichts.',
  'reference.symbol.noDoc': 'Kein Doc-Kommentar.',
};
