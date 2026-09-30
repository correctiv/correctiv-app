"""Prints every clickable node smaller than the minimum touch target.

Reads a `uiautomator dump` XML on stdin, the display's physical density (dots per
inch, as `wm density` reports it) as argv[1], an optional minimum in dp as argv[2],
and the display size (`wm size`, e.g. `1080x2400`) as argv[3]. Android's guideline
is 48 dp; the WCAG figure the issue also names is 44.

WHY HERE AND NOT IN A TEST. `apps/mobile/__tests__/accessibility.test.ts` says why
it does not check target size: a target's height is its label's line box plus
padding written as utility classes, times the reader's font scale, and none of
those three numbers is in the JSX. On the device all three have already been
applied, and `uiautomator` reports the result as `bounds`, so this is the one place
the question has an answer.

THREE THINGS IT CANNOT SEE, and they do not all cut the same way:

  - `hitSlop`. It enlarges the touch area and not the node, so a 24 dp icon with
    `hitSlop={12}` is a 48 dp target and is reported here as 24. Twelve sites in
    `apps/mobile/src` use it. That makes this a list to read rather than a verdict,
    which is why it prints rather than fails.
  - A node the app never marked clickable. React Native sets `clickable="true"`
    from the press handler, so a control the accessibility tree does not know is a
    control is not in this list at all — and that is the defect
    `accessibility.test.ts` catches on the other side.
  - A node the SCREEN cut off. `uiautomator` reports visible bounds, so the fourth
    tile of a horizontal rail is 3 dp wide because three and a bit of it are past
    the right edge, not because anybody built a 3 dp button. That one produced two
    false findings on the first run and is excluded here: a node whose short side is
    also the side an edge cuts is dropped, which needs the display size and is why
    argv[3] exists. Without it nothing is excluded, and the rails fill the list.

Its own file rather than a heredoc inside the shell function, for the reason
`find-node.py` gives: a heredoc and a pipe both claim stdin, and the loser is
silent.
"""

import re
import sys

density = float(sys.argv[1])
minimum = float(sys.argv[2]) if len(sys.argv) > 2 else 48.0
screen_w, screen_h = (
    [int(n) for n in sys.argv[3].split("x")] if len(sys.argv) > 3 else (0, 0)
)
px_per_dp = density / 160.0
xml = sys.stdin.read()

# The four tab labels of the native bar (ADR 0013), named rather than positioned:
# a tab at a fixed offset would be a guess about a layout that moves with the font
# scale, which is the mistake this whole addition exists to stop. German, because
# that is what the app ships, and `SHIPPED_LOCALE` names only one.
TAB_LABELS = re.compile(r"^(Entdecken|Mediathek|Mitmachen|Profil)$")

# The bottom of the scroll area, which is the tab bar's top edge and NOT the
# screen's. A node the scroller cuts is reported with its visible height, so a
# content card that runs past the bottom reads as a short button.
#
# It comes out of the dump rather than out of a constant, because the value moves
# with the font scale — measured on Medium_Phone_API_36 on 2026-09-30: the tab bar
# started at y=2126 at 100 % system font and at y=2086 at 200 %. A hard-coded
# number would have been right for one of the two and wrong for the other, which is
# how two false findings got past a screenshot on 2026-09-03 (see the docstring).
def scroll_bottom():
    tops = []
    for match in re.finditer(r'<node[^>]*>', xml):
        tag = match.group(0)
        desc = re.search(r'content-desc="([^"]*)"', tag)
        if not desc or not TAB_LABELS.match(desc.group(1)):
            continue
        bounds = re.search(r'bounds="\[(-?\d+),(-?\d+)\]', tag)
        if bounds:
            tops.append(int(bounds.group(2)))
    return min(tops) if tops else 0


seen = set()
rows = []
cut_bottom = scroll_bottom()
for match in re.finditer(r"<node[^>]*>", xml):
    tag = match.group(0)
    if 'clickable="true"' not in tag:
        continue
    bounds = re.search(r'bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"', tag)
    if not bounds:
        continue
    x1, y1, x2, y2 = map(int, bounds.groups())
    width = (x2 - x1) / px_per_dp
    height = (y2 - y1) / px_per_dp
    if width >= minimum and height >= minimum:
        continue
    # An empty box is a wrapper the layout collapsed, not a control anybody can hit.
    if width <= 0 or height <= 0:
        continue
    # Cut off by the screen rather than built small — see the docstring.
    if width < minimum and screen_w and (x1 <= 0 or x2 >= screen_w):
        continue
    if height < minimum and (y1 <= 0 or y2 >= screen_h or (cut_bottom and y2 >= cut_bottom)):
        continue
    label = ""
    for attribute in ("content-desc", "text"):
        found = re.search(rf'{attribute}="([^"]*)"', tag)
        if found and found.group(1):
            label = found.group(1)
            break
    key = (label, round(width), round(height))
    if key in seen:
        continue
    seen.add(key)
    rows.append(f"    {width:5.1f} x {height:5.1f} dp  {label or '(no label)'}")

if rows:
    print(f"  targets under {minimum:.0f} dp ({len(rows)}):")
    print("\n".join(sorted(rows)))
else:
    print(f"  targets under {minimum:.0f} dp: none")
