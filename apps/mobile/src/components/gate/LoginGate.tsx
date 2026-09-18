import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { KeyboardAvoiding } from '@/components/keyboard/KeyboardAvoiding';
import { Button, Card, Hairline, Overline, SafeAreaView, SplitRow, Typo } from '@/components/ui';
import { formatDate } from '@correctiv/app-core/lib/format';
import type { SignInFailure } from '@correctiv/app-core/services/auth.service';
import { accessShortfall, type AccessShortfall } from '@correctiv/app-core/stores/session';
import { TIER_LABELS } from '@/lib/membership/tierLabel';
import { openExternal } from '@/lib/openExternal';
import { useCoreActions, useLocale, useSession } from '@/lib/store/core';
import { sizes, typography, useColors } from '@/lib/theme';

/**
 * Everything a person reads on the door, in one place.
 *
 * The `defaultMessage` of each is ENGLISH and the German that ships is in
 * `packages/catalogue/src/de/gate.ts`, which is the shape ADR 0026 §6 decided: the
 * source reads in one language and the other one is data. Nothing here is
 * rendered as written — `formatMessage` answers with the catalogue's German.
 *
 * The fourth block is the one that was written most carefully. It is shown to
 * someone who IS a member, has just signed in, and is told the app is not part of
 * what they have. That is not an error and must not read like one: it thanks, it
 * says what the 0 € membership does cover, it says what the contribution is for,
 * and it offers the way in.
 */
const COPY = defineMessages({
  headline: { id: 'gate.headline', defaultMessage: 'For everyone who carries CORRECTIV.' },
  lead: {
    id: 'gate.lead',
    defaultMessage:
      'This app is the place for members who contribute. Your account is the same one you use on correctiv.org.',
  },
  emailHeading: { id: 'gate.emailHeading', defaultMessage: 'Email' },
  emailLabel: { id: 'gate.emailLabel', defaultMessage: 'Email address' },
  emailPlaceholder: { id: 'gate.emailPlaceholder', defaultMessage: 'name@example.org' },
  passwordHeading: { id: 'gate.passwordHeading', defaultMessage: 'Password' },
  passwordLabel: { id: 'gate.passwordLabel', defaultMessage: 'Enter password' },
  passwordPlaceholder: { id: 'gate.passwordPlaceholder', defaultMessage: 'Your password' },
  submit: { id: 'gate.submit', defaultMessage: 'Sign in' },
  checking: { id: 'gate.checking', defaultMessage: 'Checking your membership …' },
  forgot: { id: 'gate.forgot', defaultMessage: 'Forgotten your password?' },
  join: { id: 'gate.join', defaultMessage: 'Become a member with a contribution' },
  simulated: {
    id: 'gate.simulated',
    defaultMessage:
      'Nothing is transmitted. Every address signs in: with "frei" as the free tier without app access, with "test" during the trial, with "lokal" through the local bundle. A password shorter than four characters fails.',
  },
  simulatedHeading: { id: 'gate.simulatedHeading', defaultMessage: 'Simulated' },

  /**
   * The fourth state's own words, under the `gate.noAccess.*` ids. They were a
   * second `defineMessages` in this file; a screen's copy goes in one obvious
   * place ([AGENTS.md](../../../../../AGENTS.md#language)), and the prefix on the
   * key is the id's own spelling, so the two cannot drift.
   */
  noAccessSignedInAs: {
    id: 'gate.noAccess.signedInAs',
    defaultMessage: 'Signed in as {email}',
    description:
      'Above the headline at the door, for somebody who is signed in but has no app access. {email} is their address.',
  },
  noAccessHeadline: { id: 'gate.noAccess.headline', defaultMessage: 'Good to have you with us.' },
  noAccessLead: {
    id: 'gate.noAccess.lead',
    defaultMessage: 'The app is part of membership with a contribution.',
  },
  noAccessTier: {
    id: 'gate.noAccess.tier',
    defaultMessage:
      'Your account is on the free tier. It keeps everything on correctiv.org open to you. The app comes with the contribution: it funds the investigations, and in return there is audio, video and formats that exist only here.',
  },
  noAccessLapsed: {
    id: 'gate.noAccess.lapsed',
    defaultMessage:
      'Your trial ended on {date}. Thank you for trying the app. With a contribution it carries on here, with everything you already know.',
    description:
      'The paragraph at the door for somebody whose trial has run out. {date} is the day it ended, already formatted.',
  },
  noAccessTierRow: { id: 'gate.noAccess.tierRow', defaultMessage: 'Your tier' },
  noAccessTierTrial: {
    id: 'gate.noAccess.tierTrial',
    defaultMessage: 'Trial',
    description:
      "The value of the 'Your tier' row at the door. settings.access.trial is the same word in the settings, where it describes how access was granted rather than which tier the account is on.",
  },
  noAccessAccessRow: { id: 'gate.noAccess.accessRow', defaultMessage: 'App access' },
  noAccessAccessNone: { id: 'gate.noAccess.accessNone', defaultMessage: 'Not included' },
  noAccessAccessLapsed: {
    id: 'gate.noAccess.accessLapsed',
    defaultMessage: 'Trial, ended on {date}',
    description:
      "The value of the 'App access' row at the door, for somebody whose trial has run out. {date} is the day it ended, already formatted.",
  },
  noAccessUpgrade: { id: 'gate.noAccess.upgrade', defaultMessage: 'Extend membership' },
  noAccessResume: { id: 'gate.noAccess.resume', defaultMessage: 'Set a contribution' },
  noAccessRecheck: { id: 'gate.noAccess.recheck', defaultMessage: 'Check again' },
  noAccessSwitchAccount: {
    id: 'gate.noAccess.switchAccount',
    defaultMessage: 'Sign in with a different account',
  },
  /**
   * Both button labels are interpolated, and the second one is the point. It used
   * to be typed into the sentence, so renaming `recheck` left the note quoting a
   * button that no longer exists — and nothing would have said so, because a
   * sentence naming the wrong control still reads perfectly.
   */
  noAccessSimulated: {
    id: 'gate.noAccess.simulated',
    defaultMessage:
      'Nothing is transmitted. After "{button}", "{recheck}" finds a membership with a contribution.',
    description:
      'The note at the door that says this demonstration transmits nothing. {button} and {recheck} are two of the buttons on the same screen, interpolated so that renaming one cannot leave this sentence naming a control that no longer exists.',
  },
});

/**
 * The reasons a sign-in can fail, one message each.
 *
 * Typed as the record rather than left to inference, so a new member of
 * `SignInFailure` fails to compile here instead of rendering an empty string on
 * the one screen nobody can get past.
 */
const FAILURE_LABELS: Record<SignInFailure, MessageDescriptor> = defineMessages({
  'wrong-credentials': {
    id: 'gate.failure.wrongCredentials',
    defaultMessage: 'That email address and password do not match. Please check both.',
  },
  unreachable: {
    id: 'gate.failure.unreachable',
    defaultMessage:
      'correctiv.org cannot be reached at the moment. Please try again in a few minutes.',
  },
});

/**
 * The wordmark, and the one string on this screen that is not a message.
 *
 * A mark is not a sentence: it is the same eleven letters in every language, and a
 * catalogue entry mapping CORRECTIV to CORRECTIV would be a line for a translator
 * to wonder about. The tier names are messages, but they are not this screen's:
 * they name a domain enum the profile prints too, so their descriptors sit one
 * level up in `lib/membership/tierLabel.ts` and are formatted here.
 */
const WORDMARK = 'CORRECTIV';

/**
 * Where the door sends people. Membership is managed outside the app, per the
 * scope, so both go to the browser. The reset address is the support page until
 * the membership system names its own (the C1 dependency).
 */
const LINKS = {
  upgrade: 'https://correctiv.org/unterstuetzen/',
  join: 'https://correctiv.org/unterstuetzen/',
  reset: 'https://correctiv.org/unterstuetzen/',
};

/**
 * The door. Rendered by the root layout in place of the whole route tree while
 * the session is not admitted, so there is no route to deep-link past it.
 *
 * Four states, all on this one surface: signed out (the form), signing in (the
 * form, waiting), failed (the form, with the reason), and signed in without the
 * app (no form: a thanks, the entitlement as it stands, the way in). The page
 * surface rather than the brand red of the mission screen, because a form on red
 * reads as an alarm and this is a front door.
 */
export function LoginGate() {
  const intl = useIntl();
  const session = useSession();
  const shortfall = accessShortfall(session, Date.now());

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      {/* Inside the safe area, so the bottom inset is not counted twice — the
          component says why. */}
      <KeyboardAvoiding className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-m pt-l pb-m"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Typo variant="headline-m" style={{ letterSpacing: 2 }}>
            {WORDMARK}
          </Typo>

          {shortfall ? <NoAccess shortfall={shortfall} /> : <SignInForm />}

          {/* Anchors the note to the bottom on a tall screen; on a short one it
              simply follows the content. */}
          <View className="grow" />
          <Card tone="surface" className="mt-l">
            <Overline label={intl.formatMessage(COPY.simulatedHeading)} />
            <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
              {shortfall
                ? intl.formatMessage(COPY.noAccessSimulated, {
                    button: intl.formatMessage(
                      shortfall === 'lapsed' ? COPY.noAccessResume : COPY.noAccessUpgrade,
                    ),
                    recheck: intl.formatMessage(COPY.noAccessRecheck),
                  })
                : intl.formatMessage(COPY.simulated)}
            </Typo>
          </Card>
        </ScrollView>
      </KeyboardAvoiding>
    </SafeAreaView>
  );
}

function SignInForm() {
  const intl = useIntl();
  const colors = useColors();
  const actions = useCoreActions();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /**
   * The email field's return key says "Weiter", and React Native moves no focus on
   * its own: without this the key closed the keyboard on Android and did nothing on
   * iOS, and the person tapped the second field by hand.
   */
  const passwordRef = useRef<TextInput>(null);

  const busy = session.status === 'signing-in';
  const failed = session.status === 'failed';
  const ready = email.includes('@') && password.length > 0;

  const submit = () => {
    if (ready && !busy) void actions.session.signIn(email.trim(), password);
  };

  // A failed attempt marks both fields, not one: the answer does not say which.
  const field = [
    'mt-2xs rounded-md border px-s py-s',
    failed ? 'border-accent' : 'border-stroke',
  ].join(' ');
  const fieldText = [typography['text-m'], { color: colors['on-canvas'] }];

  return (
    <>
      <Typo variant="headline-xxl" family="serif" className="mt-l">
        {intl.formatMessage(COPY.headline)}
      </Typo>
      <Typo variant="text-l" className="mt-s">
        {intl.formatMessage(COPY.lead)}
      </Typo>

      <Typo variant="headline-xs" className="mt-m">
        {intl.formatMessage(COPY.emailHeading)}
      </Typo>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={intl.formatMessage(COPY.emailPlaceholder)}
        placeholderTextColor={colors['grey-500']}
        accessibilityLabel={intl.formatMessage(COPY.emailLabel)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!busy}
        className={field}
        style={fieldText}
      />

      <Typo variant="headline-xs" className="mt-s">
        {intl.formatMessage(COPY.passwordHeading)}
      </Typo>
      <TextInput
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder={intl.formatMessage(COPY.passwordPlaceholder)}
        placeholderTextColor={colors['grey-500']}
        accessibilityLabel={intl.formatMessage(COPY.passwordLabel)}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
        className={field}
        style={fieldText}
      />

      {failed && session.failure && (
        <View className="mt-s flex-row items-start" accessibilityLiveRegion="polite">
          {/* The icon and the field borders carry the coral; the sentence does not.
              Measured against the tokens, `accent` on `canvas` is 3.19:1 in the
              light scheme, below AA for 14 px text, and 5.98:1 in the dark one. The
              colour is not what makes this readable, the words are. */}
          <Ionicons name="alert-circle" size={18} color={colors.accent} />
          <Typo variant="text-s" color="on-canvas" className="ml-2xs flex-1">
            {intl.formatMessage(FAILURE_LABELS[session.failure])}
          </Typo>
        </View>
      )}

      <View className="mt-m">
        {busy ? (
          <View
            className="flex-row items-center justify-center rounded-md bg-surface px-m py-s"
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator color={colors.accent} />
            <Typo variant="text-m" weight="semibold" className="ml-s">
              {intl.formatMessage(COPY.checking)}
            </Typo>
          </View>
        ) : (
          <Button
            title={intl.formatMessage(COPY.submit)}
            fullWidth
            disabled={!ready}
            onPress={submit}
          />
        )}
      </View>

      {/* Two links, side by side while they fit and stacked when they do not.
          At 200 % system font they did neither: they met with no space between
          them and the second one ran off the right edge, where a third of its
          target was no longer on the screen (#158). `SplitRow` is what keeps
          them apart, and `start` rather than the default because once they are
          two lines the first line's link should not float against the second
          one's. */}
      <SplitRow align="start" className="mt-s">
        <TextLink
          label={intl.formatMessage(COPY.forgot)}
          onPress={() => openExternal(LINKS.reset)}
        />
        <TextLink
          label={intl.formatMessage(COPY.join)}
          strong
          onPress={() => openExternal(LINKS.join)}
        />
      </SplitRow>
    </>
  );
}

function NoAccess({ shortfall }: { shortfall: AccessShortfall }) {
  const intl = useIntl();
  const actions = useCoreActions();
  const session = useSession();
  const locale = useLocale();
  const entitlement = session.entitlement;

  const lapsedOn =
    shortfall === 'lapsed' && entitlement?.validUntil
      ? formatDate(entitlement.validUntil, locale)
      : null;

  return (
    <>
      <Typo variant="text-s" color="on-canvas-muted" className="mt-l">
        {intl.formatMessage(COPY.noAccessSignedInAs, { email: session.account?.email ?? '' })}
      </Typo>
      <Typo variant="headline-xxl" family="serif" className="mt-2xs">
        {intl.formatMessage(COPY.noAccessHeadline)}
      </Typo>
      <Typo variant="text-l" className="mt-s">
        {intl.formatMessage(COPY.noAccessLead)}
      </Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
        {lapsedOn
          ? intl.formatMessage(COPY.noAccessLapsed, { date: lapsedOn })
          : intl.formatMessage(COPY.noAccessTier)}
      </Typo>

      {/* The entitlement as the membership system answered it. Tier and access,
          never an amount: a trial pays 0 € and has the app. */}
      <Card className="mt-m">
        {/* A trial keeps `tier: 'paid'`, so printing the tier here said "Mitgliedschaft
            mit Beitrag" directly under a sentence explaining that the app belongs to
            one. The source is what the reader needs in that state. */}
        <Row
          label={intl.formatMessage(COPY.noAccessTierRow)}
          value={
            shortfall === 'lapsed'
              ? intl.formatMessage(COPY.noAccessTierTrial)
              : intl.formatMessage(TIER_LABELS[entitlement?.tier ?? 'free'])
          }
        />
        <Hairline className="my-s" />
        <Row
          label={intl.formatMessage(COPY.noAccessAccessRow)}
          value={
            lapsedOn
              ? intl.formatMessage(COPY.noAccessAccessLapsed, { date: lapsedOn })
              : intl.formatMessage(COPY.noAccessAccessNone)
          }
        />
      </Card>

      <View className="mt-m">
        <Button
          title={intl.formatMessage(lapsedOn ? COPY.noAccessResume : COPY.noAccessUpgrade)}
          fullWidth
          onPress={() => {
            actions.session.upgradeStarted();
            openExternal(LINKS.upgrade);
          }}
        />
        <Button
          title={intl.formatMessage(COPY.noAccessRecheck)}
          variant="outline"
          fullWidth
          className="mt-2xs"
          onPress={() => void actions.session.refreshEntitlement()}
        />
      </View>
      <View className="mt-s items-center">
        <TextLink
          label={intl.formatMessage(COPY.noAccessSwitchAccount)}
          onPress={() => actions.session.signOut()}
        />
      </View>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <SplitRow align="baseline">
      <Typo variant="text-m" color="on-canvas-muted">
        {label}
      </Typo>
      {/* `shrink` does NOT keep the value on the label's line, and this comment
          used to say that it did. `SplitRow` wraps, and a flex line breaks before
          anything on it is shrunk, so at 200 % the value takes the line below and
          `text-right` draws nothing — photographed in both appearance settings as
          `screens/evidence/158-shortfall-rows-at-200-light.webp` and its dark
          twin, and readable, which is why the layout stands as it is. What the two
          classes are for is the case one step further out: React Native defaults
          `flexShrink` to 0, so without `shrink` a value wider than the whole row
          draws past the card's border instead of wrapping inside its own column,
          and `text-right` is what sets those wrapped lines against the card's
          right edge. */}
      <Typo variant="text-m" weight="semibold" className="shrink text-right">
        {value}
      </Typo>
    </SplitRow>
  );
}

function TextLink({
  label,
  strong,
  onPress,
}: {
  label: string;
  strong?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="justify-center py-2xs active:opacity-60"
      /*
       * The door's two footer links were 33 dp tall with an 8 dp slop around them,
       * which is 49 on the phone and 33 in the browser, because react-native-web
       * draws no slop rectangle at all (#102). They sit at opposite ends of a
       * `SplitRow` and the slop never reached far enough to overlap, so what the
       * box buys here is the browser and the system font, not the neighbour.
       */
      style={{ minHeight: sizes.tapTarget }}
    >
      <Typo
        variant="text-s"
        weight={strong ? 'semibold' : 'normal'}
        color={strong ? 'accent' : 'on-canvas-muted'}
      >
        {label}
      </Typo>
    </Pressable>
  );
}
