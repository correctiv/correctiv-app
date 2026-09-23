import { ExternalLink, Maximize2, RotateCw } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import api from 'virtual:api';
import type { ApiComponent } from 'virtual:api';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { directEntry } from '../components/direct';
import { NOT_DRAWN } from '../components/direct-ids';
import { DirectPreview } from '../components/DirectPreview';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Slot } from '../shell/slots';
import type { ShellProps } from '../shell/address';
import { Badge } from '../ui/kit/badge';
import { Button } from '../ui/kit/button';
import { InfoTip } from '../ui/kit/info-tip';
import { Segmented } from '../ui/kit/segmented';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/kit/tooltip';
import { Source } from '../ui/Lookup';
import { AppFrame } from '../preview/AppFrame';
import { DEFAULT_DEVICE, deviceOption, DEVICES, preset } from '../preview/devices';
import { FRAME_ROOM, fitScale } from '../preview/scale';

const { groups } = api.components;

const CARD = 'rounded-md border border-stroke bg-canvas p-xs';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const FIELD =
  'h-[1.75rem] rounded-md border border-stroke bg-canvas px-2xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** The two renderings, and the parameter that chooses between them. */
type Rendering = 'direct' | 'bundle';

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/components.ts`, which holds both this page's ids and
 * `/components`'s — one namespace per area rather than one per file.
 *
 * **Three kinds of text on this page and only one of them is here.** This site's
 * own words are: the breadcrumb, the two rail headings, every note under a
 * control, and the lines that stand in for something missing. The component's own
 * prose is not — `first.doc`, `row.propsDoc` and each `prop.doc` are JSDoc out of
 * `apps/mobile/src/components`, rendered as HTML, and AGENTS.md keeps a comment
 * English (ADR 0052 §1). Nor are the identifiers this page prints as labels: a
 * prop's name, a type, `canvas` and `surface`, `.web.tsx`. Those are spellings,
 * and this site leaves an identifier in its own.
 */
const COPY = defineMessages({
  breadcrumb: {
    id: 'components.detail.breadcrumb',
    defaultMessage: 'Breadcrumb',
    description:
      'Read aloud as the name of the trail above the drawing, and never drawn. The trail itself is the components page, the folder, and this component.',
  },
  crumb: {
    id: 'components.detail.crumb',
    defaultMessage: 'Components',
    description:
      'The first step of that trail, which is the name of the page it links to. components.title is that page’s own heading and reads the same in English; the two move together and are two entries because one is a heading and one is a link in a trail.',
  },

  tooNarrow: {
    id: 'components.detail.tooNarrow',
    defaultMessage:
      'The app draws this in a device frame, and the frame needs more width than there is here.',
    description:
      'Shown in place of the drawing whenever the app’s bundle is what would draw it and the window is too narrow for a device frame: for a component this site cannot draw at all, and for one where the reader has asked for the bundle. The button under it is components.detail.full.',
  },
  full: {
    id: 'components.detail.full',
    defaultMessage: 'Open full screen',
    description: 'The button under that line, which gives the frame the whole window.',
  },
  frameTitle: {
    id: 'components.detail.frameTitle',
    defaultMessage: '{name}, drawn in the app',
    description:
      'The accessible name of the iframe holding the app. {name} is the component’s name in the source, such as SectionCard, and is not translated.',
  },
  gallery: {
    id: 'components.detail.gallery',
    defaultMessage: 'The gallery in the preview',
    description:
      'A link into /preview. It says the gallery and not this component on purpose: the preview cannot carry a query on the app’s route, so the frame opens the whole gallery, and the label is what the link does.',
  },
  reload: {
    id: 'components.detail.reload',
    defaultMessage: 'Reload the frame',
    description:
      'Both the reload button’s accessible name and its tooltip, on a single component’s page, where the frame holds the app’s gallery. frame.reload is the same words on the preview’s own bar, where the frame holds a whole route.',
  },

  drawnBy: {
    id: 'components.detail.drawnBy',
    defaultMessage: 'Drawn by',
    description:
      'Read aloud as the group name of the switch between the two renderings, and NEVER drawn: `ui/kit/segmented.tsx` hides a legend unless `showLegend` is passed, and this one does not pass it. The heading a reader sees over the switch is shell.section.rendering. So the two options below have to stand on their own, and a translation that made them agree grammatically with this line would leave a sighted reader with fragments.',
  },
  drawnBySite: {
    id: 'components.detail.drawnBy.site',
    defaultMessage: 'This site',
    description:
      'The first rendering: the component mounted in the workbench’s own React tree. “This site” is the workbench, as against the app. It is read under components.detail.drawnBy, which is not drawn, so it has to be a phrase that stands alone.',
  },
  drawnByBundle: {
    id: 'components.detail.drawnBy.bundle',
    defaultMessage: 'The app’s bundle',
    description:
      'The second rendering: the shipped app, in a device frame. Like components.detail.drawnBy.site it has to stand alone, because the line naming what it answers is read aloud and never drawn.',
  },
  notDrawn: {
    id: 'components.detail.notDrawn',
    defaultMessage: 'Not drawn here: {reason} The bundle draws it.',
    description:
      'Printed under the switch when the first rendering is unavailable. {reason} is a sentence, already ending in a full stop, recorded for this component in components/direct-ids.ts, or components.detail.notDrawn.reason when none is.',
  },
  notDrawnReason: {
    id: 'components.detail.notDrawn.reason',
    defaultMessage: 'the app’s catalogue has no specimen for it.',
    description:
      'The {reason} in components.detail.notDrawn when nothing more specific is recorded. Lower case and ending in a full stop, because it is dropped into the middle of that sentence.',
  },
  twoRenderings: {
    id: 'components.detail.twoRenderings',
    defaultMessage:
      'Two renderings of one component. If they differ, that is a finding, not a flaw. On purpose, nothing compares them automatically.',
  },
  frameHolds: {
    id: 'components.detail.frameHolds',
    defaultMessage: 'The frame holds <strong>{build}</strong>.',
    description:
      'Says which build the device frame is showing. {build} is components.detail.frameHolds.dev or .dist, and <strong> draws it in bold. The tag and the hole have different names because react-intl resolves both out of one map.',
  },
  frameHoldsDev: {
    id: 'components.detail.frameHolds.dev',
    defaultMessage: 'the dev server through the proxy',
    description:
      'The {build} of components.detail.frameHolds on a development server. Lower case, because it is dropped into the middle of that sentence.',
  },
  frameHoldsDist: {
    id: 'components.detail.frameHolds.dist',
    defaultMessage: 'the published export',
    description:
      'The {build} of components.detail.frameHolds in the published build. Lower case, because it is dropped into the middle of that sentence.',
  },

  device: {
    id: 'components.detail.device',
    defaultMessage: 'Device',
    description:
      'The label over the select that picks the size the app is framed at. frame.device is the same word on the preview’s own bar, where it is read aloud rather than drawn.',
  },
  sizeAuto: {
    id: 'components.detail.size.auto',
    defaultMessage: 'The box this page gives it, whatever that is.',
    description:
      'Under the device select when no device is chosen: the drawing simply takes the room the page has.',
  },
  sizeFrame: {
    id: 'components.detail.size.frame',
    defaultMessage: '{width} × {height} at {percent}%',
    description:
      'Under the device select while the app’s bundle is drawing. {width} and {height} are the device’s size in CSS pixels and {percent} is how much the frame had to be scaled down to fit.',
  },
  sizeColumn: {
    id: 'components.detail.size.column',
    defaultMessage: 'Column capped at {width} px. The height is the component’s own.',
    description:
      'Under the device select while this site is drawing. {width} is the chosen device’s width in CSS pixels; there is no height, because a component drawn here is as tall as its content.',
  },

  propsNone: {
    id: 'components.detail.props.none',
    defaultMessage: 'None.',
    description: 'Where the list of props would be, for a component that takes none.',
  },
  propOptional: {
    id: 'components.detail.prop.optional',
    defaultMessage: 'optional',
    description:
      'Appended after a prop’s type, behind a middle dot, for a prop that may be left out. The dot is drawn beside it and is not part of this string.',
  },
  propNoProse: {
    id: 'components.detail.prop.noProse',
    defaultMessage: 'No prose.',
    description:
      'Stands in where a prop carries no doc comment. components.card.noDoc says the same about a whole component and reads differently on purpose: that one is about the component’s own comment.',
  },
  inherits: {
    id: 'components.detail.inherits',
    defaultMessage:
      'Plus everything in {types}. This repository does not own those, so they are named here and not listed.',
    description:
      'Printed under the props of a component whose props type extends one from a library. {types} is the list of those type names, drawn in monospace and separated by commas, and is not translated.',
  },
});

/** The one run drawn inside `components.detail.frameHolds`, at module scope. */
const strong = (chunks: ReactNode[]) => <b className="font-semibold text-on-canvas">{chunks}</b>;

/**
 * One component, drawn twice over, with its props beside it.
 *
 * `/components` is the grid and this is where a component gets room. The
 * relation between a drawing and a frame inverts here, which is the whole reason
 * this route exists: a drawn component takes the space its content needs, and a
 * frame always carries a viewport, so on a card of about three hundred pixels a
 * frame would be a shrunken phone with the component somewhere on it. Here the
 * frame has room, the device size becomes a real choice again, and
 * `preview/devices.ts` already holds the presets for it (ADR 0028).
 *
 * **The two renderings are both offered and never compared.** "This site" is the
 * workbench's own React tree over `react-native-web`; "the app's bundle" is the
 * shipped app in a frame, and where they disagree the app is right (ADR 0027).
 * Nothing checks one against the other and nothing should: screenshot diffing is
 * the flakiest thing in CI, and a check that reddens without cause gets switched
 * off. A disagreement is a finding for a person.
 */
export function ComponentDetail({
  group,
  name,
  address,
  onAddress,
  wide,
  full,
}: ShellProps & { group: string; name: string }) {
  const intl = useWorkbenchIntl();
  const id = `${group}/${name}`;
  /*
   * Both halves of a platform split, because `?c=` carries no platform: the
   * gallery draws whichever the bundler kept and cannot say which, so a route
   * that named one would be answering a question this page cannot ask.
   */
  const rows =
    groups.find((g) => g.name === group)?.components.filter((c) => c.name === name) ?? [];
  const entry = directEntry(id);

  const device = readDevice(address.rest.get('d'));
  const rendering: Rendering =
    entry === undefined ? 'bundle' : readRendering(address.rest.get('r'));

  const setRest = (patch: Record<string, string | null>) => {
    const rest = new URLSearchParams(address.rest);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) rest.delete(key);
      else rest.set(key, value);
    }
    onAddress({ rest });
  };

  const [reloads, setReloads] = useState(0);
  const { stage, box } = useBox();
  const size = preset(device);
  const scale = fitScale(box, size, FRAME_ROOM);

  /*
   * There is always a row here: `resolveView` only answers with this view for a
   * `group/name` the reference has, so an address that names nothing is the
   * not-found view and never reaches this file. That check is there rather than
   * here because the panel is declared before the page renders — returning early
   * from this component left the route's four sections on screen with nothing in
   * any of them.
   */
  const first = rows[0];
  /** Narrow and not full: no room for a device frame, so it gets a door. */
  const asPage = !wide && !full;

  return (
    <>
      {/*
        `h-full` only where this view owns the height. Narrow it does not: the
        sections are rendered after the page, so the column scrolls as one and a
        stage that filled the viewport and scrolled inside itself would be a
        second scroller in it — the specimens caught in a 688px box that a reader
        has to get past before the props are reachable. Measured at 390px on
        2026-09-11, `ui/Typo`: the page scrolled 2,669px and the stage inside it
        3,584px. `pages/Design.tsx` makes the same split for the same reason.
      */}
      <div
        className={cn(
          'stage-grid flex flex-col bg-canvas',
          full ? 'h-dvh' : asPage ? 'min-h-[60dvh]' : 'h-full',
        )}
      >
        {!full && (
          <nav
            aria-label={intl.formatMessage(COPY.breadcrumb)}
            className="shrink-0 px-m py-s text-s text-on-canvas-muted"
          >
            <ol className="flex flex-wrap items-center gap-2xs">
              <li>
                <a className="hover:text-on-canvas" href={href('/components')}>
                  {intl.formatMessage(COPY.crumb)}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <a className="hover:text-on-canvas" href={`${href('/components')}#g-${group}`}>
                  {group}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-mono text-on-canvas">{name}</li>
              {rows.map(
                (row) =>
                  row.platform && (
                    <li key={row.platform}>
                      <Badge variant="outline" className="font-mono">
                        {row.platform}
                      </Badge>
                    </li>
                  ),
              )}
            </ol>
          </nav>
        )}

        {rendering === 'direct' && entry !== undefined ? (
          /*
            Every specimen twice, on `canvas` and on `surface`, which is the app's
            own gallery layout reproduced with this site's classes. A component
            that reaches for a primitive where it meant a semantic token looks
            right on exactly one of the two, and right on both in light mode.
          */
          <div className={cn('min-h-0 flex-1 p-m', !asPage && 'overflow-auto')}>
            <div className="mx-auto" style={{ maxWidth: size.w === 0 ? undefined : size.w }}>
              {entry.specimens.map((specimen) => (
                <section key={specimen.label} className="mb-m last:mb-0">
                  <h2 className="mb-2xs font-mono text-s text-on-canvas-muted">{specimen.label}</h2>
                  <div className="overflow-hidden rounded-md border border-stroke">
                    <p className={cn(NOTE, 'border-b border-stroke px-s py-3xs')}>canvas</p>
                    <DirectPreview specimens={[specimen]} ground="canvas" labels={false} />
                    {!specimen.ownSurface && (
                      <>
                        <p className={cn(NOTE, 'border-y border-stroke px-s py-3xs')}>surface</p>
                        <DirectPreview specimens={[specimen]} ground="surface" labels={false} />
                      </>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : asPage ? (
          <div className="flex min-h-[40dvh] flex-1 flex-col items-center justify-center px-m py-xl text-center">
            <p className={cn(NOTE, 'max-w-content')}>{intl.formatMessage(COPY.tooNarrow)}</p>
            <Button size="lg" className="mt-s" onClick={() => onAddress({ full: true })}>
              <Maximize2 aria-hidden="true" />
              {intl.formatMessage(COPY.full)}
            </Button>
          </div>
        ) : (
          <div ref={stage} className="relative flex min-h-0 flex-1 overflow-auto p-m">
            <div className="m-auto">
              <AppFrame
                key={`${id}-${device}-${reloads}`}
                route={`/gallery?c=${id}&bare=1`}
                title={intl.formatMessage(COPY.frameTitle, { name })}
                size={size.w === 0 ? { w: box.w || 393, h: box.h || 640 } : size}
                scale={size.w === 0 ? 1 : scale}
              />
            </div>
          </div>
        )}
      </div>

      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2xs">
          {/*
            The gallery, and not this component in it, because the preview
            cannot carry a query on the app's route: `shell/address.ts` splits the
            hash at the first `?`, so everything after it is a parameter, and
            `preview/state.ts` writes back only the ten it knows. A
            `#/gallery?c=ui/Card` therefore arrives as `#/gallery` and the frame
            opens the whole gallery. Measured on 2026-09-11 — the link said the
            component's name and the frame's address was `/app/gallery`, with
            nothing anywhere to say so. The label is what the link does.
          */}
          <Button variant="outline" size="sm" asChild>
            <a href={`${href('/preview')}#/gallery?d=${device}`}>
              <ExternalLink aria-hidden="true" />
              {intl.formatMessage(COPY.gallery)}
            </a>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={intl.formatMessage(COPY.reload)}
                disabled={rendering !== 'bundle'}
                onClick={() => setReloads((n) => n + 1)}
              >
                <RotateCw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{intl.formatMessage(COPY.reload)}</TooltipContent>
          </Tooltip>
        </div>
      </Slot>

      <Slot id="rendering">
        <div className="flex items-end gap-xs">
          <div className="min-w-0 flex-1">
            <Segmented
              name="rendering"
              legend={intl.formatMessage(COPY.drawnBy)}
              value={rendering}
              options={[
                { value: 'direct', label: intl.formatMessage(COPY.drawnBySite) },
                { value: 'bundle', label: intl.formatMessage(COPY.drawnByBundle) },
              ]}
              onChange={(value) => setRest({ r: value === 'direct' ? null : value })}
              disabled={entry === undefined}
            />
          </div>
          {/* Why there are two, which a reader wants once. Why one of them is off, when
              it is, stays on the panel below: that is the state of the control. */}
          {entry !== undefined && (
            <InfoTip about={intl.formatMessage(COPY.drawnBy)} className="mb-xs" align="end">
              <p>{intl.formatMessage(COPY.twoRenderings)}</p>
            </InfoTip>
          )}
        </div>
        {entry === undefined && (
          <p className={NOTE}>
            {/* A recorded reason wins; `direct-ids.ts` says in its own header that
                one written there has to be a descriptor. */}
            {intl.formatMessage(COPY.notDrawn, {
              reason: NOT_DRAWN[id] ?? intl.formatMessage(COPY.notDrawnReason),
            })}
          </p>
        )}
        {rendering === 'bundle' && (
          <p className={NOTE}>
            {/* `intl.formatMessage` and never `<FormattedMessage>`: that component
                reads react-intl's own context, which the app's provider shadows
                inside an `AppHost`. `test/i18n.test.ts` fails on one. */}
            {intl.formatMessage(COPY.frameHolds, {
              strong,
              build: intl.formatMessage(
                import.meta.env.DEV ? COPY.frameHoldsDev : COPY.frameHoldsDist,
              ),
            })}
          </p>
        )}
      </Slot>

      <Slot id="device">
        <label className="flex flex-col gap-2xs">
          <span className={NOTE}>{intl.formatMessage(COPY.device)}</span>
          <select
            className={cn(FIELD, 'w-full')}
            value={device}
            onChange={(event) =>
              setRest({ d: event.target.value === DEFAULT_DEVICE ? null : event.target.value })
            }
          >
            {DEVICES.filter((d) => d.id !== 'custom').map((d) => (
              <option key={d.id} value={d.id}>
                {deviceOption(intl, d)}
              </option>
            ))}
          </select>
        </label>
        <p className={cn(NOTE, 'tabular-nums')}>
          {size.w === 0
            ? intl.formatMessage(COPY.sizeAuto)
            : rendering === 'bundle'
              ? intl.formatMessage(COPY.sizeFrame, {
                  width: size.w,
                  height: size.h,
                  percent: Math.round(scale * 100),
                })
              : intl.formatMessage(COPY.sizeColumn, { width: size.w })}
        </p>
      </Slot>

      {/* No mark on any of these four. The rail carries a number only where it
          reports something to act on, and "this site", "390×844" and "6 props"
          are each said by the tool one press behind the icon. */}
      <Slot id="props">
        {rows.map((row) => (
          <Props key={row.platform ?? 'shared'} row={row} split={rows.length > 1} />
        ))}
      </Slot>

      <Slot id="source">
        <p className="break-words font-mono text-s text-on-canvas-muted">
          {`import { ${first.name} } from '${first.import}'`}
        </p>
        {first.doc && (
          <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: first.doc }} />
        )}
        {rows.map((row) => (
          <Source key={row.platform ?? 'shared'} file={row.file} line={row.line} />
        ))}
      </Slot>

      <Slot id="status">
        <span className="truncate font-mono">{rows.map((row) => row.file).join(' · ')}</span>
      </Slot>
    </>
  );
}

/** One platform's props, as the grid the overview used to carry in its rows. */
function Props({ row, split }: { row: ApiComponent; split: boolean }) {
  const intl = useWorkbenchIntl();

  return (
    <div>
      {split && (
        <h4 className="mb-2xs font-mono text-s font-semibold text-on-canvas">
          {row.platform === 'web' ? '.web.tsx' : '.tsx'}
        </h4>
      )}
      {row.propsType && <p className="font-mono text-s text-on-canvas-muted">{row.propsType}</p>}
      {row.propsDoc && (
        <div className="prose prose-sm mt-2xs" dangerouslySetInnerHTML={{ __html: row.propsDoc }} />
      )}
      {row.props.length === 0 ? (
        <p className="mt-2xs text-m text-on-canvas-muted">{intl.formatMessage(COPY.propsNone)}</p>
      ) : (
        <dl className="mt-2xs divide-y divide-stroke border-y border-stroke">
          {row.props.map((prop) => (
            <div key={prop.name} className="py-xs">
              <dt className="min-w-0">
                <code className={cn(CARD, 'px-3xs py-4xs font-mono text-s wrap-anywhere')}>
                  {prop.name}
                  {prop.optional && '?'}
                </code>
                <p className="mt-3xs font-mono text-s text-on-canvas-muted wrap-anywhere">
                  {prop.type}
                  {prop.optional && ` · ${intl.formatMessage(COPY.propOptional)}`}
                </p>
              </dt>
              <dd className="mt-2xs min-w-0 text-m text-on-canvas-muted">
                {prop.doc ? (
                  <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: prop.doc }} />
                ) : (
                  <span className="text-s italic">{intl.formatMessage(COPY.propNoProse)}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {row.inherits.length > 0 && (
        <p className="mt-s text-s text-on-canvas-muted">
          {/* The list goes in as a VALUE and not as a tag, because a translation
              may want it anywhere in the sentence and a tag can only wrap what the
              English put inside it. */}
          {intl.formatMessage(COPY.inherits, {
            types: row.inherits.map((type, index) => (
              <span key={type}>
                {index > 0 && ', '}
                <code className="font-mono wrap-anywhere">{type}</code>
              </span>
            )),
          })}
        </p>
      )}
    </div>
  );
}

/** A device the presets know, or the default. `custom` has no handles here. */
function readDevice(asked: string | null): string {
  if (asked === null || asked === 'custom') return DEFAULT_DEVICE;
  return DEVICES.some((d) => d.id === asked) ? asked : DEFAULT_DEVICE;
}

/**
 * `r=direct` for a component this site cannot draw falls back rather than
 * refusing: nothing offers that address, so only a hand-typed one arrives here,
 * and the frame is a fair answer to it.
 */
function readRendering(asked: string | null): Rendering {
  return asked === 'bundle' ? 'bundle' : 'direct';
}

/** The stage's own box, measured, which is what the frame is scaled against. */
function useBox() {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const next = { w: element.clientWidth, h: element.clientHeight };
      setBox((previous) => (previous.w === next.w && previous.h === next.h ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // No dependency list: the element this holds is replaced whenever the
    // rendering switches, and an observer left on the old one measures a box
    // nobody can see. Re-attaching every render is one `observe` call.
  });

  return { stage, box };
}
