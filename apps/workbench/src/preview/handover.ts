import type { IntlShape } from 'react-intl';

import type { Located } from './frame/locate';
import { wbMessage } from '../i18n/messages';

/**
 * What a designer hands to an agent after pointing at something.
 *
 * The point of this file is that "make this bit different" is not actionable and
 * `Chip.tsx:31` alone is barely better. What makes it actionable is the pair: the
 * line to change, and **the address that puts that thing back on screen**. With
 * the second one an agent can look at what was meant before changing it, and look
 * again afterwards, which is the whole reason this shell keeps its state in a URL.
 *
 * Deliberately plain text. It is pasted into a chat by a person, so it has to
 * survive being pasted into a chat by a person.
 *
 * **The four field names follow the language setting**, because the person who
 * reads this block first is the person who picked the element, and they read it in
 * the textarea before they copy it
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * What goes in the fields does not: a repository path, a component's name and the
 * view's own address are the same in every language.
 */
export interface Selection {
  /** The element's own text or accessibility label, as the picker read it. */
  label: string;
  /** The owner chain, innermost first, as `locate()` returned it. */
  frames: Located[];
  /** Which of them the person meant. "This chip" and "this chip row" differ. */
  selected: number;
  /** The shell's own address, which already carries route, device and appearance. */
  view: string;
}

/**
 * An absolute path from Metro, shortened to what someone would type.
 *
 * `/home/someone/projects/correctiv-app/apps/mobile/src/x.tsx` says one useful
 * thing and forty useless characters, and the useless part differs per machine,
 * which would make two people's notes about the same line look different.
 */
export function repoPath(file: string): string {
  return file.replace(/^.*?\/((?:apps|packages|tools)\/.*)$/, '$1');
}

export function frameLabel(frame: Located): string {
  return `${repoPath(frame.file)}:${frame.lineNumber}`;
}

/**
 * The same thing, for a 270px column. The full path goes in the row's `title`
 * and in the handover block; a row truncated to `apps/mobile/src/compone…` tells
 * a reader nothing, and every row truncates to the same thing.
 */
export function frameShort(frame: Located): string {
  const name = repoPath(frame.file).split('/').pop() ?? frame.file;
  return `${name}:${frame.lineNumber}`;
}

const CONTEXT_LINES = 3;

/**
 * The block's own four words, and the stand-in for an element that has none.
 *
 * A `Record` whose every value is wrapped one at a time: `@formatjs/cli` reads a
 * named function's single argument, so a `defineMessages`-shaped block handed to
 * `wbMessage` extracts to nothing at all. `wbMessage` and not `defineMessages`
 * because this module is reached from `preview/frame/locate.ts`'s side of the
 * shell and imports no React.
 */
const COPY = {
  element: wbMessage({
    id: 'tools.inspect.handover.element',
    defaultMessage: 'Element',
    description:
      'The first field of the plain-text block the inspector builds for pasting into a chat. What follows it is the element’s own text or accessibility label, in quotation marks. The four field names are padded to a common width, so a translation is free to be longer or shorter than the English.',
  }),
  source: wbMessage({
    id: 'tools.inspect.handover.source',
    defaultMessage: 'Source',
    description:
      'The second field of the handover block: the one file and line the person chose out of the owner chain. tools.inspect.handover.context is every other line of that chain, and shell.section.source is the component view’s tool of the same name, which reads the same in English.',
  }),
  context: wbMessage({
    id: 'tools.inspect.handover.context',
    defaultMessage: 'Context',
    description:
      'The third field of the handover block: the rest of the owner chain, at most three lines, the first of which carries this word. tools.inspect.handover.source is the one line the person chose.',
  }),
  view: wbMessage({
    id: 'tools.inspect.handover.view',
    defaultMessage: 'View',
    description:
      'The last field of the handover block: this page’s own address, which is what lets whoever picks the note up put the same thing back on screen.',
  }),
  noLabel: wbMessage({
    id: 'tools.inspect.handover.noLabel',
    defaultMessage: '(no label)',
    description:
      'Stands in the Element field for a node with no text and no accessibility label, rather than printing a pair of empty quotation marks. tools.inspect.noLabel says the same thing in the panel above and is worded as a sentence there.',
  }),
};

/**
 * The block, with its fields in a column.
 *
 * `intl` is an argument rather than a hook, because this is a pure function that
 * `preview/ui/Panels.tsx` calls during a render and `test/preview/handover.test.ts`
 * calls with no DOM at all.
 *
 * **The column is computed, not typed.** It used to be four literals padded by
 * hand, `'Source:  '` with two spaces in it, which is a layout that only holds for
 * the four English words it was counted against. `Kontext` is a letter longer than
 * `Context` and `Quelle` is a letter shorter than `Source`, so the width is taken
 * from whatever the four resolve to. Against the English it resolves to exactly
 * what was typed before.
 */
export function handover({ label, frames, selected, view }: Selection, intl: IntlShape): string {
  // A selection out of range means the link was written before the chain got
  // shorter, or nobody chose: the innermost frame is the useful answer either way.
  const index = selected >= 0 && selected < frames.length ? selected : 0;
  const chosen = frames[index];
  const context = frames.filter((_, i) => i !== index);

  const words = {
    element: intl.formatMessage(COPY.element),
    source: intl.formatMessage(COPY.source),
    context: intl.formatMessage(COPY.context),
    view: intl.formatMessage(COPY.view),
  };
  const width = Math.max(...Object.values(words).map((word) => word.length)) + ':'.length;
  const field = (word: string, value: string) => `${`${word}:`.padEnd(width)} ${value}`;
  const indent = (value: string) => `${' '.repeat(width)} ${value}`;

  const lines = [field(words.element, label ? `"${label}"` : intl.formatMessage(COPY.noLabel))];
  if (chosen)
    lines.push(
      field(
        words.source,
        `${frameLabel(chosen)}${chosen.methodName ? ` · ${chosen.methodName}` : ''}`,
      ),
    );
  for (const [i, frame] of context.slice(0, CONTEXT_LINES).entries()) {
    lines.push(i === 0 ? field(words.context, frameLabel(frame)) : indent(frameLabel(frame)));
  }
  lines.push(field(words.view, view));
  return lines.join('\n');
}
