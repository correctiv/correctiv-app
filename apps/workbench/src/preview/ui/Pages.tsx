import { Command } from 'cmdk';
import { List } from 'lucide-react';
import { useState } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { Button } from '../../ui/kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { PAGES } from '../routes';

/**
 * The two sentences this list writes itself, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/frame.ts`.
 *
 * `frame.*`, because this button sits on the bar above the app and belongs to it.
 * The groups and the notes inside the list are `frame.pages.*` as well and live in
 * `../routes.ts`, where the table is; most of the LABELS there are not messages at
 * all, because they are the app's own German screen names, and that file argues it.
 */
const COPY = defineMessages({
  open: {
    id: 'frame.pages.open',
    defaultMessage: 'Go to a page',
    description:
      'Four things at once, all the same words: the button’s accessible name, its tooltip, the dialog’s own name and the placeholder in the field that filters the list.',
  },
  empty: {
    id: 'frame.pages.empty',
    defaultMessage: 'No page of that name. The field beside this one takes any address.',
    description:
      'Stands in for the list when the typed filter matches nothing. The field it points at is the route field to the right of this button.',
  },
});

/**
 * The pages worth reaching, as a command list rather than a `select`.
 *
 * It was a `select` first, and that was the wrong element for two reasons a
 * review found by pressing keys. A `select` whose value is always the empty
 * placeholder cannot be arrowed: every Down from the closed control lands on the
 * first option and navigates there, so a keyboard reflex silently loses the route
 * you were looking at. And it takes the width of its widest option, which here is
 * a sentence, so the notes had to be capped away to keep the route field usable.
 *
 * A command list has neither problem, and the notes are the point: `/behauptung/
 * claim-001` is not an address anybody guesses, and the label alone does not say
 * that `/formular` is the participation form. It also types to filter, which the
 * `datalist` on the route field does for paths and this now does for names.
 *
 * `cmdk` rather than a menu of our own, because `ui/Search.tsx` is already built
 * on it and this is the same interaction one bar down.
 */
export function Pages({ onPick }: { onPick: (route: string) => void }) {
  const intl = useWorkbenchIntl();
  const [open, setOpen] = useState(false);
  const goTo = intl.formatMessage(COPY.open);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={goTo} onClick={() => setOpen(true)}>
            <List aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{goTo}</TooltipContent>
      </Tooltip>

      <Command.Dialog
        loop
        open={open}
        onOpenChange={setOpen}
        label={goTo}
        overlayClassName="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(34rem,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-stroke bg-canvas shadow-2xl duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <Command.Input
          autoFocus
          placeholder={goTo}
          className="w-full border-b border-stroke bg-transparent px-sm py-s text-m text-on-canvas outline-none placeholder:text-on-canvas-muted"
        />
        <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-xs">
          <Command.Empty className="px-s py-m text-center text-m text-on-canvas-muted">
            {intl.formatMessage(COPY.empty)}
          </Command.Empty>

          {PAGES.map((group) => (
            <Command.Group
              key={group.group.id}
              heading={intl.formatMessage(group.group)}
              className="[&_[cmdk-group-heading]]:px-xs [&_[cmdk-group-heading]]:py-2xs [&_[cmdk-group-heading]]:text-s [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-on-canvas-muted"
            >
              {group.pages.map((page) => {
                // Formatted once per row, because both the drawing and the string
                // `cmdk` filters on need them and a second call would be a second
                // chance for the two to differ.
                const label =
                  typeof page.label === 'string' ? page.label : intl.formatMessage(page.label);
                const note = page.note === undefined ? '' : intl.formatMessage(page.note);
                return (
                  <Command.Item
                    // The route is in the searchable value as well as the label, so
                    // somebody who does know the address can still type it here.
                    key={page.route}
                    value={`${label} ${page.route} ${note}`}
                    onSelect={() => {
                      onPick(page.route);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-baseline gap-xs rounded-md px-xs py-2xs text-m text-on-canvas data-[selected=true]:bg-surface"
                  >
                    <span className="shrink-0 font-medium">{label}</span>
                    {note !== '' && (
                      <span className="min-w-0 flex-1 truncate text-s text-on-canvas-muted">
                        {note}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 pl-s font-mono text-s text-on-canvas-muted">
                      {page.route}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
