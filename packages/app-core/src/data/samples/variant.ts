/**
 * What a sample variant IS, for every domain under `data/samples/`.
 *
 * A variant is one NAMED specimen of a domain's model, chosen to cover one case
 * the app has to survive: the open callout and the closed one, the article with
 * an image and the one without, the claim in each of its three states. The name
 * is the address — a picker puts `callouts/expiring` in its URL — and the `note`
 * says in one line what the data is there to show.
 *
 * **Why the names are in the core and not next to the specimens that use them.**
 * Three surfaces want the same awkward cases: a screen drawing its own empty
 * state, the component gallery, and the workbench's component page, which reads
 * the gallery's list rather than a second one (ADR 0027/0028). While the edge
 * cases lived in `apps/mobile/src/gallery/fixtures.ts` the other two could not
 * have them without importing the gallery, and ADR 0040 says the direction of
 * that dependency is one-way. So the specimens moved here, next to the sample
 * data they are variants OF, and the gallery became a consumer like any other.
 *
 * **A name is a claim, and the test holds the data to it.** `callouts/closed`
 * that carries an open callout is a lie in an address: a person picking it sees
 * one thing and a person reading the list sees another. `data/samples` therefore
 * ships no parser and no validator; `test/sample-variants.test.ts` carries one
 * claim per name, and the shape of that table is what makes adding a variant
 * without saying what it is for a compile error rather than a review question.
 *
 * **Nothing here says where a specimen CAME FROM.** Whether a source is live or
 * sample is a fact about the source, and `features/features.ts` says the same
 * thing about itself: the `Provenance` it carries per feature is the stand-in
 * until the sources declare it, and it is to be derived from them rather than
 * from what a row claims. A property on every variant would be a second answer
 * to one question, and the two answers would part.
 */

/** A variant's name: ASCII kebab-case, which is what a URL can carry. */
export type SampleVariantName = string;

/**
 * One named specimen of a domain's model.
 *
 * `Name` is the literal a `variant()` call wrote, so a caller can only ask for a
 * name this module has, and `data` is the specimen itself.
 */
export interface SampleVariant<Name extends SampleVariantName = SampleVariantName, T = unknown> {
  readonly name: Name;
  /** What this specimen is for, in one line. English: a developer reads it. */
  readonly note: string;
  readonly data: T;
}

/**
 * A specimen, written where the name is the argument.
 *
 * The identity function exists so the array literal keeps each name as a LITERAL
 * type without `as const` on the array, which would make every specimen deeply
 * readonly and then unassignable to the models the screens take.
 */
export function variant<const Name extends SampleVariantName, T>(
  name: Name,
  note: string,
  data: T,
): SampleVariant<Name, T> {
  return { name, note, data };
}

/** The names a domain's variant array holds, as literals. */
export type SampleNames<V extends readonly SampleVariant[]> = V[number]['name'];

/** What those variants carry, as a union — a `Callout` and a `Claim` never meet. */
export type SampleData<V extends readonly SampleVariant[]> = V[number]['data'];

/**
 * A domain's variants, plus the one way a caller asks for one.
 *
 * The parameter is the ARRAY rather than its name and payload types, because a
 * domain's variants do not all carry the same shape: one callout is the shipped
 * `Callout` and its neighbour is that callout with a deadline moved, so a single
 * `T` inferred from the first row would reject the second. Reading both out of
 * the array keeps the specimens exactly as they were written and still gives
 * `of()` a closed set of names — a renamed or deleted variant stops compiling at
 * every call site instead of quietly resolving to nothing.
 *
 * `of()` THROWS rather than returning `undefined`, because a caller inside this
 * repository naming a variant that is not there is a bug; a caller outside it,
 * holding a name a person typed, wants the `find` of {@link SampleDomainSummary}.
 */
export interface SampleDomain<V extends readonly SampleVariant[]> {
  readonly id: string;
  readonly variants: V;
  /** The data of the variant with this name. Throws when there is none. */
  of(name: SampleNames<V>): SampleData<V>;
}

/**
 * `const` on the id and NOT on the variants.
 *
 * The id stays a literal so the registry's entries stay distinguishable, and the
 * variants array is inferred plainly: a `const` type parameter would read the
 * specimens with `as const` semantics, and a `Callout` whose `formSchema.slides`
 * is a readonly tuple is not a `Callout` to a screen that takes one.
 */
export function sampleDomain<const Id extends string, V extends readonly SampleVariant[]>(
  id: Id,
  variants: V,
): SampleDomain<V> & { readonly id: Id } {
  return {
    id,
    variants,
    of(name: SampleNames<V>): SampleData<V> {
      const found = variants.find((variant) => variant.name === name);
      if (found === undefined) throw new Error(`no sample variant "${id}/${name}"`);
      return found.data;
    },
  };
}

/**
 * A domain as the registry and a picker see it: which variants exist, and how to
 * ask for one by a name that came from outside.
 *
 * `find` answers `undefined` rather than throwing, because the caller there is a
 * person who typed something. The throwing `of` is the in-repository spelling of
 * the same question, and both read the same array — one list per domain, which is
 * what stops the two from giving different answers to one name.
 */
export interface SampleDomainSummary {
  readonly id: string;
  readonly variants: readonly SampleVariant[];
  /** The variant with this name, or nothing. For a name from outside. */
  find(name: SampleVariantName): SampleVariant | undefined;
}

/**
 * A domain as the registry sees it, which is the same array with a lookup that
 * answers nothing instead of throwing.
 *
 * The loss of the payload's type is what this shape is for: a list of domains of
 * different models has no one `T`, and a caller that has a name in hand is
 * resolving an address rather than asking for a specimen to draw.
 */
export function summarise<V extends readonly SampleVariant[]>(
  domain: SampleDomain<V>,
): SampleDomainSummary {
  return {
    id: domain.id,
    variants: domain.variants,
    find: (name) => domain.variants.find((variant) => variant.name === name),
  };
}
