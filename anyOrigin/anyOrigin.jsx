{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","anyOrigin v0.1", undefined, {resizeable:true});

    res = "group{orientation:'column',\
              groupOne: Group{orientation:'row',\
                btnSave: Button{text:'Save', preferredSize:[50,-1]},\
                btnRevert: Button{text:'Revert', preferredSize:[50,-1]},\
              },\
              btnClear: Button{text:'Clear', preferredSize:[50,15]},\
              staticText: StaticText{text:'', preferredSize:[200,15]},\
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

    var btnSave = myPanel.grp.groupOne.btnSave;
    var btnRevert = myPanel.grp.groupOne.btnRevert;
    var btnClear = myPanel.grp.btnClear;

    var proj, activeItem, selectedLayers;

    function getLayers(){
      var selectedLayers = app.project.activeItem.selectedLayers;
      return selectedLayers
    }

    function setMarkerWithOrigin(layer,origin){
      var originString = getTransforms(layer);
      var mv = new MarkerValue("anyOrigin");
      var parms = new Object;
      parms.transforms = originString;
      mv.setParameters(parms);
      layer.property("Marker").setValueAtTime(0, mv);
    }

    function getTransforms(layer){
      var anchorPoint = layer.transform.anchorPoint.value;
      var position = layer.transform.position.value;
      var scale = layer.transform.scale.value;
      var rotation = layer.transform.rotation.value;
      var opacity = layer.transform.opacity.value;

      var transformArray = [];
      transformArray.push(anchorPoint.toString());
      transformArray.push(position.toString());
      transformArray.push(scale.toString());
      transformArray.push(rotation.toString());
      transformArray.push(opacity.toString());

      var transformString = transformArray.join(";");

      return transformString
    }

    function removeMarkers(){
      var layer = getLayers();
      for (var i = 0; i < layer.length; i++) {
        var length = layer[i].property("Marker").numKeys;
        var originMarker = [];
        for (var l = 1; l < length+1; l++) {
          var comment = layer[i].property("Marker").keyValue(l).comment;
          if (comment == "anyOrigin") {
            originMarker.push(l);
          }
        }
        if (originMarker.length > 0) {
          for (var r = originMarker.length-1; r >= 0; r=r-1) {
            layer[i].property("Marker").removeKey(originMarker[r]);
          }
        }
      }
    }

    function revertOrigin(){
      var layer = getLayers();
      for (var i = 0; i < layer.length; i++) {
        var length = layer[i].property("Marker").numKeys;
        var originMarker = [];
        for (var l = 1; l < length+1; l++) {
          var comment = layer[i].property("Marker").keyValue(l).comment;
          if (comment == "anyOrigin") {
            originMarker.push(l);
          }
        }
        if (originMarker.length > 1) {
          alert("There are multiple anyOrigin markers.\nOnly the first one will be used to revert to origin.");
        }
        var originString = layer[i].property("Marker").keyValue(originMarker[0]).getParameters().transforms;
        var originObj = getOriginObj(originString);
        applyOrigin(layer[i],originObj);
      }
    }

    function getOriginObj(string){
      var originArray = string.split(";");
      originObj = {};
      originObj.anchorPoint = originArray[0].split(",");
      originObj.position = originArray[1].split(",");
      originObj.scale = originArray[2].split(",");
      originObj.rotation = originArray[3];
      originObj.opacity = originArray[4];
      return originObj
    };

    function applyOrigin(layer,originObj){
      removeAllKeys(layer.transform.anchorPoint);
      removeAllKeys(layer.transform.position);
      removeAllKeys(layer.transform.scale);
      removeAllKeys(layer.transform.rotation);
      removeAllKeys(layer.transform.opacity);

      layer.transform.anchorPoint.setValue(originObj.anchorPoint);
      layer.transform.position.setValue(originObj.position);
      layer.transform.scale.setValue(originObj.scale);
      layer.transform.rotation.setValue(originObj.rotation);
      layer.transform.opacity.setValue(originObj.opacity);
    }

    function removeAllKeys(property){
      for (var i = property.numKeys; i >= 1 ; i=i-1) {
        property.removeKey(i);
      }
    }

    btnSave.onClick = function () {
      app.beginUndoGroup("anyOrigin Save");
        var layer = getLayers();
        for (var i = 0; i < layer.length; i++) {
          setMarkerWithOrigin(layer[i]);
        }
      app.endUndoGroup();
    }

    btnClear.onClick = function () {
      app.beginUndoGroup("anyOrigin Clear");
      removeMarkers();
      app.endUndoGroup();
    }

    btnRevert.onClick = function () {
      app.beginUndoGroup("anyOrigin Revert");
      revertOrigin();
      app.endUndoGroup();
    }
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
