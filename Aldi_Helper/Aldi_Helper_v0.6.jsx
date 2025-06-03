(function createUI(thisObj) {
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Aldi Helper v0.6", undefined);
    panel.orientation = "column";
    
    // Create buttons
    var markerRevealButton = panel.add("button", undefined, "Marker Reveal");
    var popInButton = panel.add("button", undefined, "Pop In");
    markerRevealButton.size = popInButton.size = [120, 30];
    
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

    var doohOffsetButton = panel.add("button", undefined, "DOOH Offset");
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
    
    panel.layout.layout(true);
    panel.layout.resize();
    if (!(thisObj instanceof Panel)) {
        panel.center();
        panel.show();
    }
})(this);

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