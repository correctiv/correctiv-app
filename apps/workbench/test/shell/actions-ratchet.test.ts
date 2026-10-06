import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  filesUnder,
  floorFaults,
  ratchet,
  under,
  withoutComments,
} from '@correctiv/prose-and-code';

import { ROOT } from '../../plugin/collect.ts';

describe('every tool with changes uses the registry (ratchet)', () => {
  const src = join(ROOT, 'apps/workbench/src');
  const read = (f: string) => readFileSync(join(src, f), 'utf8');

  const TOOLS: Record<string, string> = {
    'preview/home/HomeDocument.tsx': 'home',
    'preview/navigation/NavigationEditor.tsx': 'navigation',
    'preview/features/FeaturesEditor.tsx': 'features',
    'preview/strings/StringsTool.tsx': 'strings',
    'preview/ui/Panels.tsx': 'tokens',
  };

  for (const [file, tool] of Object.entries(TOOLS)) {
    it(`${file} registers its actions as ${tool}`, () => {
      expect(read(file)).toContain(`useToolActions('${tool}'`);
    });
  }

  it('no other file renders its own save, submit or discard button', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.tsx')) files.push(full);
      }
    };
    walk(src);
    const offenders = files
      .filter((f) => !f.endsWith('ui/ToolActions.tsx'))
      .filter((f) =>
        /\b(Save|GitPullRequest)\b[^'\n]*from 'lucide-react'|^\s+(Save|GitPullRequest),$/m.test(
          readFileSync(f, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
});

/**
 * One explanation of a submission, on the button that submits — and the check that
 * it stays the only one.
 *
 * **What was wrong, and why it is invisible in a screenshot.** Every tool carried its
 * own ⓘ or its own line explaining what Submit does: `home.document.submitHint`,
 * `home.document.submitHintLong`, `home.document.submitAbout` and the two
 * `tools.strings.submit*` twins, four sentences in three files saying that GitHub
 * opens with your change in it and that you need a GitHub account. All of it sat next
 * to a control that was not the button being described — an ⓘ beside the screen
 * switcher, a card under the texts list — and the button it described is in the
 * header, where it already had a tooltip. Two copies of a sentence drift, which is
 * how the German of one of them stopped matching the English of another.
 *
 * **Why the reason moved with it.** The per-panel variants that were not the
 * explanation were the *reason the button is off* (`home.document.scenarioGuard`) and
 * the *too long for a link* case, and a reader could not reach either from the header:
 * a disabled button with a `pointer-events: none` on it cannot be hovered at all. So
 * `blocked` in `shell/actions.tsx` carries the tool's reason as a formatted string and
 * `ui/ToolActions.tsx` says it, and `test/shell/actions.test.tsx` holds that half.
 *
 * **Two rules, because one name is not a rule.** A check on the id alone passes the
 * moment somebody calls theirs `submitExplainer`, and a check on the wording alone
 * passes the moment somebody rewords it. So: no id ending in `submitHint`/`submitAbout`
 * outside the header, AND no `defaultMessage` anywhere else that says a GitHub account
 * is what submitting needs. The wording rule is the general one — any sentence
 * explaining a submission to a newsroom reader has to say that much to be worth
 * reading — and the id rule catches the rename before the wording does.
 *
 * **The gap, named.** A hint that explains submitting without mentioning an account
 * and takes another id walks past both. There is no way to see intent from a
 * sentence, and the other half of the seam is what holds it: `useToolActions` is the
 * only channel a tool has to the header, so a hint that is not on the button is a
 * hint nobody declared to the registry.
 *
 * Read as text with `withoutComments`, or the rule's own explanation above is the file
 * that breaks it, and with a `floorFaults` on both halves, or a walk that matched
 * nothing would pass.
 */
describe('a tool does not explain the submit button itself (ratchet)', () => {
  const SRC = join(ROOT, 'apps/workbench/src');
  /** The one file allowed to hold either half. */
  const HEADER = 'ui/ToolActions.tsx';

  const files = filesUnder(SRC, /\.tsx?$/).filter((f) => !f.endsWith(HEADER));
  const code = new Map(files.map((f) => [under(SRC, f), withoutComments(readFileSync(f, 'utf8'))]));

  it('reads the descriptors it is checking, and finds the one in the header', () => {
    const inHeader = withoutComments(readFileSync(join(SRC, HEADER), 'utf8'));
    expect(
      floorFaults({
        'files under src/': { found: files.length, atLeast: 80 },
        'defaultMessages outside the header': {
          found: [...code.values()].filter((s) => /defaultMessage:/.test(s)).length,
          atLeast: 40,
        },
        // The floor for the rule itself: if the header ever stops saying this, the two
        // rules below pass over nothing rather than over a sentence that moved.
        'the sentence in the header': {
          found: Number(/GitHub account/.test(inHeader)),
          atLeast: 1,
        },
      }),
    ).toEqual([]);
  });

  it('no other file names a descriptor submitHint or submitAbout', () => {
    const offenders = [...code]
      .filter(([, source]) => /id: '[^']*\.(submitHint|submitAbout)\b/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('no other file tells a reader a GitHub account is what submitting needs', () => {
    // `[\s\S]` and not `.`, because a descriptor written over two lines puts its
    // `defaultMessage` on its own and a dot matches nothing between the two — which
    // is the half of the format this repository's own descriptors use.
    const offenders = [...code]
      .filter(([, source]) => /defaultMessage:[\s\S]{0,400}?GitHub account/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

/**
 * No panel says where the draft came from, and the editor bar has no slot to say it in.
 *
 * **What was wrong, and why it kept coming back.** ADR 0076 §3 put a paragraph at the
 * top of the home panel saying the document arrived in a link and that this machine
 * holds nothing of it. #323 took the draft paragraphs out of the panels — a permanent
 * sentence above a block list is a sentence everybody reads once and then never again,
 * and it pushes the work down — and #331 found the same sentence again, because it had
 * arrived a second time through the door the first one used. It is three words in the
 * header now (`Aus Link`, beside the change status, the sentence in its tooltip), and
 * this is the check that says the panel does not get it back.
 *
 * **Two rules, because the slot and the sentence are separate mistakes.** A
 * `notice={…}` prop coming back is the paragraph coming back; a panel formatting
 * `sharedHeld` or `sharedDamaged` is the sentence arriving through some other door
 * entirely, in any component, in any arrangement. The first is named, the second is
 * not, and the second is the one that has happened twice.
 *
 * **The excuse list is empty and the ratchet is two-sided**, for the reason the
 * describe above says: a panel that grows a `notice` fails, and a slot that is left
 * behind unused fails too, because an empty slot is where the next paragraph goes.
 */
describe('a panel does not say where the draft came from (ratchet)', () => {
  const SRC = join(ROOT, 'apps/workbench/src');
  /** The places that may hand the sentence over, and each hands it to the header. */
  const BAR = 'preview/home/HomeDocument.tsx';
  const BARS = [BAR, 'preview/navigation/NavigationEditor.tsx'];

  const files = filesUnder(SRC, /\.tsx?$/).filter((f) => !BARS.some((bar) => f.endsWith(bar)));
  const code = new Map(files.map((f) => [under(SRC, f), withoutComments(readFileSync(f, 'utf8'))]));

  it('reads the files it is checking, and finds both halves of the sentence', () => {
    const inTheTool = withoutComments(readFileSync(join(SRC, BAR), 'utf8'));
    expect(
      floorFaults({
        'files under src/': { found: files.length, atLeast: 80 },
        'sharedHeld in the tool': {
          found: Number(/COPY\.sharedHeld\b/.test(inTheTool)),
          atLeast: 1,
        },
        // The floor for the rule itself: with the tool no longer holding them, both
        // rules below would pass over nothing rather than over a sentence that moved.
        'the sentence is in the file': {
          found: Number(/sharedDamaged/.test(inTheTool)),
          atLeast: 1,
        },
      }),
    ).toEqual([]);
  });

  it('no file but the tool formats either sentence, and the tool does it once', () => {
    /*
     * A ratchet and not a list of offenders, because the tool IS allowed to format
     * these — it hands the sentence to the header's `origin` — and a rule that named
     * it would have to be switched off the moment the header asked for it. One entry
     * in each tool that has a draft to receive (the layout and the navigation), and a
     * second arrival in either file is the paragraph coming back
     * through the other door. Every other file has no entry, so one arrival there
     * fails and so does the entry going stale.
     */
    const all = new Map(code);
    for (const bar of BARS) all.set(bar, withoutComments(readFileSync(join(SRC, bar), 'utf8')));
    // No `g` flag: `test` on a global regex carries `lastIndex` from one file into the next,
    // which hides a second match, and there are two tools that may legitimately have one.
    const renders = /formatMessage\([^)]*\bshared(Held|Damaged)\b/;
    const found = [...all]
      .filter(([, source]) => renders.test(source))
      .map(([path]) => ({ key: path }));
    const report = ratchet(found, Object.fromEntries(BARS.map((bar) => [bar, 1])));
    expect(report.arrivals).toEqual([]);
    expect(report.stale).toEqual([]);
  });

  it('no panel declares a prop to put a paragraph in', () => {
    /*
     * `notice?:` and `notice={`, and neither the word: `preview/home/store.ts` has a
     * `notice` and it is a store value about a document that would not open, which is
     * the same word doing a different job. What came back twice was a PROP, and a prop
     * is what a paragraph is handed over through.
     */
    const offenders = [...code]
      .filter(([, source]) =>
        /\bnotice\?:\s*(ReactNode|React\.ReactNode|string)\b|\bnotice=\{/.test(source),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('no panel draws the hint this paragraph used to carry', () => {
    // The `data-testid` the sentence wore, which outlived the paragraph it named and
    // is the shape a copy of it would be pasted back into.
    const offenders = [...code]
      .filter(([, source]) => /data-testid="shared-hint"/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
