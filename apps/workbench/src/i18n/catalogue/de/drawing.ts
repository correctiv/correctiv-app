/**
 * German for the `drawing.*` ids: what stands where a component of the app should
 * have been drawn and threw instead.
 *
 * One id, and one namespace for it, because the surface is neither a page nor a
 * tool: `components/AppHost.tsx` is what both the component gallery and the home
 * editor mount around the app's own React tree, and its boundary catches one
 * drawing without taking the page down with it.
 *
 * What follows the colon is `error.message`, thrown by the app's own code, so it
 * arrives in English and stays that way.
 */
export const drawing: Record<string, string> = {
  'drawing.failed': 'Nicht gezeichnet: {message}',
};
