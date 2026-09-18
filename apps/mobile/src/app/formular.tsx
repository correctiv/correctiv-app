import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ScrollView, View } from 'react-native';

import { KeyboardAvoiding } from '@/components/keyboard/KeyboardAvoiding';
import { FormField } from '@/components/participate/FormField';
import { Button, Hairline, ScreenHeader, Typo } from '@/components/ui';
import { callouts, type CalloutComponent, type Callout } from '@correctiv/app-core/data/callouts';
import { useCoreActions, useExtraCount } from '@/lib/store/core';
import { sizes, useColors } from '@/lib/theme';

/**
 * Everything a person reads in the flow, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/form.ts`.
 *
 * `step` and `contributors` are one message each rather than a number stuck
 * between two fragments: word order is the translator's to change, and the
 * counter's noun inflects.
 */
const COPY = defineMessages({
  screenTitle: { id: 'form.screenTitle', defaultMessage: 'Participation form' },
  unknownHeadline: { id: 'form.unknownHeadline', defaultMessage: 'This form does not exist' },
  unknownSlug: {
    id: 'form.unknownSlug',
    defaultMessage: 'Unknown callout "{slug}".',
    description:
      'Shown when the form is opened for a callout that does not exist. {slug} is the identifier that was passed, unchanged, in quotation marks.',
  },
  noSlug: { id: 'form.noSlug', defaultMessage: 'No callout was given.' },
  cancel: { id: 'form.cancel', defaultMessage: 'Cancel' },
  step: {
    id: 'form.step',
    defaultMessage: 'Step {current} of {total}',
    description:
      'The progress line above the participation form. {current} is the page being filled in and {total} how many there are.',
  },
  back: {
    id: 'form.back',
    defaultMessage: 'Back',
    description:
      'The button that steps back one page in the participation form. `ui.back` is the same word in a screen header elsewhere, but not on this screen: its header says `form.cancel` so that two controls do not both say ‘Back’.',
  },
  next: {
    id: 'form.next',
    defaultMessage: 'Next',
    description:
      'The button that steps forward one page in the participation form. onboarding.next is the same word in the onboarding, which is a different sequence.',
  },
  submit: { id: 'form.submit', defaultMessage: 'Send' },
  thanksHeadline: { id: 'form.thanksHeadline', defaultMessage: 'Thank you for your contribution!' },
  thanksLead: {
    id: 'form.thanksLead',
    defaultMessage:
      'Your contribution goes into the investigation. The newsroom reviews every tip. We will get in touch if anything is unclear.',
  },
  contributors: {
    id: 'form.contributors',
    defaultMessage:
      '{count, plural, one {One person has} other {# people have}} contributed so far.',
    description:
      'On the thank-you page of the participation form. {count} is how many people have contributed to this callout.',
  },
  moreCallouts: { id: 'form.moreCallouts', defaultMessage: 'See more ways to take part' },
});

/**
 * The participation flow: a multi-step form following the callout's schema, then
 * the thank-you page.
 *
 * `?slug=` rather than a path parameter (`/aufruf/[slug]/formular`): the route then
 * exports as a single file and needs no nested `generateStaticParams`. The same
 * decision as for /artikel and /video.
 *
 * The thank-you page is a state of THIS route, not one of its own: it shows the
 * same counter it just raised, and going back must not drop the reader into the
 * filled-in form again.
 */
export default function FormularScreen() {
  const intl = useIntl();
  const actions = useCoreActions();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const callout = useMemo(() => callouts.find((c) => c.slug === slug) ?? null, [slug]);

  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!callout) {
    return (
      <View className="flex-1 bg-canvas">
        <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} drawnBar />
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            {intl.formatMessage(COPY.unknownHeadline)}
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {slug
              ? intl.formatMessage(COPY.unknownSlug, { slug })
              : intl.formatMessage(COPY.noSlug)}
          </Typo>
        </View>
      </View>
    );
  }

  if (submitted) return <ThankYou callout={callout} />;

  const slides = callout.formSchema.slides;
  const slide = slides[Math.min(step, slides.length - 1)];
  const isLast = step === slides.length - 1;

  const select = (component: CalloutComponent, value: string) => {
    setChoices((prev) => {
      const current = prev[component.key] ?? [];
      if (component.type === 'radio') return { ...prev, [component.key]: [value] };
      return {
        ...prev,
        [component.key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const stepValid = slide.components.every((component) => {
    if (!component.required) return true;
    if (component.type === 'radio' || component.type === 'selectboxes') {
      return (choices[component.key] ?? []).length > 0;
    }
    if (component.type === 'textarea' || component.type === 'textfield') {
      return (texts[component.key] ?? '').trim().length > 0;
    }
    return true;
  });

  const next = () => {
    if (!stepValid) return;
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    actions.participation.submit(callout.slug, { ...choices, ...texts });
    setSubmitted(true);
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* The second named exception in ADR 0030. `COPY.cancel` exists so that two
          controls carrying `COPY.back` cannot mean two things, and `headerBackTitle`
          is iOS-only — an Android stack header shows no back title at all, so the
          label would simply disappear there. */}
      <ScreenHeader
        title={intl.formatMessage(COPY.screenTitle)}
        drawnBar
        backLabel={intl.formatMessage(COPY.cancel)}
      />

      {/* Step indicator: one bar per slide, filled up to the current one. */}
      <View className="flex-row gap-3xs px-m pt-2xs">
        {slides.map((s, i) => (
          <View
            key={s.id}
            className={['flex-1 rounded-s', i <= step ? 'bg-accent' : 'bg-stroke'].join(' ')}
            style={{ height: sizes.progressBar }}
          />
        ))}
      </View>

      {/* The scroller and the action footer in ONE avoiding view. The footer used
          to be a sibling of the `ScrollView`, which left the two to react to the
          keyboard separately — and `COPY.next` is the control a person reaches for
          while the keyboard is still up. */}
      <KeyboardAvoiding className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-m pt-s pb-l"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Typo variant="text-s" color="grey-500">
            {intl.formatMessage(COPY.step, { current: step + 1, total: slides.length })}
          </Typo>
          <Typo variant="headline-l" className="mt-2xs">
            {slide.title}
          </Typo>

          {slide.components.map((component) => (
            <FormField
              key={component.key}
              component={component}
              choice={choices[component.key] ?? []}
              text={texts[component.key] ?? ''}
              fileAttached={files[component.key] ?? false}
              onSelect={(value) => select(component, value)}
              onText={(value) => setTexts((prev) => ({ ...prev, [component.key]: value }))}
              onToggleFile={() =>
                setFiles((prev) => ({ ...prev, [component.key]: !prev[component.key] }))
              }
            />
          ))}
        </ScrollView>

        <View className="bg-canvas">
          <Hairline />
          <View className="flex-row gap-s px-m py-s">
            {step > 0 && (
              <Button
                title={intl.formatMessage(COPY.back)}
                variant="secondary"
                onPress={() => setStep(step - 1)}
                className="flex-1"
              />
            )}
            <Button
              title={intl.formatMessage(isLast ? COPY.submit : COPY.next)}
              onPress={next}
              disabled={!stepValid}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAvoiding>
    </View>
  );
}

/** The thank-you page, with the counter that already includes this submission. */
function ThankYou({ callout }: { callout: Callout }) {
  const intl = useIntl();
  const colors = useColors();
  const extra = useExtraCount(callout.slug);

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1 items-center justify-center px-m">
        <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
        <Typo variant="headline-xl" className="mt-m text-center">
          {intl.formatMessage(COPY.thanksHeadline)}
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s text-center">
          {intl.formatMessage(COPY.thanksLead)}
        </Typo>
        <Typo variant="headline-xs" className="mt-m text-center">
          {intl.formatMessage(COPY.contributors, { count: callout.responseCount + extra })}
        </Typo>
      </View>
      <View className="px-m pb-l">
        <Button title={intl.formatMessage(COPY.moreCallouts)} fullWidth onPress={backToOverview} />
      </View>
    </View>
  );
}

/**
 * Closes the callout page AND the form in one step — otherwise you land on the
 * detail page and have to go back a second time. `replace` is the fallback for when
 * nobody navigated here (a cold deep link straight into the form).
 */
function backToOverview(): void {
  if (router.canGoBack()) {
    router.dismissTo('/(tabs)/mitmachen');
    return;
  }
  router.replace('/(tabs)/mitmachen');
}
