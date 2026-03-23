(function createUI(thisObj) {
    var SCRIPT_NAME = "Aldi Helper";
    var SCRIPT_VERSION = "v2.1.5";

    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, {resizeable: true});

    var mainGroup = panel.add("group", undefined);
    mainGroup.orientation = "column";
    mainGroup.alignment = ["fill", "fill"];

    // Version label
    var titleText = mainGroup.add("statictext", undefined, SCRIPT_VERSION);
    titleText.alignment = ["center", "top"];

    // Tabbed panel
    var tabs = mainGroup.add("tabbedpanel");
    tabs.alignment = ["fill", "fill"];

    // ─── General Tab ──────────────────────────────────────────────────────────

    var generalTab = tabs.add("tab", undefined, "General");
    generalTab.orientation = "column";
    generalTab.alignment = ["fill", "fill"];
    generalTab.alignChildren = ["center", "top"];

    var markerRevealButton = generalTab.add("button", undefined, "Marker Reveal");
    var popInButton        = generalTab.add("button", undefined, "Pop In");
    var easyMorphButton    = generalTab.add("button", undefined, "Easy Morph");
    var doohOffsetButton   = generalTab.add("button", undefined, "DOOH Offset");
    markerRevealButton.size = popInButton.size = easyMorphButton.size = doohOffsetButton.size = [120, 30];

    markerRevealButton.onClick = function() {
        app.beginUndoGroup("Marker Reveal Animation");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) { alert("Please select a composition"); return; }
            var sel = comp.selectedLayers;
            if (sel.length === 0) { alert("Please select at least one layer"); return; }
            createRevealAnimation(comp, sel);
        } catch (err) {
            alert("An error occurred: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    };

    popInButton.onClick = function() {
        app.beginUndoGroup("Pop In Animation");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) { alert("Please select a composition"); return; }
            var sel = comp.selectedLayers;
            if (sel.length === 0) { alert("Please select at least one layer"); return; }
            createPopInAnimation(comp, sel);
        } catch (err) {
            alert("An error occurred: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    };

    easyMorphButton.onClick = function() {
        app.beginUndoGroup("Easy Morph Animation");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) { alert("Please select a composition"); return; }
            var sel = comp.selectedLayers;
            if (sel.length !== 2) { alert("Please select exactly 2 layers"); return; }
            createEasyMorph(comp, sel);
        } catch (err) {
            alert("An error occurred: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    };

    doohOffsetButton.onClick = function() {
        app.beginUndoGroup("DOOH Offset");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) { alert("Please select a composition"); return; }
            var sel = comp.selectedLayers;
            if (sel.length === 0) { alert("Please select at least one layer"); return; }
            createDoohOffset(comp, sel);
        } catch (err) {
            alert("An error occurred: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    };

    // ─── Complex Morph Tab ────────────────────────────────────────────────────

    var morphTab = tabs.add("tab", undefined, "Complex Morph");
    morphTab.orientation = "column";
    morphTab.alignment = ["fill", "fill"];

    // Use an inner group for reliable margins/spacing across all AE versions
    var morphContent = morphTab.add("group");
    morphContent.orientation = "column";
    morphContent.alignment = ["fill", "fill"];
    morphContent.margins = 8;
    morphContent.spacing = 5;

    // groups stores { layers: [ {layer, compName, layerName}, ... ] } indexed by "small"/"big"
    // Each group holds 1-3 layer refs sorted by index (lowest index first)
    var groups = { "small": null, "big": null };
    var groupFields = {};
    var groupKeys = ["small", "big"];
    var groupLabels = { "small": "Kachel small", "big": "Kachel big" };

    var contentGroups = { "small": null, "big": null };
    var contentFields = {};
    var contentLabels = { "small": "Content small", "big": "Content big" };
    var coverData = null;
    var coverField = null;

    for (var k = 0; k < groupKeys.length; k++) {
        (function(key) {
            // ─── Kachel row ─────────────────────────────────────────────
            var kRow = morphContent.add("group");
            kRow.orientation = "row";
            kRow.alignment = ["fill", "top"];
            kRow.spacing = 4;

            kRow.add("statictext", undefined, groupLabels[key] + ":");

            var kFld = kRow.add("edittext", undefined, "");
            kFld.enabled = false;
            kFld.alignment = ["fill", "center"];
            groupFields[key] = kFld;

            var kBtn = kRow.add("button", undefined, "Set");
            kBtn.alignment = ["right", "center"];
            kBtn.preferredSize = [60, 24];

            kBtn.onClick = function() {
                var activeComp = app.project.activeItem;
                if (!activeComp || !(activeComp instanceof CompItem)) {
                    alert("Activate a composition first.");
                    return;
                }
                var count = activeComp.selectedLayers.length;
                if (count < 1 || count > 3) {
                    alert("Select 1, 2 or 3 layers for " + groupLabels[key] + ".");
                    return;
                }

                var sel = [];
                for (var i = 0; i < activeComp.selectedLayers.length; i++) {
                    sel.push(activeComp.selectedLayers[i]);
                }
                sel.sort(function(a, b) { return a.index - b.index; });

                groups[key] = [];
                var names = [];
                for (var i = 0; i < sel.length; i++) {
                    groups[key].push({
                        layer:     sel[i],
                        compName:  activeComp.name,
                        layerName: sel[i].name
                    });
                    names.push(sel[i].name);
                }
                kFld.text = "[" + count + "] " + names.join(" / ");
            };

            // ─── Content row (optional) ─────────────────────────────────
            var cRow = morphContent.add("group");
            cRow.orientation = "row";
            cRow.alignment = ["fill", "top"];
            cRow.spacing = 4;

            cRow.add("statictext", undefined, contentLabels[key] + ":");

            var cFld = cRow.add("edittext", undefined, "");
            cFld.enabled = false;
            cFld.alignment = ["fill", "center"];
            contentFields[key] = cFld;

            var cBtn = cRow.add("button", undefined, "Set");
            cBtn.alignment = ["right", "center"];
            cBtn.preferredSize = [60, 24];

            cBtn.onClick = function() {
                var activeComp = app.project.activeItem;
                if (!activeComp || !(activeComp instanceof CompItem)) {
                    alert("Activate a composition first.");
                    return;
                }
                var count = activeComp.selectedLayers.length;
                if (count < 1) {
                    alert("Select at least 1 layer for " + contentLabels[key] + ".");
                    return;
                }

                var sel = [];
                for (var i = 0; i < activeComp.selectedLayers.length; i++) {
                    sel.push(activeComp.selectedLayers[i]);
                }
                sel.sort(function(a, b) { return a.index - b.index; });

                contentGroups[key] = [];
                var names = [];
                for (var i = 0; i < sel.length; i++) {
                    contentGroups[key].push({
                        layer:     sel[i],
                        compName:  activeComp.name,
                        layerName: sel[i].name
                    });
                    names.push(sel[i].name);
                }
                cFld.text = "[" + count + "] " + names.join(" / ");
            };
        })(groupKeys[k]);
    }

    // ─── Cover layer field (optional) ───────────────────────────────────────

    var coverRow = morphContent.add("group");
    coverRow.orientation = "row";
    coverRow.alignment = ["fill", "top"];
    coverRow.spacing = 4;

    coverRow.add("statictext", undefined, "Cover layer:");

    coverField = coverRow.add("edittext", undefined, "");
    coverField.enabled = false;
    coverField.alignment = ["fill", "center"];

    var coverBtn = coverRow.add("button", undefined, "Set");
    coverBtn.alignment = ["right", "center"];
    coverBtn.preferredSize = [60, 24];

    coverBtn.onClick = function() {
        var activeComp = app.project.activeItem;
        if (!activeComp || !(activeComp instanceof CompItem)) {
            alert("Activate a composition first.");
            return;
        }
        if (activeComp.selectedLayers.length !== 1) {
            alert("Select exactly 1 layer for Cover.");
            return;
        }
        var sel = activeComp.selectedLayers[0];
        coverData = {
            layer:     sel,
            compName:  activeComp.name,
            layerName: sel.name
        };
        coverField.text = sel.name;
    };

    // ─── Reset / Apply ──────────────────────────────────────────────────────

    var resetBtn = morphContent.add("button", undefined, "Reset");
    resetBtn.alignment = ["right", "top"];
    resetBtn.preferredSize = [60, 22];
    resetBtn.onClick = function() {
        for (var i = 0; i < groupKeys.length; i++) {
            groups[groupKeys[i]] = null;
            groupFields[groupKeys[i]].text = "";
            contentGroups[groupKeys[i]] = null;
            contentFields[groupKeys[i]].text = "";
        }
        coverData = null;
        coverField.text = "";
    };

    morphContent.add("statictext", undefined, "Select matching solids in main comp:").alignment = ["fill", "top"];

    var applyMorphBtn = morphContent.add("button", undefined, "Apply Complex Morph");
    applyMorphBtn.alignment = ["fill", "bottom"];

    applyMorphBtn.onClick = function() {
        try {
            complexMorphSetupV2(groups, contentGroups, coverData);
        } catch (err) {
            alert("An error occurred: " + err.toString());
        }
    };

    // ─── Panel Setup ──────────────────────────────────────────────────────────

    panel.layout.layout(true);

    // TabbedPanel layout only measures the first (active) tab. Set an explicit
    // minimum size large enough to hold the Complex Morph tab content.
    tabs.minimumSize = [200, 340];
    mainGroup.minimumSize = mainGroup.size;

    panel.layout.resize();
    panel.onResizing = panel.onResize = function() {
        this.layout.resize();
    };

    if (!(thisObj instanceof Panel)) {
        panel.center();
        panel.show();
    }
})(this);

// ─── Shared helper functions (unchanged from V1) ──────────────────────────────

function getLayerSourceSize(layer) {
    var width = 0;
    var height = 0;
    if (layer.source && layer.source.width && layer.source.height) {
        width = layer.source.width;
        height = layer.source.height;
    } else {
        var rect = layer.sourceRectAtTime(0, false);
        width = rect.width;
        height = rect.height;
    }
    return [width, height];
}

function createEasyMorph(comp, selectedLayers) {
    if (comp.frameRate !== 25) {
        alert("Warning: Composition frame rate is " + comp.frameRate + " fps, not 25 fps");
    }

    var mainLayer, refLayer;
    if (selectedLayers[0].index < selectedLayers[1].index) {
        mainLayer = selectedLayers[0];
        refLayer  = selectedLayers[1];
    } else {
        mainLayer = selectedLayers[1];
        refLayer  = selectedLayers[0];
    }

    var currentTime   = comp.time;
    var frameDuration = comp.frameDuration;

    var forwardEndTime    = currentTime + (15 * frameDuration);
    var blendForwardStart = currentTime;
    var blendForwardEnd   = currentTime + (10 * frameDuration);
    var reverseStartTime  = currentTime + (25 * frameDuration);
    var reverseEndTime    = currentTime + (40 * frameDuration);
    var blendReverseStart = currentTime + (30 * frameDuration);
    var blendReverseEnd   = currentTime + (40 * frameDuration);

    var mainSize = getLayerSourceSize(mainLayer);
    var refSize  = getLayerSourceSize(refLayer);

    var mainPosition = mainLayer.property("Transform").property("Position");
    var refPosition  = refLayer.property("Transform").property("Position");
    var mainScale    = mainLayer.property("Transform").property("Scale");

    var mainPos = mainPosition.value;
    var refPos  = refPosition.value;

    var scaleX = (refSize[0] / mainSize[0]) * 100;
    var scaleY = (refSize[1] / mainSize[1]) * 100;

    var currentScale = mainScale.value;
    var refScale, mainScaleValue;
    if (currentScale.length === 3) {
        refScale       = [scaleX, scaleY, currentScale[2]];
        mainScaleValue = [100, 100, currentScale[2]];
    } else {
        refScale       = [scaleX, scaleY];
        mainScaleValue = [100, 100];
    }

    mainLayer.motionBlur = true;

    var easeIn  = new KeyframeEase(0, 66);
    var easeOut = new KeyframeEase(0, 44);

    mainPosition.setValueAtTime(currentTime, refPos);
    mainPosition.setValueAtTime(forwardEndTime, mainPos);
    var posKey1 = mainPosition.nearestKeyIndex(currentTime);
    var posKey2 = mainPosition.nearestKeyIndex(forwardEndTime);
    mainPosition.setTemporalEaseAtKey(posKey1, [easeIn], [easeOut]);
    mainPosition.setTemporalEaseAtKey(posKey2, [easeIn], [easeOut]);

    mainPosition.setValueAtTime(reverseStartTime, mainPos);
    mainPosition.setValueAtTime(reverseEndTime, refPos);
    var posKey3 = mainPosition.nearestKeyIndex(reverseStartTime);
    var posKey4 = mainPosition.nearestKeyIndex(reverseEndTime);
    mainPosition.setTemporalEaseAtKey(posKey3, [easeIn], [easeOut]);
    mainPosition.setTemporalEaseAtKey(posKey4, [easeIn], [easeOut]);

    mainScale.setValueAtTime(currentTime, refScale);
    mainScale.setValueAtTime(forwardEndTime, mainScaleValue);
    var scaleKey1       = mainScale.nearestKeyIndex(currentTime);
    var scaleKey2       = mainScale.nearestKeyIndex(forwardEndTime);
    var scaleDimensions = mainScale.value.length;
    if (scaleDimensions === 3) {
        mainScale.setTemporalEaseAtKey(scaleKey1, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
        mainScale.setTemporalEaseAtKey(scaleKey2, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
    } else {
        mainScale.setTemporalEaseAtKey(scaleKey1, [easeIn], [easeOut]);
        mainScale.setTemporalEaseAtKey(scaleKey2, [easeIn], [easeOut]);
    }

    mainScale.setValueAtTime(reverseStartTime, mainScaleValue);
    mainScale.setValueAtTime(reverseEndTime, refScale);
    var scaleKey3 = mainScale.nearestKeyIndex(reverseStartTime);
    var scaleKey4 = mainScale.nearestKeyIndex(reverseEndTime);
    if (scaleDimensions === 3) {
        mainScale.setTemporalEaseAtKey(scaleKey3, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
        mainScale.setTemporalEaseAtKey(scaleKey4, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
    } else {
        mainScale.setTemporalEaseAtKey(scaleKey3, [easeIn], [easeOut]);
        mainScale.setTemporalEaseAtKey(scaleKey4, [easeIn], [easeOut]);
    }

    var effects     = mainLayer.property("Effects");
    var blendEffect = effects.addProperty("ADBE Blend");
    blendEffect.property("ADBE Blend-0001").setValue(refLayer.index);
    blendEffect.property("ADBE Blend-0004").setValue(2);

    var blendWithOriginal = blendEffect.property("ADBE Blend-0003");
    blendWithOriginal.setValueAtTime(blendForwardStart, 0);
    blendWithOriginal.setValueAtTime(blendForwardEnd, 1);
    var blendKey1 = blendWithOriginal.nearestKeyIndex(blendForwardStart);
    var blendKey2 = blendWithOriginal.nearestKeyIndex(blendForwardEnd);
    blendWithOriginal.setInterpolationTypeAtKey(blendKey1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    blendWithOriginal.setInterpolationTypeAtKey(blendKey2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    blendWithOriginal.setTemporalEaseAtKey(blendKey1, [easeIn], [easeOut]);
    blendWithOriginal.setTemporalEaseAtKey(blendKey2, [easeIn], [easeOut]);

    blendWithOriginal.setValueAtTime(blendReverseStart, 1);
    blendWithOriginal.setValueAtTime(blendReverseEnd, 0);
    var blendKey3 = blendWithOriginal.nearestKeyIndex(blendReverseStart);
    var blendKey4 = blendWithOriginal.nearestKeyIndex(blendReverseEnd);
    blendWithOriginal.setInterpolationTypeAtKey(blendKey3, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    blendWithOriginal.setInterpolationTypeAtKey(blendKey4, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    blendWithOriginal.setTemporalEaseAtKey(blendKey3, [easeIn], [easeOut]);
    blendWithOriginal.setTemporalEaseAtKey(blendKey4, [easeIn], [easeOut]);

    refLayer.enabled = false;
}

function getLayerHeight(comp, layer) {
    if (layer.mask && layer.mask.numProperties > 0) {
        var shapeLayer = createShapeFromMask(comp, layer);
        var height = shapeLayer.sourceRectAtTime(comp.time, true).height;
        shapeLayer.remove();
        return height;
    } else {
        return layer.sourceRectAtTime(comp.time, false).height;
    }
}

function createPopInAnimation(comp, selectedLayers) {
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];
        layer.motionBlur = true;

        var currentTime   = comp.time;
        var frameDuration = comp.frameDuration;
        var forwardTime   = currentTime + (15 * frameDuration);
        var layerHeight   = getLayerHeight(comp, layer);

        var position = layer.property("Position");
        var endPos   = position.value;
        var startPos = [endPos[0], endPos[1] + (layerHeight * 2)];
        position.setValueAtTime(currentTime, startPos);
        position.setValueAtTime(forwardTime, endPos);

        var forwardKeyIndex  = position.nearestKeyIndex(forwardTime);
        var backwardKeyIndex = position.nearestKeyIndex(currentTime);
        var easeIn  = new KeyframeEase(0, 66);
        var easeOut = new KeyframeEase(0, 44);
        position.setTemporalEaseAtKey(forwardKeyIndex,  [easeIn], [easeOut]);
        position.setTemporalEaseAtKey(backwardKeyIndex, [easeIn], [easeOut]);

        var opacity = layer.property("Opacity");
        opacity.setValueAtTime(currentTime, 0);
        opacity.setValueAtTime(forwardTime, 100);
        forwardKeyIndex  = opacity.nearestKeyIndex(forwardTime);
        backwardKeyIndex = opacity.nearestKeyIndex(currentTime);
        opacity.setTemporalEaseAtKey(forwardKeyIndex,  [easeIn], [easeOut]);
        opacity.setTemporalEaseAtKey(backwardKeyIndex, [easeIn], [easeOut]);
    }
}

function createShapeFromMask(comp, layer) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = layer.name + " Shape";
    var masks = layer.mask;
    if (masks && masks.numProperties > 0) {
        for (var i = 1; i <= masks.numProperties; i++) {
            var maskPath  = masks.property(i).property("maskPath");
            var maskShape = maskPath.value;
            var shapeGroup = shapeLayer.property("Contents").addProperty("ADBE Vector Group");
            var shapePath  = shapeGroup.property("Contents").addProperty("ADBE Vector Shape - Group");
            shapePath.property("Path").setValue(maskShape);
            var fill = shapeGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
            fill.property("Color").setValue([1, 0, 0]);
        }
    }
    return shapeLayer;
}

function createRevealAnimation(comp, selectedLayers) {
    for (var i = 0; i < selectedLayers.length; i++) {
        var originalLayer = selectedLayers[i];
        var shapeLayer    = createShapeFromMask(comp, originalLayer);
        originalLayer.motionBlur = true;

        var duplicateLayer = originalLayer.duplicate();
        duplicateLayer.enabled = false;
        originalLayer.setTrackMatte(duplicateLayer, TrackMatteType.ALPHA);

        var currentTime   = comp.time;
        var layerWidth    = shapeLayer.sourceRectAtTime(currentTime, true).width;
        var position      = originalLayer.property("Position");
        var startPos      = position.value;
        var frameDuration = comp.frameDuration;
        var forwardTime   = currentTime + (15 * frameDuration);
        position.setValueAtTime(forwardTime, startPos);

        var endPos = [startPos[0] - (layerWidth * 1.1), startPos[1]];
        position.setValueAtTime(currentTime, endPos);

        var forwardKeyIndex  = position.nearestKeyIndex(forwardTime);
        var backwardKeyIndex = position.nearestKeyIndex(currentTime);
        var easeIn  = new KeyframeEase(0, 66);
        var easeOut = new KeyframeEase(0, 44);
        position.setTemporalEaseAtKey(forwardKeyIndex,  [easeIn], [easeOut]);
        position.setTemporalEaseAtKey(backwardKeyIndex, [easeIn], [easeOut]);

        shapeLayer.remove();
    }
}

// ─── Complex Morph V2 ─────────────────────────────────────────────────────────

function complexMorphSetupV2(groups, contentGroups, coverData) {
    // Validate kachel groups are captured
    if (!groups["small"] || !groups["big"]) {
        var missing = [];
        if (!groups["small"]) missing.push("Kachel small");
        if (!groups["big"])   missing.push("Kachel big");
        var msg = "Please capture all groups first.\n\nNot set:";
        for (var i = 0; i < missing.length; i++) msg += "\n  \u2022 " + missing[i];
        alert(msg);
        return;
    }

    // Validate kachel groups have the same number of layers
    var layerCount = groups["small"].length;
    if (groups["big"].length !== layerCount) {
        alert("Kachel layer count mismatch:\n  Kachel small: " + layerCount +
              " layers\n  Kachel big: " + groups["big"].length +
              " layers\n\nBoth groups must have the same number of layers.");
        return;
    }

    // Validate content groups if set (both must be set or both empty)
    var hasContent = contentGroups["small"] && contentGroups["big"];
    if ((contentGroups["small"] && !contentGroups["big"]) ||
        (!contentGroups["small"] && contentGroups["big"])) {
        alert("Both Content small and Content big must be set, or leave both empty.");
        return;
    }
    if (hasContent && contentGroups["small"].length !== contentGroups["big"].length) {
        alert("Content layer count mismatch:\n  Content small: " + contentGroups["small"].length +
              " layers\n  Content big: " + contentGroups["big"].length +
              " layers\n\nBoth groups must have the same number of layers.");
        return;
    }

    // Validate stored layer refs are still accessible (guards against deleted layers)
    var staleRefs = [];
    var checkSets = [
        { data: groups, labels: { "small": "Kachel small", "big": "Kachel big" } }
    ];
    if (hasContent) {
        checkSets.push({ data: contentGroups, labels: { "small": "Content small", "big": "Content big" } });
    }
    for (var s = 0; s < checkSets.length; s++) {
        var sides = ["small", "big"];
        for (var g = 0; g < sides.length; g++) {
            var grp = checkSets[s].data[sides[g]];
            for (var i = 0; i < grp.length; i++) {
                try { var testAccess = grp[i].layer.name; }
                catch (e) {
                    staleRefs.push(checkSets[s].labels[sides[g]] + " layer " + (i + 1) +
                        " (was: " + grp[i].compName + " / " + grp[i].layerName + ")");
                }
            }
        }
    }
    if (coverData) {
        try { var testAccess = coverData.layer.name; }
        catch (e) {
            staleRefs.push("Cover layer (was: " + coverData.compName + " / " + coverData.layerName + ")");
        }
    }
    if (staleRefs.length > 0) {
        var msg = "Some captured layers are no longer accessible. Please re-capture:";
        for (var i = 0; i < staleRefs.length; i++) msg += "\n  \u2022 " + staleRefs[i];
        alert(msg);
        return;
    }

    // Get solids from the current comp selection
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please activate the composition containing the solids.");
        return;
    }

    if (comp.selectedLayers.length !== layerCount) {
        alert("Please select exactly " + layerCount + " solid layer" + (layerCount > 1 ? "s" : "") +
              " in the active composition (matching the " + layerCount + " captured per Kachel group)." +
              "\n\nCurrently " + comp.selectedLayers.length + " selected.");
        return;
    }

    // Sort selected solids by layer index (top of stack = lowest index)
    var solids = [];
    for (var i = 0; i < comp.selectedLayers.length; i++) {
        solids.push(comp.selectedLayers[i]);
    }
    solids.sort(function(a, b) { return a.index - b.index; });

    // Validate cover matches a Kachel layer (by name+comp) or a selected solid (by reference)
    if (coverData) {
        var coverMatched = false;
        for (var i = 0; i < groups["small"].length && !coverMatched; i++) {
            if (coverData.compName === groups["small"][i].compName &&
                coverData.layerName === groups["small"][i].layerName) coverMatched = true;
        }
        for (var i = 0; i < groups["big"].length && !coverMatched; i++) {
            if (coverData.compName === groups["big"][i].compName &&
                coverData.layerName === groups["big"][i].layerName) coverMatched = true;
        }
        for (var i = 0; i < solids.length && !coverMatched; i++) {
            if (coverData.layer === solids[i]) coverMatched = true;
        }
        if (!coverMatched) {
            alert("Cover layer must be one of the Kachel layers or one of the selected layers.");
            return;
        }
    }

    // Timing
    var fd = comp.frameDuration;
    var t0 = 5;
    var t1 = t0 + 15 * fd;
    var t2 = t1 + 10 * fd;
    var t3 = t2 + 15 * fd;

    app.beginUndoGroup("Complex Morph Setup");
    try {
        var savedTime = comp.time;
        comp.time = t0;

        // ─── Process kachel layers ──────────────────────────────────────
        var anchors = []; // topmost layer ref per pair (for content placement)
        for (var i = 0; i < layerCount; i++) {
            var smallLayer = groups["small"][i].layer;
            var bigLayer   = groups["big"][i].layer;
            var solidLayer = solids[i];

            var smallHasMask = getReferenceMask(smallLayer) !== null;
            var bigHasMask   = getReferenceMask(bigLayer) !== null;

            if (smallHasMask && bigHasMask) {
                applyComplexMorphToColor(smallLayer, bigLayer, solidLayer, t0, t1, t2, t3);
                anchors.push(solidLayer);
            } else {
                if (!smallLayer.source || !bigLayer.source) {
                    throw new Error("Layers without masks must have a source to copy: " +
                        smallLayer.name + ", " + bigLayer.name);
                }

                var smallPos = smallLayer.property("Transform").property("Position").value;
                var bigPos   = bigLayer.property("Transform").property("Position").value;

                var copiedSmall = comp.layers.add(smallLayer.source);
                copiedSmall.name = smallLayer.name + " (morph ref)";
                copiedSmall.property("Transform").property("Position").setValue(smallPos);

                var copiedBig = comp.layers.add(bigLayer.source);
                copiedBig.name = bigLayer.name + " (morph ref)";
                copiedBig.property("Transform").property("Position").setValue(bigPos);

                copiedSmall.moveBefore(solidLayer);
                copiedBig.moveBefore(copiedSmall);

                solidLayer.enabled = false;
                createEasyMorph(comp, [copiedBig, copiedSmall]);
                anchors.push(copiedBig);
            }
        }

        // ─── Process content layers (optional) ─────────────────────────
        if (hasContent) {
            var contentCount = contentGroups["small"].length;
            // Reverse order preserves correct stacking (bottom-up insertion)
            for (var j = contentCount - 1; j >= 0; j--) {
                var cSmall = contentGroups["small"][j];
                var cBig   = contentGroups["big"][j];

                if (!cSmall.layer.source || !cBig.layer.source) {
                    throw new Error("Content layers must have a source: " +
                        cSmall.layerName + ", " + cBig.layerName);
                }

                var cSmallPos = cSmall.layer.property("Transform").property("Position").value;
                var cBigPos   = cBig.layer.property("Transform").property("Position").value;

                var copiedCSmall = comp.layers.add(cSmall.layer.source);
                copiedCSmall.name = cSmall.layerName + " (content ref)";
                copiedCSmall.property("Transform").property("Position").setValue(cSmallPos);

                var copiedCBig = comp.layers.add(cBig.layer.source);
                copiedCBig.name = cBig.layerName + " (content ref)";
                copiedCBig.property("Transform").property("Position").setValue(cBigPos);

                // Place relative to solids based on source index vs kachel indices
                var contentSrcIdx = cSmall.layer.index;
                var targetSolid = null;
                for (var k = 0; k < groups["small"].length; k++) {
                    if (groups["small"][k].layer.index < contentSrcIdx) {
                        targetSolid = solids[k];
                    }
                }

                if (targetSolid) {
                    // Content was below this kachel in source → below corresponding solid
                    copiedCSmall.moveAfter(targetSolid);
                    copiedCBig.moveBefore(copiedCSmall);
                } else {
                    // Content was above all kachels → above the topmost anchor
                    copiedCSmall.moveBefore(anchors[0]);
                    copiedCBig.moveBefore(copiedCSmall);
                }

                createEasyMorph(comp, [copiedCBig, copiedCSmall]);
            }
        }

        // ─── Process cover layer (optional) ────────────────────────────
        if (coverData) {
            applyCoverMorph(coverData, groups, solids, anchors, t0, t1, t2, t3);
        }

        app.endUndoGroup();
        comp.time = savedTime;
        alert("Complex Morph applied successfully!");
    } catch (e) {
        app.endUndoGroup();
        comp.time = savedTime;
        alert("Error: " + e.message + (e.line ? "\nLine: " + e.line : ""));
    }
}

function applyCoverMorph(coverData, groups, solids, anchors, t0, t1, t2, t3) {
    // Match cover to a kachel layer (by name+comp) or a selected solid (by reference)
    var matchIdx = -1;
    for (var i = 0; i < groups["small"].length && matchIdx === -1; i++) {
        if (coverData.compName === groups["small"][i].compName &&
            coverData.layerName === groups["small"][i].layerName) {
            matchIdx = i;
        }
    }
    for (var i = 0; i < groups["big"].length && matchIdx === -1; i++) {
        if (coverData.compName === groups["big"][i].compName &&
            coverData.layerName === groups["big"][i].layerName) {
            matchIdx = i;
        }
    }
    for (var i = 0; i < solids.length && matchIdx === -1; i++) {
        if (coverData.layer === solids[i]) {
            matchIdx = i;
        }
    }
    if (matchIdx === -1) {
        throw new Error("Cover layer must match one of the Kachel layers or selected solids.");
    }

    var companion = anchors[matchIdx];

    // Duplicate the animated layer
    var coverDup = companion.duplicate();
    coverDup.name = companion.name + " Cover";

    // Remove masks from duplicate (alpha matte handles clipping)
    var coverMasks = coverDup.mask;
    if (coverMasks) {
        while (coverMasks.numProperties > 0) {
            coverMasks.property(1).remove();
        }
    }

    // Remove effects from duplicate (e.g. blend from Easy Morph)
    var coverEffects = coverDup.property("Effects");
    while (coverEffects.numProperties > 0) {
        coverEffects.property(1).remove();
    }

    // Read the original anchor before changing it
    var origAnchor = companion.property("Transform").property("Anchor Point").value;

    // Set anchor to bottom-left of layer source
    var coverSize = getLayerSourceSize(coverDup);
    var coverH = coverSize[1];
    var newAnchor = [0, coverH];
    coverDup.property("Transform").property("Anchor Point").setValue(newAnchor);

    // Get kachel pair data for positioning
    var smallLayer  = groups["small"][matchIdx].layer;
    var bigLayer    = groups["big"][matchIdx].layer;
    var smallPos    = smallLayer.property("Transform").property("Position").value;
    var bigPos      = bigLayer.property("Transform").property("Position").value;
    var smallAnchor = smallLayer.property("Transform").property("Anchor Point").value;
    var smallSize   = getLayerSourceSize(smallLayer);
    var smallH      = smallSize[1];

    // Small state: cover bottom-left aligned with kachel small bottom-left
    var coverSmallPos = [
        smallPos[0] - smallAnchor[0],
        smallPos[1] - smallAnchor[1] + smallH
    ];

    // Big state: match exactly with original (compensate for anchor change)
    var coverBigPos = [
        bigPos[0] + newAnchor[0] - origAnchor[0],
        bigPos[1] + newAnchor[1] - origAnchor[1]
    ];

    // Clear existing position keyframes and set new ones
    var posProp = coverDup.property("Transform").property("Position");
    while (posProp.numKeys > 0) {
        posProp.removeKey(1);
    }

    posProp.setValueAtTime(t0, coverSmallPos);
    posProp.setValueAtTime(t1, coverBigPos);
    posProp.setValueAtTime(t2, coverBigPos);
    posProp.setValueAtTime(t3, coverSmallPos);

    var easeIn  = new KeyframeEase(0, 66);
    var easeOut = new KeyframeEase(0, 44);
    for (var k = 1; k <= posProp.numKeys; k++) {
        posProp.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        posProp.setTemporalEaseAtKey(k, [easeIn], [easeOut]);
    }

    // Clear scale keyframes and reset to 100%
    var scaleProp = coverDup.property("Transform").property("Scale");
    while (scaleProp.numKeys > 0) {
        scaleProp.removeKey(1);
    }
    var is3D = scaleProp.value.length === 3;
    scaleProp.setValue(is3D ? [100, 100, 100] : [100, 100]);

    // Place cover below companion and use original as alpha matte (AE 2025+)
    coverDup.moveAfter(companion);
    coverDup.setTrackMatte(companion, TrackMatteType.ALPHA);
}

function applyComplexMorphToColor(smallLayer, bigLayer, solidLayer, t0, t1, t2, t3) {
    var easeIn  = new KeyframeEase(0, 66);
    var easeOut = new KeyframeEase(0, 44);

    // --- Position keyframes ---
    // Note: position values are read from the PSD layers' own comp coordinate space.
    // This works correctly when all comps share the same canvas dimensions.
    var smallPos = smallLayer.property("Transform").property("Position").value;
    var bigPos   = bigLayer.property("Transform").property("Position").value;
    var posProp  = solidLayer.property("Transform").property("Position");

    // Clear any existing position keyframes
    while (posProp.numKeys > 0) {
        posProp.removeKey(1);
    }

    posProp.setValueAtTime(t0, smallPos);
    posProp.setValueAtTime(t1, bigPos);
    posProp.setValueAtTime(t2, bigPos);
    posProp.setValueAtTime(t3, smallPos);

    for (var i = 1; i <= posProp.numKeys; i++) {
        posProp.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        posProp.setTemporalEaseAtKey(i, [easeIn], [easeOut]);
    }

    // --- Mask path keyframes ---
    var smallMask = getReferenceMask(smallLayer);
    var bigMask   = getReferenceMask(bigLayer);

    if (!smallMask) throw new Error("No mask found on layer: " + smallLayer.name);
    if (!bigMask)   throw new Error("No mask found on layer: " + bigLayer.name);

    // Mask vertices are in each PSD layer's local coordinate space. The solid is
    // comp-size and may have a different anchor point, so we offset the vertices
    // by (solidAnchor - psdAnchor) so they land in the correct visual position.
    var solidAnchor = solidLayer.property("Transform").property("Anchor Point").value;
    var smallAnchor = smallLayer.property("Transform").property("Anchor Point").value;
    var bigAnchor   = bigLayer.property("Transform").property("Anchor Point").value;

    var smallOffset = [solidAnchor[0] - smallAnchor[0], solidAnchor[1] - smallAnchor[1]];
    var bigOffset   = [solidAnchor[0] - bigAnchor[0],   solidAnchor[1] - bigAnchor[1]];

    var smallShape = transformMaskShape(smallMask.property("maskPath").value, smallOffset);
    var bigShape   = transformMaskShape(bigMask.property("maskPath").value,   bigOffset);

    // Clear any masks the solid already has (prevents duplicates on re-run)
    var solidMasks = solidLayer.mask;
    while (solidMasks.numProperties > 0) {
        solidMasks.property(1).remove();
    }

    var newMask = solidMasks.addProperty("ADBE Mask Atom");
    if (!newMask) throw new Error("Failed to add mask to layer: " + solidLayer.name);
    newMask.maskMode = MaskMode.ADD;

    var maskShapeProp = newMask.property("maskPath");
    maskShapeProp.setValueAtTime(t0, smallShape);
    maskShapeProp.setValueAtTime(t1, bigShape);
    maskShapeProp.setValueAtTime(t2, bigShape);
    maskShapeProp.setValueAtTime(t3, smallShape);

    for (var i = 1; i <= maskShapeProp.numKeys; i++) {
        maskShapeProp.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        maskShapeProp.setTemporalEaseAtKey(i, [easeIn], [easeOut]);
    }
}

function transformMaskShape(shape, offset) {
    if (offset[0] === 0 && offset[1] === 0) return shape;
    var newVertices = [];
    for (var i = 0; i < shape.vertices.length; i++) {
        newVertices.push([shape.vertices[i][0] + offset[0], shape.vertices[i][1] + offset[1]]);
    }
    var newShape = new Shape();
    newShape.vertices   = newVertices;
    newShape.inTangents  = shape.inTangents;
    newShape.outTangents = shape.outTangents;
    newShape.closed      = shape.closed;
    return newShape;
}

function getReferenceMask(layer) {
    var masks = layer.mask;
    if (!masks || masks.numProperties === 0) return null;
    for (var i = 1; i <= masks.numProperties; i++) {
        var mask = masks.property(i);
        if (mask.maskMode === MaskMode.NONE) return mask;
    }
    return masks.property(1);
}

// ─────────────────────────────────────────────────────────────────────────────

function createDoohOffset(comp, selectedLayers) {
    var sortedLayers = selectedLayers.slice().sort(function(a, b) {
        var posA = a.property("Position").value;
        var posB = b.property("Position").value;
        if (posA[0] === posB[0]) return posB[1] - posA[1];
        return posA[0] - posB[0];
    });

    var expression = '// Get target position (the position keyframes/value set on the layer)\n' +
        'var targetPos = value;\n' +
        '// Get null object references\n' +
        'var easeIn = thisComp.layer("Ease-In").position;\n' +
        'var easeOut = thisComp.layer("Ease-Out").position;\n' +
        '// Get animation durations by finding time between first and second keyframe of each null\n' +
        'var inDuration = 0;\n' +
        'var outDuration = 0;\n' +
        'if (easeIn.numKeys >= 2) {\n' +
        '    inDuration = easeIn.key(2).time - easeIn.key(1).time;\n' +
        '}\n' +
        'if (easeOut.numKeys >= 2) {\n' +
        '    outDuration = easeOut.key(2).time - easeOut.key(1).time;\n' +
        '}\n' +
        '// Calculate in/out times\n' +
        'var inStart = inPoint;\n' +
        'var outStart = outPoint - outDuration;\n' +
        'if (time < inStart + inDuration) {\n' +
        '    // In animation - offset the Ease-In null\'s animation to our inPoint\n' +
        '    var inValue = easeIn.valueAtTime(time - inStart);\n' +
        '    [targetPos[0] + (inValue[0]), targetPos[1]];\n' +
        '} else if (time > outStart) {\n' +
        '    // Out animation - offset the Ease-Out null\'s animation to our outPoint - outDuration\n' +
        '    var outValue = easeOut.valueAtTime(time - outStart);\n' +
        '    [targetPos[0] + (outValue[0]), targetPos[1]];\n' +
        '} else {\n' +
        '    // Hold at target position\n' +
        '    targetPos;\n' +
        '}';

    var lastXPos    = null;
    var frameOffset = 0;
    var subOffset   = 0;

    for (var i = 0; i < sortedLayers.length; i++) {
        var layer      = sortedLayers[i];
        var currentPos = layer.property("Position").value;
        layer.property("Position").expression = expression;

        if (i === 0) { lastXPos = currentPos[0]; continue; }

        if (currentPos[0] !== lastXPos) {
            frameOffset += 2;
            subOffset    = 0;
            lastXPos     = currentPos[0];
        } else {
            subOffset += 1;
        }

        var totalOffset = frameOffset - subOffset;
        if (totalOffset > 0) {
            layer.startTime += (totalOffset * comp.frameDuration);
        }
    }
}
