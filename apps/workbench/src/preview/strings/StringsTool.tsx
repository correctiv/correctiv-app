import { Copy, Languages, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import model from 'virtual:strings';
import type { StringEntry } from 'virtual:strings';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import type { Status } from '../api';
import type { Pick } from '../frame/locate';
import { DRAFT_DISCARD_EVENT, publishable, publishDraft, restoreDraft, type Draft } from './draft';
import { buildIndex, resolve, type Resolution } from './match';
import { EDITED_LOCALE } from './names';
import { saveWordings, type SaveOutcome } from './save';
import { checkWording, type WordingProblem } from './validate';

/**
 * Point at a string in the frame, or find it in the list, and reword its German.
 *
 * [ADR 0056](../../../../../adr/0056-a-string-is-picked-where-it-renders.md), and the
 * shape of the home tool one floor down: a person points at the thing instead of naming
 * it. The picker reads the text back and `./match.ts` finds the id (§1 to §3); the list
 * under it is the other half, because pointing reaches about a third of the catalogue
 * (§4); what is edited is the German and never the `defaultMessage` (§6); and the edit
 * reaches the frame through `workbench:strings` (§7), which the app reads with a limit of
 * its own.
 *
 * **"No id" is only an honest answer because of a check in another package** (§5).
 * `apps/mobile/__tests__/rendered-literals.test.ts` fails on a literal a person reads,
 * so a word typed straight into the markup cannot be in the tree, and what the
 * catalogue does not recognise is content, a name or a mark. If that check is ever
 * weakened, the sentence `COPY.noId` says is what it costs.
 *
 * Only the app's strings. The workbench's own are the same model and are not in this
 * record: they are not inside the frame, so there is nothing to point at.
 */
const COPY = defineMessages({
  pick: {
    id: 'tools.strings.pick',
    defaultMessage: 'Pick a text',
    description:
      'Arms the strings tool’s picker. tools.strings.picking is what the same button says once it is armed.',
  },
  picking: {
    id: 'tools.strings.picking',
    defaultMessage: 'Click a text in the frame',
    description:
      'What the button says while the strings picker waits for a click inside the framed app. tools.strings.pick is what it says before that.',
  },
  noOwners: {
    id: 'tools.strings.noOwners',
    defaultMessage:
      'Without a development build there is no source stack, so a text that several ids share cannot be narrowed down to one. Finding it by its text still works.',
    description:
      'Under the pick button in the published export, where Metro is not there to say which file drew what.',
  },
  english: {
    id: 'tools.strings.english',
    defaultMessage:
      'The frame is in English. What this tool edits is the German, so an edit is not on screen until the frame is German again.',
    description:
      'Shown while the preview’s app language is English, since only the German catalogue is edited here.',
  },
  noId: {
    id: 'tools.strings.noId',
    defaultMessage:
      'No string id. This is content, a name or a mark, which the app does not translate, unless it is one of the few messages made almost entirely of placeholders, which the list marks.',
    description:
      'The answer to a pick whose text matches no message. It is a real answer rather than an empty result, because a check elsewhere keeps words typed straight into the markup out of the app.',
  },
  several: {
    id: 'tools.strings.several',
    defaultMessage: '{count} ids have this wording. Choose one:',
    description:
      'Over the candidate ids of an ambiguous pick. {count} is how many there are, always two or more.',
  },
  narrowed: {
    id: 'tools.strings.narrowed',
    defaultMessage: 'Narrowed down by the source stack.',
    description:
      'Beside a pick that several ids could have produced, when the files that drew the element decided which one it was.',
  },
  edited: {
    id: 'tools.strings.edited',
    defaultMessage: 'edited',
    description:
      'A badge on an id whose German differs from the catalogue in this browser. One word, lower case.',
  },
  loose: {
    id: 'tools.strings.loose',
    defaultMessage: 'cannot be picked',
    description:
      'A badge on an id made almost entirely of placeholders, which the picker cannot recognise by its text and does not try to. Lower case.',
  },
  looseNote: {
    id: 'tools.strings.looseNote',
    defaultMessage:
      'This message is almost all placeholders, so its text matches nearly any sentence. The picker leaves it out rather than guess; find it here in the list instead.',
    description: 'Under an id that carries the tools.strings.loose badge.',
  },
  englishSource: {
    id: 'tools.strings.englishSource',
    defaultMessage: 'English, which is source',
    description:
      'The label over the English wording, which cannot be edited here because it is the descriptor’s defaultMessage in the code.',
  },
  writtenIn: {
    id: 'tools.strings.writtenIn',
    defaultMessage: 'Written in {place}. Changing the English is a change to the code.',
    description:
      'Under the English wording. {place} is a repository path and a line, such as apps/mobile/src/app/index.tsx:12, and stays as it is.',
  },
  german: {
    id: 'tools.strings.german',
    defaultMessage: 'German',
    description: 'The label over the field where the German wording is edited.',
  },
  reset: {
    id: 'tools.strings.reset',
    defaultMessage: 'Back to the catalogue',
    description: 'Puts this one id’s German back to what the repository has.',
  },
  problemEmpty: {
    id: 'tools.strings.problem.empty',
    defaultMessage: 'The German is empty.',
    description: 'A refusal under the German field. Nothing reaches the frame while it stands.',
  },
  problemSyntax: {
    id: 'tools.strings.problem.syntax',
    defaultMessage: 'This is not a valid message: {detail}',
    description:
      'A refusal under the German field. {detail} is the ICU parser’s own error code, such as MALFORMED_ARGUMENT, which is not translated.',
  },
  problemMissing: {
    id: 'tools.strings.problem.missing',
    defaultMessage: 'The English has placeholders the German lost: {names}',
    description:
      'A refusal under the German field. {names} is a comma-separated list of placeholder names, each written in braces as the message spells it, which stay as they are.',
  },
  problemExtra: {
    id: 'tools.strings.problem.extra',
    defaultMessage: 'The German has placeholders the English does not: {names}',
    description:
      'A refusal under the German field. {names} is a comma-separated list of placeholder names, each written in braces as the message spells it, which stay as they are.',
  },
  problemUnknown: {
    id: 'tools.strings.problem.unknown',
    defaultMessage: 'The catalogue has no such id.',
    description:
      'A refusal from the dev server’s save, for an id no German catalogue file carries. The workbench may reword a string and may not add one.',
  },
  changes: {
    id: 'tools.strings.changes',
    defaultMessage: '{count, plural, one {# text changed} other {# texts changed}}',
    description:
      'Over the save and copy buttons. {count} is how many ids have German in this browser that differs from the catalogue.',
  },
  save: {
    id: 'tools.strings.save',
    defaultMessage: 'Save to the catalogue',
    description:
      'Writes the changed German into packages/catalogue/src/de/ through the dev server. Only offered in development.',
  },
  saved: {
    id: 'tools.strings.saved',
    defaultMessage: 'Written to {paths}.',
    description:
      'After a save. {paths} is a comma-separated list of repository paths, which stay as they are.',
  },
  savedStale: {
    id: 'tools.strings.savedStale',
    defaultMessage:
      'Written to {paths}. The list could not be rebuilt, so run npm run workbench:strings before trusting it.',
    description:
      'After a save whose files were written but whose table of strings was not rebuilt. {paths} is a comma-separated list of repository paths, and the command stays as it is.',
  },
  rejected: {
    id: 'tools.strings.rejected',
    defaultMessage: 'The dev server refused the save (HTTP {status}). Nothing was written.',
    description:
      'After a save the dev server turned away before reading it. {status} is the numeric response status.',
  },
  rejectedOrigin: {
    id: 'tools.strings.rejectedOrigin',
    defaultMessage:
      'The dev server only takes a save from this site on this machine. Nothing was written.',
    description:
      'After a save refused because it came from another machine or another site, which the endpoint refuses on purpose.',
  },
  quoted: {
    id: 'tools.strings.quoted',
    defaultMessage: '“{text}”',
    description:
      'The text that was picked, in quotation marks. {text} is the app’s own wording, printed as it is. Use the quotation marks of the language.',
  },
  refused: {
    id: 'tools.strings.refused',
    defaultMessage: 'Nothing was written. {ids}',
    description:
      'After a save the dev server refused. {ids} lists each refused id with its reason, already worded.',
  },
  saveFailed: {
    id: 'tools.strings.saveFailed',
    defaultMessage: 'The dev server did not answer: {detail}',
    description: 'After a save that got no answer. {detail} is the browser’s own error text.',
  },
  copy: {
    id: 'tools.strings.copy',
    defaultMessage: 'Copy changes',
    description: 'Copies the changed German to the clipboard as JSON, id to wording.',
  },
  discard: {
    id: 'tools.strings.discard',
    defaultMessage: 'Discard all',
    description: 'Throws every change away and puts the frame back to the catalogue.',
  },
  noSubmit: {
    id: 'tools.strings.noSubmit',
    defaultMessage:
      'Submitting texts from the published site is not built yet. Copy the changes and send them to somebody who runs the workbench locally.',
    description:
      'In the published site, where the dev server’s save does not exist and the texts kind of submission is named but not built.',
  },
  filter: {
    id: 'tools.strings.filter',
    defaultMessage: 'Find a string',
    description:
      'The accessible name and placeholder of the filter over the list of every app string. It matches ids, English and German.',
  },
  shown: {
    id: 'tools.strings.shown',
    defaultMessage: '{shown} of {total}',
    description:
      'Beside the filter. {shown} is how many rows the list prints, {total} how many match the filter.',
  },
});

const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const CODE = 'font-mono text-[0.8125rem]';

/** How many rows the list prints before it asks for a narrower filter. */
const LIST_MAX = 40;

const APP: readonly StringEntry[] = model.strings.filter((entry) => entry.surface === 'app');
const BY_ID = new Map(APP.map((entry) => [entry.id, entry]));
const SHIPPED_DE: Readonly<Record<string, string>> = Object.fromEntries(
  APP.map((entry) => [entry.id, entry.translations[EDITED_LOCALE] ?? '']),
);
const HAYSTACK = new Map(
  APP.map((entry) => [
    entry.id,
    [entry.id, entry.english, ...Object.values(entry.translations)].join(' ').toLowerCase(),
  ]),
);

/** Placeholder names spelled as a translator types them, `{count}`. */
function braces(names: string[]): string {
  return names.map((name) => `{${name}}`).join(', ');
}

function problemText(
  intl: ReturnType<typeof useWorkbenchIntl>,
  problem: WordingProblem | { code: 'unknown-id' },
): string {
  switch (problem.code) {
    case 'empty':
      return intl.formatMessage(COPY.problemEmpty);
    case 'syntax':
      return intl.formatMessage(COPY.problemSyntax, { detail: problem.detail });
    case 'missing':
      return intl.formatMessage(COPY.problemMissing, { names: braces(problem.names) });
    case 'extra':
      return intl.formatMessage(COPY.problemExtra, { names: braces(problem.names) });
    case 'unknown-id':
      return intl.formatMessage(COPY.problemUnknown);
  }
}

/** What the panel says about a save, in the reader's language and never the server's. */
function outcomeText(intl: ReturnType<typeof useWorkbenchIntl>, outcome: SaveOutcome): string {
  switch (outcome.kind) {
    case 'saved': {
      const paths = outcome.paths.join(', ');
      return intl.formatMessage(outcome.table ? COPY.saved : COPY.savedStale, { paths });
    }
    case 'refused':
      return intl.formatMessage(COPY.refused, {
        ids: outcome.ids
          .map((r) => `${r.id}: ${r.problems.map((p) => problemText(intl, p)).join(' ')}`)
          .join(' '),
      });
    case 'rejected':
      return outcome.code === 'cross-site' || outcome.code === 'not-loopback'
        ? intl.formatMessage(COPY.rejectedOrigin)
        : intl.formatMessage(COPY.rejected, { status: outcome.status });
    case 'unreachable':
      return intl.formatMessage(COPY.saveFailed, { detail: outcome.detail });
  }
}

interface Props {
  status: Status;
  picking: boolean;
  setPicking: (on: boolean) => void;
  pick: Pick | null;
}

export function StringsTool({ status, picking, setPicking, pick }: Props) {
  const intl = useWorkbenchIntl();
  const filterId = useId();
  const germanId = useId();

  /*
   * What the catalogue says, as far as this tab knows. A save moves it: the file on disk
   * now holds what was saved, the frame's dev bundle reloads with it, and the table this
   * page was built with is a build older than both, so the saved wordings are laid over
   * it here rather than left looking like edits.
   */
  const [saved, setSaved] = useState<Readonly<Record<string, string>>>({});
  const baseline = useMemo(() => ({ ...SHIPPED_DE, ...saved }), [saved]);

  const [draft, setDraft] = useState<Draft>(() => restoreDraft(SHIPPED_DE));
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  /*
   * "Alle verwerfen", asked for from outside this panel: the draft marker beside the
   * frame reuses this exact action rather than clearing `workbench:strings` on its own,
   * which would leave this state holding the same wordings and publishing them right
   * back on the next keystroke.
   */
  useEffect(() => {
    const onDiscard = () => setDraft({});
    window.addEventListener(DRAFT_DISCARD_EVENT, onDiscard);
    return () => window.removeEventListener(DRAFT_DISCARD_EVENT, onDiscard);
  }, []);

  const live = useMemo(
    () => publishable(draft, baseline, (id) => BY_ID.get(id)?.english),
    [draft, baseline],
  );
  useEffect(() => publishDraft(live), [live]);

  const lang = status.lang ?? EDITED_LOCALE;
  const index = useMemo(
    () =>
      buildIndex(
        APP.map((entry) => {
          const wording =
            lang === EDITED_LOCALE
              ? (live[entry.id] ?? baseline[entry.id] ?? '')
              : (entry.translations[lang] ?? entry.english);
          return [entry.id, wording] as const;
        }),
      ),
    [lang, live, baseline],
  );

  /*
   * The pick, resolved once when it arrives and not again as the person types: an edit
   * changes the index, and a resolution that followed it would lose the id being edited
   * the moment its German stopped matching the text that was picked.
   */
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    if (!pick) return;
    const owners = pick.hits.length > 0 ? pick.hits.map((hit) => hit.file) : null;
    const found = resolve(indexRef.current, pick.texts, owners, (id) => BY_ID.get(id)?.file);
    setResolution(found);
    setSelected(found?.ids.length === 1 ? found.ids[0]! : null);
  }, [pick]);

  const matches = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? APP.filter((entry) => HAYSTACK.get(entry.id)!.includes(needle)) : APP;
  }, [filter]);

  const entry = selected ? BY_ID.get(selected) : undefined;
  const wording = entry ? (draft[entry.id] ?? baseline[entry.id] ?? '') : '';
  const problems = entry ? checkWording(entry.english, wording) : [];
  const changed = Object.keys(live).length;

  const edit = (id: string, next: string) => {
    setResult(null);
    setDraft((current) => {
      const copy = { ...current };
      if (next === baseline[id]) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const save = async () => {
    const outcome = await saveWordings(live);
    if (outcome.kind === 'saved') {
      setSaved((current) => ({ ...current, ...live }));
      setDraft({});
    }
    setResult({ ok: outcome.kind === 'saved', text: outcomeText(intl, outcome) });
  };

  return (
    <div className="flex flex-col gap-s">
      <div>
        <Button
          variant={picking ? 'default' : 'outline'}
          size="sm"
          aria-pressed={picking}
          onClick={() => setPicking(!picking)}
        >
          <Languages aria-hidden="true" />
          {intl.formatMessage(picking ? COPY.picking : COPY.pick)}
        </Button>
      </div>
      {!status.handle && <p className={NOTE}>{intl.formatMessage(COPY.noOwners)}</p>}
      {lang !== EDITED_LOCALE && <p className={NOTE}>{intl.formatMessage(COPY.english)}</p>}

      {resolution && (
        <div className={cn(CARD, 'flex flex-col gap-2xs px-xs py-2xs')}>
          <p className="min-w-0 truncate font-mono text-s text-on-canvas" title={resolution.text}>
            {intl.formatMessage(COPY.quoted, { text: resolution.text })}
          </p>
          {resolution.ids.length === 0 && <p className={NOTE}>{intl.formatMessage(COPY.noId)}</p>}
          {resolution.ids.length > 1 && (
            <>
              <p className={NOTE}>
                {intl.formatMessage(COPY.several, { count: resolution.ids.length })}
              </p>
              <Candidates ids={resolution.ids} selected={selected} onSelect={setSelected} />
            </>
          )}
          {resolution.narrowed && <p className={NOTE}>{intl.formatMessage(COPY.narrowed)}</p>}
        </div>
      )}

      {entry && (
        <div className={cn(CARD, 'flex flex-col gap-xs p-xs')}>
          <div className="flex min-w-0 flex-wrap items-center gap-xs">
            <code className={cn(CODE, 'min-w-0 break-all text-on-canvas')}>{entry.id}</code>
            {live[entry.id] !== undefined && (
              <Badge variant="outline">{intl.formatMessage(COPY.edited)}</Badge>
            )}
            {index.loose.has(entry.id) && (
              <Badge variant="outline">{intl.formatMessage(COPY.loose)}</Badge>
            )}
          </div>
          {index.loose.has(entry.id) && (
            <p className={NOTE}>{intl.formatMessage(COPY.looseNote)}</p>
          )}
          {entry.description && <p className={NOTE}>{entry.description}</p>}

          <div className="flex flex-col gap-4xs">
            <span className={NOTE}>{intl.formatMessage(COPY.englishSource)}</span>
            <p className="text-s text-on-canvas">{entry.english}</p>
            <p className={NOTE}>
              {intl.formatMessage(COPY.writtenIn, {
                place: (
                  <code className={cn(CODE, 'break-all')}>{`${entry.file}:${entry.line}`}</code>
                ),
              })}
            </p>
          </div>

          <div className="flex flex-col gap-4xs">
            <label htmlFor={germanId} className={NOTE}>
              {intl.formatMessage(COPY.german)}
            </label>
            <textarea
              id={germanId}
              rows={3}
              value={wording}
              onChange={(event) => edit(entry.id, event.target.value)}
              aria-invalid={problems.length > 0}
              className={cn(
                CARD,
                'w-full resize-y p-xs text-s text-on-canvas',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                problems.length > 0 && 'border-accent',
              )}
            />
            {/* Polite and always mounted, so a screen reader hears a problem when it
                changes rather than the same sentence again on every keystroke. */}
            <div aria-live="polite" className="flex flex-col gap-4xs">
              {problems.map((problem) => (
                <p key={problem.code} className="text-s text-accent">
                  {problemText(intl, problem)}
                </p>
              ))}
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={draft[entry.id] === undefined}
              onClick={() => edit(entry.id, baseline[entry.id] ?? '')}
            >
              <RotateCcw aria-hidden="true" />
              {intl.formatMessage(COPY.reset)}
            </Button>
          </div>
        </div>
      )}

      {changed > 0 && (
        <div className={cn(CARD, 'flex flex-col gap-xs p-xs')}>
          <p className="text-s font-medium text-on-canvas">
            {intl.formatMessage(COPY.changes, { count: changed })}
          </p>
          <div className="flex flex-wrap gap-xs">
            {import.meta.env.DEV && (
              <Button size="sm" onClick={() => void save()}>
                <Save aria-hidden="true" />
                {intl.formatMessage(COPY.save)}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard.writeText(`${JSON.stringify(live, null, 2)}\n`)
              }
            >
              <Copy aria-hidden="true" />
              {intl.formatMessage(COPY.copy)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft({});
                setResult(null);
              }}
            >
              <Trash2 aria-hidden="true" />
              {intl.formatMessage(COPY.discard)}
            </Button>
          </div>
          {!import.meta.env.DEV && <p className={NOTE}>{intl.formatMessage(COPY.noSubmit)}</p>}
        </div>
      )}
      {result && (
        <output className={cn('block text-s', result.ok ? 'text-on-canvas' : 'text-accent')}>
          {result.text}
        </output>
      )}

      <div className="flex flex-col gap-2xs">
        <div className="flex items-center gap-xs">
          <input
            id={filterId}
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label={intl.formatMessage(COPY.filter)}
            placeholder={intl.formatMessage(COPY.filter)}
            className={cn(
              CARD,
              'h-[2rem] min-w-0 flex-1 px-xs text-s text-on-canvas',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          />
          <span className={cn(NOTE, 'shrink-0 tabular-nums')}>
            {intl.formatMessage(COPY.shown, {
              shown: Math.min(matches.length, LIST_MAX),
              total: matches.length,
            })}
          </span>
        </div>
        <ul className="flex flex-col gap-3xs">
          {matches.slice(0, LIST_MAX).map((row) => (
            <li key={row.id}>
              <Row
                id={row.id}
                wording={live[row.id] ?? baseline[row.id] ?? ''}
                active={row.id === selected}
                marks={[
                  live[row.id] !== undefined ? intl.formatMessage(COPY.edited) : null,
                  index.loose.has(row.id) ? intl.formatMessage(COPY.loose) : null,
                ]}
                onSelect={setSelected}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Candidates({
  ids,
  selected,
  onSelect,
}: {
  ids: string[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-3xs">
      {ids.map((id) => (
        <li key={id}>
          <Row
            id={id}
            wording={BY_ID.get(id)?.file ?? ''}
            active={id === selected}
            marks={[]}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

function Row({
  id,
  wording,
  active,
  marks,
  onSelect,
}: {
  id: string;
  wording: string;
  active: boolean;
  marks: (string | null)[];
  onSelect: (id: string) => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(id)}
      className={cn(
        CARD,
        'flex w-full min-w-0 flex-col items-start gap-4xs px-xs py-2xs text-left',
        'hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        active && 'border-accent',
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-xs">
        <code className={cn(CODE, 'min-w-0 flex-1 truncate text-on-canvas')}>{id}</code>
        {marks
          .filter((mark): mark is string => mark !== null)
          .map((mark) => (
            <Badge key={mark} variant="outline">
              {mark}
            </Badge>
          ))}
      </span>
      <span className={cn(NOTE, 'block w-full truncate')}>{wording}</span>
    </button>
  );
}
