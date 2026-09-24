import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import type { WordingProblem } from './validate';

/**
 * What a refused wording is told, in words, for both places that refuse one.
 *
 * The strings tool says it under the field while somebody types, and the submission
 * workflow says it on the issue when a wording in it was refused (ADR 0062 §5). One set of
 * descriptors, so the sentence a person reads on GitHub is the sentence the tool showed
 * them, in the tool's German. `wbMessage()` and not `defineMessages`, because
 * `scripts/submission-strings.ts` runs in Node without React, which is the reason
 * `src/i18n/messages.ts` gives for the function.
 *
 * `format` is handed in, as `home/write.ts` hands it in: the panel passes its `intl`, the
 * workflow a German one made from this site's catalogue.
 */
export const PROBLEM_COPY = {
  empty: wbMessage({
    id: 'tools.strings.problem.empty',
    defaultMessage: 'The German is empty.',
    description: 'A refusal under the German field. Nothing reaches the frame while it stands.',
  }),
  tooLong: wbMessage({
    id: 'tools.strings.problem.tooLong',
    defaultMessage: 'The German is longer than {max} characters.',
    description:
      'A refusal under the German field, and on a submission issue. {max} is the most characters a wording may have, a number.',
  }),
  unsafe: wbMessage({
    id: 'tools.strings.problem.unsafe',
    defaultMessage:
      'The German holds an invisible character, {character}, at character {position}. Type the text at that place again without the character.',
    description:
      'A refusal under the German field, and on a submission issue, for a control character, a line separator, a direction mark or a zero-width character, which a reviewer cannot see. {character} is its Unicode code such as U+200B, which stays as it is; {position} is where it stands, counted in characters from one.',
  }),
  syntax: wbMessage({
    id: 'tools.strings.problem.syntax',
    defaultMessage: 'This is not a valid message: {detail}',
    description:
      'A refusal under the German field. {detail} is the ICU parser’s own error code, such as MALFORMED_ARGUMENT, which is not translated.',
  }),
  missing: wbMessage({
    id: 'tools.strings.problem.missing',
    defaultMessage: 'The English has placeholders the German lost: {names}',
    description:
      'A refusal under the German field. {names} is a comma-separated list of placeholder names, each written in braces as the message spells it, which stay as they are.',
  }),
  extra: wbMessage({
    id: 'tools.strings.problem.extra',
    defaultMessage: 'The German has placeholders the English does not: {names}',
    description:
      'A refusal under the German field. {names} is a comma-separated list of placeholder names, each written in braces as the message spells it, which stay as they are.',
  }),
  kind: wbMessage({
    id: 'tools.strings.problem.kind',
    defaultMessage: 'The German uses these placeholders differently from the English: {names}',
    description:
      'A refusal under the German field, and on a submission issue, when a placeholder keeps its name but changes its kind, such as a plural becoming a date. {names} is a comma-separated list of placeholder names, each in braces, which stay as they are.',
  }),
  unknown: wbMessage({
    id: 'tools.strings.problem.unknown',
    defaultMessage: 'The catalogue has no such id.',
    description:
      'A refusal from the dev server’s save or a submission, for an id no German catalogue file carries. The workbench may reword a string and may not add one.',
  }),
};

/** Formats one of the descriptors above. */
export type FormatProblem = (message: WorkbenchMessage, values?: Record<string, string>) => string;

/** Placeholder names spelled as a translator types them, `{count}`. */
export function braces(names: readonly string[]): string {
  return names.map((name) => `{${name}}`).join(', ');
}

/**
 * One problem in words. `quote` wraps every value that came from the wording rather than
 * from this site: the panel passes it through, the workflow puts it in a code span,
 * because a placeholder's name is text anybody could have written into an issue.
 */
export function problemText(
  format: FormatProblem,
  problem: WordingProblem | { code: 'unknown-id' },
  quote: (text: string) => string = (text) => text,
): string {
  switch (problem.code) {
    case 'empty':
      return format(PROBLEM_COPY.empty);
    case 'too-long':
      return format(PROBLEM_COPY.tooLong, { max: String(problem.max) });
    case 'unsafe':
      return format(PROBLEM_COPY.unsafe, {
        character: problem.character,
        position: String(problem.position),
      });
    case 'syntax':
      return format(PROBLEM_COPY.syntax, { detail: quote(problem.detail) });
    case 'missing':
      return format(PROBLEM_COPY.missing, { names: quote(braces(problem.names)) });
    case 'extra':
      return format(PROBLEM_COPY.extra, { names: quote(braces(problem.names)) });
    case 'kind':
      return format(PROBLEM_COPY.kind, { names: quote(braces(problem.names)) });
    case 'unknown-id':
      return format(PROBLEM_COPY.unknown);
  }
}
