{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Random Expressions", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','fill'], alignChildren:['fill','top'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyRandomExpression v0.1'},\
            },\
            groupTwo: Group{orientation:'column',\
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

    //GLOBAL FUNCTIONS

    function copyToClipboard(string){
      if (string.includes("\"")) {
        alert("The expression contains double quotes.\nEither replace the doublequotes \" with single quotes ' or copy text manually.")
      }else{
        var copy = "echo \"" +  string.toString() + "\" | pbcopy"
        system.callSystem(copy);
      }
    };

    //RANDOM EXPRESSIONS START

    var expressionForBox = "";

    function setExpressionForBox(expression){
      myPanel.grp.groupTwo.randomPanelGroup.randomPanel2.RandomExTextBox.text = expression;
      expressionForBox = expression;
    };

    var randomExInfo = "no expression set";
    function setRandomExInfo(info){
      myPanel.grp.groupTwo.randomPanelGroup.randomPanel2.RandomExHelp.text = info;
    };

    //Wiggle
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel1.RandomExButtonWiggle.onClick = function () {
      setExpressionForBox("wiggle(frequency,amount)");
      randomExInfo = "wiggle(frequency,amount)\nexample: wiggle(1,200)\n\nThe first value is the frequence. It\'s kinda how quick the the property wiggles.\nThe second value is the amount, which defines the maximum amount the property is allowed to be changed."
    };

    //Motor
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel1.RandomExButtonMotor.onClick = function () {
      setExpressionForBox("value*time");
      randomExInfo = "value*time\nThis expression takes the input value of the corresponding property and multiplies it by the current time.\nThat way it generates kind of a motor.\n\nExmple:\nYou enter 90° for the rotation.\nAt the beginning of the timeline it will be 0°.\nAt 1 second it will be 90°.\nAt 2 seconds it will be 180°.\nAnd so on...";
    };

    //fixed Seed
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel1.RandomExButtonFixedSeed.onClick = function () {
      setExpressionForBox("seedRandom(index);");
      randomExInfo = "seedRandom()\nUsually, every expression that uses randomnes (like the wiggle for instance) needs a seed that defines the randomnes. Each property has it's own seed, so whenever you apply a wiggle it will wiggle in a different way.\nIf you however set the randomness with this expression before you apply the wiggle, you make sure that the wiggle will always act the same - no matter on which property or layer it is applied.\n\nExample:\n\nseedRandom(3);\nwiggle(1,200)";
    };

    //posterize Time
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel1.RandomExButtonPosterize.onClick = function () {
      setExpressionForBox("posterizeTime(1);");
      randomExInfo = "Sorry :/\nThere is no additional information about this expression.";
    };

    //AutoZoom
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel1.RandomExButtonAutoZoom.onClick = function () {
      setExpressionForBox("cam = thisComp.layer('Projector');\ndistance = length(sub(position, cam.position));\nscale * distance / cam.zoom;");
      randomExInfo = "Sorry :/\nThere is no additional information about this expression.";
    };

    //bounce
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel1.RandomExButtonBounce.onClick = function () {
      setExpressionForBox("e = .7;\ng = 5000;\nnMax = 9;\n\nn = 0;\nif (numKeys > 0){\n  n = nearestKey(time).index;\n  if (key(n).time > time) n--;\n}\nif (n > 0){\n  t = time - key(n).time;\n  v = -velocityAtTime(key(n).time - .001)*e;\n  vl = length(v);\n  if (value instanceof Array){\n    vu = (vl > 0) ? normalize(v) : [0,0,0];\n  }else{\n    vu = (v < 0) ? -1 : 1;\n  }\n  tCur = 0;\n  segDur = 2*vl/g;\n  tNext = segDur;\n  nb = 1; // number of bounces\n  while (tNext < t && nb <= nMax){\n    vl *= e;\n    segDur *= e;\n    tCur = tNext;\n    tNext += segDur;\n    nb++\n  }\n  if(nb <= nMax){\n    delta = t - tCur;\n    value +  vu*delta*(vl - g*delta/2);\n  }else{\n    value\n  }\n}else\n  value");
      randomExInfo = "Bounce\nFor more information visit:\n\nhttp://www.motionscript.com/articles/bounce-and-overshoot.html\n\nOr watch a nice tutorial here:\nhttps://www.youtube.com/watch?v=8pPSd6aSVnQ";
    };

    //copy button
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel2.RandomExButtonCopy.onClick = function () {
      var textFromBox = myPanel.grp.groupTwo.randomPanelGroup.randomPanel2.RandomExTextBox.text;
      copyToClipboard(textFromBox);
    };

    //info button
    myPanel.grp.groupTwo.randomPanelGroup.randomPanel2.RandomExButtonInfo.onClick = function () {
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
