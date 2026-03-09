(function createUI(thisObj) {
    var SCRIPT_NAME = "Aldi Helper";
    var SCRIPT_VERSION = "v2.0.1";

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

    // layerRefs stores { layer: AVLayer, compName: string, layerName: string }
    var layerRefs = {};
    var fieldRefs = {};
    var layerKeys = ["white small", "red small", "blue small", "white big", "red big", "blue big"];

    for (var k = 0; k < layerKeys.length; k++) {
        (function(key) {
            var row = morphContent.add("group");
            row.orientation = "row";
            row.alignment = ["fill", "top"];
            row.spacing = 4;

            var lbl = row.add("statictext", undefined, key + ":");

            var fld = row.add("edittext", undefined, "");
            fld.enabled = false;
            fld.alignment = ["fill", "center"];
            fieldRefs[key] = fld;

            var btn = row.add("button", undefined, "Set");
            btn.alignment = ["right", "center"];
            btn.preferredSize = [60, 24];

            btn.onClick = function() {
                var activeComp = app.project.activeItem;
                if (!activeComp || !(activeComp instanceof CompItem)) {
                    alert("Activate a composition first.");
                    return;
                }
                if (activeComp.selectedLayers.length === 0) {
                    alert("Select a layer in the active composition.");
                    return;
                }
                var layer = activeComp.selectedLayers[0];
                layerRefs[key] = {
                    layer:     layer,
                    compName:  activeComp.name,
                    layerName: layer.name
                };
                fld.text = activeComp.name + " / " + layer.name;
            };
        })(layerKeys[k]);
    }

    var resetBtn = morphContent.add("button", undefined, "Reset");
    resetBtn.alignment = ["right", "top"];
    resetBtn.preferredSize = [60, 22];
    resetBtn.onClick = function() {
        for (var i = 0; i < layerKeys.length; i++) {
            layerRefs[layerKeys[i]] = undefined;
            fieldRefs[layerKeys[i]].text = "";
        }
    };

    morphContent.add("statictext", undefined, "Select 3 solids in main comp, then:").alignment = ["fill", "top"];

    var applyMorphBtn = morphContent.add("button", undefined, "Apply Complex Morph");
    applyMorphBtn.alignment = ["fill", "bottom"];

    applyMorphBtn.onClick = function() {
        try {
            complexMorphSetupV2(layerRefs);
        } catch (err) {
            alert("An error occurred: " + err.toString());
        }
    };

    // ─── Panel Setup ──────────────────────────────────────────────────────────

    panel.layout.layout(true);

    // TabbedPanel layout only measures the first (active) tab. Set an explicit
    // minimum size large enough to hold the Complex Morph tab's 6 capture rows.
    tabs.minimumSize = [200, 260];
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

function complexMorphSetupV2(layerRefs) {
    var layerKeys = ["white small", "red small", "blue small", "white big", "red big", "blue big"];

    // Validate all 6 refs are captured
    var notSet = [];
    for (var i = 0; i < layerKeys.length; i++) {
        if (!layerRefs[layerKeys[i]]) notSet.push(layerKeys[i]);
    }
    if (notSet.length > 0) {
        var msg = "Please capture all 6 reference layers first.\n\nNot set:";
        for (var i = 0; i < notSet.length; i++) msg += "\n  \u2022 " + notSet[i];
        alert(msg);
        return;
    }

    // Validate stored layer refs are still accessible (guards against deleted layers)
    var staleRefs = [];
    for (var i = 0; i < layerKeys.length; i++) {
        try {
            var testAccess = layerRefs[layerKeys[i]].layer.name;
        } catch (e) {
            staleRefs.push(layerKeys[i] + " (was: " + layerRefs[layerKeys[i]].compName + " / " + layerRefs[layerKeys[i]].layerName + ")");
        }
    }
    if (staleRefs.length > 0) {
        var msg = "Some captured layers are no longer accessible. Please re-capture:";
        for (var i = 0; i < staleRefs.length; i++) msg += "\n  \u2022 " + staleRefs[i];
        alert(msg);
        return;
    }

    // Get solids from current comp selection
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please activate the composition containing the solids.");
        return;
    }

    var selectedLayers = comp.selectedLayers;
    var SOLID_NAMES    = ["white solid", "red solid", "blue solid"];

    if (selectedLayers.length !== 3) {
        var msg = "Please select exactly 3 layers:\n  \u2022 white solid\n  \u2022 red solid\n  \u2022 blue solid\n\n(currently " + selectedLayers.length + " selected)";
        alert(msg);
        return;
    }

    var layerMap = {};
    var extra    = [];
    for (var i = 0; i < selectedLayers.length; i++) {
        var layerName = selectedLayers[i].name;
        var isExpected = false;
        for (var j = 0; j < SOLID_NAMES.length; j++) {
            if (SOLID_NAMES[j] === layerName) { isExpected = true; break; }
        }
        if (isExpected) layerMap[layerName] = selectedLayers[i];
        else extra.push(layerName);
    }

    var missing = [];
    for (var i = 0; i < SOLID_NAMES.length; i++) {
        if (!layerMap[SOLID_NAMES[i]]) missing.push(SOLID_NAMES[i]);
    }

    if (missing.length > 0 || extra.length > 0) {
        var msg = "Selection must be exactly: white solid, red solid, blue solid.";
        if (missing.length > 0) {
            msg += "\n\nMissing:";
            for (var i = 0; i < missing.length; i++) msg += "\n  \u2022 " + missing[i];
        }
        if (extra.length > 0) {
            msg += "\n\nUnexpected:";
            for (var i = 0; i < extra.length; i++) msg += "\n  \u2022 " + extra[i];
        }
        alert(msg);
        return;
    }

    // t0 = 5 seconds (hardcoded start point, same as V1)
    var fd = comp.frameDuration;
    var t0 = 5;
    var t1 = t0 + 15 * fd;
    var t2 = t1 + 10 * fd;
    var t3 = t2 + 15 * fd;

    app.beginUndoGroup("Complex Morph Setup");
    try {
        var colors = ["white", "red", "blue"];
        for (var c = 0; c < colors.length; c++) {
            var col = colors[c];
            applyComplexMorphToColor(
                layerRefs[col + " small"].layer,
                layerRefs[col + " big"].layer,
                layerMap[col + " solid"],
                t0, t1, t2, t3
            );
        }

        app.endUndoGroup();
        alert("Complex Morph applied successfully!");
    } catch (e) {
        app.endUndoGroup();
        alert("Error: " + e.message + (e.line ? "\nLine: " + e.line : ""));
    }
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
