{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Loops", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyLoops v0.1'},\
            },\
            groupTwo: Group{orientation:'column', alignment:['center','top'],\
              loopsDropdownInOut: DropDownList{properties:{items:['Loop IN','Loop OUT','Loop IN/OUT']}},\
              loopsDropdownType: DropDownList{properties:{items:['cycle','continue','pingpong','offset']}},\
              loopsButton: Button{text:'Apply'},\
              loopsReplace: Checkbox{text:'replace previous Expression'},\
            },\
          }";

    myPanel.grp = myPanel.add(res);

    //Defaults:
    myPanel.grp.groupTwo.loopsDropdownInOut.selection = 1;
    myPanel.grp.groupTwo.loopsDropdownType.selection = 0;
    myPanel.grp.groupTwo.loopsReplace.value = true;

    //Setup Panel Sizing
    myPanel.layout.layout(true);
    myPanel.grp.minimumSize = myPanel.grp.size;

    //Make the panel resizeable
    myPanel.layout.resize();
    myPanel.onResizing = myPanel.onResize = function(){this.layout.resize()};

    /////////////////
    //THE SCRIPTING//
    /////////////////

    //LOOPS START
    myPanel.grp.groupTwo.loopsButton.onClick = function () {
      try {
        app.beginUndoGroup("Applied Loop");
        var proj = app.project;
        var activeItem = proj.activeItem;
        var selectedLayers = activeItem.selectedLayers;
        var selectedProps = activeItem.selectedProperties;

        var loopInOut = myPanel.grp.groupTwo.loopsDropdownInOut.selection;
        var loopType = myPanel.grp.groupTwo.loopsDropdownType.selection;
        var loopReplace = myPanel.grp.groupTwo.loopsReplace.value;

        var expression;
        if (loopInOut.toString() == "Loop IN/OUT") {
          expression = '//Loop IN/OUT\nif (time < key(1).time) loopIn("'+loopType.toString()+'");\nif (time >= key(1).time && time <= key(numKeys).time) value;\nif (time > key(numKeys).time) loopOut("'+loopType.toString()+'");';
        }
        if (loopInOut.toString() == "Loop IN") {
          expression ='//Loop IN\nloopIn("'+loopType.toString()+'");';
        }
        if (loopInOut.toString() == "Loop OUT") {
          expression ='//Loop OUT\nloopOut("'+loopType.toString()+'");';
        }

        if (selectedProps == "") {
          alert("The following Error occured:\nNo property selected")
        } else {
          //looping through all selected properties (including groups)
          for (var i = 0; i < selectedProps.length; i++) {
            var currentProp = selectedProps[i]; //defining currently selected property
            if(currentProp.numKeys!=undefined&&currentProp.canSetExpression==true){ //checking if property has keyframes do see if its a group
              if (loopReplace) {
                currentProp.expression = expression;
              } else {
                currentProp.expression = currentProp.expression+"\n"+expression;
              }
            }
          }
        }
        app.endUndoGroup();
      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    };
    //LOOPS END

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
