# Shared helpers for the emulator tours. Sourced, not executed.
#
# Requires: $ANDROID_HOME, a booted emulator (with a window — headless dies on
# SELinux denying execheap to SwiftShader's shader JIT), and the app installed.
# Where these tools live. Set by bash when the tours source this file; the literal
# fallback is for sourcing it by hand from the repo root, e.g. under zsh, which has
# no BASH_SOURCE.
TOOLS_DIR="${TOOLS_DIR:-$(dirname "${BASH_SOURCE[0]:-screens/tools/lib.sh}")}"
A="${ANDROID_HOME}/platform-tools/adb"
PKG=org.correctiv.app
OUT="${OUT:-out/android}"
mkdir -p "$OUT"

# Emulator images volunteer things. A round of this set came back with an Android
# stylus-handwriting sheet covering the search screen: the tap had succeeded, so the
# tour reported no MISS, and the shot documented a system dialog with the app greyed
# out behind it. That is the 83-video failure in a new costume — a step can be wrong
# without being missing — so the features that pop unasked are turned off before a
# tour starts rather than dismissed after one goes wrong.
# Called by each tour, NOT on sourcing. It presses BACK, and sourcing this file to
# poke at a device by hand then backs out of whatever was open — on the onboarding
# that leaves the app, which looks exactly like the app crashing.
quiet_system_ui() {
  $A shell settings put secure stylus_handwriting_enabled 0 >/dev/null 2>&1
  $A shell settings put secure stylus_handwriting_default_value 0 >/dev/null 2>&1
  # Animations ON, which is not the obvious choice for a screenshot tour.
  #
  # An emulator left at scale 0 makes Reanimated warn "Reduced motion setting is
  # enabled on this device", and in a debuggable build that warning is a LogBox
  # banner across the bottom of the screen. The banner is NOT in the accessibility
  # tree: `uiautomator` reports the button underneath it as present, enabled and
  # clickable, `tap` touches the right coordinates, the banner takes the touch, and
  # the walk stalls with every step reported as done. Three rounds went that way and
  # only a screenshot showed it, which is this file's own rule turned on itself —
  # the UI tree is not evidence either.
  #
  # The second reason holds even in a release build, which has no LogBox at all: at
  # scale 0 Reanimated disables animations, so a walk with them off is not walking
  # the app that ships.
  #
  # The previous values are saved and `finish` puts them back, because this is the
  # developer's own emulator and a tour has no business leaving it changed.
  for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
    SCALES_BEFORE+=("$scale=$($A shell settings get global "$scale" | tr -d '\r')")
    $A shell settings put global "$scale" 1 >/dev/null 2>&1
  done
  # Whatever is already on screen, before the first step.
  $A shell input keyevent 4 >/dev/null 2>&1
}

# --- a tour is evidence, or it is nothing -----------------------------------
#
# A step the tour cannot perform does not stop it. It writes the screenshot anyway,
# of the screen it was already on, and exits 0. Three of the comments in these files
# are post-mortems of exactly that: a blank `82-player`, a week of `83-video`
# shooting an empty state, and a run that reported MISS for every tap after the
# onboarding's first and left eighteen identical screenshots behind it.
#
# So misses are collected here and `finish` makes them fatal.
MISSES=()
# Animation scales as they were before quiet_system_ui, restored by `finish`.
SCALES_BEFORE=()
note_miss() { MISSES+=("$1"); echo "  MISS $1"; }

# Ends a tour. Non-zero if any step did not happen, naming each one.
finish() {
  for pair in ${SCALES_BEFORE+"${SCALES_BEFORE[@]}"}; do
    $A shell settings put global "${pair%%=*}" "${pair#*=}" >/dev/null 2>&1
  done
  if [ ${#MISSES[@]} -eq 0 ]; then
    echo "done — $(find "$OUT" -name '*.png' | wc -l) shots, every step performed"
    return 0
  fi
  echo
  echo "INCOMPLETE — ${#MISSES[@]} step(s) did not happen. Every shot after one of"
  echo "these is of the screen above it, not the screen it is named for:"
  printf '  - %s\n' "${MISSES[@]}"
  return 1
}

# A development build is a fine thing to photograph and a poor thing to drive: it
# fetches its bundle from Metro and reloads when Metro rebuilds, which mid-tour puts
# the app back at its first screen while the walk carries on. Said once, up front,
# rather than left to be worked out from the screenshots.
warn_if_debuggable() {
  if $A shell dumpsys package "$PKG" 2>/dev/null | grep -q 'flags=\[.*DEBUGGABLE'; then
    echo "WARNING: $PKG is a debuggable build, loaded from Metro. It reloads when"
    echo "         Metro does, which restarts the walk without failing any step."
    echo "         Install a release build for a round worth comparing."
  fi
}

# A settle before the shutter, because animations are on: `expect` returns the
# instant a label enters the tree, and a tab switch is still moving then. Without
# it the round drifts against `screens/`, which README puts at 0.4 to 1.4 % and
# tells the reader to open anything larger — a half-shifted tab is larger.
shot() { sleep "${SHOT_SETTLE:-0.6}"; $A exec-out screencap -p > "$OUT/$1.png"; echo "shot $1"; }
back() { $A shell input keyevent 4; sleep 1.4; }
scroll() { for _ in $(seq 1 "${1:-1}"); do $A shell input swipe 540 1900 540 700 260; sleep 0.7; done; sleep 0.6; }
top() { for _ in $(seq 1 6); do $A shell input swipe 540 700 540 2000 220; done; sleep 1; }

# Opens a route directly. Deep links cannot drift when a layout changes, and they
# reach the screens no tab leads to.
open_route() {
  $A shell am start -a android.intent.action.VIEW -d "correctiv://$1" >/dev/null 2>&1
  sleep "${2:-5}"
}

# The current UI tree, as XML.
ui_dump() {
  $A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  $A shell cat /sdcard/ui.xml 2>/dev/null
}

# Taps an element found by content-desc or text.
#
# Polls for the label rather than dumping once. A single dump a fixed pause after
# the previous tap reads whatever is on screen at that instant, and on a slower
# build that is regularly the screen before — the tap reports MISS while the label
# arrives half a second later. Waiting costs nothing when it is already there.
tap() {
  local label="$1" coords deadline=$((SECONDS + ${TAP_TIMEOUT:-8}))
  while :; do
    coords=$(ui_dump | python3 "$TOOLS_DIR/find-node.py" "$label")
    [ -n "$coords" ] && break
    if [ $SECONDS -ge $deadline ]; then note_miss "tap $label"; return 1; fi
    sleep 1
  done
  $A shell input tap $coords
  echo "  tap $label"
  sleep "${TAP_SETTLE:-1.4}"
}

# Asserts the tour got where it meant to go, before the shot is taken.
#
# `tap` succeeding says a control was found and touched. It does not say the app
# moved: a reload, a system sheet, a slow transition all leave the tap reported and
# the screen unchanged. Naming what should now be on screen is what turns a walk
# into a claim — and `labels` prints what was actually there when it is not.
expect() {
  local label="$1" deadline=$((SECONDS + ${EXPECT_TIMEOUT:-10}))
  while :; do
    [ -n "$(ui_dump | python3 "$TOOLS_DIR/find-node.py" "$label")" ] && return 0
    if [ $SECONDS -ge $deadline ]; then
      note_miss "expected \"$label\" on screen"
      labels
      return 1
    fi
    sleep 1
  done
}

# Types into the field found by label. `input text` takes no spaces, and none of
# the door's inputs need one.
type_into() { tap "$1" || return 1; $A shell input text "$2"; sleep 0.6; }

# The keyboard's action key: on the password field it submits the form.
submit() { $A shell input keyevent 66; sleep "${1:-4}"; }

# Through the door. A cleared app starts at the gate; every address signs in, and
# the door prints the rules for the other states (ADR 0016).
sign_in() {
  type_into "E-Mail-Adresse" "$1" || return 1
  type_into "Passwort eingeben" "$2" || return 1
  submit "${3:-4}"
}

# For a tour that does not start from a cleared app: sign in only when the door is up.
ensure_signed_in() {
  if ui_dump | grep -q 'content-desc="Anmelden"'; then sign_in alex.beispiel@example.org geheim; fi
}

# Every label on screen — run this when a tour step stops finding its target.
labels() {
  ui_dump | python3 -c '
import re, sys
xml = sys.stdin.read()
seen, out = set(), []
for m in re.finditer(r"(?:text|content-desc)=\"([^\"]+)\"", xml):
    v = m.group(1).strip()
    if v and v not in seen and len(v) <= 44:
        seen.add(v); out.append(v)
print("  labels: " + " | ".join(out))'
}
