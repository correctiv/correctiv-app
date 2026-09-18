import { router } from 'expo-router';
import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, ScrollView, View } from 'react-native';

import { SettingRow } from '@/components/profile/SettingRow';
import { Button, Card, Chip, SafeAreaView, SplitRow, Typo } from '@/components/ui';
import { interests } from '@correctiv/app-core/data/interests';
import { useCoreActions, useSelectedInterests, useSettings } from '@/lib/store/core';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { sizes, useColors } from '@/lib/theme';

/**
 * Everything a person reads in the onboarding, in ENGLISH; the German that ships
 * is `src/i18n/catalogue/de/onboarding.ts`.
 */
const COPY = defineMessages({
  screenTitle: { id: 'onboarding.screenTitle', defaultMessage: 'Welcome' },
  skip: { id: 'onboarding.skip', defaultMessage: 'Skip' },
  missionHeadline: {
    id: 'onboarding.mission.headline',
    defaultMessage: 'Investigations for society',
  },
  missionNonprofit: {
    id: 'onboarding.mission.nonprofit',
    defaultMessage: 'Non-profit: nobody owns us',
  },
  missionDonations: {
    id: 'onboarding.mission.donations',
    defaultMessage: 'Donation-funded: carried by thousands',
  },
  interestsHeadline: { id: 'onboarding.interests.headline', defaultMessage: 'What interests you?' },
  interestsLead: {
    id: 'onboarding.interests.lead',
    defaultMessage: 'Your selection orders the home screen.',
  },
  participateHeadline: {
    id: 'onboarding.participate.headline',
    defaultMessage: 'Investigations you take part in',
  },
  participateLead: {
    id: 'onboarding.participate.lead',
    defaultMessage:
      'In the CrowdNewsroom thousands of people contribute to investigations. In the Faktenforum the community checks claims. You find both in the "Mitmachen" tab.',
  },
  pushLabel: {
    id: 'onboarding.push.label',
    defaultMessage: 'Notifications',
    description:
      'The label of the notification switch in the onboarding. settings.notifications.section is the same word as a section heading in the settings.',
  },
  pushDescription: {
    id: 'onboarding.push.description',
    defaultMessage: 'For new investigations and callouts (simulated)',
  },
  start: { id: 'onboarding.start', defaultMessage: "Let's go" },
  next: {
    id: 'onboarding.next',
    defaultMessage: 'Next',
    description:
      'The button that steps forward one page in the onboarding. form.next is the same word in the participation form.',
  },
  done: { id: 'onboarding.done', defaultMessage: 'Done' },
});

/**
 * The sentences on the red mission screen.
 *
 * There was a third, on journalism without a paywall. It became false with the
 * door (ADR 0016) and the login wall the scope puts on correctiv.org, so it is gone
 * rather than reworded: what takes its place is a claim about the new arrangement,
 * and that wording is CORRECTIV's to write, not this repo's. Removed with ADR 0018.
 */
const MISSION = [COPY.missionNonprofit, COPY.missionDonations];

/** The wordmark: eleven letters, the same in every language, so it has no id. */
const WORDMARK = 'CORRECTIV';

/**
 * Onboarding: mission → interests → participate/push.
 *
 * There was a fourth step, the club pitch, ending in a join button beside a "just
 * have a look around" one. Both addressed someone who had not paid, and behind the
 * door (ADR 0016) nobody here is that person: they paid to get this far, and
 * looking around without paying was the thing they could no longer do. The step is
 * gone with ADR 0018.
 *
 * `COPY.skip` stays from step 2 on, and `completeOnboarding()` runs either way,
 * so skipping does not mean being asked again on the next launch.
 *
 * The mission screen is brand red and therefore independent of the colour scheme;
 * the steps after it run on the normal surface.
 */
export default function OnboardingScreen() {
  const intl = useIntl();
  // The one title in the app that is not a word on the screen under it: these
  // three steps have three headings and no name. ADR 0030 names it as such.
  useDocumentTitle(intl.formatMessage(COPY.screenTitle));
  const actions = useCoreActions();
  const colors = useColors();
  const [step, setStep] = useState(0);
  const settings = useSettings();
  const selected = useSelectedInterests();
  const selectedIds = new Set(selected.map((interest) => interest.id));

  const finish = () => {
    actions.settings.completeOnboarding();
    router.replace('/(tabs)');
  };

  const mission = step === 0;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className={mission ? 'flex-1 bg-accent' : 'flex-1 bg-canvas'}
    >
      <SplitRow className="px-m py-s">
        <View className="flex-row gap-2xs">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width: 7,
                height: 7,
                backgroundColor: mission
                  ? i === step
                    ? colors['always-light']
                    : 'rgba(255,255,255,0.45)'
                  : i === step
                    ? colors.accent
                    : colors['stroke'],
              }}
            />
          ))}
        </View>
        {step > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage(COPY.skip)}
            onPress={finish}
            className="justify-center active:opacity-70"
            /*
             * "Überspringen" was one line of `text-s` — 21 dp — with an 8 dp slop
             * around it (#102). It is the only way past this screen other than
             * answering it, and the row it sits in holds nothing but three 7 dp
             * dots at the far left, so the box can have the height.
             */
            style={{ minHeight: sizes.tapTarget }}
          >
            <Typo variant="text-s" color="on-canvas-muted">
              {intl.formatMessage(COPY.skip)}
            </Typo>
          </Pressable>
        )}
      </SplitRow>

      <ScrollView
        className="flex-1"
        // The mission screen has nothing to scroll, so its block is anchored to the
        // bottom of the viewport, which is where the design draft puts it.
        // Top-aligning it left a screen-height of empty red below.
        contentContainerClassName={mission ? 'px-m pb-l grow justify-end' : 'px-m pt-m pb-l'}
        showsVerticalScrollIndicator={false}
      >
        {mission && (
          <View>
            <Typo variant="headline-m" color="always-light" style={{ letterSpacing: 2 }}>
              {WORDMARK}
            </Typo>
            {/* Merriweather, like the reader's h1: this is an editorial promise, not
                a UI label. Sans here was an Expo-only divergence. */}
            <Typo variant="headline-xxl" family="serif" color="always-light" className="mt-s">
              {intl.formatMessage(COPY.missionHeadline)}
            </Typo>
            <View className="mt-2xl">
              {MISSION.map((line) => (
                <View key={line.id} className="mt-s flex-row items-start">
                  {/* White, like the text beside it. The draft had these yellow,
                      but yellow is the club's colour and on the brand red it reads
                      as a colour accident rather than as a list marker. */}
                  <View
                    className="rounded-full bg-always-light"
                    style={{ width: 8, height: 8, marginTop: 7 }}
                  />
                  <Typo variant="text-l" color="always-light" className="ml-s flex-1">
                    {intl.formatMessage(line)}
                  </Typo>
                </View>
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <>
            <Typo variant="headline-xl">{intl.formatMessage(COPY.interestsHeadline)}</Typo>
            <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
              {intl.formatMessage(COPY.interestsLead)}
            </Typo>
            <View className="mt-m flex-row flex-wrap gap-2xs">
              {interests.map((interest) => (
                <Chip
                  key={interest.id}
                  label={interest.label}
                  selected={selectedIds.has(interest.id)}
                  onPress={() => actions.interests.toggle(interest.id)}
                />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Typo variant="headline-xl">{intl.formatMessage(COPY.participateHeadline)}</Typo>
            <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
              {intl.formatMessage(COPY.participateLead)}
            </Typo>
            <Card className="mt-m">
              <SettingRow
                label={intl.formatMessage(COPY.pushLabel)}
                description={intl.formatMessage(COPY.pushDescription)}
                value={settings.pushOptIn}
                onValueChange={(value) => actions.settings.setPushOptIn(value)}
              />
            </Card>
          </>
        )}
      </ScrollView>

      <View className="px-m pb-m">
        <Button
          title={intl.formatMessage(step === 0 ? COPY.start : step === 2 ? COPY.done : COPY.next)}
          variant={mission ? 'onEmphasis' : 'primary'}
          fullWidth
          onPress={() => (step === 2 ? finish() : setStep(step + 1))}
        />
      </View>
    </SafeAreaView>
  );
}
