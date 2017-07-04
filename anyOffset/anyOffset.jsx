{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Offset", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['center','top'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyOffsets v0.1'},\
            },\
            groupTwo: Group{orientation:'column',\
              offsetGroup0: Group{orientation:'row',\
                offsetText0: StaticText{text:'Offset selected...'},\
                offsetType: DropDownList{properties:{items:['... Layers','... Keyframes']}},\
              },\
              offsetGroup1: Group{orientation:'row',\
                offsetText2: StaticText{text:'Start Offstes From:'},\
                offsetFrom: DropDownList{properties:{items:['First Selected','Current Time Indicator']}},\
              },\
              offsetGroup2: Group{orientation:'row',\
                offsetText1: StaticText{text:'Amount in Frames:'},\
                offsetAmount: EditText{text:'1', preferredSize:[80,-1], justify:'center'},\
              },\
              offsetButton: Button{text:'Apply'},\
              myStaticText: StaticText{text:''},\
              myStaticText: StaticText{text:'With the following button you can'},\
              myStaticText: StaticText{text:'copy/paste keyframes from multiple layers'},\
              offsetButtonCopyPaste: Button{text:'Copy/Paste'},\
            },\
          }";

    myPanel.grp = myPanel.add(res);

    //Defaults:
    myPanel.grp.groupTwo.offsetGroup0.offsetType.selection = 0;
    myPanel.grp.groupTwo.offsetGroup1.offsetFrom.selection = 0;

    //Setup Panel Sizing
    myPanel.layout.layout(true);
    myPanel.grp.minimumSize = myPanel.grp.size;

    //Make the panel resizeable
    myPanel.layout.resize();
    myPanel.onResizing = myPanel.onResize = function(){this.layout.resize()};

    /////////////////
    //THE SCRIPTING//
    /////////////////

    //GLOBAL FUNCTIONS

    //OFFSET START
    myPanel.grp.groupTwo.offsetButton.onClick = function () {
      try {

        var proj = app.project;
        var activeItem = proj.activeItem;
        var initialSelectedLayers = activeItem.selectedLayers;
        var selectedProps = activeItem.selectedProperties;
        var selectedLayers = [];

        for (var i = 0; i < initialSelectedLayers.length; i++) {
          selectedLayers.push(initialSelectedLayers[i].index);
        }

        if (selectedLayers.length >=1) {
          app.beginUndoGroup("Applied Offset");

          var offsetAmount = myPanel.grp.groupTwo.offsetGroup2.offsetAmount.text.toString();
          offsetAmount = Number(offsetAmount.replace(new RegExp(',','g'),'.'));

          if (isNaN(parseFloat(offsetAmount))) {
            alert("An Error occured:\nPlease only use numbers as input");
            myPanel.grp.groupTwo.offsetGroup2.offsetAmount.text = 1;
          } else {
            myPanel.grp.groupTwo.offsetGroup2.offsetAmount.text = offsetAmount;
            offsetAmount = offsetAmount*activeItem.frameDuration;
            var offset;

            var offsetFrom = myPanel.grp.groupTwo.offsetGroup1.offsetFrom.selection;
            var offsetType = myPanel.grp.groupTwo.offsetGroup0.offsetType.selection;
            var fromTime;

            if(offsetType == 0){ //if offsetType is Layer

              if (offsetFrom == 1) { //if offsetFrom is CTI
                fromTime = activeItem.time;
              }else{ //if offsetFrom is Selected
                fromTime = initialSelectedLayers[0].inPoint;
              }

              for (var i = 0; i < selectedLayers.length; i++) {
                initialSelectedLayers[i].startTime = fromTime+(offsetAmount*i)-(initialSelectedLayers[i].inPoint-initialSelectedLayers[i].startTime);
              }
            }

            if(offsetType == 1){ //if offsetType is Keyframes

              try{

                function shiftKey(prop, keyToCopy, offset, keyToRemove){

                  // Remember the key's settings before creating the new setting, just in case creating the new key affects keyToCopy's settings
                  var inInterp = prop.keyInInterpolationType(keyToCopy);
                  var outInterp = prop.keyOutInterpolationType(keyToCopy);
                  var keyToCopyValue = prop.keyValue(keyToCopy);

                  if ((inInterp === KeyframeInterpolationType.BEZIER) && (outInterp === KeyframeInterpolationType.BEZIER)){
                    var tempAutoBezier = prop.keyTemporalAutoBezier(keyToCopy);
                    var tempContBezier = prop.keyTemporalContinuous(keyToCopy);
                  }
                  if (outInterp !== KeyframeInterpolationType.HOLD){
                    var inTempEase = prop.keyInTemporalEase(keyToCopy);
                    var outTempEase = prop.keyOutTemporalEase(keyToCopy);
                  }
                  if ((prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) || (prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL)){
                    var spatAutoBezier = prop.keySpatialAutoBezier(keyToCopy);
                    var spatContBezier = prop.keySpatialContinuous(keyToCopy);
                    var inSpatTangent = prop.keyInSpatialTangent(keyToCopy);
                    var outSpatTangent = prop.keyOutSpatialTangent(keyToCopy);
                    var roving = prop.keyRoving(keyToCopy);
                  }

                  // Create the new keyframe
                  var newTime = prop.keyTime(keyToCopy) + offset;
                  var newKeyIndex = prop.addKey(newTime);
                  prop.setValueAtKey(newKeyIndex, keyToCopyValue);

                  if (outInterp !== KeyframeInterpolationType.HOLD){
                    prop.setTemporalEaseAtKey(newKeyIndex, inTempEase, outTempEase);
                  }

                  // Copy over the keyframe settings
                  prop.setInterpolationTypeAtKey(newKeyIndex, inInterp, outInterp);

                  if ((inInterp === KeyframeInterpolationType.BEZIER) && (outInterp === KeyframeInterpolationType.BEZIER) && tempContBezier){
                    prop.setTemporalContinuousAtKey(newKeyIndex, tempContBezier);
                    prop.setTemporalAutoBezierAtKey(newKeyIndex, tempAutoBezier);		// Implies Continuous, so do after it
                  }

                  if ((prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) || (prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL)){
                    prop.setSpatialContinuousAtKey(newKeyIndex, spatContBezier);
                    prop.setSpatialAutoBezierAtKey(newKeyIndex, spatAutoBezier);		// Implies Continuous, so do after it
                    prop.setSpatialTangentsAtKey(newKeyIndex, inSpatTangent, outSpatTangent);
                    prop.setRovingAtKey(newKeyIndex, roving);
                  }
                  // Remove the old keyframe
                  prop.removeKey(keyToRemove);
                }

                var diffCTI = 0;
                var selectedPropsObj = [];
                var earliestKey = 1000000;
                for (var i = 0; i < selectedProps.length; i++) {
                  if ((selectedProps[i].propertyType === PropertyType.INDEXED_GROUP) || (selectedProps[i].propertyType === PropertyType.NAMED_GROUP)){
                    //skipping property groups
                  } else {
                      selectedPropsObj.push({prop:selectedProps[i],keys:selectedProps[i].selectedKeys});
                      for (var a = 0; a < selectedProps[i].selectedKeys.length; a++) {
                        var keyTime = selectedProps[i].keyTime(selectedProps[i].selectedKeys[a]);
                        if(keyTime < earliestKey){
                          earliestKey = keyTime;
                        }
                      }
                  }
                }

                var layersEarliest = [];
                for (var a = 0; a < selectedLayers.length; a++) {
                  layersEarliest.push({
                    index:selectedLayers[a],
                    earliestKeyTime:10000
                  });
                }

                for (var i = 0; i < selectedPropsObj.length; i++) {
                  var currentLayerIndex = selectedPropsObj[i].prop.propertyGroup(selectedPropsObj[i].prop.propertyDepth).index;
                  for (var a = 0; a < layersEarliest.length; a++) {
                    if(layersEarliest[a].index == currentLayerIndex){
                      for (var b = 0; b < selectedPropsObj[i].keys.length; b++) {
                        if (selectedPropsObj[i].prop.keyTime(selectedPropsObj[i].keys[b]) < layersEarliest[a].earliestKeyTime) {
                          layersEarliest[a].earliestKeyTime = selectedPropsObj[i].prop.keyTime(selectedPropsObj[i].keys[b]);
                        }
                      }
                    }
                  }
                }

                if (offsetFrom == 1) { //if offsetFrom is CTI
                  diffCTI = activeItem.time - earliestKey;
                }

                for (var i = 0; i < selectedPropsObj.length; i++) {
                  var currentLayerIndex = selectedPropsObj[i].prop.propertyGroup(selectedPropsObj[i].prop.propertyDepth).index;
                  for (var a = 0; a < selectedLayers.length; a++) {
                    if (selectedLayers[a] == currentLayerIndex){
                      var firstKeyOffset = 0;
                      for (var b = 0; b < layersEarliest.length; b++) {
                        if(layersEarliest[b].index == currentLayerIndex){
                          firstKeyOffset = layersEarliest[b].earliestKeyTime - earliestKey
                        }
                      }
                      offset = 0;
                      offset = (offsetAmount*a)+diffCTI-firstKeyOffset;
                      offset = Math.round(offset*1000)/1000;
                      //alert("offset: "+ typeof offset+" - key: "+ typeof firstKeyOffset+" = "+newOffset);
                    }
                  }


                  if (offset > 0) {
                    for (var b = selectedPropsObj[i].keys.length-1; b >= 0; b--) {
                      var currentKey = selectedPropsObj[i].keys[b];
                      shiftKey(selectedPropsObj[i].prop, currentKey, offset, currentKey);
                    }
                  }

                  if (offset < 0) {
                    for (var b = 0; b < selectedPropsObj[i].keys.length; b++) {
                      var currentKey = selectedPropsObj[i].keys[b];
                      shiftKey(selectedPropsObj[i].prop, currentKey, offset, currentKey+1);
                    }
                  }

                }

                for (var i = 0; i < selectedPropsObj.length; i++) {
                  for (var a = 0; a < selectedPropsObj[i].keys.length; a++) {
                    selectedPropsObj[i].prop.setSelectedAtKey(selectedPropsObj[i].keys[a], true);
                  }
                }
              } catch (e){
                alert("Error in line: " + e.line + "\n" + e.toString());
                //alert("No Keyframes selected!");
              }
            }
          }
          app.endUndoGroup();
        }else{
          alert("Nothing seleceted!");
        }

      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    };

    myPanel.grp.groupTwo.offsetButtonCopyPaste.onClick = function () {
      app.beginUndoGroup("Copy/Paste");
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var selectedProps = activeItem.selectedProperties;

      try {
        var myLayers = [];
        var firstKeyTime = "not set yet";
        //Saving Layers
        for (var i = 0; i < selectedLayers.length; i++) {
          var myNewLayer = {
            index:selectedLayers[i].index,
            props:[]
          };
          myLayers.push(myNewLayer);
        }

        //Function to get keyframe values
        function getKeyValues(property,index){
          var myKeyframe = {
                keyTime : property.keyTime(index),
                keyValue : property.keyValue(index),
                keyInInterpolationType : property.keyInInterpolationType(index),
                keyOutInterpolationType : property.keyOutInterpolationType(index)
              }
          if (firstKeyTime == "not set yet") {
            firstKeyTime = myKeyframe.keyTime;
          } else{
            if (myKeyframe.keyTime < firstKeyTime) {
              firstKeyTime = myKeyframe.keyTime;
            }
          }
          if ((myKeyframe.keyInInterpolationType === KeyframeInterpolationType.BEZIER) && (myKeyframe.keyOutInterpolationType === KeyframeInterpolationType.BEZIER)){
            myKeyframe["keyTemporalAutoBezier"] = property.keyTemporalAutoBezier(index);
            myKeyframe["keyTemporalContinuous"] = property.keyTemporalContinuous(index);
          }

          if (myKeyframe.keyOutInterpolationType !== KeyframeInterpolationType.HOLD){
            myKeyframe["keyInTemporalEase"] = property.keyInTemporalEase(index);
            myKeyframe["keyOutTemporalEase"] = property.keyOutTemporalEase(index);
          }

          if ((property.propertyValueType === PropertyValueType.TwoD_SPATIAL) || (property.propertyValueType === PropertyValueType.ThreeD_SPATIAL)){
            myKeyframe["keySpatialAutoBezier"] = property.keySpatialAutoBezier(index);
            myKeyframe["keySpatialContinuous"] = property.keySpatialContinuous(index);
            myKeyframe["keyInSpatialTangent"] = property.keyInSpatialTangent(index);
            myKeyframe["keyOutSpatialTangent"] = property.keyOutSpatialTangent(index);
            myKeyframe["keyRoving"] = property.keyRoving(index);
          }

          return myKeyframe;
        }

        //Adding props and keys to layers
        for (var i = 0; i < selectedProps.length; i++) {
          if(selectedProps[i].numKeys > 0){
            var propLayerIndex = selectedProps[i].propertyGroup(selectedProps[i].propertyDepth).index;
            for (var a = 0; a < myLayers.length; a++) {
              if(myLayers[a].index == propLayerIndex){
                var myProp = {
                  prop:selectedProps[i],
                  keys:[]
                }
                for (var b = 0; b < selectedProps[i].selectedKeys.length; b++) {
                  myProp.keys.push(getKeyValues(selectedProps[i],selectedProps[i].selectedKeys[b]));
                }
                myLayers[a].props.push(myProp);
              }
            }
          }
        }


        timeOffset = activeItem.time - firstKeyTime;

        for (var i = 0; i < myLayers.length; i++) {
          for (var a = 0; a < myLayers[i].props.length; a++) {
            var currentProp = myLayers[i].props[a];
            for (var b = 0; b < currentProp.keys.length; b++) {
              var currentKey = currentProp.keys[b];
              var newTime = currentKey.keyTime + timeOffset;
              var newKeyIndex = currentProp.prop.addKey(newTime);
              currentProp.prop.setValueAtKey(newKeyIndex, currentKey.keyValue);

              if (currentKey.keyOutInterpolationType !== KeyframeInterpolationType.HOLD){
                currentProp.prop.setTemporalEaseAtKey(newKeyIndex, currentKey.keyInTemporalEase, currentKey.keyOutTemporalEase);
              }

              currentProp.prop.setInterpolationTypeAtKey(newKeyIndex, currentKey.keyInInterpolationType, currentKey.keyOutInterpolationType);

              if ((currentKey.keyInInterpolationType === KeyframeInterpolationType.BEZIER) && (currentKey.keyOutInterpolationType === KeyframeInterpolationType.BEZIER) && currentKey.keyTemporalContinuous){
                currentProp.prop.setTemporalContinuousAtKey(newKeyIndex, currentKey.keyTemporalContinuous);
                currentProp.prop.setTemporalAutoBezierAtKey(newKeyIndex, currentKey.keyTemporalAutoBezier);		// Implies Continuous, so do after it
              }

              if ((currentProp.prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) || (currentProp.prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL)){
                currentProp.prop.setSpatialContinuousAtKey(newKeyIndex, currentKey.keySpatialContinuous);
                currentProp.prop.setSpatialAutoBezierAtKey(newKeyIndex, currentKey.keySpatialAutoBezier);		// Implies Continuous, so do after it
                currentProp.prop.setSpatialTangentsAtKey(newKeyIndex, currentKey.keyInSpatialTangent, currentKey.keyOutSpatialTangent);
                currentProp.prop.setRovingAtKey(newKeyIndex, currentKey.keyRoving);
              }
            }
          }
        }

      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
      app.endUndoGroup();
    }
    //OFFSET END

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
