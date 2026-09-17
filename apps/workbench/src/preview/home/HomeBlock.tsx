import { memo, useCallback, useState, type ReactNode } from 'react';

import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

import { sameSection } from './section';

// The app's own registry, through the build that compiles `apps/mobile/src` into
// this site (ADR 0027). Not a second table: the palette, the app's screen and
// this row all draw whatever `HOME_MODULES` holds, which is what ADR 0046 §1
// makes load-bearing when it retires the roster check.
import { HOME_MODULES } from '@/lib/home/modules';

import { DrawnBoundary } from '../../components/AppHost';

/**
 * One block of the home document, drawn as the app's real component.
 *
 * **A theme editor shows the theme** (ADR 0045 §3). The row used to be the
 * module's name, a sentence about it and some controls, which reads as a form
 * over a JSON file because that is what it was. This draws the block instead,
 * through the same build the component gallery uses, so the thing being
 * arranged is the thing that will be on the phone.
 *
 * ## What it is handed, and what it may not reach for
 *
 * Its whole input is the section. It does not read the playhead, the layout
 * store or `PreviewState`, and that is a constraint rather than an omission:
 * ADR 0046 §5 has a drawing re-render on its section and not on the clock, and a
 * block that reached for the hour itself would defeat that silently — it would
 * go stale rather than slow, which is the worse of the two failures. The clock
 * reaches a block only by changing its section, which is what `stateAt` already
 * does.
 *
 * ## It is not its own host
 *
 * The caller mounts **one** `AppHost` around the whole list, because
 * `AppEnvironment` carries a redux `Provider`, an `IntlProvider`, a
 * `SafeAreaProvider` and a `GestureHandlerRootView`, and one set per row is that
 * many of each for one store and one catalogue. So this deliberately does not
 * wrap itself. Forget the one above it and the failure is loud rather than
 * quiet: the module's first `useIntl`, `useSelector` or `useSafeAreaInsets`
 * finds no provider and throws, into the `DrawnBoundary` below, which prints the
 * message in place of the block.
 *
 * ## Offline it draws less than the frame, and that is accepted
 *
 * ADR 0046 §6. The modules fetch their own content, through `useFeed` and
 * correctiv.org's REST API, out of whatever tree they are mounted in — which is
 * why the drawn rows needed no port wired in at all. What they do not have is
 * the app's bundle: `app/_layout.tsx` hands the core an `expoPlatform` whose
 * `ContentBundle` is the committed offline articles, and the workbench hands it
 * nothing, so `createMemoryPlatform()`'s empty bundle answers and the
 * feed-driven blocks draw nothing while the frame beside them draws a lead
 * article. Not fixed, because the fix is the workbench configuring the core's
 * ports, which `AppEnvironment` refuses for reasons of its own. What makes it
 * honest is that the empty row is visibly empty next to a frame that is not.
 */
function Block({ section, deviceWidth }: HomeBlockProps): ReactNode {
  /** The room this row has, in CSS pixels, and the drawing's own unscaled height. */
  const [room, setRoom] = useState<number | null>(null);
  const [natural, setNatural] = useState<number | null>(null);

  /*
   * Two observers, each attached by the ref that owns the node it watches.
   *
   * **Not one observer in a mount-only layout effect**, which is what this was,
   * and the failure was silent in the way this file exists to avoid: an effect
   * keyed on `[]` captures the nodes of the first render, and any remount of
   * either box afterwards leaves it observing a node that is no longer in the
   * document and can therefore never change size again. The block then holds
   * whatever it measured before it was orphaned. Measured: every drawing sat at
   * `height: 0` while `offsetHeight` read sixty and up, so every row said it
   * drew nothing while drawing something.
   *
   * A ref callback cannot go stale by construction — React calls it with the
   * node and calls the returned cleanup when that node goes — so the observer
   * and the node it measures have one lifetime rather than two.
   *
   * `offsetHeight` and not `getBoundingClientRect()`: the drawing is transformed,
   * so its rect is already the scaled height and reading that would fold the
   * scale in twice.
   *
   * **The two readings are not independent, and the earlier version of this
   * comment said they were.** The panel is a scroll container, so a taller list
   * takes a scrollbar and every shell in it loses that width: measured in a cold
   * review on a browser with classic scrollbars, the panel reported 401px while
   * the list overflowed and 416px once it did not, and each shell fifteen less.
   * So height does feed width, through the scrollbar, and what stands between
   * that and a loop is only a margin — the list is several times taller than the
   * panel, so no plausible change of scale takes it back over the line. Measured
   * over four seconds at two window widths: no oscillation and no
   * `ResizeObserver loop` from the browser. A margin, not an impossibility, and
   * a drawn list that ever fits its panel exactly is where to look first.
   */
  const shell = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    const observer = new ResizeObserver(() => setRoom(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const drawn = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    const observer = new ResizeObserver(() => setNatural(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Module = HOME_MODULES[section.module];
  if (!Module) {
    /*
     * A word the app does not know draws nothing, and the editor says so rather
     * than showing an empty row. It is what the app itself does — `index.tsx`
     * skips a module it has no renderer for — and ADR 0036 §7's decision: draw
     * past what is unrecognised, and report it, because the configuration moves
     * faster than the app and a host that refused the whole document would break
     * on every release the configuration is ahead of.
     */
    return (
      <p className="text-s text-on-canvas-muted">
        Not drawn: this app has no module named <span className="font-mono">{section.module}</span>.
      </p>
    );
  }

  /*
   * Never above 1, which is `fitScale`'s rule and the reason it is spelled out
   * here rather than borrowed. `fitScale` fits a box on BOTH axes and answers 1
   * the moment either height is zero; this block has no height to fit — it is as
   * tall as its content and the row grows to hold it — so the only arguments
   * that call would take are a height invented to be ignored, or the truthful
   * zero, which returns 1 in exactly the pass where the answer matters. What is
   * inherited is the rule and not the function: a block scaled up would be a lie
   * about how many pixels the app thinks it has (ADR 0045 §3).
   */
  const scale = room === null ? 1 : Math.min(1, room / deviceWidth);

  /*
   * Before the first measurement the shell reserves nothing and claims nothing:
   * no height of its own, so it is the drawing's own box, which is the truth
   * while the scale is 1 and an over-claim of `1 / scale` while it is not.
   * Collapsing to zero was the alternative and it is the worse one — every row
   * of the document would stack on the same line and the page would jump once
   * per block.
   */
  const height = natural === null ? undefined : natural * scale;

  return (
    <>
      <div ref={shell} className="overflow-hidden" style={{ height }}>
        {/*
        A flex column, because that is what the app's own parent is: a module's
        outermost element is a `View`, which is laid out by its parent, and a
        block box neither stretches its children nor honours their `align-self`
        — the same measurement `DirectPreview` records for the gallery's stage.
      */}
        <div
          ref={drawn}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: deviceWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <DrawnBoundary label={section.id}>
            <Module section={section} />
          </DrawnBoundary>
        </div>
      </div>

      {/*
        Measured at nothing, and said rather than shown as an empty box. Some of
        the app's modules draw only in a state they are not in — the loading and
        offline notice is the plain case — and a bordered rectangle with nothing
        in it reads as a block that is broken rather than one that has nothing to
        say here. The drawing stays mounted above at no height, because
        unmounting it would take the measurement with it and the two would then
        take turns.

        After the shell rather than before it, which is tidiness now and was not
        always: with the measurement in a mount-only effect, a conditional element
        in front of the shell changed what sat at position nought the first time
        it appeared, React mounted a fresh `div` in its place, and the observer
        went on watching the node that had been thrown away. Measured then: the
        drawing was sixty pixels tall in the document while the shell stayed at
        `height: 0`, so the block said it drew nothing while drawing something.
        The ref callbacks above are what actually fixes that, and a cold review
        confirmed it by putting this note back in front and finding the drawings
        unchanged. So the order is no longer load-bearing, and it is written down
        that way rather than left standing as a rule with nothing under it.
      */}
      {natural === 0 && (
        <p className="px-2xs py-3xs text-s leading-relaxed text-on-canvas-muted">
          Draws nothing here.
        </p>
      )}
    </>
  );
}

interface HomeBlockProps {
  /** The one thing this draws, and the only thing it is allowed to read. */
  section: HomeSection;
  /** The framed device's CSS width; the width the block draws at. */
  deviceWidth: number;
}

/**
 * Equal by VALUE, and `./section.ts` is where the arithmetic lives and says why it is
 * not here: a test in this package can run that module and cannot run this one.
 */
function same(before: HomeBlockProps, after: HomeBlockProps): boolean {
  return before.deviceWidth === after.deviceWidth && sameSection(before.section, after.section);
}

export const HomeBlock = memo(Block, same);
