// The GTK end of `app-state.ts`: every toplevel the process holds.

import Gtk from 'gi://Gtk?version=4.0';

import { createAppState, type ActivityWindow } from './app-state.js';

/** Read per call: a window opened after startup (the video stage) is a toplevel too. */
function toplevels(): ActivityWindow[] {
  const model = Gtk.Window.get_toplevels();
  const windows: ActivityWindow[] = [];
  for (let index = 0; index < model.get_n_items(); index++) {
    windows.push(model.get_item(index) as unknown as ActivityWindow);
  }
  return windows;
}

export const appState = createAppState(toplevels);
