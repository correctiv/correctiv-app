import { ArticlePath, ArticlePathDrawing, ARTICLE_PATH_COPY } from './ArticlePath';
import { CoreAndHost, CoreAndHostDrawing, CORE_AND_HOST_COPY } from './CoreAndHost';
import {
  DecisionsChain,
  DecisionsChainDrawing,
  DECISIONS_CHAIN_COPY,
  LAYOUT as DECISIONS,
} from './DecisionsChain';
import { InsideCore, InsideCoreDrawing, INSIDE_CORE_COPY } from './InsideCore';
import { Services, ServicesDrawing, SERVICES_COPY } from './Services';
import { SignIn, SignInDrawing, SIGN_IN_COPY } from './SignIn';

import type { MessageDescriptor } from 'react-intl';
import type { ReactNode } from 'react';

/**
 * One drawing, described well enough to place it without rendering it.
 *
 * The figure and the drawing are two exports because they answer two questions.
 * A page that has room for the whole thing takes `Figure`, which brings the
 * scroll box, the caption and the list with it. Anything that only wants the
 * picture, at a size it has to know in advance, takes `Drawing` and the two
 * numbers beside it.
 *
 * **The name and the sentence are descriptors and not strings**, because they
 * are this site's own words and follow the language setting
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * They are declared in the drawing's own module and only listed here: a drawing's
 * name belongs to the drawing, and this table would otherwise be a second place
 * holding words. `DiagramIndex` and `DiagramView` format them.
 */
export interface DiagramMeta {
  /** The section id it already carries, which is also its route segment. */
  id: string;
  /** The `<h2>` text, WITHOUT the leading number, as a descriptor. */
  title: MessageDescriptor;
  /** The lede paragraph, as a descriptor. */
  lede: MessageDescriptor;
  /**
   * What the lede's placeholders hold, for the one drawing whose lede counts.
   *
   * The decisions drawing reads the record count off its own layout, so the
   * sentence under it cannot be a fixed string in either language. Every other
   * lede takes no argument and leaves this off.
   */
  ledeValues?: Record<string, number>;
  /** The `<svg>`'s own width and height in its coordinate space, from its classes. */
  width: number;
  height: number;
  Figure: (props: { alt?: boolean }) => ReactNode;
  /** The picture alone, for a thumbnail. It describes itself with its `<title>`. */
  Drawing: () => ReactNode;
}

/**
 * The drawings, in the order `/diagrams` shows them.
 *
 * They are hand-authored inline SVG rather than images because a drawing whose
 * every fill and stroke comes from a class follows the light and dark schemes on
 * its own, with no second asset to keep in step.
 */
export const DIAGRAMS: DiagramMeta[] = [
  {
    id: 'core-host',
    title: CORE_AND_HOST_COPY.title,
    lede: CORE_AND_HOST_COPY.lede,
    width: 1100,
    height: 710,
    Figure: CoreAndHost,
    Drawing: CoreAndHostDrawing,
  },
  {
    id: 'decisions',
    title: DECISIONS_CHAIN_COPY.title,
    // The count said twenty-three while `adr/` held twenty-four, which is the
    // failure `AGENTS.md` names under "Facts that expire"; the drawing under it was
    // worse, because it was typed in full and drew 0001 to 0023 while the sentence
    // above it counted thirty-six.
    // Every figure in this entry comes from the drawing's OWN layout, which is why
    // `DECISIONS` is that module's `LAYOUT` rather than a second `chainLayout` call
    // here: two calls would agree by luck, and the height is a function of how many
    // records `adr/` holds, so it cannot be typed beside the two that are fixed.
    lede: DECISIONS_CHAIN_COPY.lede,
    ledeValues: { records: DECISIONS.summary.records },
    width: DECISIONS.width,
    height: DECISIONS.height,
    Figure: DecisionsChain,
    Drawing: DecisionsChainDrawing,
  },
  {
    id: 'services',
    title: SERVICES_COPY.title,
    lede: SERVICES_COPY.lede,
    // The one drawing sized by its viewBox rather than a height class, because it
    // is `h-auto`: 980 by 580 is what the viewBox says.
    width: 980,
    height: 580,
    Figure: Services,
    Drawing: ServicesDrawing,
  },
  {
    id: 'inside-core',
    title: INSIDE_CORE_COPY.title,
    lede: INSIDE_CORE_COPY.lede,
    width: 1040,
    height: 746,
    Figure: InsideCore,
    Drawing: InsideCoreDrawing,
  },
  {
    id: 'sign-in',
    title: SIGN_IN_COPY.title,
    lede: SIGN_IN_COPY.lede,
    width: 1100,
    height: 864,
    Figure: SignIn,
    Drawing: SignInDrawing,
  },
  {
    id: 'article-path',
    title: ARTICLE_PATH_COPY.title,
    lede: ARTICLE_PATH_COPY.lede,
    width: 1100,
    height: 856,
    Figure: ArticlePath,
    Drawing: ArticlePathDrawing,
  },
];
