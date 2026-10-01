/** Long enough for a cold Metro bundle, short enough to still be an answer. */
const LOAD_DEADLINE = 15_000;

/**
 * Resolves on the frame's next `load`, or when the deadline passes without one.
 *
 * Two callers, and the deadline is for both. `waitReady()` below uses it for a
 * document that is already on its way; `window.preview.set()` arms it *before*
 * React's effect points the frame anywhere, which is the only ordering that
 * cannot miss the event — `set()` returns while the navigation is still a render
 * away, and until it commits every question about the frame is answered by the
 * page on its way out.
 *
 * A load that never comes has to become a slow answer rather than a hang: on the
 * other side of this is an automation session sitting in an `await`.
 */
export function waitNavigation(frame: HTMLIFrameElement): Promise<void> {
  return new Promise<void>((resolve) => {
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      frame.removeEventListener('load', done);
      resolve();
    };
    timer = window.setTimeout(done, LOAD_DEADLINE);
    frame.addEventListener('load', done);
  });
}

/**
 * Resolves when the frame has stopped moving.
 *
 * The shell used to have no such signal at all: `screens/README.md` says to shoot
 * the web set "waiting for the feeds to settle", and the thing doing the waiting
 * was a person. A screenshot fired at `load` catches an unstyled first paint, one
 * fired after a fixed timeout is a guess that gets slower every year.
 *
 * Three conditions, in order, because each can only be true after the last:
 * the document parsed, the webfonts decoded (Merriweather and Source Sans are
 * embedded, and text reflows when they land), and two animation frames of quiet
 * so the first render after hydration has been painted.
 *
 * It is not a promise that the network is finished — the feed cascade can still
 * be running, and `frame/seed.ts` is how you decide what it will find. It is a
 * promise that what is on screen is what this build paints.
 */
export async function waitReady(frame: HTMLIFrameElement): Promise<void> {
  const win = frame.contentWindow;
  if (!win) return;

  if (win.document.readyState !== 'complete') await waitNavigation(frame);

  try {
    await frame.contentDocument?.fonts?.ready;
  } catch {
    // A frame that navigated mid-wait has no document any more. Not a fault:
    // the next navigation will run this again.
  }

  // The frames have to be the FRAME's. A bare `const raf = win.requestAnimationFrame`
  // does not throw — WebIDL substitutes the current realm's global for an undefined
  // receiver — it silently schedules against the shell's window instead, which is
  // not the document anyone here is waiting for.
  const live = frame.contentWindow ?? window;
  await new Promise<void>((resolve) => {
    // And a document replaced between the two frames never runs its callbacks,
    // so this settles either way rather than leaving an await outstanding.
    const timer = window.setTimeout(resolve, 2000);
    live.requestAnimationFrame(() =>
      live.requestAnimationFrame(() => {
        window.clearTimeout(timer);
        resolve();
      }),
    );
  });
}
