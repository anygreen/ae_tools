{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","My Window Name", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:''},\
              myInput: EditText{text:'/Users/nhb/github/ae_tools/', preferredSize:[400,-1]},\
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

    myPanel.grp.groupOne.myButton.onClick = function () {
      try {
        var scriptFile = File(myPanel.grp.groupOne.myInput.text.toString());
        var script = '#include' + scriptFile.fullName;

        eval(script);
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
