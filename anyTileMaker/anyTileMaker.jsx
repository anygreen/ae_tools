try{

  //<editor-fold> startup variables

  var proj = app.project;
  var activeItem = proj.activeItem;

  var compWidth = activeItem.width;
  var compHeight = activeItem.height;

  var amountX = 7;
  var amountY = 7;

  var tileWidth = compWidth/amountX;
  var tileHeight = compHeight/amountY;

  //</editor-fold>

  //<editor-fold> functions - creating solids

  //Creates a solid with a random green color and different options
  function createSolid(options){
    var color = options.color;
    var name = options.name;
    var width = options.width;
    var height = options.height;
    var position = options.position;
    var anchorPoint = options.anchorPoint;

    var mySolid = activeItem.layers.addSolid(color, name, width, height, 1);
    mySolid.anchorPoint.setValue(anchorPoint);
    mySolid.position.setValue(position);

    return mySolid
  }

  //recursively creates solids along the x axis
  function createSolidsX(lineNumber){
    for (var a = 0; a < amountX; a++) {

      createSolid({
        color:randomColor(),
        name:"TILE_L"+lineNumber+"_T"+a,
        width:Math.ceil(tileWidth),
        height:Math.ceil(tileHeight),
        position:[tileWidth*a,tileHeight*lineNumber,0],
        anchorPoint:[0,0,0]
      });

    }
  }

  //recursivley all solids
  function createSolids(){
    for (var b = 0; b < amountY; b++) {
      createSolidsX(b);
    }
  }

  //check if the specified number is a divider for the ref
  function checkDivide(amount,ref){
    if (ref%amount > 0) {
      return false
    } else {
      return true
    }
  }

  //calculates all deviders of a number
  function findDivide(number){

    var dividers = [];

    for (var i = 0; i < number; i++) {
      var current = checkDivide(i,number);
      if (current) {
          dividers.push(i)
      }
    }
    alert(dividers);
  }


  // function reduceContrast(value,amount){
  //     var result = (value*amount)+0.5;
  //     return result;
  // }

  //creates a random (green) color
  function randomColor(){
    var colorR = generateRandomNumber()*0.1;
    var colorG = (generateRandomNumber()*0.5)+0.3;
    var colorB = generateRandomNumber()*0.2;

    return [colorR,colorG,colorB]
  };
  //this function creates an array filled with the names of the layers that were selected
  function selectionToNameArray(array){
    var newArray = [];
    for (var i = 0; i < array.length; i++) {
      newArray.push(array[i].name);
    }
    return newArray
  }

  //gets the name of the top left and bottom right solid
  function getFirstAndLast(names){
    var arrayL = [];
    var arrayT = [];

    for (var i = 0; i < names.length; i++) {
      var splitInfo = names[i].split("_");
      var splitL = splitInfo[1].substr(1);
      var splitT = splitInfo[2].substr(1);
      arrayL.push(splitL);
      arrayT.push(splitT);
    }

    arrayL.sort(function(a, b){return a - b});
    arrayT.sort(function(a, b){return a - b});

    var firstTile = "TILE_L"+arrayL[0]+"_T"+arrayT[0];
    var lastTile = "TILE_L"+arrayL.pop()+"_T"+arrayT.pop();

    return [firstTile,lastTile]
  }

  //finds a layer by its name
  function getLayerObjectByName(name,selection){
    var myObject;
    for (var i = 0; i < selection.length; i++) {
      if (selection[i].name == name){
        myObject = selection[i];
      }
    }
    return myObject
  }

  //calculates the properties of a solid that covers the selected solids
  function calculategroupedSolid(firstAndLast,selectedLayers){
    var firstTile = getLayerObjectByName(firstAndLast[0],selectedLayers);
    var topLeft = firstTile.position.value;
    topLeft = [Math.round(topLeft[0]),Math.round(topLeft[1]),0];

    var lastTile = getLayerObjectByName(firstAndLast[1],selectedLayers);
    var lastTileWidth = tileWidth;
    var lastTileHeight = tileHeight;
    var bottomRight = lastTile.position.value+[lastTileWidth,lastTileHeight,0];
    bottomRight = [Math.round(bottomRight[0]),Math.round(bottomRight[1]),0];

    var newSize = bottomRight-topLeft;

    var newSolid = {
      position:topLeft+[newSize[0]/2,newSize[1]/2,0],
      anchorPoint:[newSize[0]/2,newSize[1]/2,0],
      width:newSize[0],
      height:newSize[1]
    }

    return newSolid
  }

  //removes all selected solids from the project
  function removeSelected(selectedLayers){
    for (var i = 0; i < selectedLayers.length; i++) {
      selectedLayers[i].source.remove();
    }
  }


  //</editor-fold>


  function selectionToSolid(){
    var selectedLayers = activeItem.selectedLayers;
    var names = selectionToNameArray(selectedLayers);
    var firstAndLast = getFirstAndLast(names);
    var newSolid = calculategroupedSolid(firstAndLast,selectedLayers);

    var newTileName = prompt("Enter the name of the new Comp","Tile_0");

    removeSelected(selectedLayers);

    var solidForComp = createSolid({
      color:randomColor(),
      name:newTileName,
      width:newSolid.width,
      height:newSolid.height,
      position:newSolid.position,
      anchorPoint:newSolid.anchorPoint
    });

    activeItem.layers.precompose([solidForComp.index],newTileName,false);
  }

  app.beginUndoGroup("splitRGB");

  // createSolids();
  selectionToSolid();

  app.endUndoGroup();


} catch(err) {
  alert("Error in line: " + err.line + "\n" + err.toString());
}
