import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type TabId = 'home' | 'discover' | 'media' | 'participate' | 'profile';
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * The sizes a reader can choose in the app, as factors of the design's own size.
 *
 * ADR 0033 leaves the steps and the ceiling open and asks for #158's answer before
 * the ceiling moves, so these are the three steps the article control already had
 * and nothing new. 1.15 is also the largest size anything in this app has been seen
 * at from inside it. A reader who needs more has the system's setting, which reaches
 * 200 %, and following it is the default.
 */
export const TEXT_SIZE_STEPS = [0.9, 1, 1.15] as const;
export type TextSizeStep = (typeof TEXT_SIZE_STEPS)[number];

/**
 * One text size for the whole app ([ADR 0033](../../../../adr/0033-one-text-size-for-the-whole-app-the-systems-by-default.md)).
 *
 * `'system'` follows the device's font setting, and is the default. A step is an
 * **absolute** size that replaces the system's rather than multiplying it, so the
 * same choice gives the same size on every phone. The same shape as
 * `ThemePreference`: follow the system, or turn that off and choose.
 */
export type TextSize = 'system' | TextSizeStep;

/**
 * The languages this app can be in: a member here and a catalogue in
 * `@correctiv/catalogue`, never a string in a screen
 * ([ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §6).
 *
 * Two of them now, and that is not the same statement as "the app ships two".
 * German is what ships and there is no user-facing switch; what English being a
 * member buys is that the second language can be **looked at** — in the workbench,
 * in a check, on a device — instead of being a property nobody has ever exercised.
 * A capability with no way to run it is a claim ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §3).
 */
export type Locale = 'de' | 'en';

export interface SettingsState {
  onboardingDone: boolean;
  pushOptIn: boolean;
  /**
   * The app's one text size (Profile → Settings), articles included.
   *
   * It was `textScale`, a multiplier on the article alone that stacked on top of
   * the system's font scale. That field is not read any more, and the rename is
   * the migration: `persist()` restores declared keys only, so an old value can
   * never be taken for an override it was not, and every installed app starts
   * following the system again. `test/stores.test.ts` holds that.
   */
  textSize: TextSize;
  newsletter: {
    spotlight: boolean;
    spotlightCh: boolean;
    klima: boolean;
  };
  /** Theme preference (Profile → Darstellung). 'system' follows the OS. */
  theme: ThemePreference;
  /**
   * The language every user-facing string is rendered in.
   *
   * **Supplied by the host at construction**, not written here and not read from
   * the device ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §4).
   * The phone passes `'de'`, because German is what ships and a phone set to
   * English must not get an app half in English; the workbench passes what its
   * address says; a desktop host would pass what the system answers, because
   * ignoring the system locale is what a desktop application must not do.
   *
   * The value is the same one it always was on the phone. What moved is where the
   * decision is written: out of the core, into the host that knows the answer.
   */
  locale: Locale;
  // Ephemeral shell state (not persisted)
  activeTab: TabId;
  visitedTabs: TabId[];
}

export type NewsletterKey = keyof SettingsState['newsletter'];

/**
 * What survives a restart. The rest of the slice is shell state.
 *
 * `locale` is deliberately absent, and the reason has changed shape without
 * changing its answer. It used to be a constant in this file, so persisting it
 * would have let a value written to a device in 2026 outlive the day the constant
 * changed. It is the HOST's now, which is stronger: a stored locale would let a
 * device remember an answer the host has since stopped giving, and the host is
 * where the question belongs. Nothing here is worth storing that construction
 * already states.
 */
export const PERSISTED_KEYS = [
  'onboardingDone',
  'pushOptIn',
  'textSize',
  'newsletter',
  'theme',
] satisfies Array<keyof SettingsState>;

/** Exported so `stores/store.ts` can build a preloaded slice on top of it. */
export const settingsInitialState: SettingsState = {
  onboardingDone: false,
  pushOptIn: false,
  textSize: 'system',
  newsletter: {
    spotlight: false,
    spotlightCh: false,
    klima: false,
  },
  theme: 'system',
  locale: 'de',
  activeTab: 'home',
  visitedTabs: ['home'],
};

const slice = createSlice({
  name: 'settings',
  initialState: settingsInitialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<TabId>) {
      state.activeTab = action.payload;
      if (!state.visitedTabs.includes(action.payload)) state.visitedTabs.push(action.payload);
    },

    completeOnboarding(state) {
      state.onboardingDone = true;
    },

    setTheme(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload;
    },

    /** One newsletter subscription. Keyed, so a host cannot invent a fourth list. */
    setNewsletter: {
      reducer(state, action: PayloadAction<{ key: NewsletterKey; subscribed: boolean }>) {
        state.newsletter[action.payload.key] = action.payload.subscribed;
      },
      prepare: (key: NewsletterKey, subscribed: boolean) => ({ payload: { key, subscribed } }),
    },

    /** Ignores anything that is neither `'system'` nor one of `TEXT_SIZE_STEPS`. */
    setTextSize(state, action: PayloadAction<TextSize>) {
      if (isTextSize(action.payload)) state.textSize = action.payload;
    },

    setPushOptIn(state, action: PayloadAction<boolean>) {
      state.pushOptIn = action.payload;
    },

    /**
     * The demo reset has to leave the app as if it were freshly installed: onboarding,
     * push, text size and the appearance setting. Interests live in their own slice —
     * the caller resets that one; this owns only its own keys.
     */
    resetForDemo(state) {
      state.onboardingDone = false;
      state.pushOptIn = false;
      state.textSize = 'system';
      state.theme = 'system';
    },

    /**
     * Applied by persist() at startup — see stores/persist.ts.
     *
     * A stored text size that is not one this build offers is dropped rather than
     * applied, so the reader falls back to the system's size instead of one that no
     * control on the settings screen can show as chosen.
     */
    hydrate(state, action: PayloadAction<Partial<SettingsState>>) {
      const { textSize, ...rest } = action.payload;
      Object.assign(state, rest);
      if (textSize !== undefined && isTextSize(textSize)) state.textSize = textSize;
    },
  },
});

/**
 * The language to render in, as a selector rather than a constant, because that
 * is the one shape a second language would not have to rewrite: the provider
 * already asks the store, so switching becomes an action and not a refactor.
 * There is no such action today, and no user-facing switch — a developer-only one
 * belongs in the workbench.
 */
export const locale = (state: SettingsState): Locale => state.locale;

function isTextSize(value: unknown): value is TextSize {
  return value === 'system' || (TEXT_SIZE_STEPS as readonly unknown[]).includes(value);
}

/** Whether the app's text follows the device's font setting, which is the default. */
export const textSizeFollowsSystem = (state: SettingsState): boolean => state.textSize === 'system';

/**
 * The factor every text in the app is drawn at, the article included.
 *
 * `systemScale` is the device's font scale as the host measures it (React Native's
 * `fontScale`), passed in because it changes while the app runs and the core has
 * no way to ask. Following the system, the answer is that value; with a step
 * chosen, it is the step, whatever the system says. Replace, not multiply
 * (ADR 0033 §1): at system 200 % the top step multiplied would be 230 %.
 */
export const appTextScale = (state: SettingsState, systemScale: number): number =>
  state.textSize === 'system' ? systemScale : state.textSize;

/**
 * The step closest to a scale, for the moment a reader turns "follow the system"
 * off: the manual choice starts where the text already is, as near as the steps
 * allow, instead of jumping to the smallest or the default.
 */
export function nearestTextSizeStep(scale: number): TextSizeStep {
  let best: TextSizeStep = TEXT_SIZE_STEPS[0];
  for (const step of TEXT_SIZE_STEPS) {
    if (Math.abs(step - scale) < Math.abs(best - scale)) best = step;
  }
  return best;
}

/**
 * A text style at a scale: its font size and line height multiplied, nothing else.
 *
 * What the host applies, in its one place, when a step replaces the system's scale
 * and the platform's own scaling is switched off for that reason. Those are the two
 * metrics the platform would have scaled; letter spacing stays as the token has it.
 */
export function scaleTextMetrics<T extends object>(style: T, scale: number): T {
  const scaled = Object.entries(style).map(([key, value]: [string, unknown]) =>
    SCALED_METRICS.has(key) && typeof value === 'number' ? [key, value * scale] : [key, value],
  );
  return Object.fromEntries(scaled) as T;
}

const SCALED_METRICS = new Set(['fontSize', 'lineHeight']);

export const settingsReducer = slice.reducer;
export const settingsActions = slice.actions;
export const {
  setActiveTab,
  completeOnboarding,
  setTheme,
  setNewsletter,
  setTextSize,
  setPushOptIn,
  resetForDemo,
} = slice.actions;
