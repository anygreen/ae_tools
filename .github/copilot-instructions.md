# AI Agent Instructions for ae_tools

This repository contains Adobe After Effects automation scripts written in ExtendScript JSX. Follow these guidelines when working with the codebase:

## Project Structure
- Each tool lives in its own directory with a matching name (e.g., `anyLoop/anyLoop.jsx`)
- Tools follow a naming convention: either `any[ToolName]` or specific tool names
- Version numbers are tracked in the filename (e.g., `_v0.1.jsx`, `_v0.2.jsx`)

## Core Patterns

### Script Structure
1. Each script is wrapped in an IIFE (Immediately Invoked Function Expression)
2. UI creation follows this pattern:
   ```jsx
   function myScript(thisObj) {
     function myScript_buildUI(thisObject) {
       var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Title");
       // UI definition
     }
     var scriptPal = myScript_buildUI(thisObj);
     if (scriptPal && scriptPal instanceof Window) {
       scriptPal.center();
       scriptPal.show();
     }
   }
   ```

### Version Handling
- Version numbers are tracked in both filename and script variables
- Use the format `v0.1`, `v0.2` etc.
- For date-based versioning, use YYMMDD format

### UI Conventions
- Panels are created as resizable palettes
- Use ScriptUI components organized in groups
- Standard margins: 16px
- Standard spacing: 10px
- Align children to center/top by default

### Error Handling
- Wrap main functionality in try-catch blocks
- Begin/end undo groups for operations that modify the project
- Include line numbers in error messages
- Validate selections before performing operations

### After Effects Integration
- Use `app.beginUndoGroup()` and `app.endUndoGroup()` for operations
- Check for valid selections using `app.project.activeItem`
- Use `selectedLayers` and `selectedProperties` for operating on selections
- Verify property compatibility before applying expressions

## Key Examples
- `anyVersionUp/anyVersionUp_v0.2.jsx`: Reference for version management and modal dialogs
- `anyLoop/anyLoop.jsx`: Reference for expression handling and UI layout

## Development Workflow
1. Create new tool directory matching the tool name
2. Start with version v0.1
3. Implement standard UI wrapper pattern
4. Add error handling
5. Test with After Effects
6. Increment version for significant changes