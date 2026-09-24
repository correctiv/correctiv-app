import { useState } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Pressable, ScrollView, View } from 'react-native';

import { SettingRow } from '@/components/profile/SettingRow';
import { Button, Hairline, ScreenHeader, SectionCard, Typo } from '@/components/ui';
import { openExternal } from '@/lib/openExternal';
import {
  useAppTextScale,
  useCoreActions,
  useSession,
  useSettings,
  useTextSizeFollowsSystem,
} from '@/lib/store/core';
import {
  nearestTextSizeStep,
  TEXT_SIZE_STEPS,
  type TextSizeStep,
} from '@correctiv/app-core/stores/settings';
import type { EntitlementSource } from '@correctiv/app-core/types/models';

/**
 * Everything a person reads on this screen, in one place.
 *
 * The `defaultMessage` of each is ENGLISH and the German that ships is in
 * `packages/catalogue/src/de/settings.ts` — the shape ADR 0026 §6 decided, and the one
 * `components/gate/LoginGate.tsx` set out.
 */
const COPY = defineMessages({
  screenTitle: { id: 'settings.title', defaultMessage: 'Settings' },
  accountSection: { id: 'settings.account.section', defaultMessage: 'Account' },
  signedOut: { id: 'settings.account.signedOut', defaultMessage: 'Not signed in' },
  signOut: { id: 'settings.account.signOut', defaultMessage: 'Sign out' },
  accessNone: { id: 'settings.access.none', defaultMessage: 'No app access' },
  notificationsSection: {
    id: 'settings.notifications.section',
    defaultMessage: 'Notifications',
    description:
      'A section heading in the settings. onboarding.push.label is the same word as the label of a switch in the onboarding.',
  },
  push: { id: 'settings.notifications.push', defaultMessage: 'Push notifications' },
  pushDescription: {
    id: 'settings.notifications.pushDescription',
    defaultMessage: 'New investigations and calls to take part (simulated)',
  },
  appearanceSection: { id: 'settings.appearance.section', defaultMessage: 'Appearance' },
  followSystem: {
    id: 'settings.appearance.followSystem',
    defaultMessage: 'Follow the system setting',
    description:
      'A switch in the Appearance section: on, the app is light or dark as the device is. settings.textSize.followSystem is the same words for the switch in the Text size section, one decision taking the same shape twice.',
  },
  darkMode: { id: 'settings.appearance.dark', defaultMessage: 'Dark mode' },
  textSizeSection: { id: 'settings.textSize.section', defaultMessage: 'Text size' },
  /**
   * The same words as the appearance row on purpose: ADR 0033 gives the text size
   * the shape the appearance setting already has, so a reader who has learned one
   * row has learned both. Its own id all the same, because they are two switches.
   */
  textSizeFollowSystem: {
    id: 'settings.textSize.followSystem',
    defaultMessage: 'Follow the system setting',
    description:
      "A switch in the Text size section: on, the whole app uses the device's text size. settings.appearance.followSystem is the same words for the switch in the Appearance section, one decision taking the same shape twice.",
  },
  /**
   * One message with the sample in it, not the word plus the letters. A screen
   * reader reads this whole, and where the size goes in that sentence is a question
   * about the language rather than about the control.
   */
  textSizeOption: {
    id: 'settings.textSize.option',
    defaultMessage: 'Text size {scale}',
    description:
      'The accessible name of one text-size button, read aloud and never seen. {scale} is the sample letters the button shows; it is one message so the language decides where the sample goes.',
  },
  textSizeNoteSystem: {
    id: 'settings.textSize.noteSystem',
    defaultMessage: 'The whole app, articles included, uses the text size set on your device.',
  },
  textSizeNoteManual: {
    id: 'settings.textSize.noteManual',
    defaultMessage:
      "Applies to the whole app, articles included, in place of your device's text size. For larger text, follow the system setting and choose the size on your device.",
  },
  aboutSection: { id: 'settings.about.section', defaultMessage: 'About CORRECTIV' },
  website: { id: 'settings.about.website', defaultMessage: 'Open correctiv.org' },
  imprint: { id: 'settings.about.imprint', defaultMessage: 'Legal notice' },
  privacy: { id: 'settings.about.privacy', defaultMessage: 'Privacy' },
  aboutBody: {
    id: 'settings.about.body',
    defaultMessage:
      'CORRECTIV is a non-profit, independent centre for investigative journalism. Investigations for society, funded by people like you.',
  },
  demoSection: { id: 'settings.demo.section', defaultMessage: 'Demo' },
  demoNote: {
    id: 'settings.demo.note',
    defaultMessage:
      'For demonstrations: resets interests and onboarding. Your account stays signed in.',
  },
  demoReset: { id: 'settings.demo.reset', defaultMessage: 'Reset the demo state' },
  demoDone: {
    id: 'settings.demo.done',
    defaultMessage: '✓ Reset. Restart the app for the onboarding.',
  },
});

/**
 * The sizes a reader can choose in place of the system's, for the whole app.
 *
 * The labels are samples of the size rather than words — the same three letters in
 * every language — so they are not messages. What names them for a screen reader is
 * `COPY.textSizeOption`, which takes one of these as its placeholder. Typed as a
 * record over the core's steps, so a step added there stops this file compiling
 * until it has a label.
 */
const TEXT_SIZE_LABELS: Record<TextSizeStep, string> = { 0.9: 'A', 1: 'A+', 1.15: 'A++' };

/** Where the about section sends people, with the label each link carries. */
const LINKS: Array<{ title: MessageDescriptor; url: string }> = [
  { title: COPY.website, url: 'https://correctiv.org/ueber-uns/' },
  { title: COPY.imprint, url: 'https://correctiv.org/impressum/' },
  { title: COPY.privacy, url: 'https://correctiv.org/datenschutz/' },
];

/**
 * Why the app is open to this account, as the membership system answered it.
 *
 * Typed as the record rather than left to inference, so a fourth
 * `EntitlementSource` fails to compile here instead of leaving this line blank.
 */
const SOURCE_LABELS: Record<EntitlementSource, MessageDescriptor> = defineMessages({
  paid: {
    id: 'settings.access.paid',
    defaultMessage: 'Membership with a contribution',
    description:
      'In the settings, answering how this account has app access. profile.tier.paid is the same words where a membership TIER is named.',
  },
  'local-bundle': { id: 'settings.access.localBundle', defaultMessage: 'Local bundle' },
  trial: {
    id: 'settings.access.trial',
    defaultMessage: 'Trial',
    description:
      "In the settings, answering how this account has app access. gate.noAccess.tierTrial is the same word at the door, where it names the account's tier.",
  },
});

export default function EinstellungenScreen() {
  const actions = useCoreActions();
  const settings = useSettings();
  const session = useSession();
  const intl = useIntl();
  const [resetDone, setResetDone] = useState(false);

  const followSystem = settings.theme === 'system';
  const textFollowsSystem = useTextSizeFollowsSystem();
  const textScale = useAppTextScale();
  const accessLine = intl.formatMessage(
    session.entitlement?.source ? SOURCE_LABELS[session.entitlement.source] : COPY.accessNone,
  );

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Typo variant="headline-l">{intl.formatMessage(COPY.screenTitle)}</Typo>

        {/* The way back out of the door. Signing out closes the app in the same
            tick, because the root layout renders the gate in place of the routes. */}
        <SectionCard label={intl.formatMessage(COPY.accountSection)} className="mt-m">
          <Typo variant="text-m" weight="semibold">
            {session.account?.email ?? intl.formatMessage(COPY.signedOut)}
          </Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-3xs">
            {accessLine}
          </Typo>
          <Button
            title={intl.formatMessage(COPY.signOut)}
            variant="outline"
            className="mt-s"
            fullWidth
            onPress={() => actions.session.signOut()}
          />
        </SectionCard>

        <SectionCard label={intl.formatMessage(COPY.notificationsSection)} className="mt-m">
          <SettingRow
            label={intl.formatMessage(COPY.push)}
            description={intl.formatMessage(COPY.pushDescription)}
            value={settings.pushOptIn}
            onValueChange={(value) => actions.settings.setPushOptIn(value)}
          />
        </SectionCard>

        <SectionCard label={intl.formatMessage(COPY.appearanceSection)} className="mt-m">
          <SettingRow
            label={intl.formatMessage(COPY.followSystem)}
            value={followSystem}
            onValueChange={(value) => actions.settings.setTheme(value ? 'system' : 'light')}
          />
          {!followSystem && (
            <>
              <Hairline className="my-2xs" />
              <SettingRow
                label={intl.formatMessage(COPY.darkMode)}
                value={settings.theme === 'dark'}
                onValueChange={(value) => actions.settings.setTheme(value ? 'dark' : 'light')}
              />
            </>
          )}
        </SectionCard>

        {/* The appearance row's shape for type (ADR 0033): follow the system, or
            turn that off and choose. Turned off, the choice starts at the step
            nearest the size the reader is already looking at. */}
        <SectionCard label={intl.formatMessage(COPY.textSizeSection)} className="mt-m">
          <SettingRow
            label={intl.formatMessage(COPY.textSizeFollowSystem)}
            value={textFollowsSystem}
            onValueChange={(value) =>
              actions.settings.setTextSize(value ? 'system' : nearestTextSizeStep(textScale))
            }
          />
          {!textFollowsSystem && (
            <>
              <Hairline className="my-2xs" />
              <View className="flex-row gap-s" accessibilityRole="radiogroup">
                {TEXT_SIZE_STEPS.map((step) => {
                  const active = settings.textSize === step;
                  const label = TEXT_SIZE_LABELS[step];
                  return (
                    <Pressable
                      key={step}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={intl.formatMessage(COPY.textSizeOption, {
                        scale: label,
                      })}
                      onPress={() => actions.settings.setTextSize(step)}
                      className={[
                        'flex-1 items-center rounded-md border py-s active:opacity-80',
                        active ? 'border-accent bg-surface' : 'border-stroke',
                      ].join(' ')}
                    >
                      <Typo variant="text-m" weight={active ? 'bold' : 'normal'}>
                        {label}
                      </Typo>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
            {intl.formatMessage(
              textFollowsSystem ? COPY.textSizeNoteSystem : COPY.textSizeNoteManual,
            )}
          </Typo>
        </SectionCard>

        <SectionCard label={intl.formatMessage(COPY.aboutSection)} className="mt-m">
          <Typo variant="text-m">{intl.formatMessage(COPY.aboutBody)}</Typo>
          {LINKS.map((link) => (
            <Button
              key={link.url}
              title={intl.formatMessage(link.title)}
              variant="outline"
              onPress={() => openExternal(link.url)}
              className="mt-s"
              fullWidth
            />
          ))}
        </SectionCard>

        <SectionCard label={intl.formatMessage(COPY.demoSection)} tone="surface" className="mt-m">
          <Typo variant="text-s" color="on-canvas-muted">
            {intl.formatMessage(COPY.demoNote)}
          </Typo>
          <Button
            title={intl.formatMessage(COPY.demoReset)}
            variant="secondary"
            className="mt-s"
            fullWidth
            onPress={() => {
              // Two stores, because each owns its own keys — see resetForDemo. It
              // was three until the membership slice went (ADR 0020).
              actions.settings.resetForDemo();
              actions.interests.clear();
              setResetDone(true);
            }}
          />
          {resetDone && (
            <Typo variant="text-s" color="accent" className="mt-s">
              {intl.formatMessage(COPY.demoDone)}
            </Typo>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}
