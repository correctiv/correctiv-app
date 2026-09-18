/**
 * German for the `components.*` ids: the gallery of the app's components and a
 * single component's own page.
 *
 * One namespace for two files, because it is one area. `pages/Components.tsx`
 * holds the ids without `detail.` and `pages/ComponentDetail.tsx` the ones with.
 *
 * **What is NOT here is most of the words on those pages.** The sentence under a
 * component's name, the prose under a props type and the prose under each prop are
 * JSDoc comments out of `apps/mobile/src/components`, read through `virtual:api`,
 * and they stay English because a developer wrote them for a developer
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * So a German reader gets a German page around English component documentation,
 * and that seam is the decision rather than an unfinished translation.
 *
 * **The line "Gezeichnet von" is never drawn.** `ui/kit/segmented.tsx` draws a
 * legend only with `showLegend`, which that page does not pass, so it is read
 * aloud and nothing else. The two answers under it therefore have to be nominative
 * and stand on their own. They were written as datives agreeing with it, "Dieser
 * Site" and "Dem Bundle der App", which left a sighted reader two fragments with
 * nothing governing them. A cold review found it in this change's own evidence
 * shot.
 *
 * `Props`, `Barrel` and the names of the components themselves are left in their
 * own spelling. They are what the code calls these things, and a reader of this
 * page has the code open.
 */
export const components: Record<string, string> = {
  'components.title': 'Komponenten',
  'components.lede':
    'Jede Komponente, aus der die App ihre Ansichten baut, aus <code>{root}</code> gelesen, mit ihren Props, deren Typen und dem Prosatext, den die Quelle mitbringt. Jede Karte zeichnet ihre Komponente, aus dem Quelltext der App, im React-Baum dieser Site; eine Karte, die nicht die ganze Komponente fasst, sagt das an ihrer Unterkante. Die eigene Seite einer Komponente hat jedes Exemplar vollständig, daneben das Bundle der App und eine Gerätegröße. Die Exporte des Cores sind ein eigener Abschnitt: <reference>Referenz</reference>, eine Bibliothek, die auch als solche importiert wird.',

  'components.prose':
    'Der Satz unter jedem Namen ist der Doc-Kommentar der Komponente selbst, aus dem Quelltext der App, und bleibt englisch: ein Kommentar ist für die geschrieben, die den Code lesen.',

  'components.filter': 'Ordner, Komponenten und Props filtern',
  'components.filter.placeholder': 'Filtern, zum Beispiel Typo, onPress oder reader',
  'components.filter.summary':
    '{folders} Ordner, {components} Komponenten, davon {drawn} hier gezeichnet',

  'components.drawn.legend': 'Welche Komponenten',
  'components.drawn.all': 'Alle',
  'components.drawn.here': 'Hier gezeichnet',

  'components.empty': 'Dazu passt nichts.',
  'components.barrel':
    'Dieser Ordner hat ein Barrel, ein Aufrufer nennt also den Ordner und nicht die Datei.',
  'components.alsoExported': 'Hier ebenfalls exportiert',

  'components.card.bundle': 'Im Bundle der App gezeichnet',
  'components.card.bundleNote': 'Ihre Seite zeichnet sie in der ausgelieferten App.',
  'components.card.clipped': 'Beschnitten · {height} px hoch',
  'components.card.specimens': 'Alle Exemplare von {name}',
  'components.card.specimens.clipped':
    'Alle Exemplare von {name}; diese Karte beschneidet die Komponente bei {height} px',
  'components.card.noDoc': 'Kein Doc-Kommentar.',
  'components.card.props': '{count, plural, one {# Prop} other {# Props}}',

  'components.detail.breadcrumb': 'Navigationspfad',
  'components.detail.crumb': 'Komponenten',

  'components.detail.tooNarrow':
    'Das Bundle der App zeichnet das in einem Geräterahmen, und der braucht mehr Breite, als hier zur Verfügung steht.',
  'components.detail.full': 'Im Vollbild öffnen',
  'components.detail.frameTitle': '{name}, in der App gezeichnet',
  'components.detail.gallery': 'Die Galerie in der Vorschau',
  'components.detail.reload': 'Den Rahmen neu laden',

  'components.detail.drawnBy': 'Gezeichnet von',
  'components.detail.drawnBy.site': 'Diese Site',
  'components.detail.drawnBy.bundle': 'Das Bundle der App',
  'components.detail.notDrawn': 'Hier nicht gezeichnet: {reason} Das Bundle zeichnet sie.',
  'components.detail.notDrawn.reason': 'der Katalog der App hat kein Exemplar dafür.',
  'components.detail.twoRenderings':
    'Zwei Darstellungen einer Komponente. Ein Unterschied dazwischen ist ein Befund und kein Schönheitsfehler; nichts prüft sie gegeneinander, mit Absicht.',
  'components.detail.frameHolds': 'Im Rahmen läuft <strong>{build}</strong>.',
  'components.detail.frameHolds.dev': 'der Dev-Server über den Proxy',
  'components.detail.frameHolds.dist': 'der veröffentlichte Export',

  'components.detail.device': 'Gerät',
  'components.detail.size.auto': 'Der Platz, den diese Seite ihr gibt, so groß er eben ist.',
  'components.detail.size.frame': '{width} × {height} bei {percent}%',
  'components.detail.size.column':
    'Spalte auf {width} px begrenzt. Die Höhe ist die der Komponente selbst.',

  'components.detail.props.none': 'Keine.',
  'components.detail.prop.optional': 'optional',
  'components.detail.prop.noProse': 'Kein Prosatext.',
  'components.detail.inherits':
    'Dazu alles aus {types}, was diesem Repository nicht gehört und hier benannt statt ausgeschrieben wird.',
};
