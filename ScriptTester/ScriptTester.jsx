{
function myScript(thisObj){
  var SETTINGS_SECTION = "ScriptTester";
  var SETTINGS_KEY = "lastPath";

  function getSavedPath() {
    try {
      if (app.settings.haveSetting(SETTINGS_SECTION, SETTINGS_KEY)) {
        return app.settings.getSetting(SETTINGS_SECTION, SETTINGS_KEY);
      }
    } catch (e) {}
    return "";
  }

  function savePath(path) {
    try {
      app.settings.saveSetting(SETTINGS_SECTION, SETTINGS_KEY, path);
    } catch (e) {}
  }

  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","ScriptTester", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','top'],\
            groupOne: Group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','center'],\
              myButtonChoose: Button{text:'Choose', alignment:['center','center']},\
              myInput: EditText{text:'', alignment:['fill','center'], preferredSize:[300,-1]},\
              myButton: Button{text:'Run', alignment:['center','center']},\
            },\
          }";

    myPanel.grp = myPanel.add(res);

    // Load saved path
    var savedPath = getSavedPath();
    if (savedPath) {
      myPanel.grp.groupOne.myInput.text = savedPath;
    } else {
      myPanel.grp.groupOne.myInput.text = "[enter your path here or use the button above]";
    }

    //Setup Panel Sizing
    myPanel.layout.layout(true);
    myPanel.grp.minimumSize = myPanel.grp.size;

    //Make the panel resizeable
    myPanel.layout.resize();
    myPanel.onResizing = myPanel.onResize = function(){this.layout.resize()};

    /////////////////
    //THE SCRIPTING//
    /////////////////
    myPanel.grp.groupOne.myButtonChoose.onClick = function () {
      try {
        var theFile = File.openDialog();
        if (theFile != null) {
            myPanel.grp.groupOne.myInput.text = theFile.fsName;
            savePath(theFile.fsName);
        }
      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    };

    myPanel.grp.groupOne.myButton.onClick = function () {
      try {
        var pathText = myPanel.grp.groupOne.myInput.text.toString();
        var theFile = new File(pathText);
        if (theFile.exists) {
          savePath(pathText);
          var script = '#include' + pathText.replace(/ /g, '%20');
          eval(script);
        } else {
          alert("File doesn't exist :(");
        }

      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
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
