/**
 * The app's five cuts, ready.
 *
 * On iOS and Android the `expo-font` config plugin embeds the files at build time
 * (`app.json`), so the families are usable from the first frame and there is
 * nothing to load. Asking `useFonts` anyway cost a ~360 ms async load that held
 * the splash screen up, measured on a tablet AVD. `fonts.web.ts` loads them for
 * the browser, which has no embedding, and keeps the `@expo-google-fonts` files
 * out of this bundle.
 */

/** `[loaded, error]`, shaped like `expo-font`'s `useFonts`. */
export function useAppFonts(): [boolean, Error | null] {
  return [true, null];
}
