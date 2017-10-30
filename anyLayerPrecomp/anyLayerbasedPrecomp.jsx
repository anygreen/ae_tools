{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","anyLayerbasedPrecomp v0.1", undefined, {resizeable:true});

    res = "group{orientation:'column',\
            groupOne: Group{orientation:'column',\
              staticText: StaticText{text:'Instructions:'},\
              staticText: StaticText{text:'First select all children, and then select the base', preferredSize:[-1,15]},\
              btnPrecomp: Button{text:'Precompse!'},\
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
    var btnPrecomp = myPanel.grp.groupOne.btnPrecomp;

    function compare(a,b) {
      if (a.index < b.index)
        return -1;
      if (a.index > b.index)
        return 1;
      return 0;
    }

    function main(){
      try {
        var activeItem = app.project.activeItem;
        var selectedLayers = app.project.activeItem.selectedLayers;
        var baseLayer = selectedLayers[selectedLayers.length-1];
        var children = selectedLayers.slice(0,selectedLayers.length-1);
        children.sort(compare);

        //duplicating base layer
        var baseLayerDouble = baseLayer.duplicate();

        //parenting children
        // for (var i = 0; i < children.length; i++) {
        //   children[i].parent = baseLayerDouble;
        // }

        //precomp base
        var compName = prompt("Please enter the new name of the comp:",baseLayer.name);
        var newPrecomp = app.project.activeItem.layers.precompose([baseLayer.index],compName,false);


        //moveLayers into new comp
        baseLayerDouble.copyToComp(newPrecomp);
        for (var i = children.length-1; i >=0; i=i-1) {
          children[i].copyToComp(newPrecomp);
        }

        //parenting children
        var parentLayer = newPrecomp.layer(newPrecomp.layers.length-1);
        var grandParentLayer = newPrecomp.layer(newPrecomp.layers.length);
        for (var i = 1; i < newPrecomp.layers.length-1; i++) {
          newPrecomp.layers[i].parent = parentLayer;
        }
        parentLayer.parent = grandParentLayer;

        //adjust transformations
        parentLayer.anchorPoint.setValue(grandParentLayer.anchorPoint.value);
        parentLayer.position.setValue(grandParentLayer.position.value);
        parentLayer.scale.setValue(grandParentLayer.scale.value);
        parentLayer.rotation.setValue(grandParentLayer.rotation.value);

        //unparent
        for (var i = 1; i < newPrecomp.layers.length-1; i++) {
          newPrecomp.layers[i].parent = null;
        }

        //remove bottom layer
        newPrecomp.layer(newPrecomp.layers.length).remove();

        //remove original children and double
        for (var i = 0; i < children.length; i++) {
          children[i].remove();
        }
        baseLayerDouble.remove();

      } catch (e) {
        alert("Error in line: " + e.line + "\n" + e.toString());
      }
    }

    btnPrecomp.onClick = function () {
      app.beginUndoGroup("anyLayerbasedPrecomp");
      main();
      myScriptPal.close();
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
