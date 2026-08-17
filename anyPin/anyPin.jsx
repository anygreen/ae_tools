{
var SCRIPT_VERSION = "v1.0.0";

function myScript(thisObj) {
    function myScript_buildUI(thisObject) {
        var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "anyPin", undefined, {resizeable: true});

        var PREF_SECTION = "anyPin";
        var MARKER       = "anyPin";

        // ─── Puppet matchNames ─────────────────────────────────────────────
        var MN_EFFECT   = "ADBE FreePin3";
        var MN_ARAP     = "ADBE FreePin3 ARAP Group";
        var MN_MESHGRP  = "ADBE FreePin3 Mesh Group";
        var MN_PINS     = "ADBE FreePin3 PosPins";
        var MN_PINATOM  = "ADBE FreePin3 PosPin Atom";
        var MN_PINPOS   = "ADBE FreePin3 PosPin Position";

        var LABEL_NAMES = ["None", "Red", "Yellow", "Aqua", "Pink", "Lavender", "Peach", "Sea Foam",
                           "Blue", "Green", "Purple", "Orange", "Brown", "Fuchsia", "Cyan",
                           "Sandstone", "Dark Green"];

        var PARENT_MODES = ["Source layer", "Source layer's parent", "Nothing"];

        // ─── Preferences helpers ───────────────────────────────────────────
        function loadPref(key, fallback) {
            try {
                var v = app.preferences.getPrefAsString(PREF_SECTION, key, PREFType.PREF_Type_MACHINE_SPECIFIC);
                return (v !== "" && v !== undefined && v !== null) ? v : fallback;
            } catch (e) { return fallback; }
        }

        function savePref(key, value) {
            try {
                app.preferences.savePrefAsString(PREF_SECTION, key, String(value), PREFType.PREF_Type_MACHINE_SPECIFIC);
                app.preferences.saveToDisk();
            } catch (e) {}
        }

        // ─── UI ────────────────────────────────────────────────────────────
        var mainGrp = myPanel.add("group");
        mainGrp.orientation   = "column";
        mainGrp.alignment     = ["fill", "fill"];
        mainGrp.alignChildren = ["fill", "top"];
        mainGrp.spacing       = 6;
        mainGrp.margins       = 8;

        var titleText = mainGrp.add("statictext", undefined, "anyPin " + SCRIPT_VERSION);
        titleText.alignment = ["center", "top"];

        // Name prefix
        var prefixRow = mainGrp.add("group");
        prefixRow.orientation = "row";
        prefixRow.alignment   = ["fill", "top"];
        prefixRow.spacing     = 4;
        prefixRow.add("statictext", undefined, "Prefix").preferredSize = [50, -1];
        var prefixField = prefixRow.add("edittext", undefined, "");
        prefixField.alignment = ["fill", "center"];

        // Size + label
        var styleRow = mainGrp.add("group");
        styleRow.orientation = "row";
        styleRow.alignment   = ["fill", "top"];
        styleRow.spacing     = 4;
        styleRow.add("statictext", undefined, "Size").preferredSize = [50, -1];
        var sizeField = styleRow.add("edittext", undefined, "100");
        sizeField.justify       = "center";
        sizeField.preferredSize = [46, -1];
        styleRow.add("statictext", undefined, "Label").preferredSize = [36, -1];
        var labelDrop = styleRow.add("dropdownlist", undefined, LABEL_NAMES);
        labelDrop.alignment = ["fill", "center"];
        labelDrop.selection = 2;

        // Parenting
        var parentRow = mainGrp.add("group");
        parentRow.orientation = "row";
        parentRow.alignment   = ["fill", "top"];
        parentRow.spacing     = 4;
        parentRow.add("statictext", undefined, "Parent").preferredSize = [50, -1];
        var parentDrop = parentRow.add("dropdownlist", undefined, PARENT_MODES);
        parentDrop.alignment = ["fill", "center"];
        parentDrop.selection = 0;

        var masterCheck = mainGrp.add("checkbox", undefined, "Add master control null per layer");
        var selectCheck = mainGrp.add("checkbox", undefined, "Select new nulls when done");
        selectCheck.value = true;

        var createBtn = mainGrp.add("button", undefined, "Create Nulls from Pins");
        createBtn.alignment = ["fill", "top"];

        var btnsRow = mainGrp.add("group");
        btnsRow.orientation = "row";
        btnsRow.alignment   = ["fill", "top"];
        btnsRow.spacing     = 4;
        var selectBtn = btnsRow.add("button", undefined, "Select Nulls");
        selectBtn.alignment = ["fill", "center"];
        var unlinkBtn = btnsRow.add("button", undefined, "Unlink");
        unlinkBtn.alignment = ["fill", "center"];

        var consoleTxt = mainGrp.add("statictext", undefined, "", {multiline: true});
        consoleTxt.alignment     = ["fill", "top"];
        consoleTxt.justify       = "center";
        consoleTxt.preferredSize = [250, 28];

        // ─── Init from prefs ───────────────────────────────────────────────
        prefixField.text  = loadPref("prefix", "");
        sizeField.text    = loadPref("size", "100");
        labelDrop.selection  = parseInt(loadPref("label", "2"), 10);
        parentDrop.selection = parseInt(loadPref("parentMode", "0"), 10);
        masterCheck.value = (loadPref("master", "0") === "1");
        selectCheck.value = (loadPref("selectNew", "1") === "1");

        function storeSettings() {
            savePref("prefix", prefixField.text);
            savePref("size", sizeField.text);
            savePref("label", labelDrop.selection ? labelDrop.selection.index : 2);
            savePref("parentMode", parentDrop.selection ? parentDrop.selection.index : 0);
            savePref("master", masterCheck.value ? "1" : "0");
            savePref("selectNew", selectCheck.value ? "1" : "0");
        }

        // ─── UI helpers ────────────────────────────────────────────────────
        function setConsole(text) {
            consoleTxt.text = text;
        }

        function activeComp() {
            var item = app.project.activeItem;
            if (item && item instanceof CompItem) return item;
            return null;
        }

        function nullSize() {
            var s = parseFloat(sizeField.text);
            if (isNaN(s) || s < 1) s = 100;
            if (s > 2000) s = 2000;
            return Math.round(s);
        }

        // ─── Pin collection ────────────────────────────────────────────────
        // Unique key for a property, so the same pin selected twice is only rigged once.
        function propKey(prop) {
            var key = "";
            for (var d = 1; d < prop.propertyDepth; d++) {
                key += prop.propertyGroup(d).propertyIndex + ".";
            }
            return prop.propertyGroup(prop.propertyDepth).index + ":" + key + prop.propertyIndex;
        }

        function layerOf(prop) {
            return prop.propertyGroup(prop.propertyDepth);
        }

        // Walks any selected property or group down to the Position of every deform pin
        // it contains. Selecting the effect, the Deform group, a single pin or the pin's
        // Position (or its Rotation / Scale on advanced pins) all resolve to the same thing.
        function harvest(prop, arr) {
            if (prop.matchName === MN_PINPOS) { arr.push(prop); return; }

            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.propertyDepth > 0) {
                    var par = prop.propertyGroup(1);
                    if (par && par.matchName === MN_PINATOM) {
                        try { arr.push(par.property(MN_PINPOS)); } catch (e) {}
                    }
                }
                return;
            }

            for (var i = 1; i <= prop.numProperties; i++) {
                try { harvest(prop.property(i), arr); } catch (e) {}
            }
        }

        function pinsOfLayer(layer, arr) {
            var fx = null;
            try { fx = layer.property("ADBE Effect Parade"); } catch (e) { return; }
            if (!fx) return;
            for (var i = 1; i <= fx.numProperties; i++) {
                var eff = fx.property(i);
                if (eff.matchName === MN_EFFECT) harvest(eff, arr);
            }
        }

        // Selected pins first; if nothing pin-ish is selected, fall back to every
        // deform pin on the selected layers.
        function collectPins(comp) {
            var raw = [];
            var sel = comp.selectedProperties;
            for (var i = 0; i < sel.length; i++) {
                try { harvest(sel[i], raw); } catch (e) {}
            }
            if (raw.length === 0) {
                var layers = comp.selectedLayers;
                for (var l = 0; l < layers.length; l++) pinsOfLayer(layers[l], raw);
            }

            var seen = {};
            var out  = [];
            for (var p = 0; p < raw.length; p++) {
                if (!raw[p]) continue;
                var k = propKey(raw[p]);
                if (seen[k]) continue;
                seen[k] = true;
                out.push(raw[p]);
            }
            return out;
        }

        // Groups pins by their layer, preserving order.
        function groupByLayer(pins) {
            var groups = [];
            var index  = {};
            for (var i = 0; i < pins.length; i++) {
                var lyr = layerOf(pins[i]);
                var k   = String(lyr.index);
                if (index[k] === undefined) {
                    index[k] = groups.length;
                    groups.push({ layer: lyr, pins: [] });
                }
                groups[index[k]].pins.push(pins[i]);
            }
            return groups;
        }

        // ─── Expression helpers ────────────────────────────────────────────
        function escapeName(name) {
            return String(name).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        }

        function buildPinExpression(nullName) {
            return "// " + MARKER + "\n" +
                   "var c = thisComp.layer(\"" + escapeName(nullName) + "\");\n" +
                   "var p = fromComp(c.toComp(c.anchorPoint));\n" +
                   "[p[0], p[1]];";
        }

        function linkedNullName(prop) {
            if (!prop.expression || prop.expression.indexOf(MARKER) === -1) return null;
            var m = prop.expression.match(/thisComp\.layer\("((?:[^"\\]|\\.)*)"\)/);
            if (!m) return null;
            return m[1].replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
        }

        function findLayerByName(comp, name) {
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).name === name) return comp.layer(i);
            }
            return null;
        }

        function layerNameExists(comp, name) {
            return findLayerByName(comp, name) !== null;
        }

        function uniqueName(comp, base) {
            if (!layerNameExists(comp, base)) return base;
            var n = 2;
            while (layerNameExists(comp, base + " " + n)) n++;
            return base + " " + n;
        }

        // ─── Null creation ─────────────────────────────────────────────────
        function makeNull(comp, name) {
            var n = comp.layers.addNull();
            n.name        = uniqueName(comp, name);
            n.threeDLayer = false;
            n.comment     = MARKER;
            if (labelDrop.selection) n.label = labelDrop.selection.index;

            var size = nullSize();
            if (size !== 100) {
                try {
                    n.source.width  = size;
                    n.source.height = size;
                } catch (e) {}
            }
            var w = 100, h = 100;
            try { w = n.source.width; h = n.source.height; } catch (e) {}
            n.anchorPoint.setValue([w / 2, h / 2]);
            return n;
        }

        // ExtendScript has no toComp(), so the null is placed by evaluating a throwaway
        // expression on its own Position and reading back the post-expression value.
        // The null must still be unparented at this point, so the value is comp space.
        function placeAtCompPoint(ctrl, expressionBody, time) {
            ctrl.position.expression = expressionBody;
            if (ctrl.position.expressionError !== "") {
                ctrl.position.expression = "";
                return false;
            }
            var world = ctrl.position.valueAtTime(time, false);
            ctrl.position.expression = "";
            ctrl.position.setValue([world[0], world[1]]);
            return true;
        }

        function layerPointExpression(srcIndex, x, y) {
            return "var L = thisComp.layer(" + srcIndex + ");\n" +
                   "var p = L.toComp([" + x + "," + y + "]);\n" +
                   "[p[0], p[1]];";
        }

        function layerAnchorExpression(srcIndex) {
            return "var L = thisComp.layer(" + srcIndex + ");\n" +
                   "var p = L.toComp(L.anchorPoint);\n" +
                   "[p[0], p[1]];";
        }

        function parentTargetFor(src) {
            var mode = parentDrop.selection ? parentDrop.selection.index : 0;
            if (mode === 0) return src;
            if (mode === 1) return src.parent;   // may be null
            return null;
        }

        // ─── Main action ───────────────────────────────────────────────────
        function createRig() {
            var comp = activeComp();
            if (!comp) { setConsole("Open a composition first."); return; }

            var pins = collectPins(comp);
            if (pins.length === 0) {
                setConsole("No puppet pins found.\nSelect pins, or a layer with a Puppet effect.");
                return;
            }

            var groups  = groupByLayer(pins);
            var time    = comp.time;
            var prefix  = prefixField.text;
            var created = [];
            var skipped = 0;
            var failed  = 0;
            var has3D   = false;

            app.beginUndoGroup("anyPin - Create Nulls from Pins");
            try {
                for (var g = 0; g < groups.length; g++) {
                    var src = groups[g].layer;
                    if (src.threeDLayer) has3D = true;

                    var master = null;
                    if (masterCheck.value) {
                        master = makeNull(comp, prefix + src.name + " | Master");
                        if (!placeAtCompPoint(master, layerAnchorExpression(src.index), time)) {
                            master.remove();
                            master = null;
                            failed++;
                        }
                    }

                    for (var i = 0; i < groups[g].pins.length; i++) {
                        var pin = groups[g].pins[i];

                        if (pin.expression && pin.expression.indexOf(MARKER) !== -1) { skipped++; continue; }
                        if (!pin.canSetExpression) { failed++; continue; }

                        var pinName = pin.propertyGroup(1).name;
                        var value   = pin.valueAtTime(time, false);

                        var ctrl = makeNull(comp, prefix + src.name + " | " + pinName);
                        if (!placeAtCompPoint(ctrl, layerPointExpression(src.index, value[0], value[1]), time)) {
                            ctrl.remove();
                            failed++;
                            continue;
                        }

                        var target = master ? master : parentTargetFor(src);
                        if (target) ctrl.parent = target;

                        pin.expression = buildPinExpression(ctrl.name);
                        if (pin.expressionError !== "") {
                            pin.expression = "";
                            ctrl.remove();
                            failed++;
                            continue;
                        }

                        ctrl.moveBefore(src);
                        created.push(ctrl);
                    }

                    if (master) {
                        var masterTarget = parentTargetFor(src);
                        if (masterTarget) master.parent = masterTarget;
                        master.moveBefore(src);
                        created.push(master);
                    }
                }

                if (selectCheck.value && created.length > 0) {
                    for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
                    for (var c = 0; c < created.length; c++) created[c].selected = true;
                }
            } catch (err) {
                app.endUndoGroup();
                alert("anyPin error: " + err.toString() + (err.line ? "\nLine: " + err.line : ""));
                return;
            }
            app.endUndoGroup();

            var msg = created.length + " null" + (created.length === 1 ? "" : "s") + " created";
            if (skipped) msg += ", " + skipped + " already linked";
            if (failed)  msg += ", " + failed + " failed";
            if (has3D)   msg += "\nWarning: 3D source layer - linking may be inaccurate.";
            setConsole(msg);
            storeSettings();
        }

        // ─── Unlink ────────────────────────────────────────────────────────
        function unlinkRig() {
            var comp = activeComp();
            if (!comp) { setConsole("Open a composition first."); return; }

            var pins = collectPins(comp);
            if (pins.length === 0) { setConsole("No puppet pins found in selection."); return; }

            var names = [];
            var count = 0;
            var time  = comp.time;

            app.beginUndoGroup("anyPin - Unlink Pins");
            try {
                for (var i = 0; i < pins.length; i++) {
                    var pin  = pins[i];
                    var name = linkedNullName(pin);
                    if (name === null) continue;

                    // Bake the current, expression-driven position so the pin does not jump.
                    var value = pin.valueAtTime(time, false);
                    pin.expression = "";
                    if (pin.numKeys === 0) pin.setValue([value[0], value[1]]);

                    count++;
                    var known = false;
                    for (var n = 0; n < names.length; n++) { if (names[n] === name) { known = true; break; } }
                    if (!known) names.push(name);
                }
            } catch (err) {
                app.endUndoGroup();
                alert("anyPin error: " + err.toString());
                return;
            }
            app.endUndoGroup();

            if (count === 0) { setConsole("No anyPin links in selection."); return; }

            var removed = 0;
            if (names.length > 0 && confirm("Unlinked " + count + " pin" + (count === 1 ? "" : "s") +
                                            ".\nAlso delete the " + names.length + " control null" +
                                            (names.length === 1 ? "" : "s") + "?")) {
                app.beginUndoGroup("anyPin - Delete Control Nulls");
                for (var d = 0; d < names.length; d++) {
                    var lyr = findLayerByName(comp, names[d]);
                    if (lyr && lyr.comment === MARKER && !stillLinked(comp, names[d])) {
                        lyr.remove();
                        removed++;
                    }
                }
                app.endUndoGroup();
            }

            setConsole(count + " pin" + (count === 1 ? "" : "s") + " unlinked" +
                       (removed ? ", " + removed + " null" + (removed === 1 ? "" : "s") + " deleted" : "") + ".");
        }

        // True if any pin in the comp still drives off this null.
        function stillLinked(comp, nullName) {
            var all = [];
            for (var i = 1; i <= comp.numLayers; i++) pinsOfLayer(comp.layer(i), all);
            for (var p = 0; p < all.length; p++) {
                if (linkedNullName(all[p]) === nullName) return true;
            }
            return false;
        }

        // ─── Select linked nulls ───────────────────────────────────────────
        function selectNulls() {
            var comp = activeComp();
            if (!comp) { setConsole("Open a composition first."); return; }

            var pins = collectPins(comp);
            if (pins.length === 0) { setConsole("No puppet pins found in selection."); return; }

            var targets = [];
            for (var i = 0; i < pins.length; i++) {
                var name = linkedNullName(pins[i]);
                if (name === null) continue;
                var lyr = findLayerByName(comp, name);
                if (lyr) targets.push(lyr);
            }

            if (targets.length === 0) { setConsole("No linked nulls found."); return; }

            for (var d = 1; d <= comp.numLayers; d++) comp.layer(d).selected = false;
            for (var t = 0; t < targets.length; t++) targets[t].selected = true;
            setConsole(targets.length + " null" + (targets.length === 1 ? "" : "s") + " selected.");
        }

        // ─── Event handlers ────────────────────────────────────────────────
        createBtn.onClick = function() { createRig(); };
        unlinkBtn.onClick = function() { unlinkRig(); };
        selectBtn.onClick = function() { selectNulls(); };

        prefixField.onChange = sizeField.onChange = function() { storeSettings(); };
        labelDrop.onChange   = parentDrop.onChange = function() { storeSettings(); };
        masterCheck.onClick  = selectCheck.onClick = function() { storeSettings(); };

        // ─── Layout ────────────────────────────────────────────────────────
        myPanel.layout.layout(true);
        mainGrp.minimumSize = mainGrp.size;
        myPanel.layout.resize();
        myPanel.onResizing = myPanel.onResize = function() { this.layout.resize(); };

        return myPanel;
    }

    var myScriptPal = myScript_buildUI(thisObj);
    if (myScriptPal !== null && myScriptPal instanceof Window) {
        myScriptPal.center();
        myScriptPal.show();
    }
}
myScript(this);
}
