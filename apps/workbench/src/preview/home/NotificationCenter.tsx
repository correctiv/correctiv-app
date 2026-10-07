import { Bell, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/kit/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { countByLevel, highestLevel, type Notice, type NoticeLevel } from './notices';

/**
 * The layout tool's one place for hints: a bell in the bar, a count on it, and a list
 * under it (`notices.ts` says what is in the list and why).
 *
 * **The level is told twice, by glyph and by colour**, so it survives a person who does
 * not see the difference between amber and red. Each colour is a pair that is legible in
 * both appearances without a token of its own: the brand red under white ink, the club
 * yellow under dark ink, and `surface` under `on-canvas` for the neutral one. They are the
 * primitives on purpose, the case `AGENTS.md` names, because a warning must not turn into
 * its own background when the scheme flips.
 */
const COPY = defineMessages({
  label: {
    id: 'home.notices.label',
    defaultMessage: 'Notifications',
    description:
      'The tooltip on the bell in the layout tool’s bar, and the heading of the list it opens. The bell holds every hint about the open layout: errors, warnings and information.',
  },
  summary: {
    id: 'home.notices.summary',
    defaultMessage: 'Notifications: {count, plural, =0 {none} one {# notice} other {# notices}}',
    description:
      'The accessible name of the bell in the layout tool’s bar. {count} is how many notices the open layout has, so a screen reader hears the number the badge shows.',
  },
  empty: {
    id: 'home.notices.empty',
    defaultMessage: 'Nothing to report.',
    description: 'In the list under the bell while the open layout has no notice.',
  },
  error: {
    id: 'home.notices.error',
    defaultMessage: 'Error',
    description:
      'Read aloud before a notice that is an error, because its icon and its colour are not read. Never drawn.',
  },
  warning: {
    id: 'home.notices.warning',
    defaultMessage: 'Warning',
    description:
      'Read aloud before a notice that is a warning, because its icon and its colour are not read. Never drawn.',
  },
  info: {
    id: 'home.notices.info',
    defaultMessage: 'Information',
    description:
      'Read aloud before a notice that is information only, because its icon and its colour are not read. Never drawn.',
  },
});

const LEVELS: Record<NoticeLevel, { icon: LucideIcon; tone: string; name: typeof COPY.error }> = {
  error: { icon: OctagonAlert, tone: 'bg-red-500 text-white', name: COPY.error },
  warning: { icon: TriangleAlert, tone: 'bg-yellow-400 text-neutral-700', name: COPY.warning },
  info: { icon: Info, tone: 'border border-stroke bg-surface text-on-canvas', name: COPY.info },
};

export function NotificationCenter({
  notices,
  className,
}: {
  notices: readonly Notice[];
  className?: string;
}) {
  const intl = useWorkbenchIntl();
  const highest = highestLevel(notices);
  const label = intl.formatMessage(COPY.label);
  const counts = countByLevel(notices);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn('relative size-[1.75rem] overflow-visible', className)}
              aria-label={intl.formatMessage(COPY.summary, { count: notices.length })}
              data-testid="notifications"
              data-level={highest ?? 'none'}
            >
              <Bell aria-hidden="true" />
              {highest !== null && (
                <span
                  aria-hidden="true"
                  data-testid="notifications-badge"
                  className={cn(
                    'absolute -right-3xs -top-3xs flex h-[1rem] min-w-[1rem] items-center justify-center rounded-full px-4xs text-[0.625rem] font-semibold leading-none tabular-nums',
                    LEVELS[highest].tone,
                  )}
                >
                  {notices.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="end"
        className="flex w-[min(24rem,92vw)] flex-col gap-xs"
      >
        <h2 className="text-s font-semibold text-on-canvas">{label}</h2>
        {notices.length === 0 ? (
          <p className="text-s text-on-canvas-muted" data-testid="notifications-empty">
            {intl.formatMessage(COPY.empty)}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-xs"
            data-testid="notifications-list"
            data-counts={JSON.stringify(counts)}
          >
            {notices.map((notice) => (
              <NoticeItem key={notice.id} notice={notice} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NoticeItem({ notice }: { notice: Notice }) {
  const intl = useWorkbenchIntl();
  const { icon: Icon, tone, name } = LEVELS[notice.level];
  return (
    <li
      className="flex items-start gap-xs"
      data-testid={`notice-${notice.id}`}
      data-level={notice.level}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-4xs flex size-[1.25rem] shrink-0 items-center justify-center rounded-full',
          tone,
        )}
      >
        <Icon className="size-[0.75rem]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3xs">
        <p className="text-s leading-relaxed text-on-canvas">
          <span className="sr-only">{intl.formatMessage(name)}: </span>
          {intl.formatMessage(notice.message, notice.values)}
        </p>
        {notice.actions && notice.actions.length > 0 && (
          <div className="flex flex-wrap gap-2xs">
            {notice.actions.map((action) => {
              const text = intl.formatMessage(action.label, action.values);
              const accessible = action.name
                ? intl.formatMessage(action.name, action.values)
                : text;
              return action.href !== undefined ? (
                <Button
                  key={action.testId ?? text}
                  variant="outline"
                  className="h-[1.75rem] px-2xs text-s"
                  asChild
                >
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={accessible}
                    data-testid={action.testId}
                  >
                    {text}
                  </a>
                </Button>
              ) : (
                <Button
                  key={action.testId ?? text}
                  variant="outline"
                  className="h-[1.75rem] px-2xs text-s"
                  aria-label={accessible}
                  data-testid={action.testId}
                  onClick={action.onSelect}
                >
                  {text}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}
