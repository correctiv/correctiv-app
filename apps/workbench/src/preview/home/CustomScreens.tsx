import { Eye, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { defineMessages } from 'react-intl';

import type { SettingValue } from '@correctiv/app-core/lib/home-layout';
import { textBoundOf } from '@correctiv/app-core/lib/home-settings';
import {
  CUSTOM_SCREEN_ID_MAX_LENGTH,
  SCREEN_TITLE_SPEC,
  type CustomScreenIdFault,
  type ScreenWords,
} from '@correctiv/app-core/lib/screen-layout';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { Button } from '../../ui/kit/button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '../../ui/kit/popover';
import { Select } from '../../ui/kit/select';
import { TextSetting } from './TextSetting';

/**
 * The screens the newsroom makes, in the layout tool's bar (ADR 0075 §7).
 *
 * A file of its own for the reason `Controls.tsx` gives: it takes its state as arguments,
 * so a test can press it in a real DOM without the app behind it. The store, the
 * submission and the frame stay in the panel; what is here is what a person sees and the
 * four things they can do: open a custom screen, make one, name it, take it away.
 *
 * **An id is typed once and never edited.** It becomes a route segment, a file name and a
 * key in the joined document, so renaming one would be a deletion and a new screen. The
 * title is the word the reader sees and it is the one that changes, which is ADR 0075 §3's
 * whole argument for keeping the two apart.
 */

export const CUSTOM_SCREEN_COPY = defineMessages({
  more: {
    id: 'home.custom.more',
    defaultMessage: 'Your screens',
    description:
      'The accessible name of the list of screens the newsroom made, beside the five the app ships with, in the layout tool’s bar. Also its placeholder while none of them is open.',
  },
  new: {
    id: 'home.custom.new',
    defaultMessage: 'New screen',
    description:
      'The name of the button that opens the form for making a screen the newsroom thinks of, in the layout tool’s bar. A tooltip and a title as well, because the button is a plus sign.',
  },
  idLabel: {
    id: 'home.custom.idLabel',
    defaultMessage: 'Id, e.g. summer-campaign',
    description:
      'The accessible name and the placeholder of the field for a new screen’s id. The id becomes the address /s/<id> in the app and the name of the file, so the example is one a person could use.',
  },
  titleLabel: {
    id: 'home.custom.titleLabel',
    defaultMessage: 'Title in German',
    description:
      'The accessible name and the placeholder of the field for a new screen’s title. German is the language every screen has to be named in (ADR 0075 §2).',
  },
  create: {
    id: 'home.custom.create',
    defaultMessage: 'Create screen',
    description: 'The button that makes the new screen, in the form opened by home.custom.new.',
  },
  cancel: {
    id: 'home.custom.cancel',
    defaultMessage: 'Cancel',
    description: 'The button that closes the form for a new screen without making one.',
  },
  address: {
    id: 'home.custom.address',
    defaultMessage: 'The app opens it at {path}.',
    description:
      'Under the form for a new screen, saying where it will be in the app. {path} is the address with the id typed so far, such as /s/summer-campaign, which is never translated.',
  },
  empty: {
    id: 'home.custom.fault.empty',
    defaultMessage: 'Type an id.',
    description:
      'Under the id field of a new screen while it is empty and the person has pressed Create.',
  },
  tooLong: {
    id: 'home.custom.fault.tooLong',
    defaultMessage: 'At most {max} characters.',
    description:
      'Under the id field of a new screen when the id is longer than the core allows. {max} is the number.',
  },
  malformed: {
    id: 'home.custom.fault.malformed',
    defaultMessage: 'Only lower-case letters, digits and single hyphens between them.',
    description:
      'Under the id field of a new screen when it holds anything else: a capital, a space, a dot, a slash, a leading or doubled hyphen. The id becomes part of an address, so the rule is strict.',
  },
  declared: {
    id: 'home.custom.fault.declared',
    defaultMessage: 'The app already has a screen with that name.',
    description:
      'Under the id field of a new screen when it is the id of one of the five screens the app ships with.',
  },
  reserved: {
    id: 'home.custom.fault.reserved',
    defaultMessage: 'That name is kept for the tab bar.',
    description:
      'Under the id field of a new screen when it is navigation, which is the name a submission gives the tab bar’s document.',
  },
  taken: {
    id: 'home.custom.fault.taken',
    defaultMessage: 'There is already a screen with that id.',
    description:
      'Under the id field of a new screen when a custom screen with that id exists, in the repository or as a draft here.',
  },
  titleMissing: {
    id: 'home.custom.fault.titleMissing',
    defaultMessage: 'Give the screen a German title.',
    description:
      'Under the title field of a new screen while it is empty and the person has pressed Create. A screen with no name has nothing to fall back to (ADR 0075 §2).',
  },
  title: {
    id: 'home.custom.title',
    defaultMessage: 'Title',
    description:
      'The accessible name of the field that renames the open custom screen, in its own row under the bar. The word readers see at the top of the screen and in the “Mehr” list.',
  },
  preview: {
    id: 'home.custom.preview',
    defaultMessage: 'Show {path} in the frame',
    description:
      'The name of the button that takes the frame to the open custom screen. {path} is its address, such as /s/summer-campaign, which is never translated.',
  },
  delete: {
    id: 'home.custom.delete',
    defaultMessage: 'Delete this screen',
    description:
      'The name of the button that takes the open custom screen away. For one that was only ever a draft it is the whole of the deletion.',
  },
  deleteSubmit: {
    id: 'home.custom.deleteSubmit',
    defaultMessage: 'Delete this screen and submit the deletion',
    description:
      'The name of the button that takes a custom screen away that the repository already carries. It opens GitHub’s new-issue page with the deletion in it, like Submit changes does, because the file is only removed when the pull request is merged.',
  },
});

/** The message a fault is told in. A total table, so a seventh fault is a compile error here. */
const FAULTS = {
  'not-a-string': CUSTOM_SCREEN_COPY.malformed,
  empty: CUSTOM_SCREEN_COPY.empty,
  'too-long': CUSTOM_SCREEN_COPY.tooLong,
  malformed: CUSTOM_SCREEN_COPY.malformed,
  declared: CUSTOM_SCREEN_COPY.declared,
  reserved: CUSTOM_SCREEN_COPY.reserved,
  taken: CUSTOM_SCREEN_COPY.taken,
} as const satisfies Record<CustomScreenIdFault | 'taken', unknown>;

export type NewScreenFault = CustomScreenIdFault | 'taken';

const SMALL = 'h-[1.75rem] gap-3xs px-2xs text-s';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const FIELD =
  'h-[1.75rem] w-full rounded-md border border-stroke bg-canvas px-2xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** What the bar needs to draw the custom screens, and to change them. */
export interface CustomScreensControl {
  /** Every custom screen the editor can open, by id. */
  ids: readonly string[];
  /** The title a screen is listed by: its own German one, or the id. */
  titleOf: (id: string) => string;
  /** Why this id cannot name a new screen, or null. The same function `create` asks. */
  fault: (id: string) => NewScreenFault | null;
  /** Makes the screen and opens it: its fault instead when it cannot. */
  create: (id: string, title: string) => NewScreenFault | null;
}

/** The open custom screen's own row: what it is called, where it is, and the way out. */
export interface OpenCustomScreen {
  id: string;
  words: ScreenWords | null;
  onTitle: (title: SettingValue) => void;
  onPreview: () => void;
  /**
   * Set when the repository already carries the screen: deleting it is then a submission,
   * which is a link, and `onDelete` still takes it out of this editor as the link opens.
   */
  submitDeletion: { href: string } | null;
  onDelete: () => void;
}

export function CustomScreenList({
  control,
  screen,
  disabled,
  onOpen,
}: {
  control: CustomScreensControl;
  /** The screen being edited, so the list says which of its own is open. */
  screen: string;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  const intl = useWorkbenchIntl();
  const open = control.ids.includes(screen) ? screen : '';
  return (
    <>
      {control.ids.length > 0 && (
        <Select
          aria-label={intl.formatMessage(CUSTOM_SCREEN_COPY.more)}
          className="w-[8rem] shrink"
          disabled={disabled}
          value={open}
          options={[
            { value: '', label: intl.formatMessage(CUSTOM_SCREEN_COPY.more), disabled: true },
            ...control.ids.map((id) => ({ value: id, label: control.titleOf(id), badge: id })),
          ]}
          onValueChange={(next) => {
            if (next !== '') onOpen(next);
          }}
        />
      )}
      <NewScreen control={control} disabled={disabled} />
    </>
  );
}

/**
 * The form for a screen nobody has made yet.
 *
 * Validation is the core's, asked through `control.fault`, and it is shown as text under
 * the field as the person types, once there is something to judge. An empty field is not a
 * fault until Create is pressed: telling somebody who has not typed that they have made a
 * mistake is the wrong first sentence.
 */
function NewScreen({ control, disabled }: { control: CustomScreensControl; disabled: boolean }) {
  const intl = useWorkbenchIntl();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [tried, setTried] = useState(false);

  const fault = id === '' && !tried ? null : control.fault(id);
  const titleMissing = tried && title.trim() === '';

  const reset = () => {
    setId('');
    setTitle('');
    setTried(false);
  };

  const submit = () => {
    setTried(true);
    if (control.fault(id) !== null || title.trim() === '') return;
    if (control.create(id, title) === null) {
      setOpen(false);
      reset();
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-[1.75rem]"
          disabled={disabled}
          aria-label={intl.formatMessage(CUSTOM_SCREEN_COPY.new)}
          title={intl.formatMessage(CUSTOM_SCREEN_COPY.new)}
          data-testid="new-screen"
        >
          <Plus aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="flex w-[18rem] flex-col gap-2xs">
        <form
          className="flex flex-col gap-2xs"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            type="text"
            value={id}
            maxLength={CUSTOM_SCREEN_ID_MAX_LENGTH + 10}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            placeholder={intl.formatMessage(CUSTOM_SCREEN_COPY.idLabel)}
            aria-label={intl.formatMessage(CUSTOM_SCREEN_COPY.idLabel)}
            aria-invalid={fault !== null}
            data-testid="new-screen-id"
            onChange={(event) => setId(event.target.value)}
            className={FIELD}
          />
          {fault !== null && (
            <p role="alert" className={NOTE} data-testid="new-screen-fault">
              {intl.formatMessage(FAULTS[fault], { max: CUSTOM_SCREEN_ID_MAX_LENGTH })}
            </p>
          )}
          <input
            type="text"
            value={title}
            maxLength={textBoundOf(SCREEN_TITLE_SPEC).maxChars}
            placeholder={intl.formatMessage(CUSTOM_SCREEN_COPY.titleLabel)}
            aria-label={intl.formatMessage(CUSTOM_SCREEN_COPY.titleLabel)}
            aria-invalid={titleMissing}
            data-testid="new-screen-title"
            onChange={(event) => setTitle(event.target.value)}
            className={FIELD}
          />
          {titleMissing && (
            <p role="alert" className={NOTE}>
              {intl.formatMessage(CUSTOM_SCREEN_COPY.titleMissing)}
            </p>
          )}
          {id !== '' && fault === null && (
            <p className={NOTE}>
              {intl.formatMessage(CUSTOM_SCREEN_COPY.address, { path: `/s/${id}` })}
            </p>
          )}
          <div className="flex justify-end gap-2xs">
            <PopoverClose asChild>
              <Button type="button" variant="ghost" className="h-[1.75rem] px-2xs text-s">
                {intl.formatMessage(CUSTOM_SCREEN_COPY.cancel)}
              </Button>
            </PopoverClose>
            <Button
              type="submit"
              className="h-[1.75rem] px-2xs text-s"
              data-testid="new-screen-create"
            >
              {intl.formatMessage(CUSTOM_SCREEN_COPY.create)}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The row under the bar while a custom screen is open: its title as a `text` setting
 * (ADR 0075 §3), the way to see it in the frame, and the way to delete it.
 *
 * The title field is `TextSetting`, the one every other word of the document is written
 * with, held to `SCREEN_TITLE_SPEC`, the bound the parser holds it to. What it cannot do
 * is leave the title without a German: `withWord` refuses that, because a screen with no
 * name has nothing to fall back to, so a clear that would do it is not written.
 */
export function CustomScreenRow({
  screen,
  disabled,
}: {
  screen: OpenCustomScreen;
  disabled: boolean;
}) {
  const intl = useWorkbenchIntl();
  const path = `/s/${screen.id}`;
  const label = (message: typeof CUSTOM_SCREEN_COPY.delete) => (
    <>
      <Trash2 aria-hidden="true" />
      {intl.formatMessage(message)}
    </>
  );
  const remove = screen.submitDeletion ? (
    <Button variant="outline" className={SMALL} asChild>
      <a
        href={screen.submitDeletion.href}
        target="_blank"
        rel="noreferrer"
        onClick={screen.onDelete}
        aria-disabled={disabled}
        data-testid="delete-screen"
      >
        {label(CUSTOM_SCREEN_COPY.deleteSubmit)}
      </a>
    </Button>
  ) : (
    <Button
      variant="outline"
      className={SMALL}
      disabled={disabled}
      onClick={screen.onDelete}
      data-testid="delete-screen"
    >
      {label(CUSTOM_SCREEN_COPY.delete)}
    </Button>
  );
  return (
    <div className="flex flex-col gap-2xs" data-testid="custom-screen-row">
      <TextSetting
        spec={SCREEN_TITLE_SPEC}
        value={screen.words?.title}
        disabled={disabled}
        label={intl.formatMessage(CUSTOM_SCREEN_COPY.title)}
        onSet={(next) => {
          if (next !== undefined) screen.onTitle(next);
        }}
      />
      <div className="flex flex-wrap items-center gap-2xs">
        <Button
          variant="outline"
          className={SMALL}
          onClick={screen.onPreview}
          data-testid="preview-screen"
        >
          <Eye aria-hidden="true" />
          {intl.formatMessage(CUSTOM_SCREEN_COPY.preview, { path })}
        </Button>
        {remove}
      </div>
    </div>
  );
}
