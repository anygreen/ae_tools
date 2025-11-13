(function createUI(thisObj) {
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Aldi Helper v0.7", undefined, {resizeable: true});

    // Create main group wrapper
    var mainGroup = panel.add("group", undefined);
    mainGroup.orientation = "column";
    mainGroup.alignment = ["fill", "fill"];

    // Create buttons
    var markerRevealButton = mainGroup.add("button", undefined, "Marker Reveal");
    var popInButton = mainGroup.add("button", undefined, "Pop In");
    var easyMorphButton = mainGroup.add("button", undefined, "Easy Morph");
    markerRevealButton.size = popInButton.size = easyMorphButton.size = [120, 30];

    markerRevealButton.onClick = function() {
        app.beginUndoGroup("Marker Reveal Animation");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select a composition");
                return;
            }

            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                alert("Please select at least one layer");
                return;
            }

            createRevealAnimation(comp, selectedLayers);

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
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select a composition");
                return;
            }

            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                alert("Please select at least one layer");
                return;
            }

            createPopInAnimation(comp, selectedLayers);

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
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select a composition");
                return;
            }

            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length !== 2) {
                alert("Please select exactly 2 layers");
                return;
            }

            createEasyMorph(comp, selectedLayers);

        } catch (err) {
            alert("An error occurred: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    };

    var doohOffsetButton = mainGroup.add("button", undefined, "DOOH Offset");
    doohOffsetButton.size = [120, 30];

    doohOffsetButton.onClick = function() {
        app.beginUndoGroup("DOOH Offset");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select a composition");
                return;
            }

            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                alert("Please select at least one layer");
                return;
            }

            createDoohOffset(comp, selectedLayers);

        } catch (err) {
            alert("An error occurred: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    };

    // Setup Panel Sizing
    panel.layout.layout(true);
    mainGroup.minimumSize = mainGroup.size;

    // Make the panel resizeable
    panel.layout.resize();
    panel.onResizing = panel.onResize = function() {
        this.layout.resize();
    };

    if (!(thisObj instanceof Panel)) {
        panel.center();
        panel.show();
    }
})(this);

function getLayerSourceSize(layer) {
    // Get the actual source footage dimensions
    var width = 0;
    var height = 0;

    if (layer.source && layer.source.width && layer.source.height) {
        width = layer.source.width;
        height = layer.source.height;
    } else {
        // Fallback to sourceRectAtTime if no source available
        var rect = layer.sourceRectAtTime(0, false);
        width = rect.width;
        height = rect.height;
    }

    return [width, height];
}

function createEasyMorph(comp, selectedLayers) {
    // Check comp fps
    if (comp.frameRate !== 25) {
        alert("Warning: Composition frame rate is " + comp.frameRate + " fps, not 25 fps");
    }

    // Determine main and ref layers based on index
    var mainLayer, refLayer;
    if (selectedLayers[0].index < selectedLayers[1].index) {
        mainLayer = selectedLayers[0];
        refLayer = selectedLayers[1];
    } else {
        mainLayer = selectedLayers[1];
        refLayer = selectedLayers[0];
    }

    // Get current time
    var currentTime = comp.time;
    var frameDuration = comp.frameDuration;

    // Timeline:
    // 0-15: Forward animation (position/scale)
    // 0-10: Forward blend (10 frames, starts at 0)
    // 15-25: Hold (10 frames)
    // 25-40: Reverse animation (position/scale)
    // 30-40: Reverse blend (10 frames, starts 5 frames in)

    var forwardEndTime = currentTime + (15 * frameDuration);
    var blendForwardStart = currentTime;
    var blendForwardEnd = currentTime + (10 * frameDuration);

    var reverseStartTime = currentTime + (25 * frameDuration);
    var reverseEndTime = currentTime + (40 * frameDuration);
    var blendReverseStart = currentTime + (30 * frameDuration);
    var blendReverseEnd = currentTime + (40 * frameDuration);

    // Get actual source dimensions
    var mainSize = getLayerSourceSize(mainLayer);
    var refSize = getLayerSourceSize(refLayer);

    // Get current positions
    var mainPosition = mainLayer.property("Transform").property("Position");
    var refPosition = refLayer.property("Transform").property("Position");
    var mainScale = mainLayer.property("Transform").property("Scale");

    var mainPos = mainPosition.value;
    var refPos = refPosition.value;

    // Calculate scale needed to match ref size
    var scaleX = (refSize[0] / mainSize[0]) * 100;
    var scaleY = (refSize[1] / mainSize[1]) * 100;

    // Check if layer is 3D and preserve Z scale
    var currentScale = mainScale.value;
    var refScale, mainScaleValue;
    if (currentScale.length === 3) {
        // 3D layer - preserve Z value
        refScale = [scaleX, scaleY, currentScale[2]];
        mainScaleValue = [100, 100, currentScale[2]];
    } else {
        // 2D layer
        refScale = [scaleX, scaleY];
        mainScaleValue = [100, 100];
    }

    // Enable motion blur on main layer
    mainLayer.motionBlur = true;

    // Create easing objects (66% incoming, 44% outgoing)
    var easeIn = new KeyframeEase(0, 66);
    var easeOut = new KeyframeEase(0, 44);

    // FORWARD ANIMATION: Position
    mainPosition.setValueAtTime(currentTime, refPos);
    mainPosition.setValueAtTime(forwardEndTime, mainPos);

    var posKey1 = mainPosition.nearestKeyIndex(currentTime);
    var posKey2 = mainPosition.nearestKeyIndex(forwardEndTime);
    mainPosition.setTemporalEaseAtKey(posKey1, [easeIn], [easeOut]);
    mainPosition.setTemporalEaseAtKey(posKey2, [easeIn], [easeOut]);

    // REVERSE ANIMATION: Position
    mainPosition.setValueAtTime(reverseStartTime, mainPos);
    mainPosition.setValueAtTime(reverseEndTime, refPos);

    var posKey3 = mainPosition.nearestKeyIndex(reverseStartTime);
    var posKey4 = mainPosition.nearestKeyIndex(reverseEndTime);
    mainPosition.setTemporalEaseAtKey(posKey3, [easeIn], [easeOut]);
    mainPosition.setTemporalEaseAtKey(posKey4, [easeIn], [easeOut]);

    // FORWARD ANIMATION: Scale
    mainScale.setValueAtTime(currentTime, refScale);
    mainScale.setValueAtTime(forwardEndTime, mainScaleValue);

    var scaleKey1 = mainScale.nearestKeyIndex(currentTime);
    var scaleKey2 = mainScale.nearestKeyIndex(forwardEndTime);

    // Check if scale is 3D (has 3 dimensions) and apply appropriate easing
    var scaleDimensions = mainScale.value.length;
    if (scaleDimensions === 3) {
        // 3D scale (X, Y, Z)
        mainScale.setTemporalEaseAtKey(scaleKey1, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
        mainScale.setTemporalEaseAtKey(scaleKey2, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
    } else {
        // 2D scale (X, Y)
        mainScale.setTemporalEaseAtKey(scaleKey1, [easeIn], [easeOut]);
        mainScale.setTemporalEaseAtKey(scaleKey2, [easeIn], [easeOut]);
    }

    // REVERSE ANIMATION: Scale
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

    // Add Blend effect to main layer
    var effects = mainLayer.property("Effects");
    var blendEffect = effects.addProperty("ADBE Blend");

    // Set "Blend With Layer" to reference layer
    var blendWithLayer = blendEffect.property("ADBE Blend-0001");
    blendWithLayer.setValue(refLayer.index);

    // Set "If Layer Sizes Differ" to "Stretch to fit" (value 2)
    var ifLayerSizesDiffer = blendEffect.property("ADBE Blend-0004");
    ifLayerSizesDiffer.setValue(2);

    // FORWARD ANIMATION: Blend (10 frames duration, starts at 0)
    var blendWithOriginal = blendEffect.property("ADBE Blend-0003");
    blendWithOriginal.setValueAtTime(blendForwardStart, 0);
    blendWithOriginal.setValueAtTime(blendForwardEnd, 1);

    var blendKey1 = blendWithOriginal.nearestKeyIndex(blendForwardStart);
    var blendKey2 = blendWithOriginal.nearestKeyIndex(blendForwardEnd);

    // Set interpolation type to bezier first
    blendWithOriginal.setInterpolationTypeAtKey(blendKey1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    blendWithOriginal.setInterpolationTypeAtKey(blendKey2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

    // Now apply easing - for 1D properties, need array with 1 element
    blendWithOriginal.setTemporalEaseAtKey(blendKey1, [easeIn], [easeOut]);
    blendWithOriginal.setTemporalEaseAtKey(blendKey2, [easeIn], [easeOut]);

    // REVERSE ANIMATION: Blend (starts 5 frames in, 10 frames duration)
    blendWithOriginal.setValueAtTime(blendReverseStart, 1);
    blendWithOriginal.setValueAtTime(blendReverseEnd, 0);

    var blendKey3 = blendWithOriginal.nearestKeyIndex(blendReverseStart);
    var blendKey4 = blendWithOriginal.nearestKeyIndex(blendReverseEnd);

    // Set interpolation type to bezier first
    blendWithOriginal.setInterpolationTypeAtKey(blendKey3, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    blendWithOriginal.setInterpolationTypeAtKey(blendKey4, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

    // Now apply easing
    blendWithOriginal.setTemporalEaseAtKey(blendKey3, [easeIn], [easeOut]);
    blendWithOriginal.setTemporalEaseAtKey(blendKey4, [easeIn], [easeOut]);

    // Hide the reference layer
    refLayer.enabled = false;
}

function getLayerHeight(comp, layer) {
    // Check if layer has masks
    if (layer.mask && layer.mask.numProperties > 0) {
        // Create temporary shape layer to get masked dimensions
        var shapeLayer = createShapeFromMask(comp, layer);
        var height = shapeLayer.sourceRectAtTime(comp.time, true).height;
        shapeLayer.remove();
        return height;
    } else {
        // Use regular layer height
        return layer.sourceRectAtTime(comp.time, false).height;
    }
}

function createPopInAnimation(comp, selectedLayers) {
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];

        // Enable motion blur
        layer.motionBlur = true;

        var currentTime = comp.time;
        var frameDuration = comp.frameDuration;
        var forwardTime = currentTime + (15 * frameDuration);

        // Get layer height
        var layerHeight = getLayerHeight(comp, layer);

        // Animate position
        var position = layer.property("Position");
        var endPos = position.value;
        var startPos = [endPos[0], endPos[1] + (layerHeight * 2)];

        position.setValueAtTime(currentTime, startPos);
        position.setValueAtTime(forwardTime, endPos);

        // Set position keyframe easing
        var forwardKeyIndex = position.nearestKeyIndex(forwardTime);
        var backwardKeyIndex = position.nearestKeyIndex(currentTime);

        var easeIn = new KeyframeEase(0, 66);
        var easeOut = new KeyframeEase(0, 44);

        position.setTemporalEaseAtKey(forwardKeyIndex, [easeIn], [easeOut]);
        position.setTemporalEaseAtKey(backwardKeyIndex, [easeIn], [easeOut]);

        // Animate opacity
        var opacity = layer.property("Opacity");
        opacity.setValueAtTime(currentTime, 0);
        opacity.setValueAtTime(forwardTime, 100);

        // Set opacity keyframe easing
        forwardKeyIndex = opacity.nearestKeyIndex(forwardTime);
        backwardKeyIndex = opacity.nearestKeyIndex(currentTime);

        opacity.setTemporalEaseAtKey(forwardKeyIndex, [easeIn], [easeOut]);
        opacity.setTemporalEaseAtKey(backwardKeyIndex, [easeIn], [easeOut]);
    }
}


function createShapeFromMask(comp, layer) {
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = layer.name + " Shape";

    var masks = layer.mask;
    if (masks && masks.numProperties > 0) {
        for (var i = 1; i <= masks.numProperties; i++) {
            var maskPath = masks.property(i).property("maskPath");
            var maskShape = maskPath.value;

            var shapeGroup = shapeLayer.property("Contents").addProperty("ADBE Vector Group");
            var shapePath = shapeGroup.property("Contents").addProperty("ADBE Vector Shape - Group");
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

        // Create shape layer from mask
        var shapeLayer = createShapeFromMask(comp, originalLayer);

        // Enable motion blur for the original layer
        originalLayer.motionBlur = true;

        // Duplicate layer
        var duplicateLayer = originalLayer.duplicate();

        // Hide the duplicated layer
        duplicateLayer.enabled = false;

        // Set track matte settings for the original layer only
        originalLayer.setTrackMatte(duplicateLayer, TrackMatteType.ALPHA);

        // Get current time
        var currentTime = comp.time;

        // Get size from shape layer
        var layerWidth = 0;
        var shapeRect = shapeLayer.sourceRectAtTime(currentTime, true);
        layerWidth = shapeRect.width;

        // Create position keyframes
        var position = originalLayer.property("Position");
        var startPos = position.value;

        // Go 15 frames forward and set keyframe
        var frameDuration = comp.frameDuration;
        var forwardTime = currentTime + (15 * frameDuration);
        position.setValueAtTime(forwardTime, startPos);

        // Go back 15 frames
        var backwardTime = currentTime;

        // Move layer left by width + 10%
        var endPos = [startPos[0] - (layerWidth * 1.1), startPos[1]];
        position.setValueAtTime(backwardTime, endPos);

        // Set keyframe easing
        var forwardKeyIndex = position.nearestKeyIndex(forwardTime);
        var backwardKeyIndex = position.nearestKeyIndex(backwardTime);

        // Create easing objects
        var easeIn = new KeyframeEase(0, 66);
        var easeOut = new KeyframeEase(0, 44);

        // Apply easing to both keyframes
        position.setTemporalEaseAtKey(forwardKeyIndex, [easeIn], [easeOut]);
        position.setTemporalEaseAtKey(backwardKeyIndex, [easeIn], [easeOut]);

        // Delete the shape layer now that we're done with it
        shapeLayer.remove();
    }
}

function createDoohOffset(comp, selectedLayers) {
    // Sort layers by X (ascending) and Y (descending for same X)
    var sortedLayers = selectedLayers.slice().sort(function(a, b) {
        var posA = a.property("Position").value;
        var posB = b.property("Position").value;

        if (posA[0] === posB[0]) {
            // Same X position, sort by Y in descending order (higher Y first)
            return posB[1] - posA[1];
        }
        return posA[0] - posB[0];
    });

    // Expression to apply
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

    var lastXPos = null;
    var frameOffset = 0;
    var subOffset = 0;

    for (var i = 0; i < sortedLayers.length; i++) {
        var layer = sortedLayers[i];
        var currentPos = layer.property("Position").value;

        // Apply the expression
        layer.property("Position").expression = expression;

        // Skip offset for the first layer
        if (i === 0) {
            lastXPos = currentPos[0];
            continue;
        }

        // Handle frame offsets
        if (currentPos[0] !== lastXPos) {
            // New X position
            frameOffset += 2;
            subOffset = 0;
            lastXPos = currentPos[0];
        } else {
            // Same X position, increment subOffset
            subOffset += 1;
        }

        // Calculate total offset in frames
        var totalOffset = frameOffset - subOffset;

        // Apply the offset
        if (totalOffset > 0) {
            layer.startTime += (totalOffset * comp.frameDuration);
        }
    }
}
