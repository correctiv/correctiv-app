import { useSyncExternalStore } from 'react';
import { defineMessages } from 'react-intl';

import model from 'virtual:strings';
import type { StringEntry } from 'virtual:strings';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { changedScreens, subscribeLayout } from '../home/store';
import { draftCount, subscribeDraftChange } from '../strings/draft';
import { EDITED_LOCALE } from '../strings/names';

/**
 * Everything this marker says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/draft.ts`.
 *
 * A cold review of #259 and #261 found nothing on screen saying so while `/preview`
 * shows a reworded string or an edited home document, and the same is true of `/app`
 * opened raw on this origin: a screenshot, or a glance at either page, cannot be told
 * from the shipped app. This is the marker that says so, once for both drafts.
 */
const COPY = defineMessages({
  active: {
    id: 'draft.active',
    defaultMessage: 'Draft active',
    description:
      'The badge on the draft marker, shown beside the device frame while a string or the home layout holds an unpublished edit in this browser.',
  },
  stringsChanged: {
    id: 'draft.stringsChanged',
    defaultMessage: '{count, plural, one {# text changed} other {# texts changed}}',
    description:
      'Part of the draft marker’s sentence: how many app strings have an edited German wording in this browser. {count} is that number, drawn inline by the plural rule. tools.strings.changes counts the same thing inside the strings tool and reads the same in English.',
  },
  layoutChanged: {
    id: 'draft.layoutChanged',
    defaultMessage: 'screen layout changed',
    description:
      'Part of the draft marker’s sentence: the home document differs from the file the app ships. home.document.changed is the same word inside the home tool.',
  },
});

/**
 * The shipped German, by id, the same way `StringsTool.tsx` reads it — and read here
 * independently rather than imported from there, because this marker has to render
 * wherever the frame does and the tool's own state does not have to be open for it to.
 */
const APP_STRINGS: readonly StringEntry[] = model.strings.filter(
  (entry) => entry.surface === 'app',
);
const SHIPPED_DE: Readonly<Record<string, string>> = Object.fromEntries(
  APP_STRINGS.map((entry) => [entry.id, entry.translations[EDITED_LOCALE] ?? '']),
);

/**
 * "Draft active", beside the device frame, for as long as either of the two things a
 * person can silently leave running is running.
 *
 * Two independent reads and two independent discards, because the two drafts are two
 * keys with two owners (`preview/strings/draft.ts`, `preview/home/store.ts`) and
 * neither implies the other. Each count is read the same way its own tool reads it —
 * `draftCount` straight off `workbench:strings`, `differs(layout)` off the document
 * `preview/home/store.ts` already holds — so this can never disagree with the tool it
 * is reporting on.
 *
 * Discarding calls the same function the tool's own button does
 * (`discardDraft`, `setLayout(SHIPPED)`), rather than a second way to clear the same
 * key: there is exactly one "Alle verwerfen" and one "Back to the file", each told
 * from a second place.
 */
export function DraftMarker() {
  const intl = useWorkbenchIntl();

  const stringsChanged = useSyncExternalStore(
    subscribeDraftChange,
    () => draftCount(SHIPPED_DE),
    () => draftCount(SHIPPED_DE),
  );
  const layoutChanged =
    useSyncExternalStore(subscribeLayout, changedScreens, changedScreens) !== '';

  if (stringsChanged === 0 && !layoutChanged) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-xs rounded-md border border-stroke bg-surface px-s py-2xs',
      )}
    >
      <Badge variant="accent">{intl.formatMessage(COPY.active)}</Badge>

      {stringsChanged > 0 && (
        <span className="text-s text-on-canvas">
          {intl.formatMessage(COPY.stringsChanged, { count: stringsChanged })}
        </span>
      )}

      {layoutChanged && (
        <span className="text-s text-on-canvas">{intl.formatMessage(COPY.layoutChanged)}</span>
      )}
    </div>
  );
}
