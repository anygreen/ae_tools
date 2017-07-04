{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","My Window Name", undefined, {resizeable:true});

    res = "group{orientation:'row',\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyKeyframeVelocity v0.2'},\
              groupWrapper: Group{orientation:'row',\
                groupLeft: Group{orientation:'column',\
                  myStaticText: StaticText{text:'In Influence'},\
                  definedInfluenceIn: EditText{text:'50', preferredSize:[80,-1], justify:'center'},\
                },\
                groupRight: Group{orientation:'column',\
                  myStaticText: StaticText{text:'Out Influence'},\
                  definedInfluenceOut: EditText{text:'', preferredSize:[80,-1], justify:'center'},\
                },\
              },\
              groupButtons: Group{orientation:'row',\
                buttonCheck: Button{text:'Check', preferredSize:[50,15]},\
                buttonApply: Button{text:'Apply', preferredSize:[50,-1]},\
                buttonCopy: Button{text:'Copy', preferredSize:[50,15]},\
              },\
              myConsole: StaticText{text:'', justify:'center', preferredSize:[200,20]},\
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

    function setKeyInfluences(influenceIn,influenceOut){
      app.beginUndoGroup("change Keyframe Velocity");
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var selectedProps = activeItem.selectedProperties;

      if(influenceOut == ""){
        influenceOut = influenceIn;
      };
      //looping through all selected properties (including groups)
      for (var i = 0; i < selectedProps.length; i++) {
        var currentProp = selectedProps[i]; //defining currently selected property
        if(currentProp.numKeys!=undefined){ //checking if property has keyframes do see if its a group
          //looping through all the selected keys of current property
          for (var a = 0; a < currentProp.selectedKeys.length; a++) {
            var keyIndex = currentProp.selectedKeys[a];
            currentProp.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            var easeIn = new KeyframeEase(0, influenceIn);
            var easeOut = new KeyframeEase(0, influenceOut);
            //checking length of array of property and setting easing accordingly
            if (currentProp.keyInTemporalEase(keyIndex).length == 1) {
              currentProp.setTemporalEaseAtKey(keyIndex, [easeIn], [easeOut]);
            }
            if (currentProp.keyInTemporalEase(keyIndex).length == 2) {
              currentProp.setTemporalEaseAtKey(keyIndex, [easeIn,easeIn], [easeOut,easeOut]);
            }
            if (currentProp.keyInTemporalEase(keyIndex).length== 3) {
              currentProp.setTemporalEaseAtKey(keyIndex, [easeIn,easeIn,easeIn], [easeOut,easeOut,easeOut]);
            }
          }
        }
      }

      if(countNumKeys()>0){
        setConsole(countNumKeys()+" keyframes changed");
      }
      NotifyIfNoKeysSelected();

      app.endUndoGroup();
      //showing successful easing in info panel
      clearOutput();
      writeLn("Easing set to "+influenceIn+"/"+influenceOut);
    }

    function getKeyInfluence(){
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var selectedProps = activeItem.selectedProperties;
      if (selectedProps.length > 1) {
        alert("Error...\nYou can only select one property at a time for this.")
      }else if (selectedProps[0].selectedKeys.length > 1){
        alert("Error...\nYou can only select one keyframe at a time for this.")
      }else{
        var prop = selectedProps[0];
        var keyIndex = prop.selectedKeys[0];
        var keyIN = prop.keyInTemporalEase(keyIndex)[0].influence;
        var keyOUT = prop.keyOutTemporalEase(keyIndex)[0].influence;
        return [keyIN,keyOUT]
      }
    }

    function countNumKeys(){
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var selectedProps = activeItem.selectedProperties;
      var keys = 0;
      for (var i = 0; i < selectedProps.length; i++) {
        keys = keys + selectedProps[i].selectedKeys.length
      }
      return keys
    }

    function clearConsole(){
      myPanel.grp.groupOne.myConsole.text = " ";
      //alert("should be clear");
    }

    function setConsole(text,delay){
      delay = delay || 700;
      myPanel.grp.groupOne.myConsole.text = text;
      $.sleep(delay);
      clearConsole();
    };

    function NotifyIfNoKeysSelected(){
      try {
        var proj = app.project;
        var activeItem = proj.activeItem;
        var selectedLayers = activeItem.selectedLayers;
        var selectedProps = activeItem.selectedProperties;
        if (selectedProps[0].selectedKeys.length < 1) {
          setConsole("No keyframes selected...");
        }
      } catch (e) {
        setConsole("No keyframes selected...");
      }

    };
    myPanel.grp.groupOne.groupButtons.buttonApply.onClick = function () {
      setKeyInfluences(myPanel.grp.groupOne.groupWrapper.groupLeft.definedInfluenceIn.text,myPanel.grp.groupOne.groupWrapper.groupRight.definedInfluenceOut.text);
    };

    myPanel.grp.groupOne.groupButtons.buttonCheck.onClick = function () {
      NotifyIfNoKeysSelected();
      var easing = getKeyInfluence();
      setConsole("Easing: "+easing[0]+"/"+easing[1]);
    }

    myPanel.grp.groupOne.groupButtons.buttonCopy.onClick = function () {
      NotifyIfNoKeysSelected();
      var easing = getKeyInfluence();
      myPanel.grp.groupOne.groupWrapper.groupLeft.definedInfluenceIn.text = easing[0];
      if (easing[0] == easing[1]) {
        myPanel.grp.groupOne.groupWrapper.groupRight.definedInfluenceOut.text = "";
      } else{
        myPanel.grp.groupOne.groupWrapper.groupRight.definedInfluenceOut.text = easing[1];
      }
      setConsole("Easing copied...");
    }

    function myApply(e){
      if (e.keyName == "Enter") {
        setKeyInfluences(myPanel.grp.groupOne.groupWrapper.groupLeft.definedInfluenceIn.text,myPanel.grp.groupOne.groupWrapper.groupRight.definedInfluenceOut.text);
      }
    };

    myPanel.addEventListener ("keydown", function (e){myApply(e)});
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
