import type { ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import {
  AUDIENCES,
  defaultAudience,
  EVERYONE,
  type Audience,
} from '@correctiv/app-core/lib/home-audience';
import type { HomeChange, HomeSection } from '@correctiv/app-core/lib/home-layout';

// The app's own declarations, through the build that compiles `apps/mobile/src` into this
// site. The workbench may read the app (ADR 0040); this is that, and nothing here is a copy.
import { MODULE_CONDITIONS, type IntrinsicCondition } from '@/lib/home/conditions';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { cn } from '../../lib/cn';

/**
 * When a block appears and for whom, in one place in the block's popover.
 *
 * [ADR 0060](../../../../../adr/0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md)
 * §1: two kinds of condition and one vocabulary. What the block owns is printed and cannot
 * be changed, so an editor can see WHY a block draws nothing; who it is for is a control.
 * The sentences are short on purpose, and a background explanation belongs behind an info
 * icon rather than here.
 *
 * A file of its own rather than more of `HomeDocument.tsx`, because that file is where
 * three other pieces of work are landing at once.
 */

/**
 * One sentence per condition a block can own. A `Record` over the app's union, so a new
 * condition is a type error here until somebody writes what it means (ADR 0031's first
 * mechanism).
 */
export const CONDITION_LABELS: Readonly<Record<IntrinsicCondition, WorkbenchMessage>> = {
  'loading-or-offline': wbMessage({
    id: 'conditions.intrinsic.loadingOrOffline',
    defaultMessage: 'Appears only while the app is loading or offline.',
  }),
  'has-lead-article': wbMessage({
    id: 'conditions.intrinsic.hasLeadArticle',
    defaultMessage: 'Appears only when there is a lead article: a pinned one or the newest.',
  }),
  'has-spotlight-issue': wbMessage({
    id: 'conditions.intrinsic.hasSpotlightIssue',
    defaultMessage: 'Appears only once a Spotlight issue has loaded.',
    description: 'Spotlight is the name of a CORRECTIV newsletter and stays as it is written.',
  }),
  'has-more-research': wbMessage({
    id: 'conditions.intrinsic.hasMoreResearch',
    defaultMessage: 'Appears only when the investigations feed holds more than the lead.',
  }),
  'has-fact-checks': wbMessage({
    id: 'conditions.intrinsic.hasFactChecks',
    defaultMessage: 'Appears only when fact checks have loaded.',
  }),
  'has-open-callout': wbMessage({
    id: 'conditions.intrinsic.hasOpenCallout',
    defaultMessage: 'Appears only while a callout is open.',
    description:
      'A callout is an open call to readers to send something in; the app calls that screen “Mitmachen”.',
  }),
};

/**
 * Each audience's name, in the newsroom's words (ADR 0041 §2). A `Record` over the core's
 * union for the same reason as above.
 */
export const AUDIENCE_LABELS: Readonly<Record<Audience, WorkbenchMessage>> = {
  everyone: wbMessage({ id: 'conditions.audience.everyone', defaultMessage: 'Everyone' }),
  'paying-members': wbMessage({
    id: 'conditions.audience.payingMembers',
    defaultMessage: 'Members with a contribution',
    description:
      'Members who pay a contribution, including a trial month and Soli. The door into the app uses the same words.',
  }),
  'free-members': wbMessage({
    id: 'conditions.audience.freeMembers',
    defaultMessage: 'Free members',
    description:
      'Members of the 0 € tier. Inside the app that is somebody whose local newsletter includes it.',
  }),
};

const COPY = defineMessages({
  placeFor: {
    id: 'conditions.placeFor',
    defaultMessage: 'Show to',
    description: 'The label of the control that says who a block is for, all day.',
  },
  changeFor: {
    id: 'conditions.changeFor',
    defaultMessage: 'This change applies to',
    description:
      'The label of the control that says who the change made to a block at this point of the day applies to.',
  },
  byDefault: {
    id: 'conditions.byDefault',
    defaultMessage: '{audience} (default)',
    description:
      'An option in the “Show to” list: the audience the block’s own module chooses when the document says nothing. {audience} is that audience’s name, already translated.',
  },
  notYet: {
    id: 'conditions.notYet',
    defaultMessage: 'Not yet members (nobody in the app can be one)',
    description:
      'A switched-off option in the “Show to” list. The app admits members only, so no reader of it is not yet a member; whether that changes is an open product question.',
  },
  stranding: {
    id: 'conditions.stranding',
    defaultMessage:
      'Some audiences are off: a change here hides the other place, and without this one some readers would see neither.',
    description:
      'Under the “This change applies to” list. The change belongs to a swap of two places at the same time; making it apply to only some readers would leave the others, and readers of older app versions, with neither place.',
  },
  locked: {
    id: 'conditions.locked',
    defaultMessage: 'The change here is for another audience. Frame a reader in it to edit it.',
    description:
      'In a block’s popover, where the only change about the block at this point of the day is for an audience the reader signed in in the framed app is not in, so the controls are switched off.',
  },
  notFor: {
    id: 'conditions.notFor',
    defaultMessage: 'Not in the frame: the reader signed in there is not in it.',
    description:
      'Under a block that the reader the framed app is signed in as is not in the audience of, which is why the frame does not draw it.',
  },
});

/** The sentence for what a module owns, or null for a module that always draws. */
export function conditionOf(module: string): WorkbenchMessage | null {
  const condition = MODULE_CONDITIONS[module];
  return condition ? CONDITION_LABELS[condition] : null;
}

const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const FIELD =
  'rounded-s border border-stroke bg-canvas px-3xs py-4xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * The popover's conditions: the module's own, read-only, then who the block is for, then,
 * where this point has a change about the block, who that change is for.
 */
export function Conditions({
  section,
  change,
  taken,
  stranding,
  locked,
  reaches,
  onPlace,
  onChange,
}: {
  section: HomeSection;
  /** The change an edit at the playhead lands on for this block, if there is one. */
  change: HomeChange | undefined;
  /** Audiences another change about the block at this point already has: not offered. */
  taken: ReadonlySet<Audience>;
  /**
   * Audiences a retarget here would leave some reader, an older app's included, with none
   * of a block its counterpart change hides (ADR 0060 §6): not offered, and said.
   */
  stranding: ReadonlySet<Audience>;
  /** No change here is for the framed reader; said, and the change's control is absent. */
  locked: boolean;
  /** Whether the reader in the frame is in this block's audience. */
  reaches: boolean;
  onPlace: (audience: Audience) => void;
  onChange: (audience: Audience) => void;
}): ReactNode {
  const intl = useWorkbenchIntl();
  const intrinsic = conditionOf(section.module);
  const fallback = defaultAudience(section.module);
  const place = section.audience ?? fallback;
  const name = (audience: Audience) => intl.formatMessage(AUDIENCE_LABELS[audience]);

  return (
    <div className="flex flex-col gap-2xs border-t border-stroke pt-2xs">
      {intrinsic && <p className={NOTE}>{intl.formatMessage(intrinsic)}</p>}

      <label className="flex flex-col gap-4xs text-s font-medium text-on-canvas">
        {intl.formatMessage(COPY.placeFor)}
        <select
          value={place}
          onChange={(event) => onPlace(event.target.value as Audience)}
          className={cn(FIELD, 'w-full font-normal')}
        >
          {AUDIENCES.map((audience) => (
            <option key={audience} value={audience}>
              {audience === fallback
                ? intl.formatMessage(COPY.byDefault, { audience: name(audience) })
                : name(audience)}
            </option>
          ))}
          <option disabled value="not-yet-members">
            {intl.formatMessage(COPY.notYet)}
          </option>
        </select>
      </label>
      {!reaches && <p className={NOTE}>{intl.formatMessage(COPY.notFor)}</p>}
      {locked && <p className={NOTE}>{intl.formatMessage(COPY.locked)}</p>}

      {change && (
        <label className="flex flex-col gap-4xs text-s font-medium text-on-canvas">
          {intl.formatMessage(COPY.changeFor)}
          <select
            value={change.audience ?? EVERYONE}
            onChange={(event) => onChange(event.target.value as Audience)}
            className={cn(FIELD, 'w-full font-normal')}
          >
            {AUDIENCES.map((audience) => (
              <option
                key={audience}
                value={audience}
                disabled={taken.has(audience) || stranding.has(audience)}
              >
                {name(audience)}
              </option>
            ))}
          </select>
          {stranding.size > 0 && (
            <span className={cn(NOTE, 'font-normal')}>{intl.formatMessage(COPY.stranding)}</span>
          )}
        </label>
      )}
    </div>
  );
}
