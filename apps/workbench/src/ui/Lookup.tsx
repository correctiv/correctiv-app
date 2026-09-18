import { ChevronRight, ExternalLink, Search as SearchIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import docsModule from 'virtual:docs';

const BLOB = `${docsModule.repo}/blob/${docsModule.commit}`;

/**
 * The filter over a lookup surface, with what it currently leaves standing.
 *
 * `/reference` lists the core's symbols and `/components` the app's components.
 * They answer different questions and stay two pages for that reason, but they
 * are built from the same three parts, which are this file: a filter, a row that
 * opens onto the detail, and a link into the repository. Two copies of the row
 * would be two places for the search palette's contract with it to be got wrong.
 *
 * **In the header's context bar, not in the page.** It used to be a sticky row
 * inside the scroller, which is a second sticky thing inside something that is
 * already fixed: the shell has a place for what belongs to the open view, and a
 * filter is the clearest case of it (ADR 0028). So there is no wrapper and no
 * `sticky` here any more — the row it sits in is the header's, and the header
 * wraps at 390px.
 */
export function Filter({
  id,
  label,
  placeholder,
  value,
  onChange,
  summary,
}: {
  id: string;
  /** For the screen reader; a sighted reader has the page's own prose above. */
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  /** How much is left, which is the one thing a filter has to say back. */
  summary: string;
}) {
  return (
    <div className="flex min-w-[12rem] flex-1 flex-wrap items-center gap-xs">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/*
        A floor of 18rem and not 9rem, which is what the box needs before a
        placeholder is a sentence rather than a stub. The summary beside it is
        `shrink-0` and carries three numbers, so with the smaller floor it took
        whatever it wanted and the box got the remainder: 215px at a 390px width and
        250px at 1440, which clipped every one of the three placeholders on this site
        on a font stack slightly wider than the author's. The row already wraps, so
        the floor costs no header line at either width — measured at 390 and 1440,
        both unchanged at 104px and 44px — and the summary drops below the box
        instead when there is genuinely no room.
      */}
      <div className="relative min-w-[18rem] flex-1">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-xs top-1/2 size-[0.875rem] -translate-y-1/2 text-on-canvas-muted"
        />
        <input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-[1.75rem] w-full rounded-md border border-stroke bg-canvas pl-m pr-s text-s text-on-canvas placeholder:text-on-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <p aria-live="polite" className="shrink-0 text-s tabular-nums text-on-canvas-muted">
        {summary}
      </p>
    </div>
  );
}

/**
 * One row, as a disclosure the search palette can open from the outside.
 *
 * A native `details` rather than a scripted one, because `ui/Search.tsx` jumps to
 * a row by setting `open` on the element it finds by id. The React state here
 * only mirrors that back for `aria-expanded`; the element itself stays the owner
 * of whether it is open, so an open from the palette is not undone on the next
 * render.
 *
 * `onOpenChange` is for a child that must not exist while the row is shut. A
 * `details` keeps its panel in the DOM and only hides it, so anything expensive
 * in there is paid for by every row at once whether it is open or not.
 *
 * `text-s` on the row is for a child that cannot state its own size: the kit's
 * badge carries one in the same tailwind-merge group as its colour, so `cn` keeps
 * the last of the two and a badge can have the colour or the size and not both.
 * Every other child states its own, so setting it here costs nothing.
 */
export function Disclosure({
  id,
  summary,
  children,
  onOpenChange,
}: {
  id: string;
  /** The row, minus the chevron, which is this component's. */
  summary: ReactNode;
  children: ReactNode;
  /** Told every time the row opens or shuts, including from the palette. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      id={id}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        onOpenChange?.(event.currentTarget.open);
      }}
      className="group scroll-mt-[4.75rem]"
    >
      <summary
        aria-expanded={open}
        className="flex cursor-pointer list-none items-center gap-xs px-s py-2xs text-s hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight
          aria-hidden="true"
          className="size-[0.875rem] shrink-0 text-on-canvas-muted transition-transform group-open:rotate-90"
        />
        {summary}
      </summary>

      <div className="border-t border-stroke bg-surface px-s py-s sm:pl-xl">{children}</div>
    </details>
  );
}

/**
 * The file and the line, in the repository at the commit this page was built
 * from.
 *
 * Inline text inside a block, not a flex box: a path is one word to a browser and
 * a flex box will not break one, so at 375px this line was 335px wide inside a
 * 262px box and took the panel sideways with it. The paragraph around it is what
 * carries the space above, which a margin on an inline element would not.
 */
export function Source({ file, line }: { file: string; line: number }) {
  return (
    <p className="mt-s">
      <a
        href={`${BLOB}/${file}#L${line}`}
        target="_blank"
        rel="noreferrer noopener"
        className="font-mono text-s text-on-canvas-muted underline decoration-accent underline-offset-2 wrap-anywhere hover:text-on-canvas"
      >
        {file}:{line}
        <ExternalLink aria-hidden="true" className="ml-3xs inline size-[0.75rem] align-[-0.1em]" />
      </a>
    </p>
  );
}
