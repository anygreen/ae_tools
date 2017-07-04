{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","Auto In/Out", undefined, {resizeable:true});

    res = "group{orientation:'column', alignment:['fill','top'], alignChildren:['fill','fill'],\
            groupOne: Group{orientation:'column',\
              myStaticText: StaticText{text:'anyAutoInOut v0.1'},\
            },\
            groupTwo: Group{orientation:'column',\
              myStaticText: StaticText{text:'This sets the In/Out Point of a layer'},\
              myStaticText: StaticText{text:'according to the first/last keyframe'},\
              autoInOutGroup: Group{orientation:'row',\
                autoInOutButtonIn: Button{text:'Set In'},\
                autoInOutButtonOut: Button{text:'Set Out'},\
              },\
              autoInOutButtonInOut: Button{text:'Set In/Out'},\
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

    //AUTO IN OUT START
    myPanel.grp.groupTwo.autoInOutGroup.autoInOutButtonIn.onClick = function () {
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

    myPanel.grp.groupTwo.autoInOutGroup.autoInOutButtonOut.onClick = function () {
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

    myPanel.grp.groupTwo.autoInOutButtonInOut.onClick = function () {
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
