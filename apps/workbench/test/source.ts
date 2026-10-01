/**
 * Reading a source file as a check reads one, in one place.
 *
 * Both of these had been written out three and four times over, each copy with a
 * doc comment of its own, and two of the copies of `code` said "as
 * `environment.test.ts` does it" — which is a file pointing at the original
 * instead of importing it. That is the shape the duplication takes here: the
 * second author knew, and copied anyway because there was nowhere to put it.
 *
 * There is somewhere now. The code is `@correctiv/prose-and-code`'s, and so are the
 * arguments that are about reading source at all — the line numbering, the opener
 * that cannot be a path alias, the limit a regular expression cannot close. This
 * file keeps the name `code` at the call sites that write it: the package spells it
 * `withoutCommentLines`, which says what it does, and `code` says what is left,
 * which is the right word in a check about a drawing's text.
 *
 * **Two arguments did not go with it, because they are about this site.** The
 * package is right to decline them and they were dropped rather than declined, so
 * they are back where a reader of this line meets them:
 *
 *  - Every check that reads a file for what it DOES needs the prose taken out,
 *    because a file explaining why it no longer calls something has to be able to
 *    name the thing it no longer calls. Without this, the docblock saying "applying
 *    it is the app's business, not this file's" fails the check that this file does
 *    not apply it — the comment punished for being accurate.
 *  - The drawings need it for the same reason one turn further out: their comments
 *    argue about record numbers, and a check that no record number is typed would
 *    otherwise punish the argument.
 *
 * Nothing here is a test, so vitest does not collect it.
 */
export { filesUnder, withoutCommentLines as code } from '@correctiv/prose-and-code';
