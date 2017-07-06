{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","ScriptTester", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myButtonChoose: Button{text:'Choose'},\
              myInput: EditText{text:'[enter your path here or use the button above]', preferredSize:[400,-1]},\
              myButton: Button{text:'Run'},\
            },\
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
    myPanel.grp.groupOne.myButtonChoose.onClick = function () {
      try {
        var theFile = File.openDialog();
        if (theFile != null) {
            myPanel.grp.groupOne.myInput.text = theFile.fsName;
        }
      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    };

    myPanel.grp.groupOne.myButton.onClick = function () {
      try {
        var theFile = new File(myPanel.grp.groupOne.myInput.text.toString());
        if (theFile.exists) {
          var script = '#include' + myPanel.grp.groupOne.myInput.text.toString().replace(/ /g, '%20');
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
