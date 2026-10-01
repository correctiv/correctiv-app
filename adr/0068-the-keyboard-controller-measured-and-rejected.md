# ADR 0068 — The keyboard controller, measured and rejected

Status: accepted, 2026-10-01.

## Context

[ADR 0026](0026-react-native-review-and-hardening.md) §2 asked for inputs that stay
reachable under the software keyboard, and named React Native Keyboard Controller as the
escalation if `KeyboardAvoidingView` was not enough. Issue #93 took that route.
`react-native-keyboard-controller@1.21.9` was installed, `KeyboardProvider` went into
`AppEnvironment.tsx`, and the `ScrollView` on the three input screens became the
library's `KeyboardAwareScrollView`. That work is reverted; the dependency is not in
`package.json`.

The justification the repository carried for its own `KeyboardAvoiding` box, before this
experiment, was measured in the **web export at 390x844**, where `KeyboardAvoidingView`
is a plain `View`. That is arithmetic about a layout, not an observation of a keyboard on
a phone. The measurements below are the Android ones, and they are the ones that count.

## What was measured

`Medium_Phone_API_36` (API 36, density 420), debug build, participation form step 2, app
text size at its largest, device `font_scale` 1.0. Pixels, top..bottom of the multiline
field before and after focus, the keyboard's top edge, and the footer button after focus.

| window | composition | field before | keyboard top | field after | footer after |
| --- | --- | --- | --- | --- | --- |
| 1080x2400 | own box, no library | 693..945 | 1517 | 693..945 | 1351..1487 |
| 1080x2400 | library | 693..945 | 1517 | 693..945 | 1351..1487 |
| 1080x1920 | own box, no library | 693..945 | 1048 | 594..846 | 882..1018 |
| 1080x1920 | library | 693..945 | 1048 | 594..846 | 882..1018 |
| **1080x1600** | **own box, no library** | 693..945 | 728 | **274..526, caret visible** | **562..698** |
| **1080x1600** | **library** | 693..945 | 728 | **553..526, an empty rectangle: the field is scrolled out of the viewport** | not reported |
| 1080x1600 | library, own `KeyboardAvoiding` removed | 693..945 | 728 | 553..805, 77 px covered | 1434..1570, behind the keyboard |

1600 is the only window where the keyboard reaches the field and room is left over. At
2400 and 1920 both compositions give the same numbers. At `wm size 720x800` the keyboard
takes 522 of 800 px and header plus footer leave a box of about 80 px, which cannot
answer the question.

In the one geometry that can, the library is worse than not having it, and removing our
own box as well is worse still. So the two mechanisms are not simply one fighting the
other.

Evidence, both at 1080x1600:
[`93-keyboard-own-box-1600.webp`](../screens/evidence/93-keyboard-own-box-1600.webp), the
field visible with its caret, and
[`93-keyboard-library-1600.webp`](../screens/evidence/93-keyboard-library-1600.webp), the
field gone.

## Decision

### 1. The app does not depend on `react-native-keyboard-controller`

On the only window that distinguishes the two, the library lost the field that the app's
own `KeyboardAvoiding` box kept. `KeyboardProvider` and `KeyboardAwareScrollView` stay out
of `AppEnvironment.tsx` and the three input screens, and the package stays out of
`package.json`.

### 2. ADR 0026 §2's escalation is withdrawn, and nothing replaces it

The named next step turned out to be a regression in the geometry it was meant for. The
app's own `KeyboardAvoiding` is what is left, and it stays. A future attempt starts from
the table above, not from the library's documentation, and has to show a row at 1600 that
beats the first one.

## Not established

- **Why the library under-scrolls.** Its own `visibleRect` arithmetic did not reconcile
  with the measurement, and no cause was found. The result is a measurement, not an
  explanation, so it says nothing about a later version.
- **Anything about iOS.** Nothing here was run there.
- **The other two screens.** Only the participation form was measured. `suche.tsx` and
  `LoginGate.tsx` were not.

## Retires

- ADR 0026 §2: that React Native Keyboard Controller is the escalation if
  `KeyboardAvoidingView` is not enough. The rest of the section, what done means and what
  to exercise, stands.
