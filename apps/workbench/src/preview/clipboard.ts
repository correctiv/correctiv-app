/**
 * The clipboard for a submission too long for its address (ADR 0061 §6), shared by the
 * home tool and the strings tool. Here rather than in `home/write.ts`, where it was
 * written first, because the strings tool has no business importing the home document.
 */

/**
 * Put text on the clipboard inside the click that opens the new tab, and say whether that
 * worked.
 *
 * Synchronous on purpose, and that is why it is the old `copy` command and not
 * `navigator.clipboard`: the link opens GitHub in a new tab as part of the same click,
 * the new tab takes the focus, and the asynchronous clipboard refuses a document that is
 * not focused by the time it gets round to writing. A `copy` event answered with the text
 * is written before the click's default action runs. `navigator.clipboard` stays as the
 * second attempt for a browser without the command.
 *
 * Never throws: a refusal is `false`, and the panel then offers the text in a field to
 * copy by hand.
 */
export function copyNow(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const put = (event: ClipboardEvent) => {
      event.clipboardData?.setData('text/plain', text);
      event.preventDefault();
    };
    document.addEventListener('copy', put);
    let done = false;
    try {
      done = document.execCommand('copy');
    } finally {
      document.removeEventListener('copy', put);
    }
    if (!done && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    return done;
  } catch {
    return false;
  }
}
