import { defineMessages, type MessageDescriptor } from 'react-intl';

import { SHIPPED_LAYOUT } from '@correctiv/app-core/lib/screen-layout';
import type { Locale } from '@correctiv/app-core/stores/settings';

import type { Gap } from './gaps';
import type { SizeReading } from './size';

/**
 * Everything the layout tool has to tell the person, as one list.
 *
 * **Why this is a list and not a row of paragraphs.** The bar used to stack a sentence for
 * each thing worth knowing: that the layout ships, that a language is missing, that a
 * screen was deleted. Each was true and none was needed all the time, so together they
 * pushed the first block off the screen. A notice is data here and the bell draws it, so a
 * new kind of hint is one more entry in `noticesOf` and not one more line of the bar.
 *
 * **In the workbench and not in `packages/app-core`.** The core holds behaviour the app
 * shares; nothing here is read by the app. What a notice says is about this tool's draft
 * (a deletion that is not submitted, a translation the editor did not write), and the
 * descriptors are the workbench's own copy. The module still imports no React and no DOM,
 * so a test calls it with plain objects.
 */

export type NoticeLevel = 'error' | 'warning' | 'info';

/** Most urgent first. The order of this array is the order of the list and of the badge. */
export const NOTICE_LEVELS = ['error', 'warning', 'info'] as const satisfies readonly NoticeLevel[];

/** What a notice offers to do about itself: a button, or a link that leaves the tool. */
export interface NoticeAction {
  label: MessageDescriptor;
  /** The accessible name where the label alone is ambiguous, such as one Restore per screen. */
  name?: MessageDescriptor;
  values?: Record<string, string | number>;
  href?: string;
  onSelect?: () => void;
  testId?: string;
}

export interface Notice {
  /** Stable across renders and unique in the list, so a key and a test can name it. */
  id: string;
  level: NoticeLevel;
  message: MessageDescriptor;
  /** Placeholders of `message`. Numbers are formatted by the message, not here. */
  values?: Record<string, string | number>;
  actions?: readonly NoticeAction[];
}

/** A screen the repository carries that this draft deletes. */
export interface DeletedNotice {
  id: string;
  title: string;
  /** Opens the new-issue page with the deletion in it. */
  href: string;
  onRestore: () => void;
}

/**
 * What the tool knows that is worth a notice. Plain data, so a test builds one by hand.
 * Everything but the layout is optional, because the navigation tool has no screens to count
 * and says only the part that is about the layout.
 */
export interface NoticeState {
  layout: string;
  size?: SizeReading;
  gaps?: readonly Gap[];
  /** A language's own name in the reader's language. Asked of the caller: it needs `Intl`. */
  languageName?: (language: Locale) => string;
  /** A scenario is open, so the screen and the submission are switched off. */
  guarded?: boolean;
  /** What the last deletion did, until it is taken back or the next one replaces it. */
  removal?: { title: string; next: string | null } | null;
  deleted?: readonly DeletedNotice[];
}

export const NOTICE_COPY = defineMessages({
  nearLimit: {
    id: 'home.document.nearLimit',
    defaultMessage:
      'The published screens are at {share, number, percent} of what the app reads: {length, number} of {limit, number} characters. Past that the app ignores the document and draws the one it ships with.',
    description:
      'A warning in the layout tool’s notifications, shown from 80 percent of the limit on (ADR 0075 §7). {share} is the fraction, formatted as a percentage by the message, {length} is how many characters the screens and the navigation come to when they are joined, and {limit} is the most the app reads, both as plain numbers.',
  },
  overLimit: {
    id: 'home.document.overLimit',
    defaultMessage:
      'The published screens are over what the app reads: {length, number} of {limit, number} characters. The app ignores the document and draws the one it ships with.',
    description:
      'An error in the layout tool’s notifications; replaces home.document.nearLimit once the joined document is longer than the limit (ADR 0075 §7). {length} is how many characters the screens and the navigation come to when they are joined and {limit} is the most the app reads, both as plain numbers.',
  },
  gap: {
    id: 'home.document.gap',
    defaultMessage:
      '{language} is missing in {count, plural, one {# text} other {# texts}} on this screen.',
    description:
      'A warning in the layout tool’s notifications, one per language some text of the screen does not carry (ADR 0075 §2). {language} is that language’s own name in the reader’s language, as Intl.DisplayNames writes it, and {count} is how many of the screen’s texts lack it. A mark and not a fault: the app draws German where a language is missing.',
  },
  shipped: {
    id: 'home.document.shipped',
    defaultMessage:
      'This is the layout the app ships. Once this change is merged and published, readers get it.',
    description:
      'A warning in the layout tool’s notifications while the open layout is the one the app ships (ADR 0080 §5). It says that, unlike the demo, a change to this layout reaches readers.',
  },
  screenLocked: {
    id: 'home.document.screenLocked',
    defaultMessage: 'A scenario is a Home document, so the screen stays on Home while one is open.',
    description:
      'An info in the layout tool’s notifications while the screen list is switched off because a scenario is open or the document still holds one. Scenarios are examples of Home’s day and do not exist for the other screens.',
  },
  deleted: {
    id: 'home.custom.deletedNote',
    defaultMessage:
      'Deleted “{title}” in this draft only. The file stays until the deletion is submitted.',
    description:
      'An info in the layout tool’s notifications, one per screen the person deleted that the repository still carries. Says that a deletion is a draft until it is submitted. {title} is the screen’s title.',
  },
  removed: {
    id: 'home.custom.removed',
    defaultMessage: 'Deleted “{title}”. Now showing “{next}”.',
    description:
      'An info in the layout tool’s notifications right after a screen was deleted, because the open screen changes with it. {title} is the screen that went, {next} the one that is open now.',
  },
  removedLast: {
    id: 'home.custom.removedLast',
    defaultMessage: 'Deleted “{title}”. This layout has no screen left.',
    description:
      'An info in the layout tool’s notifications right after the layout’s last screen was deleted, so no other screen opens in its place. {title} is the screen that went.',
  },
  restore: {
    id: 'home.custom.restore',
    defaultMessage: 'Restore',
    description:
      'The visible label of the button that takes a deletion back, beside the screen it is about. restoreNamed is its accessible name.',
  },
  restoreNamed: {
    id: 'home.custom.restoreNamed',
    defaultMessage: 'Restore {title}',
    description:
      'The accessible name of the button that takes a deletion back. {title} is the screen’s title, so a list of several says which one each button is about.',
  },
  submitDeletion: {
    id: 'home.custom.submitDeletion',
    defaultMessage: 'Submit the deletion of {id}',
    description:
      'The name of the link that opens GitHub’s new-issue page with the deletion of a screen in it, like Submit changes does. {id} is the screen’s id, which is not translated.',
  },
});

/** The order of the list: errors, then warnings, then info. Stable inside a level. */
export function sortNotices(notices: readonly Notice[]): Notice[] {
  const rank = (notice: Notice) => NOTICE_LEVELS.indexOf(notice.level);
  return notices
    .map((notice, index) => ({ notice, index }))
    .sort((a, b) => rank(a.notice) - rank(b.notice) || a.index - b.index)
    .map(({ notice }) => notice);
}

/** The most urgent level present, which colours the badge; null for an empty list. */
export function highestLevel(notices: readonly Notice[]): NoticeLevel | null {
  return NOTICE_LEVELS.find((level) => notices.some((notice) => notice.level === level)) ?? null;
}

/** How many notices carry each level, for the badge and its accessible name. */
export function countByLevel(notices: readonly Notice[]): Record<NoticeLevel, number> {
  const counts: Record<NoticeLevel, number> = { error: 0, warning: 0, info: 0 };
  for (const notice of notices) counts[notice.level] += 1;
  return counts;
}

/**
 * The list the bell shows, derived from the tool's state and sorted by level.
 *
 * Field faults, such as an id that is taken, are not here: they stay at the field in red,
 * because the person is looking at it. Everything else the bar used to say is.
 */
export function noticesOf(state: NoticeState): Notice[] {
  const { size, gaps = [], guarded = false, removal = null, deleted = [] } = state;
  const notices: Notice[] = [];

  if (size?.over) {
    notices.push({
      id: 'size',
      level: 'error',
      message: NOTICE_COPY.overLimit,
      values: { length: size.length, limit: size.limit },
    });
  } else if (size?.near) {
    notices.push({
      id: 'size',
      level: 'warning',
      message: NOTICE_COPY.nearLimit,
      values: {
        share: size.length / size.limit,
        length: size.length,
        limit: size.limit,
      },
    });
  }

  if (state.layout === SHIPPED_LAYOUT) {
    notices.push({ id: 'shipped', level: 'warning', message: NOTICE_COPY.shipped });
  }

  for (const gap of gaps) {
    notices.push({
      id: `gap-${gap.language}`,
      level: 'warning',
      message: NOTICE_COPY.gap,
      values: { language: state.languageName?.(gap.language) ?? gap.language, count: gap.texts },
    });
  }

  if (guarded) {
    notices.push({ id: 'locked', level: 'info', message: NOTICE_COPY.screenLocked });
  }

  if (removal !== null) {
    const { title, next } = removal;
    notices.push(
      next === null
        ? { id: 'removed', level: 'info', message: NOTICE_COPY.removedLast, values: { title } }
        : { id: 'removed', level: 'info', message: NOTICE_COPY.removed, values: { title, next } },
    );
  }

  for (const one of deleted) {
    notices.push({
      id: `deleted-${one.id}`,
      level: 'info',
      message: NOTICE_COPY.deleted,
      values: { title: one.title },
      actions: [
        {
          label: NOTICE_COPY.restore,
          name: NOTICE_COPY.restoreNamed,
          values: { title: one.title },
          onSelect: one.onRestore,
          testId: `restore-screen-${one.id}`,
        },
        {
          label: NOTICE_COPY.submitDeletion,
          values: { id: one.id },
          href: one.href,
          testId: `submit-deletion-${one.id}`,
        },
      ],
    });
  }

  return sortNotices(notices);
}
