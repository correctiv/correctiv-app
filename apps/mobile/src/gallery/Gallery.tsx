/**
 * The component gallery: every component in `src/components`, in one scroll.
 *
 * A page for developers and designers, published like any other route: see
 * `src/app/gallery.tsx` for what that costs and for how to reach it while the
 * dev server is running.
 *
 * ## Why the chrome uses the app's own components
 *
 * The labels are `Typo` and `Overline` rather than a bare `Text`, which means a
 * fault in `Typo` disfigures the gallery's own furniture as well as its specimens.
 * That is the lesser risk: no screen in this app sets a text colour through a
 * class, so `text-on-canvas` is an untravelled path, and a gallery whose labels
 * were the first thing to use it would be reporting on itself. The specimens are
 * separated from the chrome by being boxed and outlined instead.
 *
 * ## Why each specimen is drawn twice
 *
 * Once on `canvas` and once on `surface`. A component that reaches for a primitive
 * where it meant a semantic token — `bg-white` for `bg-canvas` — looks right on
 * exactly one of the two, and looks right on both in light mode. Two surfaces and
 * the appearance control below are between them the cheapest way to see it.
 */
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import type { BlockCategory } from '@correctiv/app-core/lib/block-category';
import type { ThemePreference } from '@correctiv/app-core/stores/settings';

import { categoryName } from '@/lib/home/category-labels';
import { Badge, Hairline, SafeAreaView, Typo } from '@/components/ui';
import { FEATURES, featureState, limitReason } from '@correctiv/app-core/features/features';
import { useAppSelector, useCoreActions, useTheme } from '@/lib/store/core';
import { useIsDark } from '@/lib/theme';

import { CATALOGUE, componentId, type Entry, type Folder, type Specimen } from './catalogue';
import { dataOptions, specimensFor, validChoice } from './data-pick';
import { BAUSTEINE, galleryGroups } from './groups';

const SETTINGS: ThemePreference[] = ['system', 'light', 'dark'];

const COMPONENT_COUNT = CATALOGUE.reduce((n, group) => n + group.entries.length, 0);
const SPECIMEN_COUNT = CATALOGUE.reduce(
  (n, group) => n + group.entries.reduce((m, entry) => m + entry.specimens.length, 0),
  0,
);

/**
 * What the page says about itself, in each of the three states an address can ask for.
 *
 * The middle line names the grouping rather than counting it: a figure here would have to
 * be kept in step with `BLOCK_CATEGORIES`, and ADR 0073 §2 refused a second list of
 * families for exactly that reason. "Families, then building blocks" is true of whatever
 * the core holds tomorrow.
 */
const BLURB = {
  all: `${COMPONENT_COUNT} components from src/components, ${SPECIMEN_COUNT} specimens, grouped by block family, then building blocks.`,
  one: 'One component of the catalogue. The reference has its props.',
  none: 'No component of that name. The link that sent you here is out of date.',
};

/**
 * The appearance setting, and what it currently resolves to.
 *
 * Both are printed, because "System" against a dark device is the app's default
 * and the combination that has already shipped broken: the setting alone does not
 * say which palette is on screen. This writes the app's own setting through the
 * store, so it persists exactly as the settings screen's control does — the
 * gallery is not a sandbox.
 */
function Appearance() {
  const setting = useTheme();
  const isDark = useIsDark();
  const actions = useCoreActions();

  return (
    <View className="mt-s">
      <View className="flex-row gap-2xs">
        {SETTINGS.map((value) => (
          <Pressable
            key={value}
            onPress={() => actions.settings.setTheme(value)}
            accessibilityRole="button"
            accessibilityLabel={`Appearance: ${value}`}
            accessibilityState={{ selected: setting === value }}
            className={[
              'rounded-sm px-s py-2xs active:opacity-80',
              setting === value ? 'bg-accent' : 'bg-surface border border-stroke',
            ].join(' ')}
          >
            <Typo variant="text-s" color={setting === value ? 'always-light' : 'on-canvas'}>
              {value}
            </Typo>
          </Pressable>
        ))}
      </View>
      <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
        {`setting ${setting}, painting ${isDark ? 'dark' : 'light'}`}
      </Typo>
    </View>
  );
}

/** One specimen on one surface, outlined and named so the surface is never in doubt. */
function Surface({
  surface,
  children,
}: {
  surface: 'canvas' | 'surface';
  children: Specimen['node'];
}) {
  return (
    <View
      className={[
        'mt-2xs rounded-sm border border-stroke p-s',
        surface === 'canvas' ? 'bg-canvas' : 'bg-surface',
      ].join(' ')}
    >
      <Typo variant="text-s" color="on-canvas-muted" className="mb-2xs">
        {surface}
      </Typo>
      {children}
    </View>
  );
}

/**
 * The one section that holds a single component, said in words.
 *
 * A gallery of components, one per section, happens: filter to one entry with `?c=` and the
 * family it belongs to holds that entry and nothing else. `1 components` reads as a bug, so
 * the singular has its own line. Every other count takes the plural.
 */
const ONE_COMPONENT = '1 component';

const REASONS = {
  declared: 'held back by the release file',
  data: 'sample data only',
  group: 'its group is held back',
  requires: 'a feature it needs is held back',
  unknown: 'no such feature is declared',
} as const;

/**
 * What a release build would do with this component, when it would not draw it.
 *
 * Shown and labelled rather than hidden (ADR 0072 §5): hiding it here would repeat in the
 * gallery the invisibility the feature registry exists to end.
 */
function FeatureMark({ feature }: { feature: string }) {
  const state = useAppSelector((s) => featureState(s, feature));
  const override = useAppSelector((s) => s.features.override);
  if (state === 'an') return null;
  const reason = limitReason(FEATURES, feature, override);
  return (
    <Typo variant="text-s" color="accent" className="mt-4xs">
      {`Feature "${feature}" is ${state}: ${state === 'vorschau' ? 'preview builds only' : 'in no build'}${reason ? ` (${REASONS[reason]})` : ''}.`}
    </Typo>
  );
}

/**
 * Which data the one component on screen is drawn with, in two groups.
 *
 * **Live** is the current fetch and **Beispiel** the named sample variants, each option
 * badged with the provenance its source declares (ADR 0072 §4). The choice is the `p`
 * query value, so a link carries it. Shown for a single component only: on the whole page
 * a choice per entry would be 100 controls, and the default view stays as it was.
 */
const choose = (next: string | undefined) => router.setParams({ p: next });

function DataPicker({ entry, value }: { entry: Entry; value: string | undefined }) {
  const options = dataOptions(entry);
  if (!options) return null;
  const groups = [
    { title: 'Live', kind: 'live' as const, items: options.filter((o) => o.kind === 'live') },
    {
      title: 'Beispiel',
      kind: 'sample' as const,
      items: options.filter((o) => o.kind === 'sample'),
    },
  ];

  return (
    <View className="mt-s">
      <Typo variant="text-s" weight="semibold" color="on-canvas-muted">
        Data
      </Typo>
      <Pressable
        onPress={() => choose(undefined)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === undefined }}
        className="mt-2xs active:opacity-60"
      >
        <Typo variant="text-s" weight={value === undefined ? 'semibold' : 'normal'}>
          Specimens of the catalogue
        </Typo>
      </Pressable>
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <View key={group.kind} className="mt-xs">
            <Typo variant="text-s" color="on-canvas-muted">
              {group.title}
            </Typo>
            {group.items.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => choose(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: value === option.value }}
                className="mt-2xs active:opacity-60"
              >
                <View className="flex-row items-center gap-2xs">
                  <Badge
                    label={option.kind === 'live' ? 'Live' : 'Beispiel'}
                    tone={option.provenance === 'live' ? 'live' : 'neutral'}
                  />
                  <Typo variant="text-s" weight={value === option.value ? 'semibold' : 'normal'}>
                    {option.name}
                  </Typo>
                </View>
                {option.note ? (
                  <Typo variant="text-s" color="on-canvas-muted">
                    {option.note}
                  </Typo>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
    </View>
  );
}

function SpecimenBlock({ specimen }: { specimen: Specimen }) {
  // A component that fills a screen collapses to nothing inside a ScrollView, so
  // it is given a height; everything else is sized by its own content.
  const body = specimen.height ? (
    <View style={{ height: specimen.height }}>{specimen.node}</View>
  ) : (
    specimen.node
  );

  return (
    <View className="mt-ml">
      <Typo variant="text-s" weight="semibold" color="on-canvas-muted">
        {specimen.label}
      </Typo>
      <Surface surface="canvas">{body}</Surface>
      {specimen.ownSurface ? null : <Surface surface="surface">{body}</Surface>}
    </View>
  );
}

/**
 * One way out of a filtered view, as the same pressable text either way.
 *
 * `accessibilityRole` is spelled out at the call sites rather than shortened to
 * `role`, which is the HTML attribute and makes oxlint ask for a `<button>` this
 * file has no way to render.
 */
function Action({
  label,
  accessibilityRole,
  onPress,
}: {
  label: string;
  accessibilityRole: 'button' | 'link';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      className="active:opacity-60"
    >
      <Typo variant="text-s" weight="semibold" color="accent">
        {label}
      </Typo>
    </Pressable>
  );
}

/**
 * Leaves the app for a page beside it, from inside a frame as well as outside one.
 *
 * Relative, so the address resolves under whatever base the site is served from,
 * and neither base is written down anywhere: `/app/gallery` gives `/components`
 * locally, `/correctiv-app/app/gallery` gives `/correctiv-app/components` on Pages.
 *
 * Resolved against THIS window and assigned to the TOP one, and both halves of that
 * matter. In the preview this page is an iframe, so navigating the frame renders
 * the whole workbench, activity bar and status bar and all, inside a 393px device
 * frame — and the preview's route poll then writes `/components` into its own
 * address as if the app were on that route. Resolving against the top window instead
 * would drop the base path, because the shell sits one directory above the app.
 */
function leaveApp(relative: string): void {
  const target = new URL(relative, globalThis.location.href).href;
  (globalThis.top ?? globalThis).location.href = target;
}

/**
 * The two ways out of a filtered view, and the seam this page sits on.
 *
 * The gallery draws the components and the workbench's reference describes them, and
 * for a long time those were two places with no way from one to the other. This is
 * one half of the way; `pages/Components.tsx` is the other.
 *
 * **Back to the reference is web-only, and that is not a shortcut.** The workbench is
 * a website: on the device there is nothing at the other end of that link. It leads
 * somewhere wrong in exactly one place that does have a browser, the app's own dev
 * server, which serves the app and not the workbench, so `../components` is the app's
 * unmatched route there. The address bar says why.
 *
 * The component travels as a query and not as the row's anchor. An anchor has to
 * name the platform (`nav.ts`, `componentId`) and this page cannot say which half of
 * a split component the bundler handed it, so `#c-media-VideoFrame` matched no row
 * at all. `?c=media/VideoFrame` is the same agreement as this page's own address,
 * and the reference resolves it against the rows it actually has.
 */
function Links({ only, found }: { only: string; found: boolean }) {
  return (
    <View className="mt-s flex-row flex-wrap gap-m">
      <Action
        label="All components"
        accessibilityRole="button"
        onPress={() => router.setParams({ c: undefined })}
      />
      {/* Not offered when nothing matched: a name with no specimen has no props
          either, and a link to them would be the second thing on the page
          pretending the name is real. */}
      {Platform.OS === 'web' && found ? (
        <Action
          label="Its props, in the reference"
          accessibilityRole="link"
          onPress={() => leaveApp(`../components?c=${only}`)}
        />
      ) : null}
    </View>
  );
}

/**
 * The catalogue, or the one component the address asked for.
 *
 * Filtering rather than scrolling to an anchor, because the page this feeds is a
 * frame the width of a phone: an anchor there leaves 100 specimens above and below
 * the one somebody clicked, and the scroll position is the only thing saying which
 * of them was meant.
 *
 * An id nothing matches yields an empty list rather than the whole catalogue. A
 * link that has gone stale should say so, not quietly show everything and look
 * like it worked.
 */
function shown(only: string | undefined): Folder[] {
  if (!only) return CATALOGUE;
  return CATALOGUE.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => componentId(group.folder, entry.name) === only),
  })).filter((group) => group.entries.length > 0);
}

/**
 * The key the workbench writes when it opens this app's door for a frame.
 *
 * Spelled here and in `apps/workbench/src/preview/frame/seed.ts`, and nowhere
 * else; `apps/workbench/test/preview/seed.test.ts` fails if the two spellings
 * part. Read with a `try`, because touching `localStorage` is what throws when
 * site data is switched off, and a gallery must not fail to render over it.
 */
const SEEDED_KEY = 'workbench:seeded';

function seededByTheWorkbench(): boolean {
  try {
    return globalThis.localStorage?.getItem(SEEDED_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Whoever is signed in here did not sign in, said on the page.
 *
 * Issue #112. The app's door is a render branch on the session, and the workbench
 * writes one into storage before it points a frame at this route, so a component
 * can be drawn without anybody signing in first. That is the affordance the issue
 * asks for and this line is the other half of it: a door that quietly opens is
 * worse than one that asks.
 *
 * No `__DEV__` branch, deliberately. ADR 0025 measured that a route component
 * returning `null` outside a development build is still pre-rendered into the
 * export as a blank public page, so guarding a component is not the same as
 * keeping something out of a build. The bypass is not in this bundle at all — it
 * is the workbench's code — and what is here is one line that appears only when a
 * key the workbench wrote is present.
 */
function SeededNote() {
  return (
    <Typo variant="text-s" color="on-canvas-muted" className="mb-2xs">
      Session seeded by the workbench, not signed in.
    </Typo>
  );
}

/**
 * The heading over one section: a family a block belongs to, or the building blocks.
 *
 * **A real heading where there was an overline.** It was an `Overline` — twelve pixels,
 * uppercase, letter-spaced — which is the smallest thing a page can draw, over sections that
 * hold forty components each. A design review found the hierarchy unreadable: the section
 * headings were the quietest text on a page made of headings, and a reader could not tell a
 * family from the component under it. `headline-s` bold, above a hairline, with the entry
 * names a step below it at `headline-xs`, is the hierarchy the page was already implying.
 *
 * **A component of its own, and the reason used to be a hook.** `useCategoryLabel` reads the
 * app's `IntlProvider` and React will not let a component call it once per section out of a
 * map; this page asks `categoryName` instead, which is a plain function, and keeps the
 * component because a heading and its count are one row and belong in one element.
 */
function SectionHeading({
  category,
  count,
}: {
  category: BlockCategory | undefined;
  count: number;
}) {
  return (
    <View className="mt-s flex-row items-baseline justify-between gap-s">
      <Typo variant="headline-s" weight="bold">
        {category === undefined ? BAUSTEINE : <FamilyHeading category={category} />}
      </Typo>
      {/*
        How many components are under the heading, which is what makes a section navigable
        before scrolling into it: four or forty reads very differently from a heading with
        nothing beside it. Said in words rather than a bare number, so the reader is not left
        to decide whether 1 is a mistake.
      */}
      <Typo variant="text-s" color="on-canvas-muted" className="shrink-0">
        {count === 1 ? ONE_COMPONENT : `${count} components`}
      </Typo>
    </View>
  );
}

/**
 * A family's name, in the language this page is written in.
 *
 * **English, and `categoryName` rather than `useCategoryLabel`.** The table of six words is
 * the app's and German is what ships in it, but this page is a developer's: it is excluded
 * from both of the app's string checks as `DEVELOPER_ONLY` and its furniture has always been
 * English. A design review found the mixture — English headings and lede, German family
 * headings, English again under them — and read it as a page nobody had decided on. So the
 * page is one language, English, and the six words are printed from the same descriptors'
 * `defaultMessage` rather than from the catalogue: same table, second reader, nothing to
 * translate twice. `lib/home/category-labels.ts` says why that is not a second copy.
 *
 * **The specimens keep their German**, which is not the same decision: they are the app's
 * real components carrying the copy they really carry, so their text is content here, the
 * same way `/handbook`'s English documents are content on a German page (ADR 0052 §1).
 */
function FamilyHeading({ category }: { category: BlockCategory }) {
  return <>{categoryName(category)}</>;
}

/**
 * @param only One component, as `folder/name`. Everything, when absent.
 * @param bare Without the page's own furniture, for a frame that is 393px wide.
 * @param pick The data choice for the one component: `live` or `<domain>/<variant>`.
 */
export function Gallery({ only, bare, pick }: { only?: string; bare?: boolean; pick?: string }) {
  const groups = shown(only);
  const found = groups.length > 0;
  // Grouped by what each component is rather than by the folder it sits in: one section
  // per family a block belongs to, in the core's order, and one for everything that is
  // no block's own drawing. `groups.ts` holds the argument and reads `categoryOf`.
  const sections = galleryGroups(groups);
  const seeded = seededByTheWorkbench();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        // `pt-xs` and not nothing: the first entry's own top margin is dropped in
        // this mode, and a component whose note is the first thing in the frame —
        // 17 of the 44 have one — then began 2px under the frame's top border and
        // read as cut off rather than as the top of the page. Measured in the
        // frame at 393 × 520.
        contentContainerClassName={bare ? 'px-m pt-xs pb-m' : 'px-m pt-m pb-3xl'}
        // Shown in a frame, hidden on the page. A 520px frame cannot hold both
        // surfaces of most components, and without the bar the second one looks
        // cut off rather than scrolled past.
        showsVerticalScrollIndicator={bare}
      >
        {/*
          The furniture, and why a frame does without it. `bare` is for the
          workbench's `/components`, where each row draws its own component in a
          393px frame. Everything here is already on the page around that frame,
          twice in the case of the two links: they point at the reference and at
          this gallery, and the reader clicking them is on the reference looking
          at this gallery. Measured in that frame, the header, the links and the
          appearance control took 340 of 520 pixels and left the component itself
          below the fold, which is the whole reason for the flag.
        */}
        {seeded ? <SeededNote /> : null}

        {bare ? null : (
          <>
            <Typo variant="headline-m">{only ?? 'Component gallery'}</Typo>
            <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
              {only ? (found ? BLURB.one : BLURB.none) : BLURB.all}
            </Typo>
            {only ? <Links only={only} found={found} /> : null}
            <Appearance />
          </>
        )}

        {bare && !found ? (
          <Typo variant="text-s" color="on-canvas-muted">
            {BLURB.none}
          </Typo>
        ) : null}

        {sections.map((section, g) => (
          /*
           * **The gaps between sections were 128 pixels, and that was the dead space a
           * design review named.** `mt-4xl` is the largest step in the scale; between two
           * headings on a page of fifty components it is four blank screens' worth of nothing
           * per section, and it made the next section impossible to see coming while
           * scrolling. `mt-2xl` still says "this is a new group" against the `mt-l` inside
           * one, and the hairline above each heading does the rest. The gap between two
           * components inside a section came down the same way, from `mt-4xl` to `mt-xl`.
           *
           * The first section sits under the page's own header, which is already a break;
           * the gap that separates two sections would read as a hole there.
           */
          <View key={section.key} className={g === 0 ? (bare ? '' : 'mt-l') : 'mt-2xl'}>
            {bare ? null : (
              <>
                <Hairline className={g === 0 ? undefined : 'mt-2xl'} />
                <SectionHeading category={section.category} count={section.entries.length} />
              </>
            )}
            {section.entries.map((entry, i) => (
              <View key={entry.name} className={i === 0 ? (bare ? '' : 'mt-l') : 'mt-xl'}>
                {/* A rule above every component but the first of its section. The
                    section already has one, and two hairlines with nothing between
                    them read as a mistake rather than as a boundary. */}
                {i === 0 ? null : <Hairline className="mb-l" />}
                {/*
                  **A step below the section heading, not level with it.** Both were
                  `headline-s`, which is why the hierarchy read as flat: a component name
                  and a family name were the same size and the same weight, and the eye had
                  nothing to grab on the way down the page. `headline-xs` with the section at
                  `headline-s` bold is the step the page was missing.
                */}
                {bare ? null : (
                  <Typo variant="headline-xs" weight="semibold">
                    {entry.name}
                  </Typo>
                )}
                {/* The block this component draws, where it is one. It is the same word
                    the palette offers it under and the same id the layout document
                    gives it, so a reader who has arranged a screen can find the
                    component behind a block and vice versa. */}
                {bare || entry.block === undefined ? null : (
                  <Typo variant="text-s" color="on-canvas-muted" className="mt-4xs">
                    {entry.block}
                  </Typo>
                )}
                {entry.feature ? <FeatureMark feature={entry.feature} /> : null}
                {entry.note ? (
                  <Typo variant="text-s" color="on-canvas-muted" className="mt-4xs">
                    {entry.note}
                  </Typo>
                ) : null}
                {only && !bare ? (
                  <DataPicker entry={entry} value={validChoice(entry, pick)} />
                ) : null}
                {(only ? specimensFor(entry, validChoice(entry, pick)) : entry.specimens).map(
                  (specimen) => (
                    <SpecimenBlock key={specimen.label} specimen={specimen} />
                  ),
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
