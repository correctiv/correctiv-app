/**
 * Claim variants — one per status, plus the one verdict a status can lack.
 *
 * The gallery used to build these itself: it took `claims[0]` and overwrote the
 * status, because at the time the shipped data did not carry all three. It does
 * now — `claim-004` is submitted, `claim-003` is being checked, and four are
 * checked — so the variants are the real claims and the mutation is gone. A
 * specimen that is a real claim is worth more than one that is a real claim with
 * a field overwritten, and the tag on screen reads the same either way.
 *
 * **The fourth variant is the case with no verdict at all.** `ClaimStatusTag` has
 * a message for it (`participate.claimNoVerdict`, "closed") and no shipped claim
 * reaches it: every checked claim in `data/claims.ts` carries a rating. So the
 * variant is the same claim with the verdict taken off, and the name says which
 * half of the tag is being drawn.
 */
import { claims, type Claim, type ClaimStatus } from '../claims';

import { sampleDomain, variant } from './variant';

/**
 * The shipped claim per status, found by status rather than by position.
 *
 * An index would be one array edit away from picking the wrong claim, and the
 * claim tables in `test/sample-variants.test.ts` would then report a specimen that
 * contradicts its own name — which is the failure this file exists to make
 * impossible to miss. There is one claim per status in the seed today, so the
 * first match is the one; `!` is the assertion that says so at the point of use.
 */
function byStatus(status: ClaimStatus): Claim {
  const found = claims.find((claim) => claim.status === status);
  if (found === undefined) throw new Error(`data/claims.ts carries no "${status}" claim`);
  return found;
}

const checked = byStatus('checked');
const checking = byStatus('checking');
const submitted = byStatus('submitted');

/** A checked claim that closed without saying what the check found. */
const withoutVerdict: Claim = { ...checked, rating: undefined };

const CLAIM_VARIANTS = [
  variant(
    'submitted',
    'Freshly filed, no check started, and no sources yet. The tag is the quiet one and the progress row has one step.',
    submitted,
  ),
  variant(
    'checking',
    'Being checked: outlined rather than filled, and carrying the source it came from.',
    checking,
  ),
  variant(
    'checked',
    'Checked and refuted. The only shipped status that carries a verdict and therefore a colour of its own.',
    checked,
  ),
  variant(
    'checked-unrated',
    'Checked with no verdict, which is what `noVerdict` is for.',
    withoutVerdict,
  ),
] as const satisfies readonly { name: string; note: string; data: Claim }[];

export const claimSamples = sampleDomain('claims', CLAIM_VARIANTS);

/** Every name the claims domain has, as literals. */
export type ClaimSampleName = (typeof CLAIM_VARIANTS)[number]['name'];
