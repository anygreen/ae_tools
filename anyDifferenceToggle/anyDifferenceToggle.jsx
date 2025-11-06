/*
 * Toggle Difference Panel
 * A ScriptUI Panel for After Effects
 * 
 * Features:
 * - Toggle selected layers between Difference and Normal blending modes
 * - Option to mark/unmark layers as Guide Layers
 * - Delete all Guide Layers in active composition
 */

{
function myScript(thisObj){
    function myScript_buildUI(thisObj){
        var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Toggle Difference", undefined, {resizeable:true});
        
        // Use resource string for better layout control
        res = "group{orientation:'column', alignChildren:'center', spacing:10, margins:16,\
                toggleBtn: Button{text:'Toggle Difference', preferredSize:[150,-1]},\
                guideCheckbox: Checkbox{text:'make Guide', value:true},\
                statusText: StaticText{text:'', justify:'center', preferredSize:[200,20]},\
                spacer: Panel{preferredSize:[-1,10]},\
                deleteGuideBtn: Button{text:'Delete Guide Layers', preferredSize:[150,-1]},\
              }";

        myPanel.grp = myPanel.add(res);
        
        //Setup Panel Sizing
        myPanel.layout.layout(true);
        myPanel.grp.minimumSize = myPanel.grp.size;

        //Make the panel resizeable
        myPanel.layout.resize();
        myPanel.onResizing = myPanel.onResize = function(){this.layout.resize()};

        /////////////////
        //THE SCRIPTING//
        /////////////////
        
        // Helper function to set status message with auto-clear
        function setStatus(text, delay) {
            delay = delay || 2000;
            myPanel.grp.statusText.text = text;
            $.sleep(delay);
            myPanel.grp.statusText.text = "";
        }
        
        function clearStatus() {
            myPanel.grp.statusText.text = "";
        }
        
        // Toggle Difference Button Click Handler
        myPanel.grp.toggleBtn.onClick = function() {
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
                        layer.guideLayer = myPanel.grp.guideCheckbox.value;
                    }
                }
                
            } catch (error) {
                alert("Error: " + error.message);
            } finally {
                app.endUndoGroup();
            }
        };
        
        // Delete Guide Layers Button Click Handler
        myPanel.grp.deleteGuideBtn.onClick = function() {
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
                    setStatus("No guide layers found");
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
                
                setStatus("Deleted " + guideLayers.length + " guide layer(s)");
                
            } catch (error) {
                alert("Error: " + error.message);
            } finally {
                app.endUndoGroup();
            }
        };
        
        ///////////
        //THE END//
        ///////////

        return myPanel;
    }
    
    var myScriptPal = myScript_buildUI(thisObj);

    if ((myScriptPal != null) && (myScriptPal instanceof Window)){
        myScriptPal.center();
        myScriptPal.show();
    }
}
myScript(this);
}