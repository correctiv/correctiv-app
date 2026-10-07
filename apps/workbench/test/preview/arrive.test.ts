/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { arriveFrom } from '../../src/preview/arrive';
import { formatLayoutDocument, SHIPPED, withHidden } from '../../src/preview/home/document';
import {
  layoutDraftKey,
  LAYOUT_SET_KEY,
  navigationDraftKey,
  NAVIGATION_TARGET,
} from '../../src/preview/home/names';
import { shippedNavigationOf, shippedOf as shippedIn } from '../../src/preview/home/screens';
import { formatNavigationDocument, withMaxTabs } from '../../src/preview/navigation/document';
import {
  getNavigation,
  navigationIncoming,
  setNavigation,
} from '../../src/preview/navigation/store';
import {
  discardScreens,
  getLayout,
  getScreen,
  incomingOf,
  noticeOf,
  screenIds,
  selectLayout,
  setLayout,
  setScreen,
} from '../../src/preview/home/store';
import { EXAMPLE_LAYOUT } from '@correctiv/app-core/data/layouts/registry';
import { packedIn, shareLink, type Draft } from '../../src/preview/share';
import { getState, set } from '../../src/preview/store';

/**
 * A link that arrives on somebody else's machine (ADR 0076 §3).
 *
 * **The whole of this decision is what must not happen here**, so the tests are about the
 * machine and not about the document: a draft from a link is shown, and nothing of it is
 * written. The failure it prevents is not an error anybody sees — it is the reviewer who
 * had a document of their own open, opened somebody else's link, and then lost their own
 * work to the first edit, with nothing in the interface to explain it.
 *
 * The links are built by `shareLink` rather than written out, so the test cannot drift from
 * what the tool actually produces: the arrival has to open what the button makes.
 */
/** These tests are about documents, so they read `demo`'s: the tool opens on `ship`, which is empty. */
const shippedOf = (screen: string) => shippedIn(screen, 'demo');
const SHIPPED_NAVIGATION = shippedNavigationOf('demo');
const HOME_KEY = layoutDraftKey('demo', 'home');

/**
 * What the machine holds of its own: every key but the frame's. `workbench:layout-set` is
 * the seam the tool tells the frame the layout through, and it is written whatever arrives,
 * from what the machine holds; what a link must not do is put ITS draft anywhere
 * (`frameDraws` below holds that half).
 */
const kept = () => Object.keys(window.localStorage).filter((key) => key !== LAYOUT_SET_KEY);

/** The document the frame is told to draw for a screen. */
const frameDraws = (screen: string): unknown =>
  JSON.parse(window.localStorage.getItem(LAYOUT_SET_KEY) ?? '{"screens":{}}').screens[screen];

const AT = {
  base: 'https://correctiv.github.io/correctiv-app/preview',
  hash: '#/home?d=ipad-mini',
};

/** The edit a newsroom makes before showing it to somebody: the hero off at the day's start. */
const EDITED = withHidden(SHIPPED, null, 'hero', true);
const DRAFT: Draft = { screen: 'home', document: formatLayoutDocument(EDITED) };

/** The fragment of a link to this document, which is all the arrival is given. */
async function linkTo(draft: Draft = DRAFT): Promise<string> {
  const { link } = await shareLink('home', { layout: EXAMPLE_LAYOUT, ...draft }, AT);
  return (link ?? '').slice((link ?? '').indexOf('#'));
}

/** What the machine held before the link was opened: a document of its own, unsubmitted. */
const LOCAL = formatLayoutDocument(withHidden(SHIPPED, null, 'tip', true));

beforeEach(() => {
  window.localStorage.clear();
  selectLayout('demo');
  discardScreens();
  setScreen('home');
  set({ route: '/' });
});

describe('a link carrying a draft, on a machine that holds one of its own', () => {
  it('opens the draft in the tool', async () => {
    window.localStorage.setItem(HOME_KEY, LOCAL);
    expect(await arriveFrom(await linkTo())).toBe(true);

    expect(formatLayoutDocument(getLayout())).toBe(DRAFT.document);
    expect(incomingOf('home')).toBe(true);
    expect(noticeOf()).toBeNull();
  });

  /*
   * The one that matters. `localStorage` is not the tool's own store: the framed app reads
   * the same key, so writing here is writing into the picture on the phone beside it. A
   * draft from a link that lands in the key replaces whatever the machine had — including
   * work that was never submitted — before anybody has edited a character of it.
   */
  it('writes nothing into the machine it was opened on', async () => {
    window.localStorage.setItem(HOME_KEY, LOCAL);
    // A page that opens over what an earlier visit left.
    selectLayout('ship');
    selectLayout('demo');
    await arriveFrom(await linkTo());
    expect(window.localStorage.getItem(HOME_KEY)).toBe(LOCAL);
    expect(kept()).toEqual([HOME_KEY]);
    // And the frame goes on drawing what the machine holds, not the draft.
    expect(frameDraws('home')).toEqual(JSON.parse(LOCAL));
  });

  it('writes nothing on a machine that held nothing either', async () => {
    await arriveFrom(await linkTo());
    expect(window.localStorage.getItem(HOME_KEY)).toBeNull();
    expect(kept()).toEqual([]);
    expect(frameDraws('home')).toEqual(JSON.parse(formatLayoutDocument(shippedOf('home'))));
  });

  /** The moment the draft becomes the editor's own: the first edit, and it publishes. */
  it('publishes the draft on the first edit, and says no longer where it came from', async () => {
    window.localStorage.setItem(HOME_KEY, LOCAL);
    await arriveFrom(await linkTo());
    setLayout(getLayout());

    expect(incomingOf('home')).toBe(false);
    expect(window.localStorage.getItem(HOME_KEY)).toBe(DRAFT.document);
    expect(frameDraws('home')).toEqual(JSON.parse(DRAFT.document));
  });
});

describe('a link carrying a draft for another screen', () => {
  /*
   * The other screen's own document, because the core parses a document for the screen it
   * is for: Home's twelve blocks under Entdecken are not a document that screen can open,
   * and this is not the place to find that out.
   */
  const other = {
    screen: 'entdecken' as const,
    document: formatLayoutDocument(shippedOf('entdecken')),
  };

  it('opens that screen’s document and takes the frame to it', async () => {
    await arriveFrom(await linkTo(other));

    expect(getScreen()).toBe('entdecken');
    expect(getState().route).toBe('/s/entdecken');
    expect(incomingOf('entdecken')).toBe(true);
  });
});

describe('a link carrying a draft for a screen the newsroom made (ADR 0075 §7)', () => {
  it('opens it as a screen of its own and takes the frame to /s/<id>', async () => {
    const draft = { screen: 'kampagne', document: formatLayoutDocument(shippedOf('entdecken')) };
    await arriveFrom(await linkTo(draft));

    expect(getScreen()).toBe('kampagne');
    expect(getState().route).toBe('/s/kampagne');
    expect(incomingOf('kampagne')).toBe(true);
    expect(screenIds()).toContain('kampagne');
  });
});

describe('a link carrying nothing this editor can open', () => {
  /** Whatever the fault, this is all the arrival has to say and all it may change. */
  const damaged = async (hash: string) => {
    const opened = await arriveFrom(hash);
    return { opened, notice: noticeOf() };
  };

  it('is one sentence for a fragment that is not a draft', async () => {
    const { opened, notice } = await damaged('#/home?draft=not-a-draft-at-all');

    expect(opened).toBe(false);
    expect(notice).toBe('damaged');
  });

  it('is one sentence for a screen whose name could not be one', async () => {
    const { opened, notice } = await damaged(await linkTo({ ...DRAFT, screen: 'No Where' }));

    expect(opened).toBe(false);
    expect(notice).toBe('damaged');
  });

  it('is one sentence for a document the core will not open', async () => {
    const broken = {
      screen: 'home' as const,
      document: '{"version": 4, "sections": [{"id": "hero"}]}',
    };
    const { opened, notice } = await damaged(await linkTo(broken));

    expect(opened).toBe(false);
    expect(notice).toBe('damaged');
  });

  it('leaves the machine and the tool exactly as they were', async () => {
    window.localStorage.setItem(HOME_KEY, LOCAL);
    const held = formatLayoutDocument(getLayout());
    await arriveFrom('#/home?draft=not-a-draft-at-all');

    expect(window.localStorage.getItem(HOME_KEY)).toBe(LOCAL);
    expect(formatLayoutDocument(getLayout())).toBe(held);
    expect(incomingOf('home')).toBe(false);
  });

  /** An address with no draft is not a fault: it is a person who came to look. */
  it('says nothing at all about an address that carries no draft', async () => {
    expect(await arriveFrom('#/home?d=ipad-mini')).toBe(false);
    expect(noticeOf()).toBeNull();
    expect(incomingOf('home')).toBe(false);
  });

  /**
   * The other half of "a link writes nothing": the address is not written to either.
   *
   * The page rewrites the address on the render after the arrival, and `toAddress` writes
   * the frame's own parameters and a draft is not one of them — so the draft leaves the
   * address there, on its own. Had this put it back, an address that was opened and then
   * edited would go on claiming a draft the tool has moved on from, which is the stale
   * address ADR 0076 §3 refuses. So what is held here is the narrower half: this function
   * does not touch it.
   */
  it('does not write the address back with the draft still in it', async () => {
    const link = await linkTo();
    window.location.hash = link;

    expect(await arriveFrom(link)).toBe(true);
    expect(window.location.hash).toBe(link);
    expect(packedIn(window.location.hash)).not.toBeNull();
  });
});

describe('a link carrying a navigation draft (ADR 0076 §1, the navigation document)', () => {
  const DRAFTED = withMaxTabs(SHIPPED_NAVIGATION, SHIPPED_NAVIGATION.maxTabs === 4 ? 5 : 4);
  const navigationDraft: Draft = {
    screen: NAVIGATION_TARGET,
    document: formatNavigationDocument(DRAFTED),
  };

  beforeEach(() => setNavigation(SHIPPED_NAVIGATION));

  it('opens in the navigation tool and says where it came from', async () => {
    expect(await arriveFrom(await linkTo(navigationDraft))).toBe(true);

    expect(formatNavigationDocument(getNavigation())).toBe(navigationDraft.document);
    expect(navigationIncoming()).toBe(true);
  });

  it('writes nothing into the machine it was opened on', async () => {
    window.localStorage.clear();
    await arriveFrom(await linkTo(navigationDraft));
    expect(window.localStorage.getItem(navigationDraftKey('demo'))).toBeNull();
    expect(kept()).toEqual([]);
  });

  it('publishes on the first edit, and is the editor’s own from then on', async () => {
    await arriveFrom(await linkTo(navigationDraft));
    setNavigation(getNavigation());

    expect(navigationIncoming()).toBe(false);
    expect(window.localStorage.getItem(navigationDraftKey('demo'))).toBe(navigationDraft.document);
  });

  it('leaves the tool unchanged and says so for a document it cannot open', async () => {
    const broken: Draft = { screen: NAVIGATION_TARGET, document: '{"version":99}' };
    expect(await arriveFrom(await linkTo(broken))).toBe(false);

    expect(noticeOf()).toBe('damaged');
    expect(navigationIncoming()).toBe(false);
    expect(formatNavigationDocument(getNavigation())).toBe(
      formatNavigationDocument(SHIPPED_NAVIGATION),
    );
  });
});
