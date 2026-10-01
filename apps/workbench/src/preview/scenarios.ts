import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

import wahlabend from '../../content/scenarios/wahlabend.json';
import { wbMessage, type WorkbenchMessage } from '../i18n/messages';

/**
 * The named scenarios, and what each one needs beside its document.
 *
 * [ADR 0036](../../../../adr/0036-the-home-screen-becomes-data.md) §11 to §13. A scenario
 * is named, lives in the repository, and its name goes in the address (`sc=`, read in
 * `state.ts`); it is the same file as a real configuration, only named; and it says
 * whether it pulls live content or fixed sample data.
 *
 * ## Why the document is a file of its own and this table sits beside it
 *
 * `content/scenarios/<name>.json` is a home-layout document exactly as the core parses
 * it, byte for byte what `formatLayoutDocument` prints, and nothing else. §12 is the
 * reason: one validator and not two, and a scenario that can become the real thing by
 * copying one file over `packages/app-core/src/data/home.layout.json`. A wrapper with
 * the document under a key would be a second format, and promoting it would be an edit
 * somebody can get wrong.
 *
 * What a scenario needs besides its document is four things, and none of them is the
 * document's business, so they are here:
 *
 * - **its title**, which the list prints, and which is a message rather than a string
 *   in the JSON because this site's own words follow the language setting (ADR 0052);
 * - **the instant it opens at**, in `tm=`'s own spelling;
 * - **the session it is seen as**, a fixture id of `frame/seed.ts`, which is `s=`;
 * - **live or sample** (§13).
 *
 * In `src/` and not in `content/`, because the extractor reads `src/` for the titles.
 *
 * ## Never in the app
 *
 * The files are under `apps/workbench`, which the app may not read
 * ([ADR 0040](../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)). A
 * scenario reaches the framed app the way every edit does, through the
 * `workbench:home-layout` key in the storage the two share, so it is on the screen of
 * the person looking at it and on no phone.
 *
 * **But the repository is public, and so is every scenario in it.** The election night
 * pins an article that has long been published and runs on a date made up for it. A
 * scenario carrying unpublished material belongs in the private companion (ADR 0058 §5),
 * which nothing here reads yet.
 *
 * `test/preview/scenarios.test.ts` parses every file with the core's parser, fails on any
 * problem and on a version other than the current one, and holds this table and the
 * folder to each other in both directions.
 */

/**
 * What the frame shows besides the document (§13).
 *
 * `sample`: every article the scenario pins is one of `data/home-pins.ts`, the fixed
 * sample list, so what it leads with cannot move underneath a comparison. The feeds the
 * other blocks read are still live: the app has no switch that holds them still, and the
 * panel says so rather than claiming more. `live`: the scenario may pin any article, and
 * nothing in the frame is held.
 */
export type ScenarioContent = 'sample' | 'live';

export interface Scenario {
  /** The word in the address and the file's name, without `.json`. */
  name: string;
  title: WorkbenchMessage;
  /** The document as the JSON file holds it. `layoutOf` is how it is read. */
  document: unknown;
  /** Where the playhead opens: `YYYY-MM-DDTHH:MM`, Berlin, as `tm=` spells it. */
  opensAt: string;
  /** Which fixture of `frame/seed.ts` the frame is seeded with, as `s=` names it. */
  session: string;
  content: ScenarioContent;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: 'wahlabend',
    title: wbMessage({
      id: 'scenarios.wahlabend',
      defaultMessage: 'Election night (example)',
      description:
        'The name of the election-night scenario in the scenario list. It is an example with a made-up date, and the name says so.',
    }),
    document: wahlabend,
    // Half an hour into the evening: the edition has started, the Mediathek is still on.
    opensAt: '2030-09-29T18:30',
    // A paying member, which ADR 0060 §4 says `s=onboarded` is.
    session: 'onboarded',
    content: 'sample',
  },
];

/** The scenario the address names, or null for none and for a name nothing answers to. */
export function scenarioNamed(name: string | null | undefined): Scenario | null {
  if (!name) return null;
  return SCENARIOS.find((scenario) => scenario.name === name) ?? null;
}

/** Parsed once: the editor compares against a scenario's document on every render. */
const parsed = new Map<Scenario, HomeLayout | null>();

/**
 * The scenario's document as the editor holds it, or null when the core refuses it.
 *
 * Any problem refuses, and so does another version, the same strictness the submission
 * workflow and the deploy's check have: a problem means a document nobody meant to write.
 * The test makes null impossible for a file in the repository; this is what keeps a broken
 * one from being opened anyway.
 */
export function layoutOf(scenario: Scenario): HomeLayout | null {
  if (!parsed.has(scenario)) {
    const { layout, problems } = parseHomeLayout(scenario.document);
    const clean = layout !== null && problems.length === 0;
    parsed.set(scenario, clean && layout.version === HOME_LAYOUT_VERSION ? layout : null);
  }
  return parsed.get(scenario) ?? null;
}
