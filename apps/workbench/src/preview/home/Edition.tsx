import { SlidersHorizontal, Trash2, TriangleAlert } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import type { HomeEdition, HomeLayout, MinuteOfDay } from '@correctiv/app-core/lib/home-layout';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../../ui/kit/popover';
import {
  editionHue,
  formatTimeOfDay,
  movedEditionMoment,
  withEditionFrom,
  withEditionSpan,
  withEditionTitle,
  withoutEdition,
  withoutEditionMoment,
} from './document';
import { parseMinute, STEP } from './minutes';

/**
 * An edition, as the panel shows the one an edit would land on.
 *
 * [ADR 0059](../../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md)
 * §8's first slice: the edition's name and colour, which of its points is being edited, a
 * popover with its span, its title and a delete, and the two warnings the private pipeline
 * of §7 would make unnecessary and has not been built to. What is deliberately not here is
 * §8's list of what is left out: the strip and its zooms, the layer chip, conflict badges.
 *
 * A file of its own rather than more of `HomeDocument.tsx`, which is the day's panel and
 * already long; this is the layer above it, and what the two share is the document module.
 */

/**
 * What this file says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/edition.ts`. `EDITION_COPY` rather than `COPY` because
 * `HomeDocument.tsx` imports the three a block's row says about an edition, and that file
 * has a `COPY` of its own.
 */
export const EDITION_COPY = defineMessages({
  kind: {
    id: 'edition.kind',
    defaultMessage: 'Edition',
    description:
      'The small word before an edition’s name at the head of the panel. An edition is a named layer over the ordinary day, a campaign or an election night, active from one date and time until another.',
  },
  start: {
    id: 'edition.start',
    defaultMessage: 'Start of the edition, until {until}',
    description:
      'Names the point being edited when it is the edition’s own starting state rather than one of its moments. {until} is when its first moment takes over, as 23:00, or edition.end where none does.',
  },
  end: {
    id: 'edition.end',
    defaultMessage: 'its end',
    description:
      'Stands where a time would inside edition.start and edition.momentSpan, when nothing else happens before the edition is over. Lower case, mid-sentence.',
  },
  momentTime: {
    id: 'edition.momentTime',
    defaultMessage: 'The time of this moment of the edition',
    description: 'The label of the time field for a moment of an edition. Read aloud, not drawn.',
  },
  momentSpan: {
    id: 'edition.momentSpan',
    defaultMessage:
      'until {until} · {changes, plural, =0 {nothing changes here yet} other {# changed here}}',
    description:
      'Beside the time field of a moment of an edition: how long it lasts and how much it changes. {until} is when the edition’s next moment takes over, as 23:00, or edition.end; {changes} is how many blocks it differs on. home.point.span is the same sentence for a moment of the day.',
  },
  momentRemove: {
    id: 'edition.momentRemove',
    defaultMessage: 'Remove the moment at {time} from {edition}',
    description:
      'The accessible name of the button that deletes the edition’s moment being edited. {time} is its time of day, as 23:00; {edition} is the edition’s title, or its id where it has none.',
  },
  landsOnDay: {
    id: 'edition.landsOnDay',
    defaultMessage: 'Your changes go into the ordinary day.',
    description:
      'Says which layer of the home document an edit in the panel writes to, when no edition is running at the playhead. edition.landsOn is the same line while one is.',
  },
  landsOn: {
    id: 'edition.landsOn',
    defaultMessage: 'Your changes go into the edition “{edition}”.',
    description:
      'Says which layer an edit in the panel writes to while an edition is running at the playhead: the narrowest one, which is the one whose word the phone shows. {edition} is its title as the newsroom wrote it, or its id where it has none.',
  },
  details: {
    id: 'edition.details',
    defaultMessage: 'Time, title and delete for {edition}',
    description:
      'The accessible name of the button that opens the edition’s popover, and of the popover itself. {edition} is its title, or its id where it has none.',
  },
  title: {
    id: 'edition.title',
    defaultMessage: 'Title',
    description:
      'The label of the field for the newsroom’s own name for the edition, which is data in the document and never translated. Empty means none, and the id stands in for it.',
  },
  from: {
    id: 'edition.from',
    defaultMessage: 'Starts at (Berlin time)',
    description:
      'The label of the field for the date and time the edition starts. Every time in the home document is Berlin wall-clock time, whatever the browser’s own zone is, which is why the label says so.',
  },
  until: {
    id: 'edition.until',
    defaultMessage: 'Ends at (Berlin time)',
    description:
      'The label of the field for the date and time the edition ends. At that minute it is already over, which “ends at” says without a note. An end at or before the start is not taken, and the field springs back.',
  },
  remove: {
    id: 'edition.remove',
    defaultMessage: 'Delete the edition',
    description:
      'Takes the whole edition out of the document, with everything it changes. The ordinary day is untouched by it.',
  },
  publicWhenMerged: {
    id: 'edition.publicWhenMerged',
    defaultMessage:
      'An edition is public as soon as it is merged. Submit it only once it may be known.',
    description:
      'A warning in the edition’s popover. The repository is public, and the private plan that would keep a dated edition out of it until shortly before it starts is not built yet, so this is the whole of the protection for now.',
  },
  pinEarly: {
    id: 'edition.pinEarly',
    defaultMessage:
      'This pin is public as soon as the edition is. To lead with an embargoed piece, use its flag in WordPress instead.',
    description:
      'Shown beside a pinned article inside an edition, and in the edition’s popover when it pins one. The flag is the WordPress field that makes an article lead the app, which is set at publication and so never earlier than the article itself.',
  },
  decides: {
    id: 'edition.decides',
    defaultMessage: '{edition} sets this block here',
    description:
      'Read out for the coloured hairline at a block’s edge, which marks a block whose state at the playhead an edition sets rather than the ordinary day. {edition} is the edition’s title, or its id where it has none.',
  },
  switchOnIn: {
    id: 'edition.switchOnIn',
    defaultMessage: 'Switch {block} on in {edition}',
    description:
      'The accessible name of the eye button on a block that is off, while an edition’s starting state is what an edit writes to. {block} is the block’s own name; {edition} is the edition’s title, or its id.',
  },
  switchOffIn: {
    id: 'edition.switchOffIn',
    defaultMessage: 'Switch {block} off in {edition}',
    description:
      'The same button on a block that is on. {block} is the block’s own name; {edition} is the edition’s title, or its id.',
  },
  offIn: {
    id: 'edition.offIn',
    defaultMessage: 'Not on screen in {edition}.',
    description:
      'Says when a switched-off block is off, in its details popover, while an edition’s starting state is being edited. {edition} is the edition’s title, or its id.',
  },
});

/** An edition's name as the panel shows it: the newsroom's title, or its id where it has none. */
export function nameOf(edition: HomeEdition): string {
  return edition.title ?? edition.id;
}

/**
 * The style that puts an edition's hue where `.edition-ink` in `styles/app.css` reads it.
 *
 * Only the hue is decided here, from the id (`editionHue`); the lightness comes from the
 * palette in the stylesheet, so the colour follows the appearance setting on its own.
 */
export function inkOf(id: string): CSSProperties {
  return { '--edition-hue': editionHue(id) } as CSSProperties;
}

/** Whether an edition pins an article anywhere, which is when the second warning applies. */
function pinsAnything(edition: HomeEdition): boolean {
  const pins = (changes: HomeEdition['changes']) =>
    changes.some((change) => typeof change.settings?.pin === 'string');
  return pins(edition.changes) || edition.moments.some((moment) => pins(moment.changes));
}

/**
 * A warning, drawn so it reads as one without a colour of its own.
 *
 * The palette has no warning role, and one written here would be a colour this site
 * decided (`test/styles.test.ts`). An icon, a stroke and the ordinary text colour say it.
 */
export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2xs rounded-s border border-stroke-strong p-2xs text-s leading-relaxed text-on-canvas">
      <TriangleAlert aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

const FIELD =
  'rounded-s border border-stroke bg-canvas px-3xs py-4xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';

/**
 * The head of the panel while an edition is what an edit lands on.
 *
 * The day's head (`PointHead` in `HomeDocument.tsx`) names the point of the day being
 * edited; this names the edition first, in its colour, and then its point, because the
 * question a person has to be able to answer before they press anything is which layer
 * they are writing to (ADR 0059 §2). The full "layer chip" of §8's list is not this: it is
 * one line saying so.
 */
export function EditionHead({
  layout,
  edition,
  point,
  onLayout,
  onGoTo,
}: {
  layout: HomeLayout;
  edition: HomeEdition;
  /** The edition's moment being edited, or null for its starting state. */
  point: MinuteOfDay | null;
  onLayout: (next: HomeLayout) => void;
  /** Moves the playhead to a minute of the day it is on, after a moment was moved there. */
  onGoTo: (minute: MinuteOfDay) => void;
}) {
  const intl = useWorkbenchIntl();
  const [open, setOpen] = useState(false);
  const name = nameOf(edition);
  const moment = point === null ? null : edition.moments.find((held) => held.minute === point);
  const next = edition.moments.find((held) => held.minute > (point ?? -1));
  const until = next ? next.at : intl.formatMessage(EDITION_COPY.end);

  return (
    /*
      Anchored to the whole card rather than to its button, for the reason the block rows
      give in `HomeDocument.tsx`: the button sits at the panel's right edge, so "left" of
      it is over the panel, and the two date fields want the stage's width.
    */
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className="edition-ink flex flex-col gap-2xs rounded-md border border-stroke border-l-4 border-l-(--edition) bg-canvas p-xs"
          style={inkOf(edition.id)}
        >
          <div className="flex flex-wrap items-center gap-xs">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-(--edition)">
              {intl.formatMessage(EDITION_COPY.kind)}
            </span>
            <span className="min-w-0 truncate text-m font-semibold text-on-canvas">{name}</span>

            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('ml-auto size-[2rem]', open && 'text-accent')}
                aria-label={intl.formatMessage(EDITION_COPY.details, { edition: name })}
              >
                <SlidersHorizontal aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </div>

          <div className="flex flex-wrap items-center gap-xs">
            {moment ? (
              <>
                <label className="flex items-center gap-2xs">
                  <span className="sr-only">{intl.formatMessage(EDITION_COPY.momentTime)}</span>
                  <input
                    type="time"
                    step={STEP * 60}
                    value={formatTimeOfDay(moment.minute)}
                    onChange={(event) => {
                      const to = parseMinute(event.target.value);
                      if (to === null) return;
                      onLayout(movedEditionMoment(layout, edition.id, moment.minute, to));
                      onGoTo(to);
                    }}
                    className={cn(FIELD, 'font-mono text-m font-semibold')}
                  />
                </label>
                <span className={NOTE}>
                  {intl.formatMessage(EDITION_COPY.momentSpan, {
                    until,
                    changes: moment.changes.length,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-[2rem]"
                  aria-label={intl.formatMessage(EDITION_COPY.momentRemove, {
                    time: moment.at,
                    edition: name,
                  })}
                  onClick={() => onLayout(withoutEditionMoment(layout, edition.id, moment.minute))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </>
            ) : (
              <span className={NOTE}>{intl.formatMessage(EDITION_COPY.start, { until })}</span>
            )}
          </div>

          <p className="text-s font-medium text-on-canvas">
            {intl.formatMessage(EDITION_COPY.landsOn, { edition: name })}
          </p>
        </div>
      </PopoverAnchor>
      <PopoverContent aria-label={intl.formatMessage(EDITION_COPY.details, { edition: name })}>
        <EditionDetails
          layout={layout}
          edition={edition}
          onLayout={onLayout}
          onRemoved={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The edition's popover: its title, its span, the two warnings, and a delete. */
function EditionDetails({
  layout,
  edition,
  onLayout,
  onRemoved,
}: {
  layout: HomeLayout;
  edition: HomeEdition;
  onLayout: (next: HomeLayout) => void;
  onRemoved: () => void;
}) {
  const intl = useWorkbenchIntl();

  return (
    <div className="flex w-[24rem] max-w-full flex-col gap-xs">
      <div className="flex flex-wrap items-baseline gap-2xs">
        <span className="text-m font-semibold text-on-canvas">{nameOf(edition)}</span>
        <code className="ml-auto rounded-s border border-stroke px-3xs font-mono text-[0.8125rem] text-on-canvas-muted">
          {edition.id}
        </code>
      </div>

      <label className="flex flex-col gap-4xs text-s text-on-canvas">
        {intl.formatMessage(EDITION_COPY.title)}
        <input
          type="text"
          value={edition.title ?? ''}
          onChange={(event) => onLayout(withEditionTitle(layout, edition.id, event.target.value))}
          className={FIELD}
        />
      </label>

      {/*
        `datetime-local`, because its value is exactly the document's spelling of `from`
        and `until`: a date, a `T` and a minute, with no zone. The browser shows it in the
        reader's own format and hands back that spelling, which is then read as Berlin
        time, as the label says, whatever zone the browser is in.
      */}
      <div className="flex flex-col gap-2xs">
        <label className="flex min-w-0 flex-col gap-4xs text-s text-on-canvas">
          {intl.formatMessage(EDITION_COPY.from)}
          <input
            type="datetime-local"
            step={STEP * 60}
            value={edition.from}
            onChange={(event) => onLayout(withEditionFrom(layout, edition.id, event.target.value))}
            className={cn(FIELD, 'min-w-0 font-mono')}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-4xs text-s text-on-canvas">
          {intl.formatMessage(EDITION_COPY.until)}
          <input
            type="datetime-local"
            step={STEP * 60}
            value={edition.until}
            onChange={(event) =>
              onLayout(withEditionSpan(layout, edition.id, edition.from, event.target.value))
            }
            className={cn(FIELD, 'min-w-0 font-mono')}
          />
        </label>
      </div>

      <Warning>{intl.formatMessage(EDITION_COPY.publicWhenMerged)}</Warning>
      {pinsAnything(edition) && <Warning>{intl.formatMessage(EDITION_COPY.pinEarly)}</Warning>}

      <Button
        variant="outline"
        size="sm"
        className="self-start hover:text-red-500"
        onClick={() => {
          onRemoved();
          onLayout(withoutEdition(layout, edition.id));
        }}
      >
        <Trash2 aria-hidden="true" />
        {intl.formatMessage(EDITION_COPY.remove)}
      </Button>
    </div>
  );
}
