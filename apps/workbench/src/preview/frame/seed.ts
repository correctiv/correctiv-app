/**
 * Storage fixtures: what the app finds when it boots.
 *
 * The shell and the app share an origin, so `window.localStorage` here **is** the
 * app's storage. Writing it before the frame is pointed at a route is therefore
 * the whole mechanism — no handshake, no cooperation from the app, and it works
 * against the static export too, where the dev handle does not exist.
 *
 * This is the half of state control a dispatch cannot do: `onboardingDone` is
 * read by the root layout before the first render, and the feed cascade consults
 * the cache on its way up. Everything that can wait until after boot goes through
 * the handle instead (`frame/handle.ts`), because that speaks the core's
 * vocabulary rather than copying its storage layout.
 *
 * Two things about the layout, both load-bearing and both cheap to get wrong:
 * `persist()` writes back only the keys a slice declares, so anything invented
 * here is dropped on the app's first write; and a payload that is not valid JSON
 * is not ignored but **deleted**, and the slice starts empty.
 *
 * ## What is a message here and what is not
 *
 * A fixture's name and the line under it are this site's own words and follow the
 * language setting
 * ([ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * Everything else in this file is the payload — an account, an entitlement, two
 * saved articles, a submitted form — and none of it is read by anybody on this
 * page: it is written into storage for the app to find, so it is in whatever
 * spelling the app expects. `Handbuch` is the sharpest case and its own docblock
 * below says why it is German and must stay German.
 *
 * `wbMessage()` and not `defineMessages`, because this module runs before the
 * frame boots and may not pull React in; `src/i18n/messages.ts` says why it takes
 * one descriptor per call. `preview/ui/Panels.tsx` is what formats them;
 * `window.preview.fixtures()` hands the descriptors on as they are, so an
 * automation reads a stable id and the English rather than whatever language the
 * person at the keyboard has chosen.
 */
import type { Entitlement } from '@correctiv/app-core/types/models';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';

/**
 * The app's two MMKV stores, as they land in `localStorage` on the web target.
 *
 * MMKV's web build gives each instance its own key prefix, `<id>` followed by a
 * backslash — see `LOCAL_STORAGE_KEY_WILDCARD` in `react-native-mmkv`. The ids
 * come from `apps/mobile/src/lib/platform/expo.ts`, which is the only place the
 * app names them, and `test/preview/seed.test.ts` holds the two spellings
 * together. They are also the reason a fixture cannot accidentally seed a bookmark
 * into the cache: the app keeps what the reader chose and what it may evict in two
 * separate stores.
 */
const STATE_PREFIX = 'correctiv.state\\';
const CACHE_PREFIX = 'correctiv.cache\\';

/** `packages/app-core/src/services/cache.service.ts` — djb2, kept identical. */
function fileKey(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const blobKey = (ns: string, key: string) => `${CACHE_PREFIX}${ns}/${fileKey(key)}.json`;

/** Feeds that carry articles: `CONTENT_FEEDS`, i.e. everything but `europe`. */
const CONTENT_FEEDS = ['recherchen', 'faktencheck', 'klima', 'schweiz', 'lokal', 'salon5'];

const ONBOARDED = {
  onboardingDone: true,
  pushOptIn: false,
  textScale: 1,
  newsletter: { spotlight: false, spotlightCh: false, klima: false },
  theme: 'system',
};

/**
 * Through the door. The root layout renders the gate in place of every route
 * until the session carries an entitlement with the app in it, so every fixture
 * that wants to show a screen has to carry this. It is what a sign-in leaves on
 * disk: the account and the entitlement, no status. `stores/session.ts` derives
 * the status from the account on hydration.
 */
const SIGNED_IN = {
  account: { email: 'alex.beispiel@example.org', name: 'Alex Beispiel' },
  entitlement: {
    tier: 'paid',
    appAccess: true,
    source: 'paid',
    validUntil: null,
    localAreas: [],
    memberSince: '2026-03-04T09:12:00.000Z',
  },
};

/**
 * The same, under a name that is obviously not a person.
 *
 * What `holdTheDoorOpen` writes when it opens the gate for a frame. The account
 * name reaches the app's profile screen, so a developer looking at a framed
 * screen sees "Handbuch" where an account name belongs and knows the session was
 * not signed into. German, because this one string is read by the app's own user
 * interface rather than by a developer; the marker beside it is not.
 */
const HELD_OPEN = {
  account: { email: 'handbuch@example.org', name: 'Handbuch' },
  entitlement: SIGNED_IN.entitlement,
};

/** A member of the 0 € tier: signed in, and the app is not part of it. */
const NO_ACCESS = {
  account: { email: 'frei@example.org', name: 'Frei' },
  entitlement: {
    tier: 'free',
    appAccess: false,
    source: null,
    validUntil: null,
    localAreas: [],
    memberSince: '2026-03-04T09:12:00.000Z',
  },
};

/**
 * A 0 € member whose local newsletter includes the app: inside the door, and in the
 * `free-members` audience rather than `paying-members` (ADR 0060 §4).
 *
 * The one reader the audiences can tell apart from the ordinary sign-in, which is why it
 * is a fixture: previewing the home screen for an audience is this tool and the timeline
 * together, not a mechanism of its own. `models.ts` describes the entitlement — a local
 * bundle includes the app "without being an app membership", so the tier stays the
 * membership's own. The simulated sign-in gives `lokal` addresses a paid tier, and this is
 * the other case the type allows.
 */
const FREE_LOCAL = {
  account: { email: 'lokal.frei@example.org', name: 'Lokal Frei' },
  entitlement: {
    tier: 'free',
    appAccess: true,
    source: 'local-bundle',
    validUntil: null,
    localAreas: ['Gelsenkirchen'],
    memberSince: '2026-03-04T09:12:00.000Z',
  },
};

export interface Fixture {
  id: string;
  label: WorkbenchMessage;
  /** What this is for, in one line. Shown next to the control. */
  hint: WorkbenchMessage;
  write(store: Storage): void;
}

const kv = (store: Storage, slice: string, value: unknown) =>
  store.setItem(`${STATE_PREFIX}store.${slice}`, JSON.stringify(value));

/**
 * The mark this tool leaves when it opens the app's door for a frame.
 *
 * Issue #112: a door that quietly opens is worse than one that asks. Nothing
 * about a seeded session looks different from a real sign-in from inside the
 * app, so the app is told, in one key, and prints it where a developer will see
 * it — `apps/mobile/src/gallery/Gallery.tsx`, which is the page every framed
 * component is drawn on.
 *
 * Outside the app's own store on purpose. `persist()` writes back only the keys a
 * slice declares, so anything invented under `store.` is dropped on the app's
 * first write; this is not the core's state and must not look like it. It is also
 * one greppable string, which is what the issue asks for: `workbench:seeded`
 * appears in exactly two files, and `test/preview/seed.test.ts` fails if the two
 * ever spell it differently.
 *
 * The bypass itself cannot reach a production build for a simpler reason than a
 * `__DEV__` branch: it is not in the app. `holdTheDoorOpen` is this package's
 * code, the app's own bundle contains nothing that opens its gate, and the same
 * test asserts that too.
 */
export const SEEDED_KEY = 'workbench:seeded';

/**
 * Everything the app owns, plus the mark above, and nothing else.
 *
 * `SEEDED_KEY` by name and not by its `workbench:` prefix, which is the kind of
 * shortcut that would be wrong the day something else took the prefix — and one
 * already has: `theme.ts` keeps the reader's own appearance setting under
 * `workbench:appearance`, and a fixture that wiped the prefix would put the site
 * back to "System" because somebody asked to see the app signed out.
 */
function clearApp(store: Storage): void {
  for (const key of Object.keys(store)) {
    if (key.startsWith(STATE_PREFIX) || key.startsWith(CACHE_PREFIX) || key === SEEDED_KEY) {
      store.removeItem(key);
    }
  }
}

export const FIXTURES: Fixture[] = [
  {
    id: 'fresh',
    label: wbMessage({ id: 'fixtures.fresh', defaultMessage: 'Fresh install' }),
    hint: wbMessage({
      id: 'fixtures.fresh.hint',
      defaultMessage: 'Nothing stored. The app starts at the sign-in, signed out.',
      description:
        'The line under the “Fresh install” fixture. “The door” is the sign-in gate the app’s root layout renders in place of every route until a session carries an entitlement; every hint in this group calls it that.',
    }),
    write: () => {},
  },
  {
    id: 'signed-in',
    label: wbMessage({ id: 'fixtures.signedIn', defaultMessage: 'Signed in' }),
    hint: wbMessage({
      id: 'fixtures.signedIn.hint',
      defaultMessage: 'A member’s first start: past the sign-in, into the onboarding.',
    }),
    write: (s) => kv(s, 'session', SIGNED_IN),
  },
  {
    id: 'no-access',
    label: wbMessage({ id: 'fixtures.noAccess', defaultMessage: 'Signed in, no app access' }),
    hint: wbMessage({
      id: 'fixtures.noAccess.hint',
      defaultMessage: 'A member paying 0 €. The sign-in sends them to the upgrade.',
      description:
        'The line under the “Signed in, no app access” fixture. The 0 € tier is CORRECTIV’s free membership, which does not include the app; 0 € is a price and stays as it is written.',
    }),
    write: (s) => kv(s, 'session', NO_ACCESS),
  },
  {
    id: 'onboarded',
    label: wbMessage({ id: 'fixtures.onboarded', defaultMessage: 'Onboarded' }),
    hint: wbMessage({
      id: 'fixtures.onboarded.hint',
      defaultMessage: 'The ordinary case: the app starts on Home.',
      description:
        'The line under the “Onboarded” fixture. “Home” is the app’s first tab, which the app itself calls “Start”.',
    }),
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
    },
  },
  {
    id: 'free-member',
    label: wbMessage({
      id: 'fixtures.freeMember',
      defaultMessage: 'Free member, local newsletter',
      description:
        'A fixture in the state tool: a member of the 0 € tier whose local newsletter subscription includes the app.',
    }),
    hint: wbMessage({
      id: 'fixtures.freeMember.hint',
      defaultMessage: 'A free member instead of a paying one. The app starts on Home.',
      description:
        'The line under the “Free member, local newsletter” fixture. “Home” is the app’s first tab, which the app itself calls “Start”.',
    }),
    write: (s) => {
      kv(s, 'session', FREE_LOCAL);
      kv(s, 'settings', ONBOARDED);
    },
  },
  {
    id: 'saved',
    label: wbMessage({ id: 'fixtures.saved', defaultMessage: 'Saved articles' }),
    hint: wbMessage({
      id: 'fixtures.saved.hint',
      defaultMessage: 'Without this, the Saved tab is empty.',
      description:
        'The line under the “Saved articles” fixture. /gespeichert is a route in the app and stays in its own spelling.',
    }),
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      kv(s, 'savedArticles', {
        items: [
          {
            url: 'https://correctiv.org/faktencheck/2026/07/29/roboter-greift-menschen-an-video-ist-inszeniert/',
            title: 'Roboter greift Menschen an: Video ist inszeniert',
            kicker: 'Faktencheck',
            rating: 'falsch',
            savedAt: '2026-08-30T10:00:00.000Z',
          },
          {
            url: 'https://correctiv.org/russland/2026/08/11/russisches-haus-ein-ende-fuer-propaganda-und-spionage/',
            title: 'Russisches Haus, ein Ende für Propaganda und Spionage?',
            kicker: null,
            rating: null,
            savedAt: '2026-08-29T08:00:00.000Z',
          },
        ],
      });
    },
  },
  {
    id: 'interests',
    label: wbMessage({ id: 'fixtures.interests', defaultMessage: 'Interests picked' }),
    hint: wbMessage({
      id: 'fixtures.interests.hint',
      defaultMessage: 'A personal Home: more feeds, and blocks in a different order.',
      description:
        'The line under the “Interests picked” fixture. “Home” is the app’s first tab, which the app itself calls “Start”; a module is one block of that screen.',
    }),
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      kv(s, 'interests', { selected: ['klima', 'faktenchecks', 'jugend'] });
    },
  },
  {
    id: 'submitted',
    label: wbMessage({
      id: 'fixtures.submitted',
      defaultMessage: 'Callout answered',
      description:
        'A fixture in the state tool. A callout is an open call to readers to send something in; the app calls that screen “Mitmachen”.',
    }),
    hint: wbMessage({
      id: 'fixtures.submitted.hint',
      defaultMessage: 'The form shows its thank-you instead of the questions.',
    }),
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      kv(s, 'participation', {
        submissions: [
          {
            calloutSlug: 'zukunft-von-correctiv',
            answers: { themen: ['klima', 'lokal'], wunsch: 'Mehr Lokales.', kontakt: '' },
            submittedAt: '2026-08-31T12:00:00.000Z',
          },
        ],
      });
    },
  },
  {
    id: 'bundle',
    label: wbMessage({
      id: 'fixtures.bundle',
      defaultMessage: 'Bundled content only',
      description:
        'A fixture in the state tool: the app falls back to the articles shipped inside the binary, because nothing fresher is in the cache.',
    }),
    hint: wbMessage({
      id: 'fixtures.bundle.hint',
      defaultMessage: 'The app shows only the content it shipped with, as if offline.',
      description:
        'The line under the “Bundled content only” fixture. “offline” is the literal value of the feed status in the core’s own state and stays as it is written.',
    }),
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      // A STALE and EMPTY entry, which is the only combination that reaches the
      // fallback: fresh-and-empty short-circuits to `ready` with nothing in it
      // (`[]` is truthy), and no entry at all would work too but leaves the
      // 8-second fetch timeout in the way on a host that can reach the network.
      const stale = JSON.stringify({ data: [], ts: Date.now() - 16 * 60 * 1000 });
      for (const key of CONTENT_FEEDS) s.setItem(blobKey('feeds', key), stale);
    },
  },
  {
    id: 'big-type',
    label: wbMessage({ id: 'fixtures.bigType', defaultMessage: 'Largest text scale' }),
    hint: wbMessage({
      id: 'fixtures.bigType.hint',
      defaultMessage: 'A++ (1.15). The article view is the first thing to break at this size.',
      description:
        'The line under the “Largest text scale” fixture. A++ is the app’s own name for that step of the text-size control and stays as it is written; 1.15 is the factor it multiplies by. “The reader” here is the article view, not a person.',
    }),
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', { ...ONBOARDED, textScale: 1.15 });
    },
  },
];

/**
 * The session as the app holds it in storage, as text, for a `useSyncExternalStore`.
 *
 * ADR 0060 §4: the home tool says whose screen it shows, and the answer has to be the one
 * the frame is showing. Read at render time off the fixture in the address it was wrong on
 * a first visit, where `Preview.tsx` holds the door open for a paid member in an effect that
 * runs AFTER the tool rendered, and it never followed a sign-in or sign-out inside the frame
 * (review of #250, item 2). So the tool reads the storage, and listens: the frame is another
 * document on this origin, so its own writes arrive as `storage` events, and this page's
 * writes, which fire none here, announce themselves with the event below.
 */
export const SESSION_EVENT = 'workbench:session';

function announceSession(): void {
  try {
    window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    // Not in a browser (a test, the dev server's endpoint): there is nobody to tell.
  }
}

export function subscribeSession(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(SESSION_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SESSION_EVENT, onChange);
  };
}

/** The stored session's text, or null for none or a store that cannot be read. */
export function sessionSnapshot(store?: Storage): string | null {
  try {
    return (store ?? window.localStorage).getItem(`${STATE_PREFIX}store.session`);
  } catch {
    return null;
  }
}

/** The entitlement in a stored session's text, or null. */
export function entitlementIn(text: string | null): Entitlement | null {
  try {
    const held = text ? (JSON.parse(text) as { entitlement?: Entitlement | null }) : null;
    return held?.entitlement ?? null;
  } catch {
    return null;
  }
}

/**
 * Wipes the app's storage and writes one fixture.
 *
 * Always a full wipe first, so a fixture describes a whole state rather than a
 * patch on whatever the last visit left behind. Seeding is a boot-time input,
 * not durable state: the app's own `persist()` overwrites these keys 250 ms after
 * anything changes.
 *
 * An id nothing answers to leaves the storage alone instead of wiping it. A link
 * naming a fixture that has since been renamed should open the app, not clear
 * whatever the person looking at it had set up.
 */
export function applyFixture(store: Storage, id: string): void {
  const chosen = FIXTURES.find((f) => f.id === id);
  if (!chosen) return;
  clearApp(store);
  chosen.write(store);
  announceSession();
}

/**
 * Opens the door, and touches nothing else.
 *
 * `applyFixture` above is for someone who asked for a state: it wipes first, so a
 * fixture describes a whole state rather than a patch. That is wrong for a frame
 * that appears because a reader opened a component's page — they asked to see a
 * button drawn, not to have the demo app's saved articles cleared.
 *
 * So: the session key, and only when the door is actually shut. Nothing else is
 * read or written, and a reader who is already signed in keeps the account they
 * signed in with.
 *
 * A frame does need this. The app's root layout renders the gate INSTEAD of the
 * router until the session carries an entitlement, so a frame pointed at
 * `/gallery` without one draws the sign-in form, which is what the link out of
 * the component reference did for every reader of the published site. Storage is the only
 * key that works there, because the static export carries no dev handle to
 * dispatch through, which is the same argument the file header makes.
 *
 * **It says so, which is the whole of issue #112.** The account it writes is
 * named `Handbuch` rather than a plausible person, and it sets `SEEDED_KEY`
 * beside it; the app's gallery prints one line when that key is there, so a
 * developer looking at a framed component can tell a held door from a sign-in.
 * A door that quietly opens is worse than one that asks.
 *
 * `settings` is deliberately left alone here: the onboarding redirect fires only
 * from `/`, and nothing on `/components/<group>/<name>` starts there. What it
 * writes does outlive the page, like every fixture — the next visit to `/preview`
 * that names no fixture finds this session rather than the door. `/preview`'s own
 * main frame DOES start at `/`, so it calls `ensureOnboarded` alongside this one
 * below rather than widening this function's contract for a caller that never
 * needed it.
 *
 * **Two `try` blocks and not one.** A store that cannot be read is the ordinary
 * case, and the answer to it is to write; a store that cannot be *written* is a
 * browser with site data switched off, and there is no answer to it at all. One
 * block put the write in the catch of the read, so a blocked store threw out of
 * the effect that calls this and React unmounted the page: measured against a
 * `localStorage` whose accessors throw `SecurityError`, the component reference
 * rendered its error boundary and none of its rows. A frame that draws the door
 * is worse than one that draws a component and far better than no reference page.
 */
export function holdTheDoorOpen(store: Storage): void {
  try {
    const raw = store.getItem(`${STATE_PREFIX}store.session`);
    const held = raw
      ? (JSON.parse(raw) as { entitlement?: { appAccess?: unknown } }).entitlement?.appAccess
      : false;
    if (held === true) return;
  } catch {
    // Unparsable is the same as shut. `persist()` deletes a payload that is not
    // valid JSON, so writing over it loses nothing that would have survived.
  }
  try {
    kv(store, 'session', HELD_OPEN);
    store.setItem(SEEDED_KEY, new Date().toISOString());
    announceSession();
  } catch {
    // Site data switched off. Nothing can be seeded, and nothing may throw.
  }
}

/**
 * Marks onboarding done for the session `holdTheDoorOpen` admitted, so the
 * root layout's redirect does not trade the sign-in form for "Los geht's".
 *
 * A door held open with no completed onboarding is the same fault one screen
 * later: still nothing behind it for a tool built to show the Home screen —
 * `/preview` with the home tool open and no `s=` landed here, edits reaching
 * storage and no screen for them to redraw. `AppFrame.tsx`'s routes are never
 * `/`, so onboarding never entered play there and `holdTheDoorOpen` was right
 * to leave `settings` alone for it; `/preview`'s own frame starts at `/` and
 * needs both.
 *
 * Gated on `SEEDED_KEY`, the same marker `holdTheDoorOpen` writes, so this
 * only ever completes the synthetic "Handbuch" account's onboarding — never a
 * real visitor's own progress, which is exactly as much theirs to skip as
 * their sign-in is. Additive like `holdTheDoorOpen`: an existing `settings`
 * value keeps every field it already had.
 */
export function ensureOnboarded(store: Storage): void {
  try {
    if (!store.getItem(SEEDED_KEY)) return;
    const raw = store.getItem(`${STATE_PREFIX}store.settings`);
    const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (settings.onboardingDone === true) return;
    kv(store, 'settings', { ...settings, onboardingDone: true });
  } catch {
    // Unparsable or unwritable: the same two faults `holdTheDoorOpen` guards
    // against, and the same answer — nothing here may throw.
  }
}
