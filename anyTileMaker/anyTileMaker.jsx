// Version 0.2


//<editor-fold> startup variables

var proj,activeItem,compWidth,compHeight,tileWidth,tileHeight;

function setVariables(){
  proj = app.project;
  activeItem = proj.activeItem;

  compWidth = activeItem.width;
  compHeight = activeItem.height;

  amountX = parseInt(amountXinput.text);
  amountY = parseInt(amountYinput.text);

  tileWidth = compWidth/amountX;
  tileHeight = compHeight/amountY;

}

//</editor-fold>

//<editor-fold> functions

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

//detects if layer toches the edges of the comp
function edgeDetection(element){

  var addDistance = 2;
  var detection = [];
  var topLeft = element.position.value-element.anchorPoint.value;
  var bottomRight = topLeft+[element.width,element.height,0];

  //detecting top
  if (topLeft[1] < addDistance && topLeft[1] > addDistance*-1) {
    detection.push("top");
  }

  //detecting right
  if (bottomRight[0] < activeItem.width+addDistance && bottomRight[0] > activeItem.width-addDistance) {
    detection.push("right");
  }

  //detecting bottom
  if (bottomRight[1] < activeItem.height+addDistance && bottomRight[1] > activeItem.height-addDistance) {
    detection.push("bottom");
  }

  //detecting left
  if (topLeft[0] < addDistance && topLeft[0] > addDistance*-1) {
    detection.push("left");
  }

  return detection
}

//checks if b is part of a (a needs to be an array)
function checkContent(a,b){
  var contains = false;
  for (var i = 0; i < a.length; i++) {
    if(a[i] == b){
      contains = true;
    }
  }
  return contains
};

//creates the shape layer for the border
function createBorder(element){
  // alert(element.source);
  var source = element.source;
  var shape = source.layers.addShape();
  var rect = shape.property("Contents").addProperty("ADBE Vector Shape - Rect");
  rect.property("Size").setValue([source.width,source.height]);

  var shapeFill = shape.property("Contents").addProperty("ADBE Vector Graphic - Fill");
  shapeFill.property("Color").setValue([1,1,1,1]);

  var shapeStroke = shape.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
  shapeStroke.property("Color").setValue([0,0,0,1]);
  shapeStroke.property("Stroke Width").setValue(parseInt(borderWidth.text));
  shapeStroke.property("Composite").setValue(2);

  if (detectEdgesOption.value == 1) {
    var detectedEdges = edgeDetection(element);
    var rect = shape.property("Contents").property("Rectangle Path 1");

    //prepare scale
    if (checkContent(detectedEdges,"top") || checkContent(detectedEdges,"bottom")) {
      var scaleX = rect.property("Size").value[0];
      var scaleY = rect.property("Size").value[1];
      var newScaleY = scaleY*1.5;

      rect.property("Size").setValue([scaleX,newScaleY]);
    }

    if (checkContent(detectedEdges,"left") || checkContent(detectedEdges,"right")) {
      var scaleX = rect.property("Size").value[0];
      var scaleY = rect.property("Size").value[1];
      var newScaleX = scaleX*1.5;

      rect.property("Size").setValue([newScaleX,scaleY]);
    }

    //set position
    var heightDifference = (rect.property("Size").value[1]-source.height)/2;
    var widthDifference = (rect.property("Size").value[0]-source.width)/2;
    var previousPosition = rect.property("Position").value;

    if (checkContent(detectedEdges,"top") && checkContent(detectedEdges,"bottom") != true) {
      var newPosition = previousPosition - [0,heightDifference];
      rect.property("Position").setValue(newPosition);
    }

    if (checkContent(detectedEdges,"bottom") && checkContent(detectedEdges,"top") != true) {
      var newPosition = previousPosition + [0,heightDifference];
      rect.property("Position").setValue(newPosition);
    }

    previousPosition = rect.property("Position").value;

    if (checkContent(detectedEdges,"left") && checkContent(detectedEdges,"right") != true) {
      var newPosition = previousPosition - [widthDifference,0];
      rect.property("Position").setValue(newPosition);
    }

    if (checkContent(detectedEdges,"right") && checkContent(detectedEdges,"left") != true) {
      var newPosition = previousPosition + [widthDifference,0];
      rect.property("Position").setValue(newPosition);
    }

  }
}

//creating a random tile name
function randomTileName(){
  // var possibleLetters = "abcdefghijklmnopqrstuvwxyz";
  var possibleLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var possibleNumbers = "0123456789";
  var tileName = "Tile_";
  tileName = tileName+possibleLetters.charAt(Math.floor(generateRandomNumber() * possibleLetters.length));
  tileName = tileName+possibleNumbers.charAt(Math.floor(generateRandomNumber() * possibleNumbers.length));
  tileName = tileName.toString()+possibleNumbers.charAt(Math.floor(generateRandomNumber() * possibleNumbers.length));

  return tileName
}

//converts selected solids to a comp
function selectionToComp(){
  var selectedLayers = activeItem.selectedLayers;
  var names = selectionToNameArray(selectedLayers);
  var firstAndLast = getFirstAndLast(names);
  var newSolid = calculategroupedSolid(firstAndLast,selectedLayers);

  var newTileName = prompt("Enter the name of the new Comp\nIf you keep the name \"Tile_0\" a random name will be generated","Tile_0");
  if (newTileName == "Tile_0") {
    newTileName = randomTileName();
  }

  removeSelected(selectedLayers);

  var solidForComp = createSolid({
    color:randomColor(),
    name:newTileName,
    width:newSolid.width,
    height:newSolid.height,
    position:newSolid.position,
    anchorPoint:newSolid.anchorPoint
  });

  var precomp = activeItem.layers.precompose([solidForComp.index],newTileName,false);

  if (createBorderOption.value == 1) {
    createBorder(activeItem.selectedLayers[0]);
  }
}

//find shape layer in collection
function findShapeLayer(collection){
  for (var i = 1; i <= collection.length; i++) {
    if (collection[i].name == "Shape Layer 1") {
      return collection[i];
    }
  }
}

//change thickness of stroke
function changeStrokeThickness(comp){
  var source = comp.source;
  var shape = findShapeLayer(source.layers);
  shape.property("Contents").property("Stroke 1").property("Stroke Width").setValue(parseInt(borderWidth.text));
}

//</editor-fold>

var myWin = new Window("palette", "anyTileMaker v0.2", undefined);
    myWin.orientation = "column";

    var panelOne = myWin.add("panel", undefined, "Step 1:");
    var panelTwo = myWin.add("panel", undefined, "Step 2:");
    var panelTree = myWin.add("panel", undefined, "Step 3:");

    panelOne.add("statictext", undefined, "Enter the amount of selectable solids below:");

    var groupSolids = panelOne.add("group", undefined, "groupSolids");
        groupSolids.orientation = "column";

        var groupSolidsX = groupSolids.add("group", undefined, "groupSolidsX");
            groupSolidsX.orientation = "row";
            groupSolidsX.add("statictext", undefined, "solids along X");
            var amountXinput = groupSolidsX.add("edittext", [0,0,25,20], "2");

        var groupSolidsY = groupSolids.add("group", undefined, "groupSolidsY");
            groupSolidsY.orientation = "row";
            groupSolidsY.add("statictext", undefined, "solids along Y");
            var amountYinput = groupSolidsY.add("edittext", [0,0,25,20], "2");

    var createSolidsBtn = panelOne.add("button", undefined, "create solids");

    panelTwo.add("statictext", undefined, "Select the solids you want to convert\nand hit the next button:",{multiline:true});

    var borderWidthGroup = panelTwo.add("group", undefined, "groupSolidsX");
        borderWidthGroup.orientation = "row";
        borderWidthGroup.add("statictext", undefined, "border width:");
        var borderWidth = borderWidthGroup.add("edittext", [0,0,25,25], "10");

    var groupChecks = panelTwo.add("group", undefined, "groupChecks");
        groupChecks.orientation = "row";
        var createBorderOption = groupChecks.add("checkbox", undefined, "create border");
        createBorderOption.value = 1;
        var detectEdgesOption = groupChecks.add("checkbox", undefined, "auto detect edged");
        detectEdgesOption.value = 1;

    var convertToCompBtn = panelTwo.add("button", undefined, "convert to comp");

    panelTree.add("statictext", undefined, "Click the button below to adjust\nborder width of selected tiles",{multiline:true});

    var changeBorderBtn = panelTree.add("button", undefined, "change border");


myWin.center();
myWin.show();

createSolidsBtn.onClick = function(){
  app.beginUndoGroup("anyTileMaker - create solids");
    try {
      setVariables();
      createSolids();
    } catch (e) {
      alert("Error in line: " + e.line + "\n" + e.toString());
    }
  app.endUndoGroup();
}

convertToCompBtn.onClick = function(){
  app.beginUndoGroup("anyTileMaker - convert to comp");
    try {
      setVariables();
      selectionToComp();
    } catch (e) {
      alert("Error in line: " + e.line + "\n" + e.toString());
    }
  app.endUndoGroup();
}

changeBorderBtn.onClick = function(){
  app.beginUndoGroup("anyTileMaker - change border");
    try {
      setVariables();
      var selectedLayers = activeItem.selectedLayers;
      for (var i = 0; i < selectedLayers.length; i++) {
        changeStrokeThickness(selectedLayers[i]);
      }
    } catch (e) {
      alert("Error in line: " + e.line + "\n" + e.toString());
    }
  app.endUndoGroup();
}
