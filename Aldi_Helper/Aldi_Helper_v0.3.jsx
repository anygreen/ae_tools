// Function to log messages
function logMessage(message) {
    $.writeln(message); // Write to JavaScript Console
    // You can extend this function to write to a file or show alerts
}

// Create a ScriptUI panel
var myPanel = new Window("palette", "Mask Operations", undefined);
myPanel.orientation = "column";

// First button
var maskButton = myPanel.add("button", undefined, "Mask");
var mask1, mask2;

// Second Panel - Non-modal
var secondPanel = myPanel.add("panel", undefined, "Select Mask");
secondPanel.orientation = "column";
secondPanel.visible = false;

var selectText = secondPanel.add("statictext", undefined, "Select the first mask");
var doneButton = secondPanel.add("button", undefined, "Done");

// Handlers for button clicks
maskButton.onClick = function() {
    secondPanel.visible = true;
    selectText.text = "Select the first mask";
    doneButton.text = "Done";
};

// Handler for 'done' button
doneButton.onClick = function() {
    if (doneButton.text === "Done") {
        mask1 = getMaskInfo();
        if (!mask1) {
            alert("No layer or mask selected!");
            return;
        }
        selectText.text = "Select the second mask";
        doneButton.text = "Run";
    } else {
        mask2 = getMaskInfo();
        if (!mask2) {
            alert("No layer or mask selected!");
            return;
        }
        processMasks(mask1, mask2);
        secondPanel.visible = false;
    }
};

// Update the getMaskInfo function to include logging
function getMaskInfo() {
    var activeComp = app.project.activeItem;
    if (!activeComp || !activeComp.selectedLayers[0]) {
        logMessage("No active composition or selected layer.");
        return null;
    }
    var selectedLayer = activeComp.selectedLayers[0];
    var firstMask = selectedLayer.property("Masks").property(1); // Assuming the first mask
    if (!firstMask) {
        logMessage("No mask found on the selected layer.");
        return null;
    }
    logMessage("Mask info retrieved successfully.");
    return { comp: activeComp, layer: selectedLayer, mask: firstMask };
}

// Function to process masks
function processMasks(mask1, mask2) {
    app.beginUndoGroup("Process Masks");

    // Work on mask2
    var mask2Keyframe = mask2.mask.property("Mask Path").keyframeAtIndex(1);
    var copiedKeyframeValue = mask2.mask.property("Mask Path").keyValue(mask2Keyframe);

    // Creating keyframes
    mask2.mask.property("Mask Path").addKey(5); // 5 seconds
    mask2.mask.property("Mask Path").addKey(6 + 15 / 25); // 6 seconds and 15 frames

    // Pasting keyframes
    mask2.mask.property("Mask Path").setValueAtTime(5 + 15 / 25, copiedKeyframeValue);
    mask2.mask.property("Mask Path").setValueAtTime(6, copiedKeyframeValue);

    // Change keyframes of mask1
    var numKeyframes = mask1.mask.property("Mask Path").numKeys;
    for (var i = 1; i <= numKeyframes; i++) {
        var keyframe = mask1.mask.property("Mask Path").keyframeTime(i);
        mask1.mask.property("Mask Path").setTemporalEaseAtKey(i, [new KeyframeEase(0.66, 33)], [new KeyframeEase(0.44, 66)]);
    }

    app.endUndoGroup();
}


// Show the panel
myPanel.center();
myPanel.show();
