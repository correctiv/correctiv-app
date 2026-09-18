import type { IntlShape } from 'react-intl';

import { wbMessage, type WorkbenchMessage } from '../i18n/messages';

/**
 * A frame's two sides in CSS pixels, written the way the thing is held.
 *
 * Which side is horizontal is the state's `landscape`, which swaps the pair, so
 * nothing here has to pretend a laptop has a portrait. The toolbar names the
 * orientation from the frame `frameSize` returns rather than from the flag,
 * which is the only reading that stays true for both a phone and a laptop.
 *
 * The sizes are kept verbatim from the shell this package replaces, so a link
 * written against it still resolves to the same rectangle.
 *
 * ## What is a message here and what is not
 *
 * A device's name is a product's name and is left alone; a device's *description*
 * is this site's own words and follows the language setting
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * So `iPhone SE` and `Pixel 8` are literals for the same reason `routes.ts` keeps
 * `Entdecken` and `Settings.tsx` keeps `Deutsch` — translating one would rename a
 * thing rather than translate a sentence — and `This screen, full size` is a
 * descriptor, because no manufacturer ever called anything that.
 *
 * `wbMessage()` and not `defineMessages`, because this table is read by
 * `preview/state.ts` and `preview/store.ts` on their way to a number and must not
 * pull React in with it. `src/i18n/messages.ts` says why it takes one descriptor
 * per call.
 */
export interface Device {
  id: string;
  /** A product's own name, or a message where the label is a description. */
  label: string | WorkbenchMessage;
  w: number;
  h: number;
}

/**
 * A device as the two selects print it: its name, and its size where it has one.
 *
 * Here rather than in each select, because `preview/ui/Toolbar.tsx` and
 * `pages/ComponentDetail.tsx` both wrote `${label}, ${w}×${h}` and a third caller
 * would have written it again. `intl` is handed in rather than the hook called,
 * which is what `ui/Settings.tsx`'s `say()` does for the same reason: this is
 * reached from inside a `.map`.
 *
 * `×` is the multiplication sign and the dimensions are digits, so the size half
 * is the same in every language and is not part of any message.
 */
export function deviceOption(intl: IntlShape, device: Device): string {
  const label = typeof device.label === 'string' ? device.label : intl.formatMessage(device.label);
  return device.w === 0 ? label : `${label}, ${device.w}×${device.h}`;
}

/**
 * 768 is not a device. It is the reader's 48rem breakpoint
 * (`packages/design-tokens/src/reader.generated.ts`), worth being able to sit
 * exactly on.
 */
export const DEVICES: Device[] = [
  // Sizeless on purpose: the box it is given IS the size, measured. Everything
  // that reads a width goes through `frameSize`, which asks the stage for this
  // one rather than looking it up here.
  {
    id: 'host',
    label: wbMessage({
      id: 'devices.host',
      defaultMessage: 'This screen, full size',
      description:
        'The first entry in the device picker: no device frame at all, the app drawn at whatever size the page has. It states a size rather than naming one, because this is the one entry with no number beside it.',
    }),
    w: 0,
    h: 0,
  },
  { id: 'iphone-se', label: 'iPhone SE', w: 375, h: 667 },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', w: 393, h: 852 },
  { id: 'pixel-8', label: 'Pixel 8', w: 412, h: 915 },
  {
    id: 'breakpoint',
    label: wbMessage({
      id: 'devices.breakpoint',
      defaultMessage: 'Tablet breakpoint (48rem)',
      description:
        'Not a device: the width the reader’s own stylesheet changes at, worth being able to sit exactly on. 48rem is a CSS length and stays as it is written.',
    }),
    w: 768,
    h: 1024,
  },
  { id: 'ipad-mini', label: 'iPad mini', w: 744, h: 1133 },
  { id: 'ipad-pro-11', label: 'iPad Pro 11"', w: 834, h: 1194 },
  { id: 'ipad-pro-13', label: 'iPad Pro 13"', w: 1024, h: 1366 },
  /*
   * These two are written landscape-first, because that is how a laptop is used.
   * Turning the orientation still turns them, and 800 × 1280 is a rectangle a
   * large tablet is held in, so nothing is lost by it.
   *
   * They are in the list because the app has to work here too and today does not:
   * there is no breakpoint anywhere in `apps/mobile/src` and no
   * `useWindowDimensions`, so every one of these widths shows a phone layout
   * stretched. That is the point of being able to select them.
   *
   * A class of machine rather than a model, so both are messages while the phones
   * and the tablets above are not.
   */
  {
    id: 'laptop',
    label: wbMessage({
      id: 'devices.laptop',
      defaultMessage: 'Laptop',
      description:
        'A size, not a model: a window the size a laptop opens one at. devices.desktop is the larger of the same pair.',
    }),
    w: 1280,
    h: 800,
  },
  {
    id: 'desktop',
    label: wbMessage({
      id: 'devices.desktop',
      defaultMessage: 'Desktop',
      description:
        'A size, not a model: a window the size a desktop screen opens one at. devices.laptop is the smaller of the same pair.',
    }),
    w: 1440,
    h: 900,
  },
  {
    id: 'custom',
    label: wbMessage({
      id: 'devices.custom',
      defaultMessage: 'Custom',
      description:
        'The last entry in the device picker: a width and a height the reader types, or drags the stage handles to. Choosing it is what makes the two number fields on the bar appear.',
    }),
    w: 0,
    h: 0,
  },
];

export const DEFAULT_DEVICE = 'iphone-15-pro';

/** The id whose size is the host's own, so nothing may look it up in `DEVICES`. */
export const HOST_DEVICE = 'host';

/**
 * Below this, a phone drawn inside the page is smaller than the page.
 *
 * At 390 CSS pixels the frame fitted at 40%: an app rendered a quarter of its
 * intended size, inside a device frame, on a device. A tablet in portrait is 744
 * to 1024 wide and has the same problem with less of it, so the line sits on the
 * widest of them and below the narrowest desktop window anybody works in.
 */
export const HOST_BELOW = 1024;

/**
 * What to show when the address named no device.
 *
 * A link that names one always wins, because that is what the link is for. This
 * only decides the first view of `/preview` with nothing after the hash.
 */
export function defaultDevice(): string {
  return window.innerWidth < HOST_BELOW ? HOST_DEVICE : DEFAULT_DEVICE;
}

/**
 * And whether the shell's own chrome starts out of the way.
 *
 * Same line, same reason. On a screen this size the header, the rail, two
 * sidebars and a status line are most of what there is, and the app is what
 * somebody opened this address for. One floating button brings them back.
 */
export function defaultFull(): boolean {
  return window.innerWidth < HOST_BELOW;
}

export function preset(id: string): Device {
  return DEVICES.find((d) => d.id === id) ?? DEVICES.find((d) => d.id === DEFAULT_DEVICE)!;
}
