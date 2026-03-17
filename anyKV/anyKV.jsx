{
var SCRIPT_VERSION = "v1.0.1";

function myScript(thisObj) {
    function myScript_buildUI(thisObject) {
        var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "anyKV", undefined, {resizeable: true});

        var PREF_SECTION    = "anyKV";
        var DEFAULT_PRESET  = "50/50";

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

        function loadCustomPresets() {
            var raw = loadPref("presets", "");
            if (raw === "") return [];
            return raw.split("|");
        }

        function saveCustomPresets(presets) {
            savePref("presets", presets.join("|"));
        }

        // ─── UI ───────────────────────────────────────────────────────────
        var mainGrp = myPanel.add("group");
        mainGrp.orientation    = "column";
        mainGrp.alignment      = ["fill", "fill"];
        mainGrp.alignChildren  = ["fill", "top"];
        mainGrp.spacing        = 6;
        mainGrp.margins        = 8;

        // Title
        var titleText = mainGrp.add("statictext", undefined, "anyKeyframeVelocity " + SCRIPT_VERSION);
        titleText.alignment = ["center", "top"];

        // Presets row
        var presetsRow = mainGrp.add("group");
        presetsRow.orientation = "row";
        presetsRow.alignment   = ["fill", "top"];
        presetsRow.spacing     = 4;

        var presetDrop = presetsRow.add("dropdownlist", undefined, [DEFAULT_PRESET]);
        presetDrop.alignment = ["fill", "center"];
        presetDrop.selection = 0;

        var addPresetBtn = presetsRow.add("button", undefined, "+");
        addPresetBtn.preferredSize = [26, 22];

        var delPresetBtn = presetsRow.add("button", undefined, "-");
        delPresetBtn.preferredSize = [26, 22];

        // Inputs row
        var inputRow = mainGrp.add("group");
        inputRow.orientation   = "row";
        inputRow.alignment     = ["fill", "top"];
        inputRow.alignChildren = ["center", "bottom"];
        inputRow.spacing       = 4;

        var inGrp = inputRow.add("group");
        inGrp.orientation = "column";
        inGrp.alignment   = ["fill", "top"];
        inGrp.spacing     = 2;
        inGrp.add("statictext", undefined, "In Influence").alignment = ["center", "top"];
        var inField = inGrp.add("edittext", undefined, "50");
        inField.alignment     = ["fill", "top"];
        inField.justify       = "center";
        inField.preferredSize = [80, -1];

        var swapBtn = inputRow.add("button", undefined, "<->");
        swapBtn.alignment     = ["center", "bottom"];
        swapBtn.preferredSize = [42, 22];

        var outGrp = inputRow.add("group");
        outGrp.orientation = "column";
        outGrp.alignment   = ["fill", "top"];
        outGrp.spacing     = 2;
        outGrp.add("statictext", undefined, "Out Influence").alignment = ["center", "top"];
        var outField = outGrp.add("edittext", undefined, "");
        outField.alignment     = ["fill", "top"];
        outField.justify       = "center";
        outField.preferredSize = [80, -1];

        // Buttons row
        var btnsRow = mainGrp.add("group");
        btnsRow.orientation = "row";
        btnsRow.alignment   = ["center", "top"];
        btnsRow.spacing     = 4;

        var checkBtn = btnsRow.add("button", undefined, "Check");
        checkBtn.preferredSize = [60, -1];
        var applyBtn = btnsRow.add("button", undefined, "Apply");
        applyBtn.preferredSize = [60, -1];
        var copyBtn  = btnsRow.add("button", undefined, "Copy");
        copyBtn.preferredSize  = [60, -1];

        // Console
        var consoleTxt = mainGrp.add("statictext", undefined, "");
        consoleTxt.alignment     = ["center", "top"];
        consoleTxt.justify       = "center";
        consoleTxt.preferredSize = [220, 20];

        // ─── Init from prefs ───────────────────────────────────────────────
        var customPresets = loadCustomPresets();
        inField.text  = loadPref("lastIn",  "50");
        outField.text = loadPref("lastOut", "");

        for (var ci = 0; ci < customPresets.length; ci++) {
            presetDrop.add("item", customPresets[ci]);
        }
        presetDrop.selection = 0;

        // ─── UI helpers ────────────────────────────────────────────────────
        function setConsole(text, delay) {
            delay = delay || 700;
            consoleTxt.text = text;
            $.sleep(delay);
            consoleTxt.text = "";
        }

        function effectiveOut() {
            return (outField.text === "") ? inField.text : outField.text;
        }

        // ─── AE helpers ────────────────────────────────────────────────────
        function countNumKeys() {
            var props = app.project.activeItem.selectedProperties;
            var keys  = 0;
            for (var i = 0; i < props.length; i++) {
                keys += props[i].selectedKeys.length;
            }
            return keys;
        }

        function notifyIfNoKeys() {
            try {
                if (app.project.activeItem.selectedProperties[0].selectedKeys.length < 1) {
                    setConsole("No keyframes selected...");
                }
            } catch (e) {
                setConsole("No keyframes selected...");
            }
        }

        function setKeyInfluences(influenceIn, influenceOut) {
            app.beginUndoGroup("change Keyframe Velocity");
            var props = app.project.activeItem.selectedProperties;
            if (influenceOut === "") influenceOut = influenceIn;

            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                if (prop.numKeys !== undefined) {
                    for (var a = 0; a < prop.selectedKeys.length; a++) {
                        var ki   = prop.selectedKeys[a];
                        prop.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                        var eIn  = new KeyframeEase(0, influenceIn);
                        var eOut = new KeyframeEase(0, influenceOut);
                        var len  = prop.keyInTemporalEase(ki).length;
                        if (len === 1) {
                            prop.setTemporalEaseAtKey(ki, [eIn], [eOut]);
                        } else if (len === 2) {
                            prop.setTemporalEaseAtKey(ki, [eIn, eIn], [eOut, eOut]);
                        } else if (len === 3) {
                            prop.setTemporalEaseAtKey(ki, [eIn, eIn, eIn], [eOut, eOut, eOut]);
                        }
                    }
                }
            }

            if (countNumKeys() > 0) {
                setConsole(countNumKeys() + " keyframes changed");
            }
            notifyIfNoKeys();
            app.endUndoGroup();

            savePref("lastIn",  influenceIn);
            savePref("lastOut", (influenceOut === influenceIn) ? "" : influenceOut);
        }

        function getKeyInfluence() {
            var props = app.project.activeItem.selectedProperties;
            if (props.length > 1) {
                alert("Error...\nYou can only select one property at a time for this.");
                return null;
            }
            if (props[0].selectedKeys.length > 1) {
                alert("Error...\nYou can only select one keyframe at a time for this.");
                return null;
            }
            var prop = props[0];
            var ki   = prop.selectedKeys[0];
            return [prop.keyInTemporalEase(ki)[0].influence, prop.keyOutTemporalEase(ki)[0].influence];
        }

        // ─── Event handlers ────────────────────────────────────────────────
        presetDrop.onChange = function() {
            if (!presetDrop.selection) return;
            var parts = presetDrop.selection.text.split("/");
            if (parts.length === 2) {
                inField.text  = parts[0];
                outField.text = (parts[0] === parts[1]) ? "" : parts[1];
                savePref("lastIn", inField.text);
                savePref("lastOut", outField.text);
            }
        };

        addPresetBtn.onClick = function() {
            var inVal  = inField.text;
            var outVal = effectiveOut();
            var label  = inVal + "/" + outVal;
            if (label === DEFAULT_PRESET) { setConsole("50/50 is always available."); return; }
            for (var i = 0; i < customPresets.length; i++) {
                if (customPresets[i] === label) { setConsole("Already exists as preset."); return; }
            }
            customPresets.push(label);
            presetDrop.add("item", label);
            presetDrop.selection = presetDrop.items.length - 1;
            saveCustomPresets(customPresets);
            setConsole("Saved: " + label, 500);
        };

        delPresetBtn.onClick = function() {
            if (!presetDrop.selection) return;
            var idx = presetDrop.selection.index;
            if (idx === 0) { setConsole("Cannot remove 50/50."); return; }
            var removed = presetDrop.selection.text;
            presetDrop.remove(idx);
            customPresets.splice(idx - 1, 1);
            presetDrop.selection = Math.max(0, idx - 1);
            saveCustomPresets(customPresets);
            setConsole("Removed: " + removed, 500);
        };

        swapBtn.onClick = function() {
            var inVal  = inField.text;
            var outVal = effectiveOut();
            if (inVal === outVal) return;
            inField.text  = outVal;
            outField.text = inVal;
            savePref("lastIn", outVal);
            savePref("lastOut", inVal);
        };

        applyBtn.onClick = function() {
            setKeyInfluences(inField.text, outField.text);
        };

        checkBtn.onClick = function() {
            notifyIfNoKeys();
            var easing = getKeyInfluence();
            if (easing) setConsole("Easing: " + easing[0] + "/" + easing[1]);
        };

        copyBtn.onClick = function() {
            notifyIfNoKeys();
            var easing = getKeyInfluence();
            if (!easing) return;
            inField.text  = easing[0];
            outField.text = (easing[0] === easing[1]) ? "" : easing[1];
            savePref("lastIn", inField.text);
            savePref("lastOut", outField.text);
            setConsole("Easing copied...");
        };

        myPanel.addEventListener("keydown", function(e) {
            if (e.keyName === "Enter") {
                setKeyInfluences(inField.text, outField.text);
            }
        });

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
