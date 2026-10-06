/** The `demo` layout as the grammar's tests read it: the app bundles `ship`, which is empty. */
import { DEMO_SCREENS } from '../../src/data/layouts/demo/bundle';
import { parseHomeLayout, type HomeLayout } from '../../src/lib/home-layout';

export { DEMO_NAVIGATION, DEMO_SCREENS } from '../../src/data/layouts/demo/bundle';

export const demoHomeDocument = DEMO_SCREENS.home;

export const DEMO_HOME_LAYOUT: HomeLayout = parseHomeLayout(demoHomeDocument).layout!;
