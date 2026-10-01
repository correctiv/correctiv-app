/**
 * German for the `signIn.*` ids: the fifth drawing, how somebody signs in.
 *
 * **Two ids, and that is the whole of this drawing's translation today.** Every
 * label inside the picture, its caption and the list under it are still English
 * literals in `src/diagrams/SignIn.tsx`, which `test/rendered-literals.test.ts`
 * counts. `test/diagrams-sign-in.test.ts` reads that English prose out of the
 * drawing and holds its figures to `services/auth.service.ts`, so moving the
 * labels means deciding what that check reads instead.
 */
export const signIn: Record<string, string> = {
  'signIn.title': 'Wie sich jemand anmeldet und was hinter der Tür liegt',
  'signIn.lede':
    'Die Tür ist echt, alles dahinter noch nicht. Das Root-Layout zeigt sie statt der Routen. Sie ruft eine Funktion auf, die anderthalb Sekunden wartet und die E-Mail-Adresse in einer Tabelle nachschlägt. Über der roten Linie steht, was dieses Repository tut. Darunter steht, was das Whiteboard plant, als Lücke gezeichnet, weil es das noch nicht gibt.',
};
