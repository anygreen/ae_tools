// Property Discovery Script
// Usage:
// 1. Select a layer with the Blend effect applied
// 2. Run this script to get all property matchNames and names

function discoverProperties(prop, indent) {
    var output = "";
    indent = indent || "";

    if (prop) {
        // Show property name and matchName
        output += indent + "Name: " + prop.name;

        if (prop.matchName) {
            output += " | matchName: " + prop.matchName;
        }

        // Show property type
        if (prop.propertyValueType) {
            output += " | Type: " + prop.propertyValueType;
        }

        output += "\n";

        // If this property is a group, recurse into children
        if (prop.numProperties) {
            for (var i = 1; i <= prop.numProperties; i++) {
                output += discoverProperties(prop.property(i), indent + "  ");
            }
        }
    }

    return output;
}

var comp = app.project.activeItem;
if (!comp || !(comp instanceof CompItem)) {
    alert("Please select a composition");
} else {
    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        alert("Please select a layer");
    } else {
        var layer = selectedLayers[0];
        var effects = layer.property("Effects");

        if (effects && effects.numProperties > 0) {
            var output = "Effects on layer: " + layer.name + "\n\n";

            for (var i = 1; i <= effects.numProperties; i++) {
                output += "=== Effect " + i + " ===\n";
                output += discoverProperties(effects.property(i), "");
                output += "\n";
            }

            // Write to a text file
            var file = new File("~/Desktop/property_discovery.txt");
            file.open("w");
            file.write(output);
            file.close();

            alert("Property names saved to Desktop/property_discovery.txt");
        } else {
            alert("No effects found on the selected layer");
        }
    }
}
