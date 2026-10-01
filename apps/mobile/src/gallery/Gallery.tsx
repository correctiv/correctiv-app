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

import type { ThemePreference } from '@correctiv/app-core/stores/settings';

import { Hairline, Overline, SafeAreaView, Typo } from '@/components/ui';
import { useCoreActions, useTheme } from '@/lib/store/core';
import { useIsDark } from '@/lib/theme';

import { CATALOGUE, componentId, type Folder, type Specimen } from './catalogue';

const SETTINGS: ThemePreference[] = ['system', 'light', 'dark'];

const COMPONENT_COUNT = CATALOGUE.reduce((n, group) => n + group.entries.length, 0);
const SPECIMEN_COUNT = CATALOGUE.reduce(
  (n, group) => n + group.entries.reduce((m, entry) => m + entry.specimens.length, 0),
  0,
);

/** What the page says about itself, in each of the three states an address can ask for. */
const BLURB = {
  all: `${COMPONENT_COUNT} components from src/components, ${SPECIMEN_COUNT} specimens, grouped by folder. A page for developers, published like any other route.`,
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
              'rounded-s px-s py-2xs active:opacity-80',
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
        'mt-2xs rounded-s border border-stroke p-s',
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
 * @param only One component, as `folder/name`. Everything, when absent.
 * @param bare Without the page's own furniture, for a frame that is 393px wide.
 */
export function Gallery({ only, bare }: { only?: string; bare?: boolean }) {
  const groups = shown(only);
  const found = groups.length > 0;
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

        {groups.map((group, g) => (
          // The first folder sits under the page's own header, which is already a
          // break; the gap that separates two folders would read as a hole there.
          <View key={group.folder} className={g === 0 ? (bare ? '' : 'mt-l') : 'mt-4xl'}>
            {bare ? null : (
              <>
                <Hairline />
                <Overline label={`components/${group.folder}`} color="accent" className="mt-s" />
              </>
            )}
            {group.entries.map((entry, i) => (
              <View key={entry.name} className={i === 0 ? (bare ? '' : 'mt-l') : 'mt-4xl'}>
                {/* A rule above every component but the first of its folder. The
                    folder already has one, and two hairlines with nothing between
                    them read as a mistake rather than as a boundary. */}
                {i === 0 ? null : <Hairline className="mb-l" />}
                {bare ? null : <Typo variant="headline-s">{entry.name}</Typo>}
                {entry.note ? (
                  <Typo variant="text-s" color="on-canvas-muted" className="mt-4xs">
                    {entry.note}
                  </Typo>
                ) : null}
                {entry.specimens.map((specimen) => (
                  <SpecimenBlock key={specimen.label} specimen={specimen} />
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
