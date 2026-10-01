/**
 * Names the browser tab for as long as this screen is mounted — nothing, on iOS
 * and Android, because there is no tab and no document.
 *
 * The pair exists so that a route can declare its name in one line that compiles
 * on every platform. On the device the route's name reaches the platform's header
 * through `<Stack.Screen options>` instead, which is `ScreenHeader`'s job; the
 * five routes that call this have no header at all and nothing to say to the
 * device ([ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md)).
 *
 * `documentTitle.web.ts` is the half that does something, and carries the
 * argument for the shape it has.
 */
export function useDocumentTitle(_title: string): void {
  // Deliberately empty.
}
