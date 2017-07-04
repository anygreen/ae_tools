{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Auto Fade", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyAutoFade v0.1'},\
            },\
            groupTwo: Group{orientation:'column',\
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

    //AUTO FADE START
    myPanel.grp.groupTwo.autoFadeButton.onClick = function () {
      try {
        app.beginUndoGroup("Added Auto-Fade");

        var autoFadeTime = myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputTime.autoFadeTime.text.toString();
        autoFadeTime = Number(autoFadeTime.replace(new RegExp(',','g'),'.'));
        myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputTime.autoFadeTime.text = autoFadeTime;

        var autoFadeMin = myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputOpacityMin.autoFadeMin.text.toString();
        autoFadeMin = Number(autoFadeMin.replace(new RegExp(',','g'),'.'));
        myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputOpacityMin.autoFadeMin.text = autoFadeMin;

        var autoFadeMax = myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputOpacityMax.autoFadeMax.text.toString();
        autoFadeMax = Number(autoFadeMax.replace(new RegExp(',','g'),'.'));
        myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputOpacityMax.autoFadeMax.text = autoFadeMax;

        if (isNaN(parseFloat(autoFadeTime)) || isNaN(parseFloat(autoFadeMin)) || isNaN(parseFloat(autoFadeMax))) {
          alert("An Error occured:\nPlease only use numbers as input");
          if (isNaN(parseFloat(autoFadeTime))){
            myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputTime.autoFadeTime.text = 10;
          }
          if (isNaN(parseFloat(autoFadeMin))){
            myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputMin.autoFadeMin.text = 0;
          }
          if (isNaN(parseFloat(autoFadeMax))){
            myPanel.grp.groupTwo.autoFadeInputWrapper.autoFadeInputMax.autoFadeMax.text = 100;
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
