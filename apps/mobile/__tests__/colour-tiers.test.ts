import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  filesUnder,
  floorFaults,
  ratchet,
  under,
  withoutComments,
} from '@correctiv/prose-and-code';

/**
 * The check AGENTS.md says does not exist.
 *
 * Its words: "nothing stops you writing `bg-white` where you meant `bg-canvas`.
 * That is a white page on a dark phone, and no check catches it." Typecheck cannot
 * — both names are real tokens. Lint cannot — it is a string. A screenshot can, and
 * only if somebody takes it in the appearance the mistake is wrong in, which is why
 * `TROUBLESHOOTING.md` has a section about exactly that combination.
 *
 * Two tiers are wrong here, for opposite reasons
 * ([ADR 0022](../../../adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md)).
 *
 *  - A **primitive** — `white`, `black`, `neutral-100…700` — names a VALUE and
 *    therefore does not follow the scheme. That is right for a surface that does
 *    not switch either (text on the brand red, the label on club yellow, a scrim
 *    over a photograph) and wrong everywhere else. In this app the right case has
 *    its own spelling, `always-light` / `always-dark`, which every one of its call
 *    sites uses — ADR 0022 counted 45 of them, over the files this walks, and
 *    `DEVELOPER_ONLY` below is why that figure is not 49. So a primitive appearing
 *    here is the wrong case by construction, and needs no exception list at all.
 *    That is the whole reason this check can be strict in `apps/mobile` and could
 *    not be in `packages/app-core`, where the role names do not exist and the
 *    primitives are all there is.
 *  - A **deprecated v1 alias** — `grey-100…700`, `emphasis`, `alternative` — does
 *    follow the scheme and is not a bug. It is upstream's old spelling, kept as an
 *    alias until its consumers have moved, and nothing new should acquire one.
 *
 * `red-500` and `yellow-400` are primitives too and are deliberately NOT checked:
 * they are the brand's two colours, they have no neutral successor to migrate to,
 * and they are the surfaces the exceptions above sit on.
 *
 * Nearly this check already existed in the wrong app,
 * `apps/workbench/test/styles.test.ts`, which forbids a colour LITERAL because the
 * workbench decides no colour. This one is about a token that means the wrong thing,
 * which is the mistake a repository with a palette actually makes.
 */
const SRC = join(__dirname, '..', 'src');

/**
 * The utility prefixes that take a colour, so `bg-white` is a hit and a component
 * called `<Neutral/>` is not. `accent-` is in the list as Tailwind's caret utility
 * and is why every pattern below carries a `(?<![\w-])` — without it `bg-accent-alternative`,
 * a SEMANTIC token, reads as the prefix `accent` followed by the deprecated
 * `alternative` and the check fires on the migration it is supposed to encourage.
 */
const PREFIX =
  '(?:bg|text|border|placeholder|decoration|caret|divide|outline|ring|shadow|fill|stroke|accent|from|via|to)';

/** `bg-grey-250`, `bg-always-dark/70` — the class spelling, with its opacity suffix. */
const utility = (tokens: string) =>
  new RegExp(`(?<![\\w-])${PREFIX}-(${tokens})(?:/\\d+)?(?![\\w-])`, 'g');

/**
 * The other two spellings, which are both a quoted token name: `colors['grey-500']`
 * for a colour read in TypeScript, and `color="grey-500"` for `Typo`'s prop. A bare
 * quoted name is not enough on its own — `tone="emphasis"` is a `Badge` variant
 * that happens to be named after the old token, and `type Tone = 'emphasis' | …`
 * declares it. So the line has to be applying a colour as well, which is the same
 * device `apps/workbench/test/styles.test.ts` uses to tell a hex it applies from a
 * hex it is talking about.
 */
const quoted = (tokens: string) => new RegExp(`(?<![\\w-])['"](${tokens})['"](?![\\w-])`, 'g');

/**
 * The fourth spelling, and the one the house idiom points straight at:
 * `colors.white`. Dot access carries no quotes for `quoted` to find, `colors.accent`
 * is written at twenty sites, and `lib/theme/useColors.ts` recommends the static
 * `colors` import for exactly the primitive case — so this is the bypass the next
 * developer reaches for by following that file's own advice, and it was open.
 *
 * Only `white`, `black`, `emphasis` and `alternative` can be written this way at
 * all: `colors['grey-500']` needs its brackets because a hyphen is not an
 * identifier, and that spelling is already `quoted`'s. Gated by `APPLIES` like
 * `quoted`, for the same reason and at no cost — every palette is bound as `colors`
 * or `palette`, so the line names one by construction.
 */
const member = (tokens: string) => new RegExp(`(?<=[\\w)\\]])\\.(${tokens})(?![\\w-])`, 'g');

const APPLIES = /colou?r|palette|tint|background/i;

const PRIMITIVE = 'white|black|neutral-\\d+';
const V1_ALIAS = 'grey-\\d+|emphasis|alternative';

/**
 * The gallery, excluded for the reason `__tests__/localisation-seam.test.ts`
 * excludes it and so that the two checks read one app rather than two: it is a
 * developer's catalogue of the components and is read by nobody else.
 *
 * It is also a catalogue OF the palette, which prints token names as captions — so
 * a specimen labelled `bg-white` would fail this check for naming a token rather
 * than painting with one, and the only way to pass would be to stop documenting it.
 *
 * It holds no primitive and no v1 alias today, so the scope costs this check
 * nothing and settles a figure that was moving: `always-*` is 45 call sites without
 * the gallery, which is what ADR 0022 counted, and 49 with it.
 */
const DEVELOPER_ONLY = /^gallery\//;

const FILES = filesUnder(SRC, /\.(tsx?|css)$/).filter(
  (path) => !DEVELOPER_ONLY.test(under(SRC, path)),
);

interface Use {
  /** Path under `src/`, with `/` on every OS. */
  file: string;
  token: string;
  line: number;
}

function uses(tokens: string): Use[] {
  const asClass = utility(tokens);
  const asName = quoted(tokens);
  const asProperty = member(tokens);
  return FILES.flatMap((path) => {
    const file = under(SRC, path);
    return withoutComments(readFileSync(path, 'utf8'))
      .split('\n')
      .flatMap((text, index) => {
        const found = [...text.matchAll(asClass)];
        if (APPLIES.test(text)) found.push(...text.matchAll(asName), ...text.matchAll(asProperty));
        return found.map(([, token]) => ({ file, token, line: index + 1 }));
      });
  });
}

/** `app/atlas.tsx: grey-500` — the key the ratchet below counts and excuses by. */
const site = ({ file, token }: Use) => `${file}: ${token}`;

/**
 * **What a green run here does NOT mean**, at the top of the assertions rather than
 * at the bottom of the file, because the sentence in AGENTS.md is read by people who
 * will never open this one.
 *
 * This reads four spellings of a token NAME: the class (`bg-white`), the quoted key
 * (`colors['white']`), the prop (`color="white"`) and the property (`colors.white`),
 * the last three only on a line that also mentions colour. Everything else is
 * invisible:
 *
 *  - a class assembled at runtime, `` `bg-${tone}` ``, and a token reached through a
 *    variable, `colors[token]` — `Typo` does the second one on the `color` prop it
 *    is handed, so this check sees the call site and never the value;
 *  - a palette bound to a name with no colour in it: `const p = useColors()` and
 *    then `p.white` fails `APPLIES` and passes;
 *  - a colour that is not a token at all. Two hex literals live in `src` today
 *    (`VideoFrame.tsx` `#000`, `ClaimStatusTag.tsx` `#2e7d4f`) and `app.json` ships
 *    `#ffffff` as the splash and adaptive-icon background, which is literally the
 *    white page on a dark phone this tier is about. `apps/workbench/test/styles.test.ts`
 *    is the check for a literal; extending it to two more hosts is its own argument.
 *
 * None of these is accommodated here, and none should be quietly: each one is a PR
 * to have rather than a pattern to widen.
 */
describe('colour comes from the tier that means the role', () => {
  it('reads the app it is checking (guards against a silently empty walk)', () => {
    // A walk that matched nothing writes no offenders, and every assertion below
    // passes over it.
    expect(floorFaults({ 'files under src/': { found: FILES.length, atLeast: 50 } })).toEqual([]);
  });

  it('writes no primitive where a semantic token exists', () => {
    // No exception list, and that is the point: the case a primitive is right for
    // is spelled `always-light` / `always-dark` in this app, so there is nothing
    // left for `bg-white` to be except `bg-canvas` written wrong. A fourth kind of
    // exception is an argument to have in a PR, not a line to add here.
    const offenders = uses(PRIMITIVE).map(({ file, token, line }) => `${file}:${line} → ${token}`);

    expect(offenders).toEqual([]);
  });
});

/**
 * The three v1 aliases that have no semantic successor yet, and ADR 0022's reason
 * for each. Named one by one rather than waving the tier through: the other seven
 * (`grey-100`, `grey-200`, `grey-400`, `grey-600`, `grey-700`, `emphasis`,
 * `alternative`) all have a successor that is value-identical in both schemes, so
 * there is no argument for a new use of one and no line here to write it on.
 */
const NO_SUCCESSOR: Record<string, string> = {
  // Upstream dropped #f0f0f0 from the ramp with "no replacement".
  'grey-250': 'Badge’s neutral fill and ClaimStatusTag',
  // `neutral-200` as a FILL; the semantic tier has no surface at #e6e6e6.
  'grey-300': 'Thumbnail’s placeholder and SettingRow’s switch track',
  // No foreground token is that faint. `stroke-strong` shares the value and names
  // a line, which is a different thing to say.
  'grey-500': 'faint text: placeholders, chevrons, inactive tabs',
};

/**
 * Where each of them is still written, and how many times — the ratchet, in the
 * shape `__tests__/localisation-seam.test.ts` uses and for the same two reasons.
 *
 * Asserted in BOTH directions. A v1 alias in a file that is not here fails, and so
 * does a file here that no longer has as many as it claims — so migrating one takes
 * its number down with it and cannot leave an excuse behind for the next person to
 * read as permission.
 *
 * The counts are per file AND per token because "anywhere new" includes a fourth
 * `grey-500` in a file that already had three — so the key is `file: token` and the
 * value is how many, which is the counted form `ratchet` takes. Fifty uses across
 * thirty-four files on 2026-09-15; forty-five of them are `grey-500`, which is the
 * same forty-five ADR 0022 counted, arrived at independently.
 */
const STILL_ON_THE_V1_TIER: Record<string, number> = {
  'app/(tabs)/_layout.tsx: grey-500': 1,
  'app/(tabs)/_layout.web.tsx: grey-500': 1,
  'app/(tabs)/mitmachen.tsx: grey-500': 1,
  'app/atlas.tsx: grey-500': 5,
  'app/aufruf/[slug].tsx: grey-500': 2,
  'app/backstage.tsx: grey-500': 4,
  'app/behauptung/[id].tsx: grey-500': 2,
  'app/faktenforum.tsx: grey-500': 1,
  'app/formular.tsx: grey-500': 1,
  'app/gespeichert.tsx: grey-500': 2,
  'app/player.tsx: grey-500': 3,
  'app/spotlight.tsx: grey-500': 1,
  'app/suche.tsx: grey-500': 1,
  'app/tagebuch/[id].tsx: grey-500': 1,
  'app/video.tsx: grey-500': 1,
  'components/discover/ProjectRow.tsx: grey-500': 1,
  'components/discover/SampleHitRow.tsx: grey-500': 2,
  'components/discover/SearchEntry.tsx: grey-500': 1,
  'components/feed/ArticleHero.tsx: grey-500': 1,
  'components/feed/ArticleRow.tsx: grey-500': 1,
  'components/gate/LoginGate.tsx: grey-500': 2,
  'components/home/SpotlightBriefing.tsx: grey-500': 1,
  'components/media/EpisodeRow.tsx: grey-500': 1,
  'components/media/MediaCard.tsx: grey-500': 1,
  'components/media/SeriesTile.tsx: grey-500': 1,
  // `grey-250` left this file in #151, which moved the progress track to `stroke`.
  'components/participate/CalloutCard.tsx: grey-500': 1,
  'components/participate/ClaimStatusTag.tsx: grey-250': 1,
  'components/participate/FormField.tsx: grey-500': 1,
  'components/player/MiniPlayer.tsx: grey-500': 1,
  'components/profile/NavCard.tsx: grey-500': 1,
  'components/profile/SettingRow.tsx: grey-300': 1,
  'components/profile/SettingRow.tsx: grey-500': 1,
  'components/ui/Badge.tsx: grey-250': 1,
  'components/ui/Thumbnail.tsx: grey-300': 1,
};

describe('the deprecated v1 tier only leaves', () => {
  const { arrivals, stale } = ratchet(uses(V1_ALIAS).map(site), STILL_ON_THE_V1_TIER);

  it('acquires no new use of a v1 alias', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that has since been migrated', () => {
    // The direction a one-sided list cannot do, and the one that makes the
    // migration finishable: the last `grey-500` to go takes this file's last entry
    // with it, and then the whole tier is gone rather than merely tolerated.
    expect(stale).toEqual([]);
  });

  it('excuses only the three aliases ADR 0022 says have no successor', () => {
    // A ratchet that takes any v1 name would let `bg-grey-100` in behind a file
    // that was already listed for `grey-500`, and `grey-100` is `canvas`.
    const unexplained = Object.keys(STILL_ON_THE_V1_TIER).filter(
      (entry) => !NO_SUCCESSOR[entry.split(': ')[1]],
    );

    expect(unexplained).toEqual([]);
  });
});
