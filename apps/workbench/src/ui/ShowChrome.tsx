import { PanelsTopLeft } from 'lucide-react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { Button } from './kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';

/**
 * The two words this button says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * `Esc` stays in the tooltip untranslated: it is the key's own name, printed on
 * the keyboard, and the settings dialog leaves `⌘K` and `⌘J` alone for the same
 * reason.
 */
const COPY = defineMessages({
  show: {
    id: 'shell.chrome.show',
    defaultMessage: 'Show the toolbar and sidebars',
    description:
      'The accessible name of the one control left on screen while the chrome is away, which is the only way back.',
  },
  showTip: {
    id: 'shell.chrome.showTip',
    defaultMessage: 'Show the toolbar · Esc',
    description:
      'The tooltip on the same button, naming the key that does it too. Esc is the key’s own name and is not translated.',
  },
});

/**
 * The one thing left on screen when the chrome is out of the way.
 *
 * Floating rather than docked, because docking it would cost the row the chrome
 * just gave back. Top right, over the app, on its own ground with a border so it
 * is legible against whatever the app happens to be painting underneath: this
 * button is the only way back, and a button that disappears into a light screen
 * strands whoever pressed the one before it.
 */
export function ShowChrome({ onShow }: { onShow: () => void }) {
  const intl = useWorkbenchIntl();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onShow}
          aria-label={intl.formatMessage(COPY.show)}
          className="fixed right-s top-s z-40 size-[2.25rem] rounded-full border-stroke-strong bg-canvas shadow-lg"
        >
          <PanelsTopLeft aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{intl.formatMessage(COPY.showTip)}</TooltipContent>
    </Tooltip>
  );
}
