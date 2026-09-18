/**
 * Which documents the workbench publishes, and at what address.
 *
 * The workbench renders the repository's own Markdown in place. It never holds a
 * copy: two copies of `ARCHITECTURE.md` would disagree within a month, and the
 * one on the website would be the one nobody edits. So this file maps a path in
 * the repository to a route on the site, and everything else follows from it,
 * including the link rewriting, which needs the mapping in reverse.
 */

export interface DocumentSource {
  /** Stable id, used as the module key and the anchor namespace. */
  id: string;
  /** Repository-relative path. The single source of truth for the content. */
  file: string;
  /** Where it answers on the site. */
  route: string;
  /** What the navigation calls it, which is not always what its h1 says. */
  nav: string;
  /** One line for the navigation and the landing page. */
  blurb: string;
  /**
   * True where `file` is the program that writes the page rather than the page.
   *
   * One document is generated from the repository instead of read out of it, and
   * the difference reaches the reader: `pages/Document.tsx` offers every other
   * document as a file to edit, and offering this one would be an invitation to
   * type into an output.
   */
  generated?: boolean;
}

/**
 * The fixed documents. Every `adr/0NNN-*.md` is added on top of these by the
 * plugin, because they are a growing set and listing them here would be a second
 * place to forget.
 *
 * `README.md` and `RELEASE.md` are published because they are the two documents
 * that describe how to run and ship the thing, and a developer arriving at the
 * workbench should not have to go back to the repository for them. `AGENTS.md` is
 * published as "Conventions" because that is what it is; its filename is an
 * artefact of which tool reads it first.
 */
/**
 * **`nav` and `blurb` are this site's own words, and they do not follow the
 * language setting.** By
 * [ADR 0052](../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1 they
 * would: they are hand-written in this package, about the repository rather than
 * by it. What stops them is the extraction, not the record. `package.json`'s
 * `i18n:extract` walks `src/**` and this file is in `plugin/`, so a descriptor
 * written here extracts to nothing and would ship as an English default with no
 * German behind it and nothing going red.
 *
 * ADR 0052 §5 names the gap. Until it closes, a document has ONE name and it is
 * here: `pages/Handbook.tsx`'s cards print `nav` rather than carrying a second
 * copy, and `pages/Document.tsx`'s breadcrumb prints the same. Do not add a
 * descriptor beside one of these expecting it to be extracted, and do not write a
 * second name for a document anywhere else.
 */
export const DOCUMENTS: DocumentSource[] = [
  {
    id: 'architecture',
    file: 'ARCHITECTURE.md',
    route: '/architecture',
    nav: 'Architecture',
    blurb: 'What the system is: one core, its ports, and the article path end to end.',
  },
  {
    id: 'sources',
    file: 'SOURCES.md',
    // Not `/sources`: that is the board built from `content/sources.manifest.ts`,
    // and a route the workbench answers itself shadows a document silently. This
    // document is the record the board is built from, and it carries the part a
    // manifest cannot: the argument, the measurements and their date, and the ten
    // questions somebody has to answer. `test/routes.test.ts` keeps the two sets
    // from colliding again.
    route: '/sources/measured',
    nav: 'Sources, measured',
    blurb: 'The figures behind the board, taken by hand, and the questions they raise.',
  },
  {
    id: 'decisions',
    file: 'adr/README.md',
    // Not `/decisions`: that is the board built from the records themselves, the
    // same pair as `/sources` and this document's opposite number above. What is
    // left here once the board carries the index is the part a table of rows
    // cannot carry — the nine notes for readers of the older records, and the rule
    // that says how an expired claim is marked.
    //
    // Not `/decisions/…` either, which would read better and be wrong twice:
    // `pages/Landing.tsx` counts the records as the documents under that prefix
    // and would count them all, and `ui/Search.tsx` labels everything under it
    // `ADR <segment>`, so the palette would offer "ADR notes". Both are right to
    // assume a segment there is a record. `ui/ActivityBar.tsx` lights the
    // Decisions rail for anything starting `/decisions`, which this still does.
    route: '/decisions-notes',
    nav: 'Decisions, the notes',
    blurb: 'How an expired claim is marked, and nine notes for readers of the older records.',
  },
  {
    id: 'traps',
    file: 'TROUBLESHOOTING.md',
    route: '/traps',
    nav: 'Traps',
    blurb: 'The failures that pass every check, and why a green check is not evidence.',
  },
  {
    id: 'conventions',
    file: 'AGENTS.md',
    route: '/conventions',
    nav: 'Conventions',
    blurb: 'Where code goes, how colour works, and which language goes where.',
  },
  {
    id: 'readme',
    file: 'README.md',
    route: '/readme',
    nav: 'Readme',
    blurb: 'Getting the repository running.',
  },
  {
    id: 'release',
    file: 'RELEASE.md',
    route: '/release',
    nav: 'Release',
    blurb: 'How a build reaches a device and a store.',
  },
  {
    // Under `/design`, not in the handbook: it is the design section's document,
    // and `ui/ActivityBar.tsx` lights that section for anything under the prefix.
    // `/design` is a page and this is a document, which are distinct addresses;
    // `test/shell.test.ts` holds that pair specifically, because a page that
    // shadows a document takes it off the site with no error anywhere.
    //
    // Published rather than summarised, because the page that used to summarise
    // it was a shorter version of prose that already exists: the README carries
    // the three traps of the Linux client next to the code they describe, and
    // `plugin/markdown.ts` resolves its relative links from its own directory, so
    // `../../adr/0020-…` becomes `/decisions/0020` and `../../screens` becomes a
    // repository link at the built commit.
    id: 'figma-plugin',
    file: 'tools/figma-plugin/README.md',
    route: '/design/plugin',
    nav: 'The Figma plugin',
    blurb:
      'Draws the app’s screens and kit into the Figma file from data in this repository, and what it needs to run.',
  },
];

/**
 * Whether a repository path is one of the records.
 *
 * Anchored at `adr/`, unlike `adrNumber` below, and that is the whole difference:
 * this one is handed every path in the tree and has to refuse `tools/0012-x.md`,
 * where `adrNumber` is handed a record and asked only to read its number. Both
 * callers of this were filtering a list of repository paths with a copy of the
 * literal, which is two regexes that have to be edited together.
 */
export function isRecordFile(file: string): boolean {
  return /^adr\/0\d{3}-.*\.md$/.test(file);
}

/** `adr/0022-three-tiers-of-colour.md` and `0022-three-tiers-of-colour.md` both give `0022`. */
export function adrNumber(file: string): string | null {
  return /(?:^|\/)(0\d{3})-[^/]*\.md$/.exec(file)?.[1] ?? null;
}

export function adrRoute(number: string): string {
  return `/decisions/${number}`;
}
