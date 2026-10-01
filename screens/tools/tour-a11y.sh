#!/usr/bin/env bash
# Walks the app with the accessibility settings turned up, and screenshots every
# step in each of them.
#
# The other two tours photograph the app as it ships. This one photographs it as a
# reader who has changed something receives it — the largest system font size, and
# both device colour schemes — which is where layout fails and where no test in
# `npm run check` can look. Issue #102 is the scope; issue #145 is the reason 200 %
# is the interesting scale rather than 130 %.
#
# The step names are the contract, and here a step name carries its CONDITION as a
# suffix: `10-home-top-s100-light`, `10-home-top-s200-light`, `10-home-top-s200-dark`.
# That order is deliberate — the three sort next to each other, and the comparison
# anybody makes is one screen across three settings rather than one setting across
# nine screens.
#
#   OUT=out/a11y bash screens/tools/tour-a11y.sh
set -uo pipefail
source "$(dirname "$0")/lib.sh"

# The top of Android's own slider, "Größte". The device accepts any float, so this
# stays a parameter — but the name of every shot is derived from it below rather
# than typed, or an override would leave 33 files claiming a scale nobody set.
SCALE_MAX="${SCALE_MAX:-2.0}"

# --- the device's own settings, put back on the way out ---------------------
#
# `quiet_system_ui` saves the animation scales and `finish` restores them, which is
# the pattern this copies for the two settings it changes itself. With one addition:
# a trap, rather than a line at the end. These two are visible on the device in a
# way an animation scale is not — a developer who interrupts this tour and finds
# their emulator stuck at 200 % in dark mode has been handed a bug that is not
# theirs — so the restore has to survive the walk failing, not only the walk
# finishing.
FONT_BEFORE="$($A shell settings get system font_scale | tr -d '\r')"
NIGHT_BEFORE="$($A shell cmd uimode night | tr -d '\r' | awk '{ print $NF }')"

restore_a11y() {
  # `settings get` on a value that was never written prints `null`, and writing
  # that back sets the literal string, which Android reads as a scale of 0.
  if [ "$FONT_BEFORE" = "null" ] || [ -z "$FONT_BEFORE" ]; then
    $A shell settings delete system font_scale >/dev/null 2>&1
  else
    $A shell settings put system font_scale "$FONT_BEFORE" >/dev/null 2>&1
  fi
  $A shell cmd uimode night "${NIGHT_BEFORE:-no}" >/dev/null 2>&1
}
trap restore_a11y EXIT

quiet_system_ui
warn_if_debuggable

# Physical dots per inch, for the touch-target report. Read once: it cannot change
# under us, and `wm density` is a round trip per call.
DENSITY="$($A shell wm density | tr -d '\r' | awk -F': ' '/Physical/ { print $2 }')"
# The display size, so a rail tile the right edge cuts in half is not reported as a
# 3 dp button. See `small-targets.py`.
SCREEN="$($A shell wm size | tr -d '\r' | awk -F': ' '/Physical/ { print $2 }')"

# A font scale is NOT in MainActivity's `configChanges` (`uiMode` is), so Android
# recreates the activity when it changes and the app comes back at its first
# screen. Set before the walk, never during one.
set_scale() {
  $A shell settings put system font_scale "$1" >/dev/null 2>&1
  sleep 2
}

# Night mode IS in `configChanges`, so this one does not restart anything: the app
# is handed the new scheme and re-renders in place. That is the combination
# AGENTS.md calls the app's default and the one that has already shipped broken —
# the appearance setting on "System", the device on dark.
set_night() {
  $A shell cmd uimode night "$1" >/dev/null 2>&1
  sleep 3
}

# Every clickable node the current screen exposes that is under 48 dp, printed into
# the log beside the shot it belongs to. `small-targets.py` says what it cannot see;
# read that before treating a line as a defect.
targets() {
  echo "  $1"
  ui_dump | python3 "$TOOLS_DIR/small-targets.py" "$DENSITY" "${TARGET_MIN:-48}" "$SCREEN"
}

# Through the door, at a font size the door was not laid out for.
#
# `lib.sh`'s `sign_in` types the address and then taps the password field. At 200 %
# the headline and the intro fill the screen, so once the keyboard is up the
# password field is below it and `uiautomator` — which reports VISIBLE bounds — does
# not have it in the tree at all. The tap reports MISS and the whole walk stops at
# the gate: the first run of this tour produced 22 shots of the login screen under
# nine other screens' names.
#
# It is NOT a defect, and that is worth writing down because the shot looks exactly
# like one. The gate is a `ScrollView`; scrolling reaches the field, which was
# measured by hand before this workaround was written rather than assumed.
#
# The swipe starts at y=1200 and not at `scroll`'s y=1900, and that is the second
# post-mortem in this function: at 200 % the keyboard's top edge is around y=1520,
# a swipe that begins below it is a swipe ACROSS the keyboard, and Gboard reads that
# as glide typing. The first run put two invented words into the e-mail field and
# the labels dump showed `alex.beispiel@example.org ft ft`.
sign_in_large() {
  type_into "E-Mail-Adresse" "$1" || return 1
  $A shell input swipe 540 1200 540 600 300
  sleep 1.5
  type_into "Passwort eingeben" "$2" || return 1
  submit "${3:-5}"
}

# One condition, start to finish, from a cleared app.
#
# Cleared for each condition rather than once for the set, so the three walks are
# the same walk: the door and the onboarding are three screens of dense copy and
# four buttons, they are where a font scale shows first, and they exist only on a
# cleared app. The cost is a sign-in per condition.
#
# The tabs are reached by deep link rather than by tapping. Both work, and the tour
# that taps is `tour-android.sh`; here a tab bar at 200 % is one of the things under
# test, so the walk must not depend on being able to hit it.
walk() {
  local tag="$1"
  echo
  echo "--- $tag"
  $A shell pm clear "$PKG" >/dev/null
  $A shell am start -n "$PKG/${ACTIVITY:-.MainActivity}" >/dev/null
  sleep 9

  expect Anmelden;                             shot "00-gate-$tag"
  targets "00-gate-$tag"
  sign_in_large alex.beispiel@example.org geheim 6

  expect "Recherchen für die Gesellschaft";    shot "01-onboarding-welcome-$tag"
  tap "Los geht’s"
  expect "Was interessiert Sie?";              shot "02-onboarding-interests-$tag"
  tap Klima; tap Faktenchecks; tap Weiter
  expect Benachrichtigungen;                   shot "03-onboarding-push-$tag"
  tap Fertig; sleep 6

  # The tab bar is the proof the onboarding is behind us: it does not exist above it.
  expect Home;                                 shot "10-home-top-$tag"
  targets "10-home-top-$tag"
  scroll 2;                                    shot "11-home-mid-$tag"
  open_route entdecken 5
  expect "Recherchen, Faktenchecks, Projekte"; shot "30-entdecken-$tag"
  open_route mediathek 6
  expect "Salon5 Radio";                       shot "40-mediathek-$tag"
  targets "40-mediathek-$tag"
  open_route mitmachen 5
  expect "AKTIVE AUFRUFE";                     shot "50-mitmachen-$tag"
  open_route profil 5
  expect "IHRE MITGLIEDSCHAFT";                shot "60-profil-$tag"
  targets "60-profil-$tag"
  open_route einstellungen 5
  expect DARSTELLUNG;                          shot "91-einstellungen-$tag"
}

# `s100`, `s200` — derived from the scale actually set, so the name cannot lie.
scale_tag() { awk -v s="$1" 'BEGIN { printf "s%d", s * 100 }'; }

# The baseline first, and it is not decoration: a shot at 200 % on its own shows a
# large app, and only the pair shows what the size COST. Light, because the
# `screens/android/` set is light throughout and this is the frame it is read
# against.
set_scale 1.0;         set_night no;  walk "$(scale_tag 1.0)-light"
set_scale "$SCALE_MAX"                # still light: one variable moves at a time
walk "$(scale_tag "$SCALE_MAX")-light"
set_night yes;         walk "$(scale_tag "$SCALE_MAX")-dark"

finish
