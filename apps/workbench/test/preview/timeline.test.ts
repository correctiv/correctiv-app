import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { floorFaults } from '@correctiv/prose-and-code';

import { ROOT } from '../../plugin/collect.ts';
import { governs } from '../../src/preview/home/document';
import { code } from '../source.ts';

/**
 * The day under the frame, and the list beside it, held to the two records that put
 * them there.
 *
 * [ADR 0042](../../../../adr/0042-the-timeline-belongs-to-the-stage.md) moves the track
 * out of the tool panel and under the framed app, and
 * [ADR 0045](../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §1–§3
 * and §5 make the panel's list the whole day with each block drawn. The two are one
 * piece of work by 0045's own first line, and most of what follows is about the seam
 * between them: **one playhead, read by both drawings**, which 0042's "What it costs"
 * names as the thing that must not become two pieces of state, because two of them
 * would disagree in front of somebody.
 *
 * ## What is read as text, and why that is the weaker half
 *
 * Only `governs` below is a function this file can call. Everything else is a decision
 * about where a component is mounted and what it is allowed to read, and this package's
 * tests have no DOM — `vite.config.ts` gives vitest no environment, which is the same
 * choice `environment.test.ts` and `direct.test.ts` explain: rendering one of these to
 * ask what is above it would need `react-native-web`, a browser and the app's whole
 * toolchain to answer a question about imports.
 *
 * So these are ADR 0031's mechanism 4 and they are worth knowing as that. They catch a
 * line deleted and a line moved to the wrong file; they cannot catch a track that draws
 * in the wrong place or a block that measures itself wrong. What catches those is
 * looking, and `scripts/home-live.mjs` is where this repository automates the looking.
 */

/** Read as text, because what is being asked is where a line is rather than what it does. */
const read = (path: string): string => code(readFileSync(join(ROOT, path), 'utf8'));

const PAGE = read('apps/workbench/src/pages/Preview.tsx');
const STAGE = read('apps/workbench/src/preview/ui/Stage.tsx');
const TOOLBAR = read('apps/workbench/src/preview/ui/Toolbar.tsx');
const TIMELINE = read('apps/workbench/src/preview/home/Timeline.tsx');
const PANEL = read('apps/workbench/src/preview/home/HomeDocument.tsx');
const BLOCK = read('apps/workbench/src/preview/home/HomeBlock.tsx');
const MINUTES = read('apps/workbench/src/preview/home/minutes.ts');
const HOOK = read('apps/workbench/src/preview/Preview.tsx');
const REVEAL = read('apps/workbench/src/preview/frame/reveal.ts');

describe('the files this reads', () => {
  it('read them, rather than matching nothing in an empty string', () => {
    /*
     * The first case in a file that reads the repository asserts that it READ it.
     * `prose-and-code`'s README argues why: every assertion below is of the shape "the
     * source says this" or "the source does not say that", and an empty source passes
     * the second kind silently. A path that moved or a stripper that ate a file turns
     * this suite green over a panel that is no longer there.
     */
    expect(
      floorFaults({
        'pages/Preview.tsx': { found: PAGE.length, atLeast: 1000 },
        'preview/ui/Stage.tsx': { found: STAGE.length, atLeast: 1000 },
        'preview/home/Timeline.tsx': { found: TIMELINE.length, atLeast: 3000 },
        'preview/home/HomeDocument.tsx': { found: PANEL.length, atLeast: 8000 },
        'preview/home/HomeBlock.tsx': { found: BLOCK.length, atLeast: 1000 },
        'preview/home/minutes.ts': { found: MINUTES.length, atLeast: 500 },
        'preview/frame/reveal.ts': { found: REVEAL.length, atLeast: 500 },
      }),
    ).toEqual([]);
  });
});

describe('which routes the document governs', () => {
  /*
   * ADR 0042 §2. The home screen and nothing else: on `/artikel` the hour changes
   * nothing, because the document does not describe that screen, and a playhead there
   * would move while the app did not.
   */
  it('answers for the home screen, under either spelling Expo Router serves it as', () => {
    expect(governs('/')).toBe(true);
    expect(governs('/index')).toBe(true);
  });

  it('ignores what belongs to the app rather than to the route', () => {
    // A query and a hash are the app's own business and neither changes which screen is
    // being shown. A trailing slash is the same route typed by a different person.
    expect(governs('/?from=push')).toBe(true);
    expect(governs('/index#top')).toBe(true);
    expect(governs('//')).toBe(true);
  });

  it('answers no for every other screen', () => {
    for (const route of ['/artikel', '/entdecken', '/mediathek', '/profil', '/indexes']) {
      expect(governs(route)).toBe(false);
    }
  });

  it('answers no before the frame has said anything', () => {
    // Every moment before the first load settles. An absent control that appears is a
    // smaller surprise than a control that appears and then goes.
    expect(governs(undefined)).toBe(false);
  });
});

describe('an hour in a link survives being opened', () => {
  /**
   * The address is what looking writes, and ADR 0042 §3 rests the whole feature on it:
   * a view of the home screen at half past six is a thing to send somebody. It did not
   * survive. `#/?d=iphone-15-pro&tm=11:30` came back as `#/?d=iphone-15-pro`, on this
   * branch and on `origin/main` alike — older than the timeline's move and found by
   * opening a link rather than by reading anything.
   *
   * The first render reads the store's defaults, because `start()` reads the hash in an
   * effect and effects run after a render; the page's address-writing effect then fired
   * with those defaults and replaced the hash with them. `d` survived only because the
   * default device happened to be the one in the link.
   *
   * Read as text, and it is the weaker half in the way this file's header says: what
   * actually holds this is `scripts/home-live.mjs`, which opens a link in a browser.
   */
  it('waits for the store to have read the address before writing one back', () => {
    expect(HOOK).toMatch(/const \[started, setStarted\] = useState\(false\)/);
    expect(HOOK).toMatch(/setStarted\(true\)/);
    expect(PAGE).toMatch(/if \(!preview\.started\) return;/);
    // And the guard has to be a dependency, or it is read once at the wrong moment.
    expect(PAGE).toMatch(/\[preview\.started, state, onAddress\]/);
  });
});

describe('the track is the stage’s and not the tool’s', () => {
  /*
   * ADR 0042 §1, and the half a reader cannot see: the panel no longer holds a track at
   * all, so the only way to have one is to be mounted by the page under the frame.
   */
  it('is drawn by the stage, and the panel does not draw one of its own', () => {
    expect(PAGE).toMatch(/<Timeline\b/);
    expect(PAGE).toMatch(/timeline=\{/);
    expect(STAGE).toMatch(/timeline: ReactNode/);
    expect(PANEL).not.toMatch(/Timeline/);
  });

  it('keeps one order down the screen, so the frame is measured without the track', () => {
    /*
     * ADR 0042 §4: frame, then timeline, then the tools, at every width. `stageRef` is
     * what `useStage` fits the frame into, so a track INSIDE it would make the frame fit
     * itself, and the frame would shrink by the height of the thing below it.
     *
     * So what has to be read is nesting, and an earlier version of this read order —
     * "`{timeline}` appears after `ref={stageRef}`" — which is true of a `{timeline}`
     * sitting inside that very element. Measured in a cold review: moved into the
     * measured box, in each of the two branches in turn, and this check stayed green
     * over exactly the arrangement its own comment described as the failure.
     *
     * Indentation is the nesting, because `oxfmt` decides it and `npm run check` runs
     * `oxfmt --check`: two lines at the same indent in one JSX block are siblings. That
     * is a real dependency on the formatter and it is the honest one to take — the
     * alternative is balancing tags in a regular expression, which is the thing regular
     * expressions cannot do.
     */
    const lines = STAGE.split('\n');
    const indent = (line: string) => line.length - line.trimStart().length;

    const boxes = lines.filter((line) => line.includes('ref={stageRef}'));
    const tracks = lines.filter((line) => line.trim() === '{timeline}');
    // Two branches, `host` and framed, and each draws one of each.
    expect(boxes).toHaveLength(2);
    expect(tracks).toHaveLength(2);

    for (const [box, track] of boxes.map((box, at) => [box, tracks[at]] as const)) {
      // The box's own line is `<div` plus attributes, so the element opens one line up
      // whenever the attributes wrap; either way its indent is the element's.
      expect(indent(track)).toBe(indent(box));
      expect(lines.indexOf(track)).toBeGreaterThan(lines.indexOf(box));
    }
  });

  it('asks one predicate whether there is a day, and asks it in both places', () => {
    // The switch in the toolbar and the track under the frame have to agree about which
    // routes have a day, or one of them is offered for a thing that is not there. One
    // exported function, called twice, rather than two spellings of one route list.
    expect(PAGE).toMatch(/governs\(preview\.status\.frameRoute\)/);
    expect(TOOLBAR).toMatch(/governs\(status\.frameRoute\)/);
    for (const file of [PAGE, TOOLBAR]) expect(file).toMatch(/from '.*home\/document'/);
  });

  it('takes the route the frame reports, never the field somebody is typing in', () => {
    // They part company on every keystroke and for the second the app spends
    // navigating. `state.route` is the field; `status.frameRoute` is the app.
    expect(PAGE).not.toMatch(/governs\(state\.route\)/);
    expect(TOOLBAR).not.toMatch(/governs\(state\.route\)/);
  });
});

describe('full screen, and the line it borrows', () => {
  it('keeps the day above the breakpoint and gives it up below, on the shell’s own line', () => {
    // ADR 0042 §5. `full` exists so that somebody can look at the app, and the track is
    // the control for looking — so it is the one thing `full` keeps. Below the line the
    // arithmetic beats the argument, and it is arithmetic #185 already did.
    expect(PAGE).toMatch(/!full \|\| wide/);
  });

  it('does not measure a line of its own', () => {
    // `WIDE` in `lib/useMedia.ts` and `HOST_BELOW` in `preview/devices.ts` are the same
    // number on purpose. A third copy of one editorial judgement is one more place for
    // it to be edited alone, and the copy that goes wrong is whichever nobody touches.
    for (const file of [PAGE, STAGE, TIMELINE]) {
      expect(file).not.toMatch(/\b1024\b/);
      expect(file).not.toMatch(/64rem/);
    }
  });
});

describe('one playhead, two drawings', () => {
  /*
   * ADR 0042's "What it costs", in as many words: the stage's playhead and the panel's
   * head are the same minute, and if they are ever two pieces of state they will
   * disagree in front of somebody. The minute lives where it already lived — in the
   * frame's state and in the address — and both drawings read it.
   */
  it('reads the simulated hour out of the address in both drawings', () => {
    for (const file of [TIMELINE, PANEL]) expect(file).toMatch(/state\.time/);
  });

  it('reads the machine’s clock from one place, so the two cannot be a minute apart', () => {
    // `Date.now()` in two components is two readings, and on a page opened at 10:59:58
    // they are a minute apart: the track would put the playhead in one point and the
    // panel would name the other. Since ADR 0059 the one reading is an instant, and each
    // drawing turns it into a Berlin day and minute through the same `playheadFrom`.
    expect(MINUTES).toMatch(/opened \?\?= Date\.now\(\)/);
    for (const file of [TIMELINE, PANEL]) {
      expect(file).toMatch(/openedAt\(\)/);
      expect(file).not.toMatch(/Date\.now\(\)/);
    }
  });

  it('snaps to one step, from one constant', () => {
    // A track landing on fives beside a field accepting minutes would disagree by four
    // minutes about where a drag put the playhead, with both of them right about their
    // own rule.
    expect(MINUTES).toMatch(/export const STEP = /);
    for (const file of [TIMELINE, PANEL]) expect(file).toMatch(/from '.*minutes'/);
  });
});

describe('looking never changes anything', () => {
  /*
   * ADR 0042 §3. With the tool shut the track moves the playhead and jumps between the
   * moments the document already names; adding one, moving one and deleting one need
   * the tool open. The line is reading the document versus writing it, which is the same
   * line `apps/mobile/src/lib/home/clock.ts` draws about its own key.
   */
  it('makes every write on the track refuse itself while the tool is shut', () => {
    /*
     * The guard is in the write and not only in the markup, and that is the finding of a
     * cold review rather than a preference: asked only whether an `{editing &&` stood
     * before the first `withMoment(`, this check was green over a real guard changed to
     * `{true && (` with a decorative `{editing &&` left above it. A rendered condition is
     * what somebody edits; the rule belongs where the write is.
     *
     * So both writers open by refusing, and what is counted is that every function which
     * reaches `setLayout` does. `snap` and `goTo` do not write and are not counted.
     */
    expect(TIMELINE).toMatch(/editing: boolean/);
    const writes = TIMELINE.match(/setLayout\(/g) ?? [];
    const guards = TIMELINE.match(/if \(!editing\) return;/g) ?? [];
    expect(writes.length).toBeGreaterThan(0);
    expect(guards).toHaveLength(writes.length);
  });

  it('takes the answer from the tool being open rather than from a switch of its own', () => {
    // "The tool is open" is already the sentence that separates reading the document
    // from writing it; a second switch would be a second answer to one question.
    expect(PAGE).toMatch(/editing=\{address\.tool === 'home'\}/);
  });
});

describe('the list is the day, and the blocks are drawn', () => {
  it('draws every block the document has, in the document’s order', () => {
    // ADR 0045 §1. Not the sections in effect at the playhead: the list is where the
    // document is, and a list that showed only what is on screen would make "remove"
    // mean two different things that look identical (§2).
    //
    // Still `layout` and not some second order, which ADR 0053 §2 is what now guarantees:
    // a carry offsets the rows with a transform rather than reordering them, so there is
    // one order in this file and it is the document's. `palette.test.ts` holds that half.
    expect(PANEL).toMatch(/\{layout\.sections\.map\(/);
  });

  it('greys a block that is off at the playhead rather than collapsing it', () => {
    /*
     * ADR 0045 §2 kept the header row and took the drawing away. ADR 0053 §1 keeps the
     * drawing and greys it: the list is the screen now, and a hole in a screen is the one
     * thing a person cannot point at. What §2 was defending is untouched — the whole day
     * is visible and every block stays addressable — and it is defended by more than it
     * was, because an off block is now the same shape as an on one.
     *
     * So the panel draws the block unconditionally and `HomeBlock` is what greys it. The
     * second half is the load-bearing one: a conditional left here would be the collapse
     * coming back one branch at a time.
     */
    expect(PANEL).toMatch(/deviceWidth !== null && <HomeBlock section=\{section\}/);
    expect(PANEL).not.toMatch(/off \? \(/);
    expect(BLOCK).toMatch(/off && 'opacity-45 grayscale'/);
  });

  it('draws nothing while the panel is behind the rail', () => {
    /*
     * The slot keeps a tool mounted whether or not it is the open one (ADR 0038 §1), so
     * the drawings were in the document on a plain visit to `/preview` with nothing open
     * — the demo audience ADR 0038 §2 protects, mounting and feeding the app's modules a
     * second time beside the frame that already has them. Measured on the dev server:
     * 1250 elements on the page with the tool shut, the app's own modules among them;
     * 1032 and none of them once the page handed the panel the answer.
     *
     * Both spellings are held, because the failure is that they part: the page decides
     * and the panel obeys, and a panel that decided for itself would be a second answer
     * to "is this tool open".
     */
    expect(PAGE).toMatch(/drawing=\{address\.tool === 'home'\}/);
    expect(PANEL).toMatch(/drawing: boolean/);
    expect(PANEL).toMatch(/deviceWidth=\{drawing \? deviceWidth : null\}/);
  });

  it('puts one environment round the list rather than one round each row', () => {
    // `AppEnvironment` mounts a store provider, an intl provider, a safe-area provider
    // and a gesture root; one per row would be one of each per row.
    expect(PANEL).toMatch(/<AppHost>/);
    // The block imports the boundary from that file and must not mount the host itself;
    // a second environment per row is the thing being refused, not the import.
    expect(BLOCK).not.toMatch(/<AppHost\b/);
  });

  it('leaves the checkbox behind and keeps `hidden` in the document', () => {
    // ADR 0045 §5. What the checkbox had to do was say the block was off, and the
    // collapsed row says it without a word; what is left is the switching, which is an
    // act rather than a field. The WRITE is unchanged in kind: `writeHidden` puts the
    // change into the point in effect, of the day through `withHidden`, or of the
    // edition running at the playhead (ADR 0059 §2).
    //
    // The row and not the whole panel, because the panel has a checkbox again and should:
    // whether the frame follows the pointer is a setting, which is what a form field is
    // for. §5 is about the one control that was a field and should have been an act.
    const row = PANEL.slice(PANEL.indexOf('function Row('), PANEL.indexOf('function Here('));
    expect(row).not.toMatch(/type="checkbox"/);
    expect(row).toMatch(/onHidden\(/);
    expect(PANEL).toMatch(/writeHidden\(/);
  });
});

describe('the list draws at the phone’s width, whatever the frame is set to', () => {
  /**
   * ADR 0045 §3: "a block draws at **the phone's own width**", and narrower than that the
   * drawing scales down as a whole, never up.
   *
   * This followed the framed device for one release, which is a different sentence and a
   * worse interface: pick an iPad and every drawing in the panel shrinks to about a third,
   * because a 744px block then has to fit a panel about 400px wide. The two surfaces have
   * two jobs — the frame is where a device is tried, the list is where the document is —
   * and they want two widths.
   */
  it('takes the width from the device list and not from the frame', () => {
    expect(PANEL).toMatch(/preset\(DEFAULT_DEVICE\)\.w/);
    expect(PANEL).not.toMatch(/frameSize/);
  });
});

describe('the frame goes to the block under the pointer', () => {
  /**
   * An outline is no use where it cannot be seen, and at a phone's height most of the
   * shipped document is below the fold: measured on the dev server, the app's scroller is
   * 796px tall and the last section's top sits at 2856px.
   *
   * The arithmetic that decides how far to scroll is `frame/reveal.ts` and
   * `test/preview/reveal.test.ts` runs it. What is read here is the wiring, which is the
   * half that can only be looked at.
   */
  it('scrolls the frame’s own scroller, never `scrollIntoView`', () => {
    // `scrollIntoView` scrolls every scrollable ancestor, and the frame's ancestors do
    // not stop at the frame: the stage box around the iframe is `overflow-auto` and so is
    // the page. Asking the app to show its footer would move the workbench under it.
    expect(REVEAL).not.toMatch(/scrollIntoView/);
    expect(REVEAL).toMatch(/scrollBy\(/);
  });

  it('is a setting of the panel, on by default, and not in the address', () => {
    // The address carries what a link should reproduce. This changes nothing a screenshot
    // would show — it changes what happens when a pointer moves — so it stays local, the
    // same call `textPass` makes in `Preview.tsx`.
    expect(PANEL).toMatch(/useState\(true\)/);
    expect(read('apps/workbench/src/preview/state.ts')).not.toMatch(/follow/);
  });

  it('follows only a hover, never the setting being changed', () => {
    // `follow` travels with the id rather than being read where the scroll happens: held
    // apart, it would be a second value in that effect's dependencies, and switching the
    // setting on would scroll a frame nobody had pointed at.
    expect(HOOK).toMatch(/\{ id: string; follow: boolean \}/);
    expect(HOOK).toMatch(/hoveredSection\?\.follow/);
    expect(HOOK).toMatch(/\[hoveredSection, loaded\]/);
  });
});

describe('a block draws itself and reads nothing else', () => {
  /*
   * ADR 0046 §5, which measured what a drawn list costs per playhead step and how few of
   * the day's minutes change anything about a block, and decided the drawing re-draws on
   * its section rather than on the clock. The figures are that record's and are not
   * copied here; what this file can hold is the shape the decision needs.
   *
   * And that shape is: the component's whole input is the section it is given. A block
   * that read the playhead would have a reason to redraw on every step of a drag, and no
   * comparator could take it away.
   */
  it('takes the section and the width, and reaches for nothing that moves', () => {
    for (const forbidden of ['../state', './store', './clock', './minutes']) {
      expect(BLOCK).not.toMatch(new RegExp(`from '${forbidden}'`));
    }
    expect(BLOCK).not.toMatch(/useSyncExternalStore/);
  });

  it('is memoised on the section’s value rather than on its identity', () => {
    // `effectiveAt` rebuilds a section a moment has touched on every call and hands back
    // the original for every section no moment has touched, and the array is new either
    // way. So the default comparator would redraw exactly the blocks a moment changes,
    // for ever, which is the case this exists for.
    expect(BLOCK).toMatch(/memo\(Block, same\)/);
    expect(BLOCK).toMatch(/function same\(/);
  });

  it('scales down and never up, through the one function that decides it', () => {
    // ADR 0045 §3: a block scaled up would be a lie about how many pixels the app thinks
    // it has. The rule moved out of this file into `home/fit.ts`, where
    // `test/preview/fit.test.ts` runs it rather than looking for `Math.min` in a source
    // — which is what this assertion used to do, and the shape of check this repository
    // has been bitten by three times.
    expect(BLOCK).toMatch(/fit\(room, deviceWidth\)/);
    expect(BLOCK).not.toMatch(/Math\.min/);
  });

  it('measures the drawing with an observer the node owns', () => {
    // A mount-only effect captures the nodes of the first render and goes on observing
    // them after a remount, which is measured: every drawing sat at `height: 0` while
    // `offsetHeight` read sixty and up, and every row said it drew nothing while drawing
    // something. A ref callback and its cleanup cannot go stale that way.
    const observers = BLOCK.match(/new ResizeObserver\(/g) ?? [];
    const cleanups = BLOCK.match(/observer\.disconnect\(\)/g) ?? [];
    expect(observers.length).toBeGreaterThan(0);
    // One count against the other, not one match: with a single `toMatch` here, dropping
    // the cleanup from either callback on its own was green — measured — and a leaked
    // observer holds a detached node and keeps answering about it.
    expect(cleanups).toHaveLength(observers.length);
    expect(BLOCK).not.toMatch(/useLayoutEffect|useEffect/);
  });
});
