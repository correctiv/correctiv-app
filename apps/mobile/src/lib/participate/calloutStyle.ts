import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';

import type { Callout } from '@correctiv/app-core/data/callouts';

/**
 * The words this module answers with, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/callout.ts`.
 *
 * Descriptors rather than strings, because there is no React here and therefore
 * no `useIntl()` to call: this is a plain function two components share, so it
 * hands back what to say and the call sites, which are components, say it.
 *
 * The counters are ICU plurals. A callout with a single response printed the
 * plural noun anyway before this, and the phrase differs per kind, so the unit
 * cannot be a word glued onto a number by whoever renders it. The number in them is
 * `#`, which is the plural's own argument formatted in the provider's locale — so
 * the thousands separator stays German, and there is one spelling of it in the app
 * rather than `#` in some messages and `{count, number}` in others.
 */
const COPY = defineMessages({
  surveyKicker: { id: 'callout.survey.kicker', defaultMessage: 'Survey' },
  surveyCta: {
    id: 'callout.survey.cta',
    defaultMessage: 'Take part',
    description:
      "The button on a survey callout's card. German says 'Teilnehmen' here and 'Mitmachen' on a CrowdNewsroom card, callout.crowdnewsroom.cta, although English says 'Take part' for both.",
  },
  surveyCount: {
    id: 'callout.survey.count',
    defaultMessage: '{count, plural, one {One response} other {# responses}}',
    description:
      "The response count on a survey callout's card. {count} is how many people have answered. A survey gets responses where a CrowdNewsroom gets contributions, which is callout.crowdnewsroom.count.",
  },
  surveyCountSoFar: {
    id: 'callout.survey.countSoFar',
    defaultMessage: '{count, plural, one {One response} other {# responses}} so far',
    description: "The same response count with 'so far'. {count} is how many people have answered.",
  },
  crowdnewsroomCta: {
    id: 'callout.crowdnewsroom.cta',
    defaultMessage: 'Take part',
    description:
      "The button on a CrowdNewsroom callout's card. One of five ids reading 'Take part': the survey's button is callout.survey.cta, the detail screen's is callout.detail.cta, the tab is ui.tabParticipate and the screen heading is participate.title.",
  },
  crowdnewsroomCount: {
    id: 'callout.crowdnewsroom.count',
    defaultMessage: '{count, plural, one {One contribution} other {# contributions}}',
    description:
      "The contribution count on a CrowdNewsroom callout's card. {count} is how many people have contributed. The survey's own wording is callout.survey.count.",
  },
  crowdnewsroomCountSoFar: {
    id: 'callout.crowdnewsroom.countSoFar',
    defaultMessage: '{count, plural, one {One contribution} other {# contributions}} so far',
    description:
      "The same count with ‘so far’ on a CrowdNewsroom card, where {count} is how many people have contributed. Reads identically to callout.detail.responses, which is the detail SCREEN's line: that one is printed for every kind of callout, this one only for a CrowdNewsroom, so the two may diverge and must not be merged.",
  },
});

/**
 * The CrowdNewsroom kicker is the product's name, not a word about it. A
 * catalogue entry mapping CrowdNewsroom to CrowdNewsroom would be a line for a
 * translator to wonder about, which is the same call `gate/LoginGate.tsx` makes
 * for the wordmark — so this one kicker is a plain string and `calloutKicker`
 * below is where the two cases meet.
 */
const CROWDNEWSROOM = 'CrowdNewsroom';

export type CalloutStyle = {
  /** Kicker above the title. A mark rather than a message where it is a mark. */
  kicker: MessageDescriptor | string;
  /** Button label. */
  cta: MessageDescriptor;
  /** How loud the button is: a survey asks less than a CrowdNewsroom. */
  variant: 'primary' | 'outline';
  /** The counter with its unit, taking `count`. */
  count: MessageDescriptor;
  /** The same counter where the card says how many have taken part so far. */
  countSoFar: MessageDescriptor;
};

/**
 * How a callout presents itself, from its kind.
 *
 * Two places need the same answer — the card on Mitmachen and the module on Home —
 * and the draft ties three decisions to that one fact: what the kicker says, what
 * the button says, and how much weight the button carries. Written out separately
 * in two files they would be two truths free to drift apart, which is how all three
 * callouts ended up labelled CROWDNEWSROOM with the same loud coral button.
 */
export function calloutStyle(callout: Callout): CalloutStyle {
  if (callout.kind === 'survey') {
    return {
      kicker: COPY.surveyKicker,
      cta: COPY.surveyCta,
      variant: 'outline',
      count: COPY.surveyCount,
      countSoFar: COPY.surveyCountSoFar,
    };
  }
  return {
    kicker: CROWDNEWSROOM,
    cta: COPY.crowdnewsroomCta,
    variant: 'primary',
    count: COPY.crowdnewsroomCount,
    countSoFar: COPY.crowdnewsroomCountSoFar,
  };
}

/** The kicker as a string, whichever of the two kinds it is. */
export function calloutKicker(intl: IntlShape, style: CalloutStyle): string {
  return typeof style.kicker === 'string' ? style.kicker : intl.formatMessage(style.kicker);
}
