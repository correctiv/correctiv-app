import { ArrowDown, ArrowUp, Check, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { defineMessages } from 'react-intl';

import { MAX_TABS, MIN_MAX_TABS, MORE_TAB } from '@correctiv/app-core/lib/navigation';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { useToolActions } from '../../shell/actions';
import { Select } from '../../ui/kit/select';
import { copyNow } from '../clipboard';
import { ShippedNote } from '../home/DocumentNotes';
import {
  getLayoutId,
  noticeOf,
  screensSnapshot,
  screenTitle,
  subscribeLayout,
} from '../home/store';
import { DEFAULT_LAYOUT } from '../home/names';
import { shippedNavigationOf } from '../home/screens';
import { SHARE_ADDRESS_LIMIT, shareLink } from '../share';
import { SHARE_COPY } from '../shareCopy';
import { VIA_LINK } from '../submission';
import { NAVIGATION_TARGET } from '../home/names';
import { canSave } from '../home/write';
import {
  barOf,
  formatNavigationDocument,
  MORE_NAME,
  movedTab,
  navigationDiffers,
  problemsOf,
  unused,
  withMaxTabs,
  withTab,
} from './document';
import { getNavigation, navigationIncoming, setNavigation, subscribeNavigation } from './store';
import { saveNavigation, submitNavigation } from './write';

/** Everything this tool says, in ENGLISH; the German that ships is `src/i18n/catalogue/de/navigation.ts`. */
const COPY = defineMessages({
  lead: {
    id: 'navigation.lead',
    defaultMessage:
      'The tab bar of the app. The first entry is the screen the app starts on. The frame follows every change.',
    description: 'The one paragraph at the top of the navigation tool.',
  },
  entries: {
    id: 'navigation.entries',
    defaultMessage: 'Entries',
    description: 'The heading above the list of tabs, in order. One word.',
  },
  moveUp: {
    id: 'navigation.moveUp',
    defaultMessage: 'Move {name} up',
    description:
      'The accessible name of a button. {name} is the screen’s own name, such as Entdecken.',
  },
  moveDown: {
    id: 'navigation.moveDown',
    defaultMessage: 'Move {name} down',
    description:
      'The accessible name of a button. {name} is the screen’s own name, such as Entdecken.',
  },
  remove: {
    id: 'navigation.remove',
    defaultMessage: 'Take {name} off the tab bar',
    description:
      'The accessible name of a button. {name} is the screen’s own name, such as Entdecken.',
  },
  add: {
    id: 'navigation.add',
    defaultMessage: 'Add {name}',
    description:
      'The accessible name of a button. {name} is the screen’s own name, such as Entdecken.',
  },
  available: {
    id: 'navigation.available',
    defaultMessage: 'Not on the bar',
    description: 'The heading above the screens of the open layout that the bar does not list.',
  },
  maxTabs: {
    id: 'navigation.maxTabs',
    defaultMessage: 'Tabs before “Mehr”',
    description:
      'The label of the drop-down that sets the most tabs shown. “Mehr” is the name of the overflow tab in the app and is not translated.',
  },
  maxTabsOption: {
    id: 'navigation.maxTabsOption',
    defaultMessage: '{count} tabs',
    description: 'One option of the drop-down. {count} is a number from 2 to 5.',
  },
  maxTabsNote: {
    id: 'navigation.maxTabsNote',
    defaultMessage:
      'Counts “Mehr” as one of them. With more entries than this, the surplus goes behind “Mehr”. At least {min} and at most {max}.',
    description:
      'Under the drop-down. “Mehr” is the overflow tab’s name in the app and stays. {min} and {max} are numbers.',
  },
  result: {
    id: 'navigation.result',
    defaultMessage: 'The bar shows',
    description:
      'The label before the tabs the bar will draw, in order, such as Home · Entdecken · Mehr.',
  },
  behindMore: {
    id: 'navigation.behindMore',
    defaultMessage: 'behind “Mehr”: {names}',
    description:
      'After the bar, when entries overflow. {names} is a comma-separated list of screens’ own names. “Mehr” is the overflow tab’s name and stays.',
  },
  resultEmpty: {
    id: 'navigation.resultEmpty',
    defaultMessage: 'nothing: the app shows its empty state',
    description:
      'After the label of the bar, when no entry can be opened. The empty state is the app’s own page that says the layout holds no screen yet.',
  },
  resultSingle: {
    id: 'navigation.resultSingle',
    defaultMessage: '{name}, with no tab bar',
    description:
      'After the label of the bar, when there is exactly one entry. {name} is the screen’s own name, such as Entdecken.',
  },
  invalid: {
    id: 'navigation.invalid',
    defaultMessage: 'The app would not draw this bar: {codes}',
    description:
      'Shown when the navigation is not valid, and the reason the Submit button in the header is switched off. {codes} is a comma-separated list of the core’s problem codes, which are never translated.',
  },
  copied: {
    id: 'navigation.copied',
    defaultMessage:
      'The change was too long for the link and is on your clipboard. Paste it into the issue.',
    description: 'Shown after Submit changes when the change had to go by the clipboard.',
  },
  refused: {
    id: 'navigation.refused',
    defaultMessage: 'refused',
    description:
      'The badge before a refusal from the dev server. home.document.refused is the same word.',
  },
});

const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const ROW = 'flex items-center gap-xs rounded-md border border-stroke bg-canvas px-xs py-2xs';

export function NavigationEditor() {
  const intl = useWorkbenchIntl();
  const navigation = useSyncExternalStore(subscribeNavigation, getNavigation, getNavigation);
  const selectId = useId();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const incoming = useSyncExternalStore(subscribeNavigation, navigationIncoming, () => false);
  const notice = useSyncExternalStore(subscribeLayout, noticeOf, () => null);
  /** What the last click on Share link came to, as the layout tool keeps it (ADR 0076 §2). */
  const [linked, setLinked] = useState<
    | { kind: 'copied' }
    | { kind: 'no-clipboard'; link: string }
    | { kind: 'too-long'; length: number }
    | null
  >(null);

  // The frame follows the navigation on its own, because the app listens for the key
  // (ADR 0079): a change is no reload. What it does clear is what the last save said. Skipped
  // on arrival, when there is nothing to clear.
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) {
      setFirst(false);
      return;
    }
    setResult(null);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const layoutId = useSyncExternalStore(subscribeLayout, getLayoutId, () => DEFAULT_LAYOUT);
  const joined = useSyncExternalStore(subscribeLayout, screensSnapshot, () => '');
  /** Every screen of the open layout, not a fixed five (ADR 0080 §4). */
  const screens = useMemo(() => (joined === '' ? [] : joined.split('\n')), [joined]);
  const format = (
    message: Parameters<typeof intl.formatMessage>[0],
    values?: Record<string, string>,
  ) => intl.formatMessage(message, values);
  const dirty = navigationDiffers(navigation, shippedNavigationOf(layoutId));
  const problems = problemsOf(navigation);
  const bar = barOf(navigation, screens);
  const offer =
    dirty && problems.length === 0
      ? submitNavigation(navigation, format, layoutId, incoming ? VIA_LINK : undefined)
      : null;
  const rest = unused(navigation, screens);

  const share = async () => {
    const { link, length } = await shareLink(
      'navigation',
      { screen: NAVIGATION_TARGET, document: formatNavigationDocument(getNavigation()) },
      { base: `${window.location.origin}${window.location.pathname}`, hash: window.location.hash },
    );
    if (link === null) setLinked({ kind: 'too-long', length });
    else setLinked(copyNow(link) ? { kind: 'copied' } : { kind: 'no-clipboard', link });
  };

  useToolActions('navigation', {
    dirty,
    /*
     * The reason, in the reader's language, and not a flag: the header's tooltip on a
     * switched-off Submit says it. The codes travel with it rather than being looked
     * up there, because only this tool knows which problem fired.
     */
    blocked:
      problems.length > 0
        ? intl.formatMessage(COPY.invalid, { codes: problems.map((p) => p.code).join(', ') })
        : undefined,
    submit: offer
      ? {
          href: offer.href,
          onClick: () => {
            if (!offer.fits) setCopied(copyNow(offer.body));
          },
        }
      : null,
    origin:
      incoming || notice !== null
        ? intl.formatMessage(
            notice === 'damaged' ? SHARE_COPY.sharedDamaged : SHARE_COPY.sharedHeld,
          )
        : undefined,
    share: {
      run: () => void share(),
      warning:
        linked?.kind === 'too-long'
          ? {
              text: intl.formatMessage(SHARE_COPY.shareTooLong, {
                link: linked.length,
                limit: SHARE_ADDRESS_LIMIT,
              }),
              submit: offer === null ? undefined : { href: offer.href },
            }
          : undefined,
    },
    save: canSave
      ? { run: () => void saveNavigation(navigation, format, layoutId).then(setResult) }
      : undefined,
    discard: () => setNavigation(shippedNavigationOf(layoutId)),
  });

  return (
    <div className="flex flex-col gap-s" data-testid="navigation-editor">
      <p className={NOTE}>{intl.formatMessage(COPY.lead)}</p>

      <section className="flex flex-col gap-2xs" aria-label={intl.formatMessage(COPY.entries)}>
        <h3 className="text-m font-semibold text-on-canvas">{intl.formatMessage(COPY.entries)}</h3>
        <ol className="flex flex-col gap-2xs">
          {navigation.tabs.map((id, index) => (
            <li key={id} className={ROW} data-testid={`nav-entry-${id}`}>
              <span className="flex-1 text-s text-on-canvas">{screenTitle(id)}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                aria-label={intl.formatMessage(COPY.moveUp, { name: screenTitle(id) })}
                onClick={() => setNavigation(movedTab(navigation, id, -1))}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={index === navigation.tabs.length - 1}
                aria-label={intl.formatMessage(COPY.moveDown, { name: screenTitle(id) })}
                onClick={() => setNavigation(movedTab(navigation, id, 1))}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={intl.formatMessage(COPY.remove, { name: screenTitle(id) })}
                onClick={() => setNavigation(withTab(navigation, id, false, screens))}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      </section>

      {rest.length > 0 && (
        <section className="flex flex-col gap-2xs" aria-label={intl.formatMessage(COPY.available)}>
          <h3 className="text-m font-semibold text-on-canvas">
            {intl.formatMessage(COPY.available)}
          </h3>
          <ul className="flex flex-col gap-2xs">
            {rest.map((id) => (
              <li key={id} className={ROW} data-testid={`nav-available-${id}`}>
                <span className="flex-1 text-s text-on-canvas">{screenTitle(id)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={intl.formatMessage(COPY.add, { name: screenTitle(id) })}
                  onClick={() => setNavigation(withTab(navigation, id, true, screens))}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2xs">
        <div className="flex items-center gap-xs">
          <label htmlFor={selectId} className="shrink-0 text-s text-on-canvas">
            {intl.formatMessage(COPY.maxTabs)}
          </label>
          <Select
            id={selectId}
            className="flex-1"
            value={String(navigation.maxTabs)}
            onValueChange={(value) => setNavigation(withMaxTabs(navigation, Number(value)))}
            options={Array.from(
              { length: MAX_TABS - MIN_MAX_TABS + 1 },
              (_, i) => MIN_MAX_TABS + i,
            ).map((count) => ({
              value: String(count),
              label: intl.formatMessage(COPY.maxTabsOption, { count: String(count) }),
            }))}
          />
        </div>
        <p className={NOTE}>
          {intl.formatMessage(COPY.maxTabsNote, {
            min: String(MIN_MAX_TABS),
            max: String(MAX_TABS),
          })}
        </p>
      </div>

      <p className={cn(NOTE, 'text-on-canvas')} data-testid="navigation-result">
        {intl.formatMessage(COPY.result)}:{' '}
        {bar.kind === 'empty'
          ? intl.formatMessage(COPY.resultEmpty)
          : bar.kind === 'single'
            ? intl.formatMessage(COPY.resultSingle, { name: screenTitle(bar.start!) })
            : bar.tabs.map((id) => (id === MORE_TAB ? MORE_NAME : screenTitle(id))).join(' · ')}
        {bar.more.length > 0 && (
          <>
            {' '}
            ({intl.formatMessage(COPY.behindMore, { names: bar.more.map(screenTitle).join(', ') })})
          </>
        )}
      </p>

      {problems.length > 0 && (
        <p role="alert" className={NOTE}>
          {intl.formatMessage(COPY.invalid, { codes: problems.map((p) => p.code).join(', ') })}
        </p>
      )}

      {offer && <ShippedNote layout={layoutId} />}
      {copied && <p className={NOTE}>{intl.formatMessage(COPY.copied)}</p>}
      {linked !== null && linked.kind !== 'too-long' && (
        <div className="flex flex-col gap-xs">
          <output
            className="flex items-start gap-xs text-s text-on-canvas"
            data-testid="share-outcome"
          >
            {linked.kind === 'copied' && (
              <Check aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
            )}
            <span className="min-w-0">
              {intl.formatMessage(
                linked.kind === 'copied' ? SHARE_COPY.shareCopied : SHARE_COPY.shareNoClipboard,
              )}
            </span>
          </output>
          {linked.kind === 'no-clipboard' && (
            <textarea
              readOnly
              aria-label={intl.formatMessage(SHARE_COPY.shareLinkField)}
              value={linked.link}
              rows={3}
              onFocus={(event) => event.currentTarget.select()}
              className="rounded-sm border border-stroke bg-canvas px-3xs py-4xs font-mono text-[0.75rem] leading-snug text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          )}
        </div>
      )}
      {result && (
        <p className="flex items-start gap-xs text-s text-on-canvas">
          {result.ok ? (
            <Check aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
          ) : (
            <span className="shrink-0 rounded-sm bg-red-500 px-3xs font-mono text-[0.75rem] font-semibold uppercase text-white">
              {intl.formatMessage(COPY.refused)}
            </span>
          )}
          <span className="min-w-0">{result.message}</span>
        </p>
      )}
    </div>
  );
}
