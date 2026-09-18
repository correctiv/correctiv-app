import { Maximize2, Search as SearchIcon, Settings as SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import docsModule from 'virtual:docs';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { Button } from './kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';
import { href } from '../router';

/**
 * Everything this bar says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * `CORRECTIV` is not here, and neither is the sr-only `CORRECTIV workbench` beside
 * it. Both are the name of the thing rather than a sentence about it, which is the
 * same exemption `nav.ts` gives the `/` entry and `Settings.tsx` gives `English`
 * and `Deutsch`.
 */
const COPY = defineMessages({
  search: {
    id: 'shell.header.search',
    defaultMessage: 'Search the workbench',
    description:
      'The accessible name of the button in the header that opens the palette. shell.search.dialog is the palette itself, which is named the same and is a different element.',
  },
  searchShort: {
    id: 'shell.header.searchShort',
    defaultMessage: 'Search',
    description:
      'The one word drawn inside the search button at md and up, beside its icon and its ⌘K. The button’s full accessible name is shell.header.search.',
  },
  full: { id: 'shell.header.full', defaultMessage: 'Give the app the whole screen' },
  fullTip: {
    id: 'shell.header.fullTip',
    defaultMessage: 'The app on its own',
    description:
      'The tooltip on the button whose accessible name is shell.header.full. Shorter, because a tooltip is read beside the thing it describes.',
  },
  source: {
    id: 'shell.header.source',
    defaultMessage: 'The source on GitHub',
    description:
      'Both the accessible name and the tooltip of the link to the repository every page of this site is rendered from.',
  },
  settings: {
    id: 'shell.header.settings',
    defaultMessage: 'Settings',
    description:
      'Both the accessible name and the tooltip of the button that opens the settings dialog. settings.title is that dialog’s own heading and reads the same in English.',
  },
});

interface Props {
  onSearch: () => void;
  onSettings: () => void;
  /** Present only where there is something worth having the screen to itself. */
  onFull?: () => void;
  /** The context bar: whatever the open view needs across the top. */
  children?: ReactNode;
}

/**
 * The bar across the top, and the only place the application names itself.
 *
 * What is not here any more is the right panel's switch. It sat at the end of
 * this bar, it showed `PanelRight` or `PanelRightClose`, and the panel it opened
 * carried a second button with nearly the same icon that shut the same panel —
 * two controls, one job, and neither of them said which of six tools was about to
 * appear. `ui/ToolRail.tsx` is the one switch now, on the edge the panel opens
 * from. ([ADR 0038](../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
 */
export function Header({ onSearch, onSettings, onFull, children }: Props) {
  const intl = useWorkbenchIntl();

  return (
    <header className="flex min-h-[2.75rem] shrink-0 flex-wrap items-center gap-xs border-b border-stroke bg-canvas py-4xs pl-3xs pr-s">
      <a
        href={href('/')}
        className="flex min-w-0 items-center gap-2xs rounded-md px-3xs text-m font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span aria-hidden="true" className="size-[0.875rem] shrink-0 rounded-s bg-accent" />
        {/* The mark alone below `sm`. On a 390px screen the word is a fifth of
            the bar and the mark says the same thing. */}
        <span className="hidden truncate sm:inline">CORRECTIV</span>
        <span className="sr-only sm:hidden">CORRECTIV workbench</span>
      </a>

      {/* The context bar. It is the middle of the header rather than a row of its
          own, so a view that needs no controls costs no height. It is allowed to
          wrap: at 1024px the app view's controls are about forty pixels wider
          than the room left for them, and a control pushed off the end of a bar
          is a control nobody knows is missing.

          Below 640 it takes a row of its own instead, and takes it last. Every
          view keeps its bar here at that width, so without this the mark and the
          icons are pushed into a second row in whatever order they happen to
          fall: measured at 390px on `/design`, the mark ended up under the "Open
          in Figma" button, which reads as a broken header rather than as a
          wrap. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center max-sm:order-last max-sm:basis-full max-sm:pt-4xs">
        {children}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onSearch}
        className="gap-xs text-on-canvas-muted"
        aria-label={intl.formatMessage(COPY.search)}
      >
        <SearchIcon aria-hidden="true" />
        <span className="hidden md:inline">{intl.formatMessage(COPY.searchShort)}</span>
        <kbd className="hidden rounded-s border border-stroke px-3xs font-mono text-s md:inline">
          ⌘K
        </kbd>
      </Button>

      {onFull && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onFull}
              aria-label={intl.formatMessage(COPY.full)}
              className="size-[2rem]"
            >
              <Maximize2 aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{intl.formatMessage(COPY.fullTip)}</TooltipContent>
        </Tooltip>
      )}

      {/*
        The repository, which every page of this site is rendered from and none
        of them linked to. In the header rather than on one page, because the
        answer to "where does this come from" should not depend on where you are.
      */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild className="size-[2rem]">
            <a
              href={docsModule.repo}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={intl.formatMessage(COPY.source)}
            >
              <GithubMark />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{intl.formatMessage(COPY.source)}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            aria-label={intl.formatMessage(COPY.settings)}
            className="size-[2rem]"
          >
            <SettingsIcon aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{intl.formatMessage(COPY.settings)}</TooltipContent>
      </Tooltip>
    </header>
  );
}

/**
 * GitHub's own mark, inline.
 *
 * `lucide-react` has no brand icons, and a generic one would say "code" where
 * this says "the repository this site is built from". `currentColor` so it takes
 * the button's ink in both schemes, which is also why `test/styles.test.ts` has
 * nothing to object to.
 */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
