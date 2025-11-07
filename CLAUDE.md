# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains Adobe After Effects automation scripts written in ExtendScript JSX. Each script is a standalone tool that extends After Effects functionality through ScriptUI panels and expressions.

## Architecture

### Script Organization
- **One directory per tool**: Each tool lives in its own directory (e.g., `anyLoop/anyLoop.jsx`)
- **Naming convention**: Tools are prefixed with `any[ToolName]` or use specific descriptive names
- **Versioning**: Version numbers are embedded in filenames (`_v0.1.jsx`, `_v0.2.jsx`) and tracked as variables in the script

### Standard Script Structure

All scripts follow this IIFE pattern:

```jsx
(function createUI(thisObj) {
    // or
    function myScript(thisObj) {
        function myScript_buildUI(thisObject) {
            var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Title");
            // UI components defined here
            // Event handlers attached here
            return panel;
        }
        var scriptPal = myScript_buildUI(thisObj);
        if (scriptPal && scriptPal instanceof Window) {
            scriptPal.center();
            scriptPal.show();
        }
    }
    myScript(this);
})(this);
```

This pattern allows scripts to work both as dockable panels and standalone windows in After Effects.

### UI Patterns

**Resource String Method** (older scripts like `anyLoop.jsx`):
- UI defined as resource strings for complex layouts
- Enables compact, declarative UI definitions
- Example: `res = "group{orientation:'column', ...}"`

**Programmatic Method** (newer scripts like `anyVersionUp_v0.3.jsx`):
- UI built using `panel.add()` method calls
- More flexible for dynamic UI generation
- Better for creating highlighted text and complex interactions

**Standard dimensions**:
- Margins: 16px
- Spacing: 10px
- Orientation: column with center/top alignment

### After Effects Integration

**Undo Groups**:
```jsx
app.beginUndoGroup("Operation Name");
// modifications here
app.endUndoGroup();
```
Always wrap project-modifying operations in undo groups.

**Selection Handling**:
- Check `app.project.activeItem` for valid compositions
- Use `activeItem.selectedLayers` for layer operations
- Use `activeItem.selectedProperties` for property/expression operations
- Validate selections before operations

**Property Expressions**:
- Verify `currentProp.canSetExpression` before applying expressions
- Check `currentProp.numKeys` to distinguish properties from groups
- Use `currentProp.expression` to read/write expression text

### Error Handling

All button onClick handlers and main operations should be wrapped in try-catch:

```jsx
try {
    app.beginUndoGroup("Operation");
    // operation code
    app.endUndoGroup();
} catch (error) {
    alert("Error: " + error.message);
    // or: alert("Error in line: " + e.line + "\n" + e.toString());
}
```

## Development Workflow

1. **Creating a new tool**:
   - Create directory with tool name
   - Create script file with matching name and `_v0.1.jsx` suffix
   - Implement standard IIFE wrapper pattern
   - Add error handling and undo groups

2. **Version increments**:
   - Create new file for each version (e.g., `_v0.2.jsx`, `_v0.3.jsx`)
   - Update `scriptVersion` variable in script header
   - Keep old versions for reference/rollback

3. **Testing**:
   - Scripts must be tested directly in After Effects
   - Install scripts via File > Scripts > Run Script File
   - For development, use ScriptUI panels docked in After Effects workspace

## Key Reference Scripts

- **`anyVersionUp/anyVersionUp_v0.3.jsx`**: Modal dialogs, complex name parsing, folder management, highlighted UI text
- **`anyLoop/anyLoop.jsx`**: Expression application, resource string UI, property iteration
- **`anyDifferenceToggle/anyDifferenceToggle.jsx`**: Guide layer manipulation, checkbox state management

## Common Patterns

### Finding/Creating Folders
```jsx
// Search for folder in specific parent
for (var j = 1; j <= app.project.numItems; j++) {
    var item = app.project.item(j);
    if (item instanceof FolderItem &&
        item.name === "folderName" &&
        item.parentFolder === parentFolder) {
        folder = item;
        break;
    }
}
// Create if doesn't exist
if (!folder) {
    folder = app.project.items.addFolder("folderName");
    folder.parentFolder = parentFolder;
}
```

### Date Formatting (YYMMDD)
```jsx
function getCurrentDate() {
    var date = new Date();
    return padNumber(date.getFullYear() % 100, 2) +
           padNumber(date.getMonth() + 1, 2) +
           padNumber(date.getDate(), 2);
}
```

### Iterating Selected Items
```jsx
// For compositions in project panel
for (var i = 1; i <= app.project.numItems; i++) {
    if (app.project.item(i).selected && app.project.item(i) instanceof CompItem) {
        selectedComps.push(app.project.item(i));
    }
}

// For properties in active composition
for (var i = 0; i < selectedProps.length; i++) {
    var currentProp = selectedProps[i];
    if (currentProp.numKeys != undefined && currentProp.canSetExpression == true) {
        // Apply expression
    }
}
```

## ExtendScript Limitations

- **No modern JavaScript**: ES5 only, no arrow functions, no `const`/`let`, no template literals
- **Array iteration**: Use `for` loops with index, not `forEach`
- **String concatenation**: Use `+` operator, not template literals
- **File system**: Use ExtendScript `File` and `Folder` objects, not Node.js fs module
- **Debugging**: Use `alert()` for output, or `$.writeln()` for ExtendScript Toolkit console
