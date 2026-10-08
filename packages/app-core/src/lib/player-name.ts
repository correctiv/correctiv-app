/**
 * The name a member goes by where other members can see it: a nickname they chose, or
 * their first name and the initial of their last.
 *
 * The highscore table is the first place that prints one, and it is written for the day
 * that table becomes public: a full name never leaves this function, so a member who
 * never chose a nickname appears as "Alex B." and not as the name on their membership.
 */

/** The longest nickname kept, in characters. Long enough for a name, short enough for a row. */
export const NICKNAME_MAX = 24;

/**
 * A nickname as it is stored: control characters read as spaces, whitespace collapsed,
 * trimmed and cut at `NICKNAME_MAX`. Null for one that is empty after that, which is
 * the same as having none.
 */
export function normaliseNickname(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  const printable = Array.from(input)
    .map((char) => {
      const code = char.codePointAt(0)!;
      return code < 0x20 || code === 0x7f ? ' ' : char;
    })
    .join('');
  const cleaned = printable.replace(/\s+/g, ' ').trim();
  const cut = Array.from(cleaned).slice(0, NICKNAME_MAX).join('').trim();
  return cut === '' ? null : cut;
}

/** "Alex Beispiel" → "Alex B.", "Anna Maria von Berg" → "Anna B.", "Alex" → "Alex". */
export function shortName(fullName: string | null | undefined): string | null {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return null;
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const initial = last === undefined ? '' : Array.from(last)[0]!.toUpperCase();
  return initial === '' ? first : `${first} ${initial}.`;
}

/** The nickname when there is one, otherwise the short form of the account's name. */
export function playerName(
  nickname: string | null | undefined,
  accountName: string | null | undefined,
): string | null {
  return normaliseNickname(nickname) ?? shortName(accountName);
}
