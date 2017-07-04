{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","My Window Name", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyScripts v0.6'},\
            },\
            myTabbedPanel: Panel{type:'tabbedpanel',\
              tabOffset: Panel{type:'tab', text:'Offsets',\
                myStaticText: StaticText{text:''},\
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
              tabLoops: Panel{type:'tab', text:'Loops',\
                myStaticText: StaticText{text:''},\
                loopsDropdownInOut: DropDownList{properties:{items:['Loop IN','Loop OUT','Loop IN/OUT']}},\
                loopsDropdownType: DropDownList{properties:{items:['cycle','continue','pingpong','offset']}},\
                loopsButton: Button{text:'Apply'},\
                loopsReplace: Checkbox{text:'replace previous Expression'},\
              },\
              tabOvershoot: Panel{type:'tab', text:'Overshoot',\
                myStaticText: StaticText{text:''},\
                overshootTxt1: StaticText{text:'Frequency:'},\
                overshootFreq: EditText{text:'3', preferredSize:[80,-1], justify:'center'},\
                overshootTxt2: StaticText{text:'Delay'},\
                overshootDecay: EditText{text:'8', preferredSize:[80,-1], justify:'center'},\
                overshootButton: Button{text:'Apply'},\
              },\
              tabCountingNumbers: Panel{orientation:'column', type:'tab', text:'Counting Numbers',\
                myStaticText: StaticText{text:''},\
                countingPanelGroup: Group{orientation:'row', alignment:['fill','fill'],\
                  countingPanel1: Panel{orientation:'column', alignment:['fill','fill'], alignChildren:['right','right'],\
                    countingGroupDecimals: Group{orientation:'row',\
                      countingTxt1: StaticText{text:'Amount of Decimals:'},\
                      countingNumOfDecimals: EditText{text:'2', preferredSize:[80,-1], justify:'center'},\
                    },\
                    countingGroupCharCount: Group{orientation:'row',\
                      countingTxt2: StaticText{text:'Minimum Amount of Characters:'},\
                      countingMinNumberCount: EditText{text:'0', preferredSize:[80,-1], justify:'center'},\
                    },\
                    countingGroupPrefix: Group{orientation:'row',\
                      countingTxt3: StaticText{text:'Prefix:'},\
                      countingPrefix: EditText{text:'', preferredSize:[150,-1], justify:'left'},\
                    },\
                    countingGroupSuffix: Group{orientation:'row',\
                      countingTxt4: StaticText{text:'Suffix:'},\
                      countingSuffix: EditText{text:'', preferredSize:[150,-1], justify:'left'},\
                    },\
                  },\
                  countingPanel2: Panel{orientation:'column', alignment:['fill','fill'], alignChildren:['left','left'],\
                    countingThousands: Checkbox{text:'Break at Thousands'},\
                    countingSwitchCommaPeriod: Checkbox{text:'Switch Comma/Period'},\
                    countingLinear: Checkbox{text:'Remap Count from 0-100'},\
                    countingGroupLinearMin: Group{orientation:'row',\
                      countingTxt5: StaticText{text:'Min:'},\
                      countingLinearMin: EditText{text:'0', preferredSize:[120,-1], justify:'center'},\
                    },\
                    countingGroupLinearMax: Group{orientation:'row',\
                      countingTxt6: StaticText{text:'Max:'},\
                      countingLinearMax: EditText{text:'5000', preferredSize:[120,-1], justify:'center'},\
                    },\
                  },\
                },\
                countingButton: Button{text:'Apply', preferredSize:[250,-1]},\
              },\
              tabAutoFade: Panel{type:'tab', text:'Auto Fade',\
                myStaticText: StaticText{text:''},\
                myStaticText: StaticText{text:'The Fade-Time is defined in Frames'},\
                autoFadeInputWrapper: Group{orientation:'row',\
                  autoFadeInputTime: Group{orientation:'column',\
                    autoFadeText: StaticText{text:'Fade-Time:'},\
                    autoFadeTime: EditText{text:'10', preferredSize:[80,-1], justify:'center'},\
                  },\
                  autoFadeInputOpacityMin: Group{orientation:'column',\
                    autoFadeText: StaticText{text:'Opacity Min:'},\
                    autoFadeMin: EditText{text:'0', preferredSize:[80,-1], justify:'center'},\
                  },\
                  autoFadeInputOpacityMax: Group{orientation:'column',\
                    autoFadeText: StaticText{text:'Opacity Max:'},\
                    autoFadeMax: EditText{text:'100', preferredSize:[80,-1], justify:'center'},\
                  },\
                },\
              autoFadeButton: Button{text:'Apply'},\
              },\
              tabAutoInOut: Panel{type:'tab', text:'Auto set In/Out',\
                myStaticText: StaticText{text:''},\
                myStaticText: StaticText{text:'This sets the In/Out Point of a layer'},\
                myStaticText: StaticText{text:'according to the first/last keyframe'},\
                autoInOutGroup: Group{orientation:'row',\
                  autoInOutButtonIn: Button{text:'Set In'},\
                  autoInOutButtonOut: Button{text:'Set Out'},\
                },\
                autoInOutButtonInOut: Button{text:'Set In/Out'},\
              },\
              tabRandom: Panel{type:'tab', text:'Random Expressions',\
                myStaticText: StaticText{text:''},\
                randomPanelGroup: Group{orientation:'row', alignment:['fill','fill'],\
                  randomPanel1: Panel{orientation:'column', alignment:['left','fill'],\
                    RandomExButtonWiggle: Button{text:'Wiggle', preferredSize:[-1,20]},\
                    RandomExButtonMotor: Button{text:'Motor (value*time)', preferredSize:[-1,20]},\
                    RandomExButtonFixedSeed: Button{text:'FixedSeed', preferredSize:[-1,20]},\
                    RandomExButtonPosterize: Button{text:'Posterize Time', preferredSize:[-1,20]},\
                    RandomExButtonAutoZoom: Button{text:'AutoZoom', preferredSize:[-1,20]},\
                    RandomExButtonBounce: Button{text:'Bounce', preferredSize:[-1,20]},\
                  },\
                  randomPanel2: Panel{orientation:'column', alignment:['fill','fill'], alignChildren:['left','left'],\
                    RandomExTextBox: EditText{text:'Some text here', alignment:['fill','fill'], justify:'left', properties:{multiline:true}},\
                    RandomExButtonInfo: Button{text:'i', alignment:['left','bottom'], preferredSize:[20,20]},\
                    RandomExButtonCopy: Button{text:'Copy', alignment:['center','bottom']},\
                  },\
                },\
              },\
            },\
          }";

    myPanel.grp = myPanel.add(res);

    //Defaults:
    myPanel.grp.myTabbedPanel.tabLoops.loopsDropdownInOut.selection = 1;
    myPanel.grp.myTabbedPanel.tabLoops.loopsDropdownType.selection = 0;
    myPanel.grp.myTabbedPanel.tabLoops.loopsReplace.value = true;
    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingSwitchCommaPeriod.value = true;
    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingTxt5.enabled = false;
    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.enabled = false;
    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingTxt6.enabled = false;
    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.enabled = false;
    myPanel.grp.myTabbedPanel.tabOffset.offsetGroup0.offsetType.selection = 0;
    myPanel.grp.myTabbedPanel.tabOffset.offsetGroup1.offsetFrom.selection = 0;

    //Setup Panel Sizing
    myPanel.layout.layout(true);
    myPanel.grp.minimumSize = myPanel.grp.size;

    //Make the panel resizeable
    myPanel.layout.resize();
    // myPanel.onResizing = myPanel.onResize = function(){this.layout.resize()};

    /////////////////
    //THE SCRIPTING//
    /////////////////

    //GLOBAL FUNCTIONS
    function setExpression(expression){
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var selectedProps = activeItem.selectedProperties;

      if (selectedProps == "") {
        alert("The following Error occured:\nNo property selected")
      } else {
        //looping through all selected properties (including groups)
        for (var i = 0; i < selectedProps.length; i++) {
          var currentProp = selectedProps[i]; //defining currently selected property
          if(currentProp.numKeys!=undefined&&currentProp.canSetExpression==true){ //checking if property has keyframes do see if its a group
            currentProp.expression = expression;
          }
        }
      }
    };

    function checkInt(input){
      var check;
      if(input == parseInt(input)){
        check = true;
      }else{
        check = false;
      };
      return check
    };

    function deselectAll(){
        var activeItem = app.project.activeItem;
        var layerAmount = activeItem.numLayers;

        for (var i = 1; i <= layerAmount; i++) {
          activeItem.layer(i).selected = false;
        }
    };

    function copyToClipboard(string){
      if (string.includes("\"")) {
        alert("The expression contains double quotes.\nEither replace the doublequotes \" with single quotes ' or copy text manually.")
      }else{
        var copy = "echo \"" +  string.toString() + "\" | pbcopy"
        system.callSystem(copy);
      }
    };

    //LOOPS START
    myPanel.grp.myTabbedPanel.tabLoops.loopsButton.onClick = function () {
      try {
        app.beginUndoGroup("Applied Loop");
        var proj = app.project;
        var activeItem = proj.activeItem;
        var selectedLayers = activeItem.selectedLayers;
        var selectedProps = activeItem.selectedProperties;

        var loopInOut = myPanel.grp.myTabbedPanel.tabLoops.loopsDropdownInOut.selection;
        var loopType = myPanel.grp.myTabbedPanel.tabLoops.loopsDropdownType.selection;
        var loopReplace = myPanel.grp.myTabbedPanel.tabLoops.loopsReplace.value;

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

    //OVERSHOOT START
    myPanel.grp.myTabbedPanel.tabOvershoot.overshootButton.onClick = function () {
      try {
        app.beginUndoGroup("Overshoot Applied");

        var freq = myPanel.grp.myTabbedPanel.tabOvershoot.overshootFreq.text.toString();
        freq = Number(freq.replace(new RegExp(',','g'),'.'));
        myPanel.grp.myTabbedPanel.tabOvershoot.overshootFreq.text = freq;

        var decay = myPanel.grp.myTabbedPanel.tabOvershoot.overshootDecay.text.toString();
        decay = Number(decay.replace(new RegExp(',','g'),'.'));
        myPanel.grp.myTabbedPanel.tabOvershoot.overshootDecay.text = decay;

        if (isNaN(parseFloat(freq)) || isNaN(parseFloat(decay))) {
          alert("An Error occured:\nPlease only use numbers as input");
          if (isNaN(parseFloat(freq))){
            myPanel.grp.myTabbedPanel.tabOvershoot.overshootFreq.text = 3;
          }
          if (isNaN(parseFloat(decay))){
            myPanel.grp.myTabbedPanel.tabOvershoot.overshootDecay.text = 8;
          }
        } else {
          var expression = "//Overshoot freq="+freq+" || decay="+decay+"\nfreq = "+freq+";\ndecay = "+decay+";\nn = 0;\nif (numKeys > 0){\nn = nearestKey(time).index;\nif (key(n).time > time) n--;\n}\nif (n > 0){\nt = time - key(n).time;\namp = velocityAtTime(key(n).time - .001);\nw = freq*Math.PI*2;\nvalue + amp*(Math.sin(t*w)/Math.exp(decay*t)/w);\n}else\nvalue";
          setExpression(expression);
        }

        app.endUndoGroup();
      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    };
    //OVERSHOOT END

    //COUNTING NUMBERS START
    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingLinear.onClick = function () {
      var buttonState = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingLinear.value;
      if (buttonState) {
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingTxt5.enabled = true;
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.enabled = true;
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingTxt6.enabled = true;
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.enabled = true;
      } else {
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingTxt5.enabled = false;
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.enabled = false;
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingTxt6.enabled = false;
        myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.enabled = false;
      }
    }

    myPanel.grp.myTabbedPanel.tabCountingNumbers.countingButton.onClick = function () {
      try {
        app.beginUndoGroup("Counting Numbers Applied");
        var error = false;

        var decimals = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel1.countingGroupDecimals.countingNumOfDecimals.text;
        if(checkInt(decimals)==false){
          myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel1.countingGroupDecimals.countingNumOfDecimals.text = 3;
          error = true;
          alert("Wrong input for Amount of Decimals\nPlease only use numbers (integers)");
        }

        var charCount = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel1.countingGroupCharCount.countingMinNumberCount.text;
        if(checkInt(charCount)==false){
          myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel1.countingGroupCharCount.countingMinNumberCount.text = 0;
          error = true;
          alert("Wrong input for Minimum Amount of Characters\nPlease only use numbers (integers)");
        }

        var linearMin = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.text.toString();
        linearMin = Number(linearMin.replace(new RegExp(',','g'),'.'));
        if (isNaN(parseFloat(linearMin))){
          myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.text = 0;
          error = true;
          alert("Wrong input for Remap Min\nPlease only use numbers as input");
        }

        var linearMax = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.text.toString();
        linearMax = Number(linearMax.replace(new RegExp(',','g'),'.'));
        if (isNaN(parseFloat(linearMax))){
          myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.text = 5000;
          error = true;
          alert("Wrong input for Remap Max\nPlease only use numbers as input");
        }

        var prefix = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel1.countingGroupPrefix.countingPrefix.text;
        prefix = "\""+prefix+"\"";

        var suffix = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel1.countingGroupSuffix.countingSuffix.text;
        suffix = "\""+suffix+"\"";

        var thousands = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingThousands.value.toString();

        var switchCommaPeriod = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingSwitchCommaPeriod.value.toString();

        var remap = myPanel.grp.myTabbedPanel.tabCountingNumbers.countingPanelGroup.countingPanel2.countingLinear.value.toString();

        if (error == false) {
          var expression ='//counting number\nnumber = effect("number")("Slider");\nnumOfDecimals = '+decimals+';\nthousands = '+thousands+';\nswitchCommaPeriod = '+switchCommaPeriod+';\nminNumberCount = '+charCount+';\nprefix = '+prefix+';\nsuffix = '+suffix+';\nlinearCheck = '+remap+';\nlinearMin = '+linearMin+';\nlinearMax = '+linearMax+';\n//Map number if necessary\nif(linearCheck){\n	x = effect("number")("Slider").value;\n	number = linear(x,0,100,linearMin,linearMax);\n}\n//switch comma/period\nif(switchCommaPeriod){\n	comma = ".";\n	period = ",";\n} else {\n	comma = ",";\n	period = ".";\n}\n//adding decimals\nif(numOfDecimals == 0){\n	decimals = "";\n} else {\n	decimals = "";\n	power = Math.pow(10,numOfDecimals);\n	if(Math.floor(number*power)==0){\n		for(i=0; i<numOfDecimals; i++){\n			decimals = decimals + "0";\n		}\n		decimals = period+decimals;\n	} else {\n		numberPrep = Math.floor(number*power)/power;\n		decimals = period +numberPrep.toFixed(numOfDecimals).toString().split(".")[1];\n	}\n}\n//adding leading zeros\nnumberFlat = Math.floor(number).toString();\nif(numberFlat.length < minNumberCount){\n	numOfLoops = minNumberCount-numberFlat.length;\n	for(i=0; i < numOfLoops; i++){\n		numberFlat = "0"+numberFlat;\n	}\n}\n//splitting thousands\nif(thousands){\n	numberArray = [];\n	numberRest = numberFlat;\n	while (numberRest.length > 3){\n		numberArray.push([numberRest.slice(-3)]);\n		numberRest = numberRest.slice(0,-3);\n	}\n	threes = "";\n	for (i=0; i<numberArray.length; i++){\n		threes = comma+numberArray[i].toString()+threes.toString();\n	}\n	mainNumber = numberRest+threes;\n} else {\n	mainNumber = numberFlat;\n}\n//adding everything together\nprefix+mainNumber+decimals+suffix';

          function setTextExpression(expression){
            var proj = app.project;
            var activeItem = proj.activeItem;
            var selectedLayers = activeItem.selectedLayers;

            if (selectedLayers == "") {
              alert("The following Error occured:\nNo layer selected!");
            } else {

              //looping through all selected properties (including groups)
              for (var i = 0; i < selectedLayers.length; i++) {
                var currentLayer = selectedLayers[i]; //defining currently selected Layer
                try {
                  var currentProp = currentLayer.property("Text").property("Source Text");
                  if(currentLayer.property("Effects").property("number") == null) {
                    var slider = currentLayer.Effects.addProperty("Slider Control");
                    slider.name = "number";
                  }

                  if(currentProp.numKeys!=undefined&&currentProp.canSetExpression==true){ //checking if property has keyframes do see if its a group
                    currentProp.expression = expression;
                  }
                } catch (e) {
                    alert("Please only select text layers");
                    //alert("Error in line: " + e.line + "\n" + e.toString());
                }

                /*
                if(currentProp.numKeys!=undefined&&currentProp.canSetExpression==true){ //checking if property has keyframes do see if its a group
                  currentProp.expression = expression;
                }*/
              }
            }
          };

          setTextExpression(expression);
        }

        app.endUndoGroup();
      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    }
    //COUNTING NUMBERS END

    //OFFSET START
    myPanel.grp.myTabbedPanel.tabOffset.offsetButton.onClick = function () {
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

          var offsetAmount = myPanel.grp.myTabbedPanel.tabOffset.offsetGroup2.offsetAmount.text.toString();
          offsetAmount = Number(offsetAmount.replace(new RegExp(',','g'),'.'));

          if (isNaN(parseFloat(offsetAmount))) {
            alert("An Error occured:\nPlease only use numbers as input");
            myPanel.grp.myTabbedPanel.tabOffset.offsetGroup2.offsetAmount.text = 1;
          } else {
            myPanel.grp.myTabbedPanel.tabOffset.offsetGroup2.offsetAmount.text = offsetAmount;
            offsetAmount = offsetAmount*activeItem.frameDuration;
            var offset;

            var offsetFrom = myPanel.grp.myTabbedPanel.tabOffset.offsetGroup1.offsetFrom.selection;
            var offsetType = myPanel.grp.myTabbedPanel.tabOffset.offsetGroup0.offsetType.selection;
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

    myPanel.grp.myTabbedPanel.tabOffset.offsetButtonCopyPaste.onClick = function () {
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

    //AUTO FADE START
    myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeButton.onClick = function () {
      try {
        app.beginUndoGroup("Added Auto-Fade");

        var autoFadeTime = myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputTime.autoFadeTime.text.toString();
        autoFadeTime = Number(autoFadeTime.replace(new RegExp(',','g'),'.'));
        myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputTime.autoFadeTime.text = autoFadeTime;

        var autoFadeMin = myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputOpacityMin.autoFadeMin.text.toString();
        autoFadeMin = Number(autoFadeMin.replace(new RegExp(',','g'),'.'));
        myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputOpacityMin.autoFadeMin.text = autoFadeMin;

        var autoFadeMax = myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputOpacityMax.autoFadeMax.text.toString();
        autoFadeMax = Number(autoFadeMax.replace(new RegExp(',','g'),'.'));
        myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputOpacityMax.autoFadeMax.text = autoFadeMax;

        if (isNaN(parseFloat(autoFadeTime)) || isNaN(parseFloat(autoFadeMin)) || isNaN(parseFloat(autoFadeMax))) {
          alert("An Error occured:\nPlease only use numbers as input");
          if (isNaN(parseFloat(autoFadeTime))){
            myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputTime.autoFadeTime.text = 10;
          }
          if (isNaN(parseFloat(autoFadeMin))){
            myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputMin.autoFadeMin.text = 0;
          }
          if (isNaN(parseFloat(autoFadeMax))){
            myPanel.grp.myTabbedPanel.tabAutoFade.autoFadeInputWrapper.autoFadeInputMax.autoFadeMax.text = 100;
          }
        } else {
          var expression = "//Auto-Fade Fade-Time="+autoFadeTime+" || Opacity-Min="+autoFadeMin+" || Opacity-Max="+autoFadeMax+"\n\nfadeTime = "+autoFadeTime+";\nopacityMin = "+autoFadeMin+";\nopacityMax = "+autoFadeMax+";\nlayerDuration = outPoint - inPoint;\nsingleFrame = thisComp.frameDuration;\n\nanimateIn = linear(time, inPoint, (inPoint + framesToTime(fadeTime)), opacityMin, opacityMax);\nanimateOut = linear(time, (outPoint - framesToTime(fadeTime+1)), (outPoint-singleFrame), opacityMax, opacityMin);\n\nif(time < (layerDuration/2+inPoint)){\nanimateIn;\n}else{\nanimateOut;\n}";
          var proj = app.project;
          var activeItem = proj.activeItem;
          var initialSelectedLayers = activeItem.selectedLayers;

          for (var i = 0; i < initialSelectedLayers.length; i++) {
            initialSelectedLayers[i].property("Opacity").expression = expression;
          }
        }

        app.endUndoGroup();
      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    }
    //AUTO FADE END

    //AUTO IN OUT START
    myPanel.grp.myTabbedPanel.tabAutoInOut.autoInOutGroup.autoInOutButtonIn.onClick = function () {
      app.beginUndoGroup("Auto Set In");
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var hasKeyframes = false;
      var earliestKey = 10000;

      function setEarliestKey(propGroup){
        var i, prop;
        for (i=1; i<=propGroup.numProperties; i++){
          prop = propGroup.property(i);
          if (prop.propertyType === PropertyType.PROPERTY){
            if (prop.numKeys > 0){
              hasKeyframes = true;
              if (prop.keyTime(1) < earliestKey){
                earliestKey = prop.keyTime(1);
              }
            }
          }else if ((prop.propertyType === PropertyType.INDEXED_GROUP) || (prop.propertyType === PropertyType.NAMED_GROUP)){
            setEarliestKey(prop);
          }
        }
      }

      for (var i = 0; i < selectedLayers.length; i++) {
        hasKeyframes = false;
        earliestKey = 10000;
        setEarliestKey(selectedLayers[i]);
        var previousOut = selectedLayers[i].outPoint;
        selectedLayers[i].inPoint = earliestKey;
        selectedLayers[i].outPoint = previousOut;
      }
      app.endUndoGroup();
    };

    myPanel.grp.myTabbedPanel.tabAutoInOut.autoInOutGroup.autoInOutButtonOut.onClick = function () {
      app.beginUndoGroup("Auto Set Out");
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var hasKeyframes = false;
      var lastKey = 0;

      function setLastKey(propGroup){
        var i, prop;
        for (i=1; i<=propGroup.numProperties; i++){
          prop = propGroup.property(i);
          if (prop.propertyType === PropertyType.PROPERTY){
            if (prop.numKeys > 0){
              hasKeyframes = true;
              if (prop.keyTime(prop.numKeys) > lastKey){
                lastKey = prop.keyTime(prop.numKeys);
              }
            }
          }else if ((prop.propertyType === PropertyType.INDEXED_GROUP) || (prop.propertyType === PropertyType.NAMED_GROUP)){
            setLastKey(prop);
          }
        }
      }

      for (var i = 0; i < selectedLayers.length; i++) {
        hasKeyframes = false;
        lastKey = 0;
        setLastKey(selectedLayers[i]);
        selectedLayers[i].outPoint = lastKey;
      }
      app.endUndoGroup();
    };

    myPanel.grp.myTabbedPanel.tabAutoInOut.autoInOutButtonInOut.onClick = function () {
      app.beginUndoGroup("Auto Set In/Out");
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;
      var hasKeyframes = false;
      var lastKey = 0;
      var earliestKey = 10000;

      function setLastKey(propGroup){
        var i, prop;
        for (i=1; i<=propGroup.numProperties; i++){
          prop = propGroup.property(i);
          if (prop.propertyType === PropertyType.PROPERTY){
            if (prop.numKeys > 0){
              hasKeyframes = true;
              if (prop.keyTime(prop.numKeys) > lastKey){
                lastKey = prop.keyTime(prop.numKeys);
              }
            }
          }else if ((prop.propertyType === PropertyType.INDEXED_GROUP) || (prop.propertyType === PropertyType.NAMED_GROUP)){
            setLastKey(prop);
          }
        }
      }

      function setEarliestKey(propGroup){
        var i, prop;
        for (i=1; i<=propGroup.numProperties; i++){
          prop = propGroup.property(i);
          if (prop.propertyType === PropertyType.PROPERTY){
            if (prop.numKeys > 0){
              hasKeyframes = true;
              if (prop.keyTime(1) < earliestKey){
                earliestKey = prop.keyTime(1);
              }
            }
          }else if ((prop.propertyType === PropertyType.INDEXED_GROUP) || (prop.propertyType === PropertyType.NAMED_GROUP)){
            setEarliestKey(prop);
          }
        }
      }

      for (var i = 0; i < selectedLayers.length; i++) {
        hasKeyframes = false;
        lastKey = 0;
        earliestKey = 1000000;
        setEarliestKey(selectedLayers[i]);
        selectedLayers[i].inPoint = earliestKey;
        setLastKey(selectedLayers[i]);
        selectedLayers[i].outPoint = lastKey;
      }
      app.endUndoGroup();
    };
    //AUTO IN OUT END

    //RANDOM EXPRESSIONS START

    var expressionForBox = "";

    function setExpressionForBox(expression){
      myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel2.RandomExTextBox.text = expression;
      expressionForBox = expression;
    };

    var randomExInfo = "no expression set";
    function setRandomExInfo(info){
      myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel2.RandomExHelp.text = info;
    };

    //Wiggle
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel1.RandomExButtonWiggle.onClick = function () {
      setExpressionForBox("wiggle(frequency,amount)");
      randomExInfo = "wiggle(frequency,amount)\nexample: wiggle(1,200)\n\nThe first value is the frequence. It\'s kinda how quick the the property wiggles.\nThe second value is the amount, which defines the maximum amount the property is allowed to be changed."
    };

    //Motor
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel1.RandomExButtonMotor.onClick = function () {
      setExpressionForBox("value*time");
      randomExInfo = "value*time\nThis expression takes the input value of the corresponding property and multiplies it by the current time.\nThat way it generates kind of a motor.\n\nExmple:\nYou enter 90° for the rotation.\nAt the beginning of the timeline it will be 0°.\nAt 1 second it will be 90°.\nAt 2 seconds it will be 180°.\nAnd so on...";
    };

    //fixed Seed
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel1.RandomExButtonFixedSeed.onClick = function () {
      setExpressionForBox("seedRandom(index);");
      randomExInfo = "seedRandom()\nUsually, every expression that uses randomnes (like the wiggle for instance) needs a seed that defines the randomnes. Each property has it's own seed, so whenever you apply a wiggle it will wiggle in a different way.\nIf you however set the randomness with this expression before you apply the wiggle, you make sure that the wiggle will always act the same - no matter on which property or layer it is applied.\n\nExample:\n\nseedRandom(3);\nwiggle(1,200)";
    };

    //posterize Time
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel1.RandomExButtonPosterize.onClick = function () {
      setExpressionForBox("posterizeTime(1);");
      randomExInfo = "Sorry :/\nThere is no additional information about this expression.";
    };

    //AutoZoom
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel1.RandomExButtonAutoZoom.onClick = function () {
      setExpressionForBox("cam = thisComp.layer('Projector');\ndistance = length(sub(position, cam.position));\nscale * distance / cam.zoom;");
      randomExInfo = "Sorry :/\nThere is no additional information about this expression.";
    };

    //bounce
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel1.RandomExButtonBounce.onClick = function () {
      setExpressionForBox("e = .7;\ng = 5000;\nnMax = 9;\n\nn = 0;\nif (numKeys > 0){\n  n = nearestKey(time).index;\n  if (key(n).time > time) n--;\n}\nif (n > 0){\n  t = time - key(n).time;\n  v = -velocityAtTime(key(n).time - .001)*e;\n  vl = length(v);\n  if (value instanceof Array){\n    vu = (vl > 0) ? normalize(v) : [0,0,0];\n  }else{\n    vu = (v < 0) ? -1 : 1;\n  }\n  tCur = 0;\n  segDur = 2*vl/g;\n  tNext = segDur;\n  nb = 1; // number of bounces\n  while (tNext < t && nb <= nMax){\n    vl *= e;\n    segDur *= e;\n    tCur = tNext;\n    tNext += segDur;\n    nb++\n  }\n  if(nb <= nMax){\n    delta = t - tCur;\n    value +  vu*delta*(vl - g*delta/2);\n  }else{\n    value\n  }\n}else\n  value");
      randomExInfo = "Bounce\nFor more information visit:\n\nhttp://www.motionscript.com/articles/bounce-and-overshoot.html\n\nOr watch a nice tutorial here:\nhttps://www.youtube.com/watch?v=8pPSd6aSVnQ";
    };

    //copy button
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel2.RandomExButtonCopy.onClick = function () {
      var textFromBox = myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel2.RandomExTextBox.text;
      copyToClipboard(textFromBox);
    };

    //info button
    myPanel.grp.myTabbedPanel.tabRandom.randomPanelGroup.randomPanel2.RandomExButtonInfo.onClick = function () {
      alert(randomExInfo);
    };
    //RANDOM EXPRESSIONS END

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
