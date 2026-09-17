// `react-native`, which this build aliases to `react-native-web` (vite.app.mjs).
// The stage boxes are views rather than divs because a specimen's own outermost
// element is laid out by its parent, and the app's parent is always a view: a
// view is a flex column that stretches its children, a `<div>` is a block box
// that does neither. Measured on 2026-09-11, with divs: `ui/Badge` and
// `participate/ClaimStatusTag` ran the full width of the column although both
// say `self-start`, because `align-self` means nothing to a child of a block
// box, and `ui/Chip` hugged its label where the app stretches it.
import { View } from 'react-native';

// The app's own environment, the appearance the site is set to, and a boundary
// per drawing: `AppHost.tsx` beside this file holds all three, because the home
// editor draws the app's components too and a fact measured once must not be
// measured again per host (ADR 0045 §3).
import { AppHost, DrawnBoundary } from './AppHost';
import type { DirectSpecimen } from './direct';

/**
 * One or more of the app's specimens, drawn in this site's React tree.
 *
 * What this file decides is the STAGE — which ground the specimen stands on, how
 * wide the column is, whether the label is shown, and that one specimen's fault
 * is one specimen's fault. What the app decides is everything inside
 * `AppEnvironment`, and the split is the point: a stage is this site's business
 * and an environment is the app's.
 *
 * Two things the environment does not supply, and both are deliberate:
 *
 * - **The ports, which are nobody's here.** `packages/app-core`'s default
 *   platform is `createMemoryPlatform()`, so a thunk that reaches for storage or
 *   the bundle gets an empty answer instead of throwing. Nothing in a specimen
 *   dispatches one, and a component that started a fetch on mount degrades rather
 *   than fails.
 * - **The store's persisted state.** `coreStore` is the app's own instance and
 *   the components' bound actions are bound to it, but nothing hydrates it here,
 *   so every slice is at its default. That is what a specimen wants: the props in
 *   the catalogue decide what is drawn, not whatever the last visit left on disk.
 */
export function DirectPreview({
  specimens,
  ground,
  width,
  labels = true,
}: {
  specimens: readonly DirectSpecimen[];
  /** Which of the app's two grounds to stand the specimens on. */
  ground: 'canvas' | 'surface';
  /** A CSS pixel cap on the drawing's column: a device width, or a card's own. */
  width?: number;
  /** Off on a card, where the component is the whole of what there is room for. */
  labels?: boolean;
}) {
  return (
    <AppHost>
      <View
        style={width === undefined ? undefined : { maxWidth: width }}
        className={ground === 'surface' ? 'bg-surface' : 'bg-canvas'}
      >
        {specimens.map((specimen) => (
          <View className="p-s" key={specimen.label}>
            {labels && (
              <p className="mb-2xs font-mono text-s text-on-canvas-muted">{specimen.label}</p>
            )}
            {/*
              A component that fills a screen has no height of its own inside a
              block box and collapses to nothing. The app's own gallery boxes the
              same specimens to the same `height`, which is why the number is the
              catalogue's rather than this file's.
            */}
            <View style={specimen.height === undefined ? undefined : { height: specimen.height }}>
              <DrawnBoundary label={specimen.label}>{specimen.node}</DrawnBoundary>
            </View>
          </View>
        ))}
      </View>
    </AppHost>
  );
}
