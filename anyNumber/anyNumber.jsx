{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Counting Numbers", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyNumber v0.1'},\
            },\
            groupTwo: Group{orientation:'column', alignment:['center','top'],\
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
          }";

    myPanel.grp = myPanel.add(res);

    //Defaults:
    myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingSwitchCommaPeriod.value = true;
    myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingTxt5.enabled = false;
    myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.enabled = false;
    myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingTxt6.enabled = false;
    myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.enabled = false;

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


    function checkInt(input){
      var check;
      if(input == parseInt(input)){
        check = true;
      }else{
        check = false;
      };
      return check
    };

    //COUNTING NUMBERS START
    myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingLinear.onClick = function () {
      var buttonState = myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingLinear.value;
      if (buttonState) {
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingTxt5.enabled = true;
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.enabled = true;
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingTxt6.enabled = true;
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.enabled = true;
      } else {
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingTxt5.enabled = false;
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.enabled = false;
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingTxt6.enabled = false;
        myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.enabled = false;
      }
    }

    myPanel.grp.groupTwo.countingButton.onClick = function () {
      try {
        app.beginUndoGroup("Counting Numbers Applied");
        var error = false;

        var decimals = myPanel.grp.groupTwo.countingPanelGroup.countingPanel1.countingGroupDecimals.countingNumOfDecimals.text;
        if(checkInt(decimals)==false){
          myPanel.grp.groupTwo.countingPanelGroup.countingPanel1.countingGroupDecimals.countingNumOfDecimals.text = 3;
          error = true;
          alert("Wrong input for Amount of Decimals\nPlease only use numbers (integers)");
        }

        var charCount = myPanel.grp.groupTwo.countingPanelGroup.countingPanel1.countingGroupCharCount.countingMinNumberCount.text;
        if(checkInt(charCount)==false){
          myPanel.grp.groupTwo.countingPanelGroup.countingPanel1.countingGroupCharCount.countingMinNumberCount.text = 0;
          error = true;
          alert("Wrong input for Minimum Amount of Characters\nPlease only use numbers (integers)");
        }

        var linearMin = myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.text.toString();
        linearMin = Number(linearMin.replace(new RegExp(',','g'),'.'));
        if (isNaN(parseFloat(linearMin))){
          myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMin.countingLinearMin.text = 0;
          error = true;
          alert("Wrong input for Remap Min\nPlease only use numbers as input");
        }

        var linearMax = myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.text.toString();
        linearMax = Number(linearMax.replace(new RegExp(',','g'),'.'));
        if (isNaN(parseFloat(linearMax))){
          myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingGroupLinearMax.countingLinearMax.text = 5000;
          error = true;
          alert("Wrong input for Remap Max\nPlease only use numbers as input");
        }

        var prefix = myPanel.grp.groupTwo.countingPanelGroup.countingPanel1.countingGroupPrefix.countingPrefix.text;
        prefix = "\""+prefix+"\"";

        var suffix = myPanel.grp.groupTwo.countingPanelGroup.countingPanel1.countingGroupSuffix.countingSuffix.text;
        suffix = "\""+suffix+"\"";

        var thousands = myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingThousands.value.toString();

        var switchCommaPeriod = myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingSwitchCommaPeriod.value.toString();

        var remap = myPanel.grp.groupTwo.countingPanelGroup.countingPanel2.countingLinear.value.toString();

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
