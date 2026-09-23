/**
 * Who a place or a change on the home screen is for, and the one file that knows what that
 * means in terms of a membership.
 *
 * [ADR 0041](../../../../adr/0041-a-change-may-name-an-audience.md) decided the shape and
 * [ADR 0060](../../../../adr/0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md)
 * builds it. An audience is a word the newsroom uses in a meeting (§2 of the first), never a
 * field of the entitlement, and this file is the only place in the repository that turns
 * one into a question about `Entitlement` (§3). When the membership model changes, this
 * file changes.
 *
 * ## A filter, never a lock
 *
 * ADR 0041 §5, and the reason it is repeated here is that this file is where somebody will
 * arrive looking for access control. There is none. The document is fetched whole by every
 * app, so an audience decides what the home screen leads with and nothing about what a
 * reader may open. The door stays at the root, on `appAccess`
 * ([ADR 0016](../../../../adr/0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)).
 *
 * ## Why "not yet a member" is not in the list
 *
 * Nobody inside the app can be in it: the door admits only an entitlement that includes the
 * app, and there is no guest ([ADR 0018](../../../../adr/0018-removing-the-guest.md)). A
 * rule that always answered no would be an audience that parses, can be chosen, and makes
 * a block vanish for everybody. It waits on the question in issue #242 §4, whether the app
 * is installable by people who are not members; the editor shows it switched off and says
 * why, and ADR 0060 §3 is the record.
 */

import type { Entitlement, MembershipTier } from '../types/models';
import { MODULE_AUDIENCES } from './home-audience.generated';

/**
 * Every audience the document may name, each with the one rule that answers it.
 *
 * A `Record` over the union, so an audience without a rule does not compile (ADR 0041 §3,
 * which is mechanism 1 of ADR 0031). The rules read the tier and nothing else today; the
 * signature takes the whole entitlement so that the day one reads `localAreas`, nothing
 * outside this file has to change.
 *
 * - `everyone` is also what a place is for when neither the document nor its module says.
 *   It is written in a document only to take a module's own default back off a place.
 * - `paying-members` is the club's word for it, "Mitglieder mit Beitrag", which is what
 *   the door itself says the app is for. `paid` and `soli` are both a membership with a
 *   contribution, and a trial month is a `paid` tier at 0 €, which `models.ts` explains:
 *   a tier read off an amount would lock out exactly the people being courted.
 * - `free-members` is the 0 € membership. Inside the door that is somebody whose local
 *   newsletter includes the app (`source: 'local-bundle'`) without an app membership. A
 *   local bundle on a PAID tier, which is what the simulated sign-in answers for a `lokal`
 *   address, is a paying member: the source says why the app is included, not who pays.
 *
 * What the rules do not have to get right is a reader Home never draws for. An expired
 * trial, a membership without `appAccess` and nobody signed in are all refused at the door
 * (`isAdmitted` in `stores/session.ts`), so the home screen is never folded for them; that
 * `readerOf` still answers for them, `everyone` and a tier, is harmless for that reason and
 * is what the workbench relies on to preview a frame whose door is shut.
 */
const RULES: Readonly<Record<Audience, (entitlement: Entitlement | null) => boolean>> = {
  everyone: () => true,
  'paying-members': (entitlement) => entitlement !== null && PAYING[entitlement.tier],
  'free-members': (entitlement) => entitlement?.tier === 'free',
};

export type Audience = 'everyone' | 'paying-members' | 'free-members';

/** Which tiers carry a contribution, over the whole union so a new tier has to be sorted. */
const PAYING: Readonly<Record<MembershipTier, boolean>> = { free: false, paid: true, soli: true };

/** In the order an editor is offered them. */
export const AUDIENCES: readonly Audience[] = Object.keys(RULES) as Audience[];

/** What a place is for when nothing says otherwise. */
export const EVERYONE: Audience = 'everyone';

export function isAudience(value: unknown): value is Audience {
  return typeof value === 'string' && Object.hasOwn(RULES, value);
}

/**
 * The audiences one reader is in.
 *
 * This is what the fold takes, as it takes the instant (ADR 0041 §4): the core holds no
 * session, the host answers the question once and hands the answer in. A set rather than
 * one name, because a paying member is in `everyone` too, and a change for either applies.
 */
export type Reader = ReadonlySet<Audience>;

export function readerOf(entitlement: Entitlement | null): Reader {
  return new Set(AUDIENCES.filter((audience) => RULES[audience](entitlement)));
}

/**
 * Every reader the rules can tell apart, which is what the editor has to check an edit
 * against before it may call it a repetition.
 *
 * Derived by asking the rules about one entitlement per tier and about nobody, so it
 * cannot disagree with them. It is complete only while the rules read the tier alone,
 * and a rule that reads anything else has to add its cases here; the test beside this
 * file holds every rule to the list.
 */
export const READERS: readonly Reader[] = distinct([
  readerOf(null),
  ...(Object.keys(PAYING) as MembershipTier[]).map((tier) =>
    readerOf({
      tier,
      appAccess: true,
      source: null,
      validUntil: null,
      localAreas: [],
      memberSince: null,
    }),
  ),
]);

function distinct(readers: readonly Reader[]): readonly Reader[] {
  const seen = new Map<string, Reader>();
  for (const reader of readers) seen.set([...reader].sort().join(' '), reader);
  return [...seen.values()];
}

/**
 * The audience a module is for unless the document says otherwise.
 *
 * Declared beside the module, in `apps/mobile/src/lib/home/conditions.ts`, and carried here
 * by the generator that carries the settings (ADR 0045 §9), because the fold needs it and
 * the core cannot import the app. Absent is `everyone`.
 */
export function defaultAudience(module: string): Audience {
  return MODULE_AUDIENCES[module] ?? EVERYONE;
}

/** Who a place is for: what the document says, or its module's default. */
export function audienceOf(place: {
  readonly module: string;
  readonly audience?: Audience;
}): Audience {
  return place.audience ?? defaultAudience(place.module);
}

/** Whether a reader is in an audience. The only question the fold asks. */
export function reaches(reader: Reader, audience: Audience | undefined): boolean {
  return audience === undefined || reader.has(audience);
}

export { MODULE_AUDIENCES };
