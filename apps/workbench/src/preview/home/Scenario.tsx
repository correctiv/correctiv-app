import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { InfoTip } from '../../ui/kit/info-tip';
import { Select } from '../../ui/kit/select';
import { layoutOf, SCENARIOS, scenarioNamed, type Scenario } from '../scenarios';
import type { PreviewState } from '../state';
import { arriving, entering, exiting, heldOf, leaving, loading, type Held } from './scenario';
import { getLayout, setLayout } from './store';

/**
 * Everything the scenario list says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/scenarios.ts`. Few words on purpose, and each one a short
 * sentence: the list is for the newsroom, and what a scenario is belongs behind nothing
 * at all, because its title says it.
 */
const COPY = defineMessages({
  label: {
    id: 'scenarios.label',
    defaultMessage: 'Scenario',
    description:
      'The label of the select that opens a named example of the home screen, such as the election night, in the editor and the frame.',
  },
  none: {
    id: 'scenarios.none',
    defaultMessage: 'None',
    description:
      'The first option of the scenario select: no scenario, the editor shows the real home screen.',
  },
  sample: {
    id: 'scenarios.sample',
    defaultMessage: 'Pinned articles are fixed examples. Everything else is live.',
    description:
      'Behind the ⓘ beside the scenario select while a scenario with sample data is open. Says honestly what is held still in the frame and what is not.',
  },
  live: {
    id: 'scenarios.live',
    defaultMessage: 'All content is live.',
    description:
      'Behind the ⓘ beside the scenario select while a scenario with live content is open.',
  },
  ask: {
    id: 'scenarios.ask',
    defaultMessage: 'You have changes of your own. The scenario would replace them.',
    description:
      'Shown when a scenario is opened while the editor holds somebody’s unsubmitted changes. Nothing has been replaced yet; the two buttons under it decide.',
  },
  replace: {
    id: 'scenarios.replace',
    defaultMessage: 'Open the scenario',
    description: 'Replaces the person’s own changes with the scenario. Under scenarios.ask.',
  },
  keep: {
    id: 'scenarios.keep',
    defaultMessage: 'Keep my changes',
    description: 'Closes the scenario and leaves the person’s own changes as they are.',
  },
});

/** What the scenario list and the editor's bar need to know, from `useScenario`. */
export interface ScenarioControl {
  /** The scenario the address has open, or null. */
  open: Scenario | null;
  /** The scenario waiting for an answer, because opening it would replace somebody's work. */
  asking: Scenario | null;
  choose: (name: string | null) => void;
  /** Replace the work with the scenario that is asking. */
  replace: () => void;
  /** Close the scenario that is asking, and keep the work. */
  keep: () => void;
  /** Close whatever is open. "Discard changes" calls it. */
  close: () => void;
}

/**
 * Opens and leaves scenarios as the address changes, which is every way there is to do it:
 * a link, the select, the address bar, a step back in history.
 *
 * Called by `pages/Preview.tsx`, which is mounted for as long as `/preview` is, and not
 * by the home tool's panel, which is drawn only into a slot that may not be there.
 * `./scenario.ts` holds the rules and says why each is what it is.
 */
export function useScenario(
  state: PreviewState,
  onChange: (patch: Partial<PreviewState>) => void,
): ScenarioControl {
  const [asking, setAsking] = useState<Scenario | null>(null);
  /** The scenario the last run saw, and `undefined` before the first. */
  const seen = useRef<string | null | undefined>(undefined);
  /**
   * The person's own time and session from before a scenario was opened from the list,
   * given back when it is left (`exiting`). Taken once per visit to scenarios: switching
   * from one scenario to another keeps what was there before the first.
   */
  const held = useRef<Held | null>(null);

  useEffect(() => {
    const from = seen.current;
    const to = state.scenario;
    seen.current = to;
    if (from === to) return;
    setAsking(null);
    if (to === null) held.current = null;

    const left = scenarioNamed(from);
    const leftLayout = left ? layoutOf(left) : null;
    if (leftLayout) {
      const back = leaving(getLayout(), leftLayout);
      if (back) setLayout(back);
    }

    const entered = scenarioNamed(to);
    const layout = entered ? layoutOf(entered) : null;
    if (!entered || !layout) return;
    const arrival = arriving(getLayout(), layout);
    if (arrival === 'load') setLayout(layout);
    if (arrival === 'ask') setAsking(entered);
  }, [state.scenario]);

  const close = useCallback(() => {
    setAsking(null);
    const back = exiting(state, held.current);
    held.current = null;
    onChange(back);
  }, [onChange, state]);

  return {
    open: scenarioNamed(state.scenario),
    asking,
    choose: (name) => {
      const scenario = scenarioNamed(name);
      const layout = scenario ? layoutOf(scenario) : null;
      if (!scenario || !layout) {
        close();
        return;
      }
      held.current ??= heldOf(state);
      onChange(entering(scenario, state, arriving(getLayout(), layout)));
    },
    replace: () => {
      const layout = asking ? layoutOf(asking) : null;
      if (asking && layout) {
        setLayout(layout);
        // Its time and session only now, once the person has said to load it.
        onChange(loading(asking));
      }
      setAsking(null);
    },
    keep: close,
    close,
  };
}

const NOTE = 'text-s leading-relaxed text-on-canvas-muted';

/** The list, what the open scenario shows, and the question when opening one would cost work. */
export function ScenarioBar({ control }: { control: ScenarioControl }) {
  const intl = useWorkbenchIntl();
  const selectId = useId();
  const { open, asking } = control;

  return (
    <div className="flex flex-col gap-2xs" data-testid="scenario-bar">
      <div className="flex items-center gap-xs">
        <label htmlFor={selectId} className="shrink-0 text-s text-on-canvas">
          {intl.formatMessage(COPY.label)}
        </label>
        <Select
          id={selectId}
          className="flex-1"
          value={open?.name ?? ''}
          onValueChange={(value) => control.choose(value || null)}
          options={[
            { value: '', label: intl.formatMessage(COPY.none) },
            ...SCENARIOS.map((scenario) => ({
              value: scenario.name,
              label: intl.formatMessage(scenario.title),
            })),
          ]}
        />
        {/* What in the open scenario is held still and what is live, for whoever asks. */}
        {open && !asking && (
          <InfoTip about={intl.formatMessage(open.title)} align="end">
            <p data-testid="scenario-content" data-content={open.content}>
              {intl.formatMessage(open.content === 'sample' ? COPY.sample : COPY.live)}
            </p>
          </InfoTip>
        )}
      </div>

      {asking && (
        <div role="alert" className="flex flex-col gap-2xs">
          <p className={cn(NOTE, 'text-on-canvas')}>{intl.formatMessage(COPY.ask)}</p>
          <div className="flex flex-wrap gap-xs">
            <Button size="sm" variant="outline" onClick={control.keep}>
              {intl.formatMessage(COPY.keep)}
            </Button>
            <Button size="sm" variant="outline" onClick={control.replace}>
              {intl.formatMessage(COPY.replace)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
