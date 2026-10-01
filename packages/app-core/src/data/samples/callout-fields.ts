/**
 * Callout form field variants — one per component type the form schema allows.
 *
 * A callout's form is a list of `CalloutComponent`s, and the form screen and
 * `FormField` both branch on `type`, so the set worth having a specimen of is
 * exactly the five values of that union. The gallery held that list as one array
 * it mapped over; here each field is a name, which is what lets a picker offer
 * "the file field" on its own and lets a test say that a type with no variant is
 * a type nothing draws.
 *
 * The keys read `sample-` where they read `gallery-` before. A field key is the
 * key a form answer is filed under, and the gallery's is now a core specimen's;
 * nothing renders it, and the one place it is used as a React key is the gallery
 * itself.
 */
import type { CalloutComponent } from '../callouts';

import { sampleDomain, variant } from './variant';

const FIELD_VARIANTS = [
  variant(
    'radio',
    'One answer out of several, required. The only type with a single choice per value.',
    {
      key: 'sample-radio',
      type: 'radio',
      label: 'Wie oft lesen Sie CORRECTIV?',
      description: 'Eine Antwort.',
      required: true,
      values: [
        { label: 'Täglich', value: 'taeglich' },
        { label: 'Wöchentlich', value: 'woechentlich' },
        { label: 'Seltener', value: 'seltener' },
      ],
    },
  ),
  variant('selectboxes', 'Several answers out of several, so a value can be on and another off.', {
    key: 'sample-selectboxes',
    type: 'selectboxes',
    label: 'Welche Themen interessieren Sie?',
    description: 'Mehrere Antworten möglich.',
    values: [
      { label: 'Klima', value: 'klima' },
      { label: 'Lokal', value: 'lokal' },
      { label: 'Faktenchecks', value: 'faktenchecks' },
    ],
  }),
  variant('textfield', 'One line of text, with a placeholder and nothing required.', {
    key: 'sample-textfield',
    type: 'textfield',
    label: 'Ihre Stadt',
    placeholder: 'Bottrop',
  }),
  variant(
    'textarea',
    'More than one line, required, which is the height a single-line field does not have.',
    {
      key: 'sample-textarea',
      type: 'textarea',
      label: 'Was sollten wir recherchieren?',
      description: 'So genau, wie Sie möchten.',
      placeholder: 'Ihre Antwort …',
    },
  ),
  variant('file', 'An attachment, optional: the only type whose answer is not text.', {
    key: 'sample-file',
    type: 'file',
    label: 'Dokument anhängen',
    description: 'PDF oder Foto.',
  }),
] as const satisfies readonly { name: string; note: string; data: CalloutComponent }[];

export const calloutFieldSamples = sampleDomain('callout-fields', FIELD_VARIANTS);

/** Every name the callout-fields domain has, as literals. */
export type CalloutFieldSampleName = (typeof FIELD_VARIANTS)[number]['name'];
