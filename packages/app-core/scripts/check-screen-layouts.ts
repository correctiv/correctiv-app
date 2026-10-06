/**
 * Refuses a joined screen document that the app would refuse, or draw past.
 *
 *     npx tsx packages/app-core/scripts/check-screen-layouts.ts site/layout.json
 *
 * The counterpart of `check-home-layout.ts` for the document ADR 0071 §1 publishes: every
 * screen the app declares has to be in it and has to parse with no problem, judged by the
 * app's own parser and stricter than the app, for the reason that script gives. A screen
 * the newsroom made (ADR 0075 §7) is judged the same way, with two differences: it need not
 * be there, and it may hold no section at all, because a screen that is only a heading is a
 * screen. A key that is neither declared nor a valid custom id is refused, since it is a
 * file somebody put under `screens/` that no route can reach.
 */
import { readFileSync } from 'node:fs';

import { parseHomeLayout } from '../src/lib/home-layout';
import { parseNavigation } from '../src/lib/navigation';
import {
  CONFIGURABLE_SCREENS,
  isCustomScreenId,
  isDeclaredScreen,
  navigationDocumentOf,
  parseScreenDocument,
  screenDocumentOf,
} from '../src/lib/screen-layout';

const path = process.argv[2];
if (!path) {
  console.error('usage: check-screen-layouts.ts <layout.json>');
  process.exit(2);
}

let body: unknown;
try {
  body = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`${path}: not a JSON file: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const custom =
  typeof body === 'object' &&
  body !== null &&
  typeof (body as { screens?: unknown }).screens === 'object' &&
  (body as { screens: unknown }).screens !== null
    ? Object.keys((body as { screens: object }).screens).filter((key) => !isDeclaredScreen(key))
    : [];

let failed = false;
for (const screen of [...CONFIGURABLE_SCREENS, ...custom]) {
  const declared = isDeclaredScreen(screen);
  if (!declared && !isCustomScreenId(screen)) {
    console.error(`${path}: ${JSON.stringify(screen)}: not a valid screen id`);
    failed = true;
    continue;
  }
  const document = screenDocumentOf(body, screen);
  if (document === undefined) {
    console.error(`${path}: ${screen}: missing`);
    failed = true;
    continue;
  }
  const { layout, problems } = parseHomeLayout(document);
  for (const problem of problems)
    console.error(`${path}: ${screen}: ${problem.code} ${JSON.stringify(problem.context)}`);
  /*
   * The words, parsed by their own function and refused on their own terms, because the
   * arrangement is not the whole of what is about to be published (ADR 0075 §3). The
   * layout above already carries the same faults, so this is not a second reading that can
   * disagree with the first — it is the strict half of the pair: `parseHomeLayout` keeps a
   * screen whose title it could not read (ADR 0036 §7), and a publish does not.
   */
  const named = parseScreenDocument(document);
  for (const problem of named.problems)
    console.error(`${path}: ${screen}: ${problem.code} ${JSON.stringify(problem.context)}`);
  if (
    !layout ||
    (declared && layout.sections.length === 0) ||
    problems.length > 0 ||
    named.words === null
  ) {
    console.error(`${path}: ${screen}: refused`);
    failed = true;
  } else {
    console.log(
      `${path}: ${screen}: ${layout.sections.length} sections, ` +
        `${JSON.stringify(named.words.title.de)}, no problems`,
    );
  }
}
const navigation = navigationDocumentOf(body);
if (navigation === undefined) {
  console.error(`${path}: navigation: missing`);
  failed = true;
} else {
  const parsed = parseNavigation(navigation);
  for (const problem of parsed.problems)
    console.error(`${path}: navigation: ${problem.code} ${JSON.stringify(problem.context)}`);
  if (!parsed.navigation) {
    console.error(`${path}: navigation: refused`);
    failed = true;
  } else {
    console.log(
      `${path}: navigation: ${parsed.navigation.tabs.length} tabs after Home, no problems`,
    );
  }
}
process.exit(failed ? 1 : 0);
