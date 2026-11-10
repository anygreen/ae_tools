# Aldi Helper

ScriptUI panel for the ALDI spots (`Aldi_Helper_V2.jsx`, installed and updated with anyUpdater).
Open it via Window > Aldi_Helper_V2.jsx. Tabs:

- **General** - Marker Reveal, Pop In, Easy Morph, DOOH Offset, Smart Precomp
- **Complex Morph** - Kachel small/big morph setup
- **Stars** - Xmas star pops (since v2.2.0, see below)

## Stars tab (Xmas star pops)

Puts the star pop-in / pop-out keys on the selected layers, so the stars no longer need to be
copy-pasted and shifted by hand.

### How to use (for Alex)

1. Open the precomp with the stars (e.g. `TVC_KW47_Product_1_01`, `Produkt_1_OLV_KW47_01`).
2. Put the time marker where the first star should start.
3. Select the star layers. With **Selection order** the pop order is the order After Effects reports the
   selection in (normally the click order). If the order looks wrong, use `Layer index` or a spatial order.
4. In the **Stars** tab choose:
   - **Animation**: `Pop In`, `Pop Out` or `Pop In + Out`
   - **Order**: `Selection order`, `Layer index` (top layer first), `Left to right`, `Right to left`,
     `Top to bottom`, `Bottom to top` (position of the layers at the time marker)
   - **In offset (f)**: frames between two stars popping in (0 = all at once, 1 or 2 as in the spots)
   - **Out offset (f)**: frames between two stars popping out (0 = all at once)
   - **Out after (f)**: only for `Pop In + Out`, frames from the time marker to the first pop out
   - **Reverse order for Pop Out**: the last star to pop in pops out first
   - **Motion blur**: switches motion blur on for the layers (on by default, like the other buttons)
5. Click **Apply Stars**. One Cmd+Z undoes the whole run.

Typical setups from the Xmas projects:

| Case | Animation | Offset |
|------|-----------|--------|
| Product stars leave with the price morph | Pop Out | Out 1 f |
| Price stars come in after the morph | Pop In | In 1 f (ANAS KW47) or 2 f (AN OLV, AS) |
| Stars leave as a transition, all together (AS) | Pop Out | Out 0 f |
| Stars in and out in one go | Pop In + Out | In 2 f, Out 1 f, Out after = hold time |

### What it sets

Scale keys only (no opacity, no time remap), on frame boundaries starting at the time marker:

- **Pop In**: 0 % -> 120 % (+5 f) -> 100 % (+8 f)
- **Pop Out**: 100 % -> 120 % (+3 f) -> 0 % (+8 f)
- Ease: speed 0, influence 66 % in / 44 % out (first and last key keep AE's 16.67 % on the outer side)

These values come from the star keys in the KW46/KW47 Xmas Silvester AEPs (AN OLV, ANAS TVC, AS OLV).
"100 %" is the layer's own scale: a star that sits at 60 % pops 0 -> 72 -> 60 %. The z scale of 3D layers stays.

### Existing keys

Existing scale keys inside the new range (from the first new key to the last new key of that layer) are
replaced. Keys outside that range are kept, and the panel shows a warning so you can check the curves
there. Locked layers and layers without scale are skipped with a warning. If `Out after` is too short for a
star to finish its pop in, nothing is changed and the panel tells you the minimum.
