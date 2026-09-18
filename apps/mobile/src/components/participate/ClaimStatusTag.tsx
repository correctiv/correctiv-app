import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { View } from 'react-native';

import { Typo } from '@/components/ui';
import { RATING_LABELS } from '@correctiv/app-core/articles/rating';
import { type Claim, type ClaimStatus } from '@correctiv/app-core/data/claims';
import { useColors, type Palette } from '@/lib/theme';

/**
 * The checking status of a claim, in ENGLISH; the German ships in
 * `src/i18n/catalogue/de/participate.ts` and the verdict in `de/core.ts`
 * (ADR 0026 §6).
 *
 * The wording used to come from `claimStatusTag()` in the core's `data/claims.ts`,
 * which returned the finished German and a `cls` nothing had read since this
 * component started computing its own colours. A checked claim says the verdict —
 * that vocabulary is the core's (`RATING_LABELS`) and is the same word the
 * article reader's plaque uses — and everything around it is this component's.
 */
const COPY = defineMessages({
  /** The verdict slot of `claimChecked` when the check closed without one. */
  noVerdict: { id: 'participate.claimNoVerdict', defaultMessage: 'closed' },
});

const STATUS_LABELS: Record<ClaimStatus, MessageDescriptor> = defineMessages({
  submitted: {
    id: 'participate.claimSubmitted',
    defaultMessage: 'Submitted',
    description:
      "The status tag on a claim, in the Faktenforum list and at the top of a claim's own screen. `claim.stage.submitted` is the same word a few lines below it on that same screen, in the progress row. The two are separate ids and are read together, so word them alike unless the progress row needs a form of its own.",
  },
  checking: {
    id: 'participate.claimChecking',
    defaultMessage: 'Being checked',
    description:
      "The status tag on a claim, in the Faktenforum list and at the top of a claim's own screen. `claim.stage.checking` is the same word a few lines below it on that same screen, in the progress row. The two are separate ids and are read together, so word them alike unless the progress row needs a form of its own.",
  },
  checked: {
    id: 'participate.claimChecked',
    defaultMessage: 'Checked: {verdict}',
    description:
      "The status tag on a claim, in the Faktenforum list and at the top of a claim's own screen. {verdict} is the verdict, already translated, or the word under participate.claimNoVerdict when the check closed without one.",
  },
});

/**
 * The colours, which stay here because the core knows no platform styles.
 *
 * "Richtig" is the one place the brand palette does not stretch to: a confirmed
 * fact check must not wear the same red as a refuted one. Hence this green
 * (#2e7d4f), carried over from the first implementation and still not declared a
 * token.
 */
const CHECKED_TRUE_GREEN = '#2e7d4f';

function toneFor(
  claim: Claim,
  colors: Palette,
): { background: string; color: string; border?: string } {
  // The two coloured states carry their label on a surface that is the same in
  // both schemes; the two neutral ones sit on the card.
  if (claim.status === 'checked') {
    return claim.rating === 'richtig'
      ? { background: CHECKED_TRUE_GREEN, color: colors['always-light'] }
      : { background: colors.accent, color: colors['always-light'] };
  }
  if (claim.status === 'checking') {
    return {
      background: colors['canvas'],
      color: colors['on-canvas'],
      border: colors['stroke'],
    };
  }
  return { background: colors['grey-250'], color: colors['on-canvas-muted'] };
}

export function ClaimStatusTag({ claim, className }: { claim: Claim; className?: string }) {
  const intl = useIntl();
  const colors = useColors();
  const tone = toneFor(claim, colors);
  // `verdict` is only read by the `checked` message; the other two ignore it.
  const text = intl.formatMessage(STATUS_LABELS[claim.status], {
    verdict: intl.formatMessage(claim.rating ? RATING_LABELS[claim.rating] : COPY.noVerdict),
  });
  return (
    <View
      className={['self-start rounded-xs px-2xs py-4xs', className ?? ''].join(' ')}
      style={{
        backgroundColor: tone.background,
        borderWidth: tone.border ? 1 : 0,
        borderColor: tone.border,
      }}
    >
      <Typo variant="text-s" weight="bold" style={{ fontSize: 11, color: tone.color }}>
        {text}
      </Typo>
    </View>
  );
}
