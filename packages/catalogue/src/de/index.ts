/**
 * The German catalogue, merged from one file per id namespace.
 *
 * **This directory is the only place under `apps/mobile/src` where German may be
 * written**, and `apps/mobile/__tests__/localisation-seam.test.ts` is what says
 * so rather than this sentence. A message descriptor elsewhere carries an ENGLISH
 * `defaultMessage`; the German that ships is data, and it is here.
 *
 * Every namespace is listed already, including the ones whose file is still
 * empty. That is the point of the list: migrating a screen means filling one
 * file, never editing this one, so two of them cannot collide here.
 */
import { article } from './article';
import { atlas } from './atlas';
import { backstage } from './backstage';
import { callout } from './callout';
import { claim } from './claim';
import { core } from './core';
import { diary } from './diary';
import { discover } from './discover';
import { faktenforum } from './faktenforum';
import { form } from './form';
import { gallery } from './gallery';
import { gate } from './gate';
import { home } from './home';
import { mediathek } from './mediathek';
import { notFound } from './notFound';
import { onboarding } from './onboarding';
import { participate } from './participate';
import { player } from './player';
import { profile } from './profile';
import { project } from './project';
import { recovery } from './recovery';
import { search } from './search';
import { series } from './series';
import { settings } from './settings';
import { ui } from './ui';
import { video } from './video';

export const de: Record<string, string> = {
  ...article,
  ...atlas,
  ...backstage,
  ...callout,
  ...claim,
  ...core,
  ...diary,
  ...discover,
  ...faktenforum,
  ...form,
  ...gallery,
  ...gate,
  ...home,
  ...mediathek,
  ...notFound,
  ...onboarding,
  ...participate,
  ...player,
  ...profile,
  ...project,
  ...recovery,
  ...search,
  ...series,
  ...settings,
  ...ui,
  ...video,
};
