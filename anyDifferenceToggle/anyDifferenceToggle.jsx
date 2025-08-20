/*
 * Toggle Difference Panel
 * A ScriptUI Panel for After Effects
 * 
 * Features:
 * - Toggle selected layers between Difference and Normal blending modes
 * - Option to mark/unmark layers as Guide Layers
 * - Delete all Guide Layers in active composition
 */

(function createToggleDifferencePanel(thisObj) {
    
    // Check if panel or window
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("dialog", "Toggle Difference");
    
    // Set panel properties
    myPanel.orientation = "column";
    myPanel.alignChildren = "center";
    myPanel.spacing = 10;
    myPanel.margins = 16;
    
    // Main toggle button
    var toggleBtn = myPanel.add("button", undefined, "Toggle Difference");
    toggleBtn.preferredSize.width = 150;
    
    // Checkbox for guide layer option
    var guideCheckbox = myPanel.add("checkbox", undefined, "make Guide");
    guideCheckbox.value = false;
    
    // Add some space before the delete button
    myPanel.add("panel"); // spacer
    
    // Delete guide layers button
    var deleteGuideBtn = myPanel.add("button", undefined, "Delete Guide Layers");
    deleteGuideBtn.preferredSize.width = 150;
    
    // Toggle Difference Button Click Handler
    toggleBtn.onClick = function() {
        app.beginUndoGroup("Toggle Difference");
        
        try {
            var activeComp = app.project.activeItem;
            
            // Check if there's an active composition
            if (!activeComp || !(activeComp instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }
            
            var selectedLayers = activeComp.selectedLayers;
            
            // Check if any layers are selected
            if (selectedLayers.length === 0) {
                alert("Please select at least one layer.");
                return;
            }
            
            // Process each selected layer
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                
                // Only process AVLayers (layers that have blending modes)
                if (layer instanceof AVLayer) {
                    
                    // Toggle blending mode
                    if (layer.blendingMode === BlendingMode.DIFFERENCE) {
                        layer.blendingMode = BlendingMode.NORMAL;
                    } else {
                        layer.blendingMode = BlendingMode.DIFFERENCE;
                    }
                    
                    // Set guide layer status based on checkbox
                    layer.guideLayer = guideCheckbox.value;
                }
            }
            
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            app.endUndoGroup();
        }
    };
    
    // Delete Guide Layers Button Click Handler
    deleteGuideBtn.onClick = function() {
        app.beginUndoGroup("Delete Guide Layers");
        
        try {
            var activeComp = app.project.activeItem;
            
            // Check if there's an active composition
            if (!activeComp || !(activeComp instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }
            
            var guideLayers = [];
            
            // Find all guide layers
            for (var i = 1; i <= activeComp.numLayers; i++) {
                var layer = activeComp.layer(i);
                if (layer instanceof AVLayer && layer.guideLayer) {
                    guideLayers.push(layer);
                }
            }
            
            // Confirm deletion if guide layers exist
            if (guideLayers.length === 0) {
                alert("No guide layers found in the active composition.");
                return;
            }
            
            var confirmDelete = confirm("Delete " + guideLayers.length + " guide layer(s)?");
            if (!confirmDelete) {
                return;
            }
            
            // Delete guide layers (iterate backwards to avoid index issues)
            for (var j = guideLayers.length - 1; j >= 0; j--) {
                guideLayers[j].remove();
            }
            
            alert("Deleted " + guideLayers.length + " guide layer(s).");
            
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            app.endUndoGroup();
        }
    };
    
    // Layout and show panel
    myPanel.layout.layout(true);
    
    // If it's a dialog window, show it
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
    
    return myPanel;
    
})(this);