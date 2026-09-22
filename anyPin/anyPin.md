# anyPin

Creates a null for every selected Puppet Pin and links the pin back to the null with an
expression — the equivalent of Duik's "add bones / controllers to puppet pins".

File: `anyPin/anyPin.jsx` — works both as `File > Scripts > Run Script File` and as a
dockable ScriptUI panel (same IIFE / `thisObj instanceof Panel` pattern as `anyKV`).

## UI

| Control | Meaning |
| --- | --- |
| **Prefix** | Prepended to every null name. Names are `<prefix><layer name> \| <pin name>`, e.g. `Character \| Puppet Pin 3`. |
| **Size** | Null size in px. `100` (the AE default) leaves the null source untouched. |
| **Label** | Label colour applied to the created nulls. |
| **Parent** | What the nulls are parented to: *Source layer* (default), *Source layer's parent*, or *Nothing*. |
| **Add master control null per layer** | Creates one extra null at the source layer's anchor point; all pin nulls of that layer are parented to it, and the master takes the **Parent** setting. Lets you move/scale the whole rig at once. |
| **Select new nulls when done** | Leaves the created nulls selected. |
| **Create Nulls from Pins** | Main action. |
| **Select Nulls** | Selects the nulls linked to the currently selected pins. |
| **Unlink** | Removes the anyPin expressions from the selected pins and offers to delete the nulls. |

All settings persist in AE preferences under the `anyPin` section.

## What counts as "selected"

`collectPins()` walks whatever is selected in the timeline down to every deform pin's
`Position` property. Any of these work:

- one or more pin `Position` properties (this is what clicking a pin in the viewer selects)
- a pin group (`Puppet Pin 1`), including its Rotation / Scale on advanced pins
- the `Deform` group, a `Mesh` group, or the whole `Puppet` effect
- **nothing pin-related selected** → falls back to *every* deform pin on the selected layers

Duplicates are removed via `propKey()` (layer index + the chain of `propertyIndex` values),
because ExtendScript hands out a fresh wrapper object on every property access, so `===`
cannot be used for identity.

Relevant matchNames:

```
ADBE FreePin3                 the Puppet effect
ADBE FreePin3 ARAP Group      > arap
ADBE FreePin3 Mesh Group      > Mesh
ADBE FreePin3 PosPins         > Deform
ADBE FreePin3 PosPin Atom     > Puppet Pin n
ADBE FreePin3 PosPin Position > Position
```

## The link expression

Applied to each pin's `Position`:

```js
// anyPin
var c = thisComp.layer("Character | Puppet Pin 1");
var p = fromComp(c.toComp(c.anchorPoint));
[p[0], p[1]];
```

Why this form:

- **`c.toComp(c.anchorPoint)`** resolves the null's position in comp space *through its whole
  parent chain*, so the pin follows correctly when the null is parented to another layer,
  animated, rotated or scaled. Using `c.position` instead would break as soon as the null gets
  a parent.
- **`fromComp(...)`** (i.e. `thisLayer.fromComp`) converts comp space back into the puppet
  layer's own coordinate space, which is exactly the space puppet pin positions live in
  (origin = top-left of the layer's bounds). This is what makes the rig survive the source
  layer being moved, scaled, rotated or parented.
- **`[p[0], p[1]]`** — `fromComp` returns three components on a 3D layer, while the pin
  property is 2D; the slice avoids a dimension mismatch error.
- The `// anyPin` marker line is what **Unlink** and **Select Nulls** look for. The null name
  is recovered from the expression with a regex on `thisComp.layer("…")`; quotes and
  backslashes in layer names are escaped by `escapeName()`.

Parenting the pin nulls to the *source layer* (the default) is not circular: a layer's
transform never depends on its own effects, so AE evaluates layer transform → null transform →
pin position.

## How the nulls are positioned

ExtendScript has no `toComp()` / `fromComp()` API, so `placeAtCompPoint()` uses the
evaluate-an-expression-and-read-it-back trick:

1. Read the pin's current value: `pin.valueAtTime(comp.time, false)` — `false` means
   *post*-expression, i.e. where the pin actually sits right now. This is a point in the source
   layer's space.
2. Create the null (still unparented, still at comp root, so its `position` **is** comp space).
3. Put a throwaway expression on the null's `position`:
   `var L = thisComp.layer(<srcIndex>); var p = L.toComp([x,y]); [p[0], p[1]];`
   `L.index` is read at this moment, *after* the null was added, because adding a layer shifts
   the indices below it.
4. Read `ctrl.position.valueAtTime(comp.time, false)` → the comp-space point.
5. Clear the expression and `setValue()` the sampled point.
6. Only then parent the null. `layer.parent = x` preserves the world transform (unlike
   `setParentWithJump()`), so the null stays exactly on the pin.

`expressionError` is checked after step 3; if the throwaway expression fails the null is
removed again and the pin is counted as failed rather than being left half-rigged.

The null's `anchorPoint` is centred (`[w/2, h/2]`) so the null square is centred on the pin and
`toComp(anchorPoint)` in the link expression equals the null's position.

## Unlink

For each selected pin carrying an anyPin expression:

1. Sample the current post-expression value.
2. Clear the expression.
3. If the pin has no keyframes, bake the sampled value back in, so the pin does not snap to its
   old base pose.

Then, if confirmed, delete the linked nulls — but only those whose `comment` is `anyPin` and
which `stillLinked()` reports no other pin in the comp is using.

## Known limitations

- **3D source layers.** `toComp` / `fromComp` on a 3D layer go through the active camera, and
  mapping a 2D comp point back onto a 3D plane is ambiguous. anyPin still rigs the pins but
  prints a warning. Keep puppet layers 2D.
- **Size field.** Resizing goes through `n.source.width/height` inside a `try/catch`. At the
  default `100` nothing is touched.
- **Renaming a null** breaks its pin expression — the link is by layer name. Re-run **Unlink**
  and rig again, or fix the name in the expression.
- Pins that already carry an anyPin expression are skipped, so re-running the button never
  produces duplicate nulls.

## Not yet in anyUpdater

anyPin is intentionally **not** listed in `anyUpdater/manifest.json` yet. To ship it, add:

```json
{
  "id": "any_pin",
  "name": "anyPin",
  "version": "1.0.0",
  "files": [ { "repo": "anyPin/anyPin.jsx", "local": "anyPin.jsx" } ],
  "remove": [ "anyPin/anyPin.jsx" ]
}
```

and from then on follow the version-tracking rules in `CLAUDE.md` (bump `SCRIPT_VERSION`, the
manifest `version`, and the list in `CLAUDE.md` together).
