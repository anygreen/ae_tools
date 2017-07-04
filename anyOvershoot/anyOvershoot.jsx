{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Overshoot", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['center','top'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyOvershoot v0.1'},\
            },\
            groupTwo: Group{orientation:'row', alignment:['center','top'],\
              myStaticText: StaticText{text:''},\
              groupLeft: Group{orientation:'column', alignment:['center','top'],\
                overshootTxt1: StaticText{text:'Frequency:'},\
                overshootFreq: EditText{text:'3', preferredSize:[80,-1], justify:'center'},\
              },\
              groupRight: Group{orientation:'column', alignment:['center','top'],\
                overshootTxt2: StaticText{text:'Decay:'},\
                overshootDecay: EditText{text:'8', preferredSize:[80,-1], justify:'center'},\
              },\
            },\
            overshootButton: Button{text:'Apply'},\
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

    //OVERSHOOT START
    myPanel.grp.overshootButton.onClick = function () {
      try {
        app.beginUndoGroup("Overshoot Applied");

        var freq = myPanel.grp.groupTwo.groupLeft.overshootFreq.text.toString();
        freq = Number(freq.replace(new RegExp(',','g'),'.'));
        myPanel.grp.groupTwo.groupLeft.overshootFreq.text = freq;

        var decay = myPanel.grp.groupTwo.groupRight.overshootDecay.text.toString();
        decay = Number(decay.replace(new RegExp(',','g'),'.'));
        myPanel.grp.groupTwo.groupRight.overshootDecay.text = decay;

        if (isNaN(parseFloat(freq)) || isNaN(parseFloat(decay))) {
          alert("An Error occured:\nPlease only use numbers as input");
          if (isNaN(parseFloat(freq))){
            myPanel.grp.groupTwo.groupLeft.overshootFreq.text = 3;
          }
          if (isNaN(parseFloat(decay))){
            myPanel.grp.groupTwo.groupRight.overshootDecay.text = 8;
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
