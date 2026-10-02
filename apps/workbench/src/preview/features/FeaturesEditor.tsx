import { Lock, TriangleAlert } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { defineMessages } from 'react-intl';

import type { FeatureState } from '@correctiv/app-core/features/features';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { useToolActions } from '../../shell/actions';
import { Segmented } from '../../ui/kit/segmented';
import { copyNow } from '../clipboard';
import {
  declaredGroup,
  featuresDiffer,
  membersOf,
  NO_DRAFT,
  sampleOnly,
  selectable,
  SHIPPED_FEATURES,
  shownState,
  sourcesOf,
  STATES,
  withFeature,
  withGroup,
} from './document';
import { getFeatures, setFeatures, subscribeFeatures } from './store';
import { submitFeatures } from './write';

/** Everything this tool says, in ENGLISH; the German that ships is `src/i18n/catalogue/de/features.ts`. */
const COPY = defineMessages({
  lead: {
    id: 'features.lead',
    defaultMessage:
      'What a build may let a reader reach. A group is the ceiling of its features. Changes here are tried out in the frame, which reloads; releasing them is a submission that becomes a pull request.',
    description: 'The one paragraph at the top of the feature tool.',
  },
  group: {
    id: 'features.group',
    defaultMessage: 'Group {name}',
    description:
      'The accessible name of the switch of one group. {name} is the group’s id from features.json, which is an identifier and is never translated.',
  },
  feature: {
    id: 'features.feature',
    defaultMessage: 'Feature {name}',
    description:
      'The accessible name of the switch of one feature. {name} is the feature’s id from features.json, which is an identifier and is never translated.',
  },
  locked: {
    id: 'features.locked',
    defaultMessage: 'always on',
    description:
      'Beside a group that cannot be switched: it is the core of the app, and neither a commit’s mistake nor an override can turn it down.',
  },
  stateAus: {
    id: 'features.state.aus',
    defaultMessage: 'Off',
    description:
      'One segment of the three-state switch: the feature is reachable in no build. features.state.vorschau and features.state.an are the other two.',
  },
  stateVorschau: {
    id: 'features.state.vorschau',
    defaultMessage: 'Preview',
    description:
      'One segment of the three-state switch: reachable in the preview channel, not in a release build. The state is called vorschau in features.json.',
  },
  stateAn: {
    id: 'features.state.an',
    defaultMessage: 'On',
    description:
      'One segment of the three-state switch: reachable in every build. Not selectable while the data is sample only or while the group is lower.',
  },
  live: {
    id: 'features.source.live',
    defaultMessage: 'Live',
    description:
      'The badge on a data source that is read from the outside world. features.source.sample is its opposite. The gallery uses the same word.',
  },
  sample: {
    id: 'features.source.sample',
    defaultMessage: 'Example',
    description:
      'The badge on a data source that is a checked-in stand-in for an API that does not exist yet. features.source.live is its opposite. The gallery says Beispiel for it.',
  },
  sampleOnly: {
    id: 'features.sampleOnly',
    defaultMessage: 'Example data only, preview at most.',
    description:
      'The warning under a feature whose every data source is a sample. “On” cannot be chosen for it (ADR 0072 §4).',
  },
  noData: {
    id: 'features.noData',
    defaultMessage: 'reads no data',
    description: 'Where the sources of a feature would be listed, and it reads none.',
  },
  groupCeiling: {
    id: 'features.groupCeiling',
    defaultMessage: 'The group is lower, so “On” cannot be chosen here.',
    description:
      'Under a feature whose group is not on: a group is the ceiling of its members. “On” is the switch’s own segment, features.state.an.',
  },
  copied: {
    id: 'features.copied',
    defaultMessage:
      'The change was too long for the link and is on your clipboard. Paste it into the issue.',
    description: 'Shown after Submit release when the change had to go by the clipboard.',
  },
});

const NOTE = 'text-s leading-relaxed text-on-canvas-muted';

export function FeaturesEditor({ onReload }: { onReload: () => void }) {
  const intl = useWorkbenchIntl();
  const draft = useSyncExternalStore(subscribeFeatures, getFeatures, getFeatures);
  const [copied, setCopied] = useState(false);

  // The app reads the states once, so a change is a reload of the frame, skipped on arrival.
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) {
      setFirst(false);
      return;
    }
    onReload();
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const format = (
    message: Parameters<typeof intl.formatMessage>[0],
    values?: Record<string, string>,
  ) => intl.formatMessage(message, values);
  const labels: Record<FeatureState, string> = {
    aus: intl.formatMessage(COPY.stateAus),
    vorschau: intl.formatMessage(COPY.stateVorschau),
    an: intl.formatMessage(COPY.stateAn),
  };
  const dirty = featuresDiffer(SHIPPED_FEATURES, draft);
  const offer = dirty ? submitFeatures(draft, format) : null;

  useToolActions('features', {
    dirty,
    submit: offer
      ? {
          href: offer.href,
          onClick: () => {
            if (!offer.fits) setCopied(copyNow(offer.body));
          },
        }
      : null,
    discard: () => setFeatures(NO_DRAFT),
  });

  return (
    <div className="flex flex-col gap-s" data-testid="features-editor">
      <p className={NOTE}>{intl.formatMessage(COPY.lead)}</p>

      {SHIPPED_FEATURES.groups.map((group) => (
        <section
          key={group.id}
          className="flex flex-col gap-2xs"
          data-testid={`features-group-${group.id}`}
        >
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className="min-w-0 flex-1 font-mono text-m font-semibold text-on-canvas">
              {group.id}
            </h3>
            {group.locked ? (
              <span className={cn(NOTE, 'flex items-center gap-3xs')}>
                <Lock aria-hidden="true" className="size-[0.875rem]" />
                {intl.formatMessage(COPY.locked)}
              </span>
            ) : (
              <Segmented
                name={`group-${group.id}`}
                legend={intl.formatMessage(COPY.group, { name: group.id })}
                value={declaredGroup(draft, group)}
                onChange={(state) =>
                  setFeatures(withGroup(SHIPPED_FEATURES, draft, group.id, state as FeatureState))
                }
                options={STATES.map((state) => ({ value: state, label: labels[state] }))}
              />
            )}
          </div>

          <ul className="flex flex-col gap-2xs">
            {membersOf(SHIPPED_FEATURES, group).map((feature) => {
              const shown = shownState(SHIPPED_FEATURES, draft, feature);
              const sample = sampleOnly(feature);
              const heldByGroup = !sample && declaredGroup(draft, group) !== 'an';
              return (
                <li
                  key={feature.id}
                  className="flex flex-col gap-3xs rounded-md border border-stroke bg-canvas p-xs"
                  data-testid={`feature-${feature.id}`}
                >
                  <div className="flex flex-wrap items-center gap-xs">
                    <span className="min-w-0 flex-1 font-mono text-s text-on-canvas">
                      {feature.id}
                    </span>
                    <Segmented
                      name={`feature-${feature.id}`}
                      legend={intl.formatMessage(COPY.feature, { name: feature.id })}
                      value={shown}
                      disabled={group.locked}
                      onChange={(state) =>
                        setFeatures(
                          withFeature(SHIPPED_FEATURES, draft, feature.id, state as FeatureState),
                        )
                      }
                      options={STATES.map((state) => ({
                        value: state,
                        label: labels[state],
                        disabled: !selectable(SHIPPED_FEATURES, draft, feature, state),
                      }))}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2xs">
                    {sourcesOf(feature).length === 0 ? (
                      <span className={NOTE}>{intl.formatMessage(COPY.noData)}</span>
                    ) : (
                      sourcesOf(feature).map((source) => (
                        <Badge
                          key={source.id}
                          variant={source.provenance === 'live' ? 'default' : 'alt'}
                          data-testid={`source-${feature.id}-${source.id}`}
                        >
                          <span className="font-mono">{source.id}</span>
                          {source.provenance === 'live'
                            ? intl.formatMessage(COPY.live)
                            : intl.formatMessage(COPY.sample)}
                        </Badge>
                      ))
                    )}
                  </div>
                  {sample && (
                    <p role="note" className={cn(NOTE, 'flex items-start gap-3xs text-on-canvas')}>
                      <TriangleAlert
                        aria-hidden="true"
                        className="mt-4xs size-[0.875rem] shrink-0"
                      />
                      {intl.formatMessage(COPY.sampleOnly)}
                    </p>
                  )}
                  {heldByGroup && !group.locked && (
                    <p className={NOTE}>{intl.formatMessage(COPY.groupCeiling)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {copied && <p className={NOTE}>{intl.formatMessage(COPY.copied)}</p>}
    </div>
  );
}
