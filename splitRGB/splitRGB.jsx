try{

  function addShiftChannels(layer,channel){
    var effect = layer.Effects.addProperty("Shift Channels");
    return effect;
  };

  function setMode0(newRC,newGC,newBC){
    newRC.property(2).setValue(2);
    newRC.property(3).setValue(2);
    newRC.property(4).setValue(2);

    newGC.property(2).setValue(3);
    newGC.property(3).setValue(3);
    newGC.property(4).setValue(3);

    newBC.property(2).setValue(4);
    newBC.property(3).setValue(4);
    newBC.property(4).setValue(4);
  }

  function setMode1(newRC,newGC,newBC){
    newRC.property(1).setValue(2);
    newRC.property(2).setValue(9);
    newRC.property(3).setValue(9);
    newRC.property(4).setValue(9);

    newGC.property(1).setValue(3);
    newGC.property(2).setValue(9);
    newGC.property(3).setValue(9);
    newGC.property(4).setValue(9);

    newBC.property(1).setValue(4);
    newBC.property(2).setValue(9);
    newBC.property(3).setValue(9);
    newBC.property(4).setValue(9);
  }

  function setMode2(newRC,newGC,newBC){
    newRC.property(2).setValue(2);
    newRC.property(3).setValue(10);
    newRC.property(4).setValue(10);

    newGC.property(2).setValue(10);
    newGC.property(3).setValue(3);
    newGC.property(4).setValue(10);

    newBC.property(2).setValue(10);
    newBC.property(3).setValue(10);
    newBC.property(4).setValue(4);
  }

  function setChannels(mode,newRC,newGC,newBC){

    if (mode == "luma mattes") {
      setMode0(newRC,newGC,newBC);
    }

    if (mode == "alpha mattes") {
      setMode1(newRC,newGC,newBC);
    }

    if (mode == "RGB mattes") {
      setMode2(newRC,newGC,newBC);
    }

  }


  if (app.project.activeItem.selectedLayers.length >= 1) {

    var myWin = new Window("palette", "splitRGB settings", undefined);
        myWin.orientation = "column";

    var groupOne = myWin.add("group", undefined, "GroupOne");
        groupOne.orientation = "row";
        var keep = groupOne.add("checkbox", undefined, "Keep original layer");
        keep.value = 1;

    var groupTwo = myWin.add("group", undefined, "GroupTwo");
        groupTwo.orientation = "row";
        groupTwo.add("statictext", undefined, "Mode:");
        var mode = groupTwo.add("dropdownlist", undefined, ["luma mattes","alpha mattes","RGB mattes"]);
        mode.selection = 0;

    var groupThree = myWin.add("group", undefined, "GroupThree");

    var apply = groupThree.add("button", undefined, "Apply");

    myWin.center();
    myWin.show();

    apply.onClick = function(){
      app.beginUndoGroup("splitRGB");
      myWin.close();
      var proj = app.project;
      var activeItem = proj.activeItem;
      var selectedLayers = activeItem.selectedLayers;

      layerObj = [];

      for (var i = 0; i < selectedLayers.length; i++) {
        layerObj.push(selectedLayers[i])
      }

      for (var i = 0; i < layerObj.length; i++) {
        var currentLayer = layerObj[i];

        var newR = currentLayer.duplicate();
        newR.name = newR.name+" [R]";
        var newRC = addShiftChannels(newR);

        var newG = currentLayer.duplicate();
        newG.name = newG.name+" [G]";
        var newGC = addShiftChannels(newG);

        var newB = currentLayer.duplicate();
        newB.name = newB.name+" [B]";
        var newBC = addShiftChannels(newB);

        setChannels(mode.selection.toString(),newRC,newGC,newBC);

        if (keep == false) {
          currentLayer.remove();
        }
      }
      app.endUndoGroup();
    }

  } else {
    alert("No layers selected");
  }


} catch(err) {
  alert("Error in line: " + err.line + "\n" + err.toString());
}
