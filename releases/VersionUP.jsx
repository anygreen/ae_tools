{
function myScript(thisObj){
  function myScript_buildUI(thisObject){
    var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette","My Window Name", undefined, {resizeable:true});

    res = "group{orientation:'column',\
            myStaticText: StaticText{text:'VersionUP v0.2'},\
            groupOne: Group{orientation:'row',\
              versionUpComp: Button{text:'Comp'},\
              versionUpProject: Button{text:'Project'},\
            },\
            confirmCheckbox: Checkbox{text:'confirm before changing'},\
          }";

    myPanel.grp = myPanel.add(res);
    myPanel.grp.confirmCheckbox.value = true;

    //Setup Panel Sizing
    myPanel.layout.layout(true);
    myPanel.grp.minimumSize = myPanel.grp.size;

    //Make the panel resizeable
    myPanel.layout.resize();
    myPanel.onResizing = myPanel.onResize = function(){this.layout.resize()};


    /////////////////
    //THE SCRIPTING//
    /////////////////

    function checkIfDate(input){
      var isDate = false;
      if (input.length == 6) {
        var allNumbers = true;
        for (var i = 0; i < input.length; i++) {
          if(checkIfNumber(input[i]) == false){
            allNumbers = false
          }
        }
        if(allNumbers){
          isDate = true;
        }
      }
      return isDate
    }

    function checkIfNumber(input){
      var isNumber = false;
      for (var b = 0; b < 10; b++) {
        if (input == b) {
          isNumber = true;
        }
      }
      return isNumber
    }

    function removeExtension(name){
      var newName = name.slice(0,name.length-4);
      return newName
    }

    function createDate(){

      var d = new Date();

      var year = d.getFullYear().toString();
      year = year.toString().slice(2,4);

      var month = d.getMonth()+1;
      if (month < 10) {
        month = "0"+month.toString();
      } else{
        month = month.toString();
      }

      var day = d.getDate();
      if (day < 10) {
        day = "0"+day.toString();
      } else{
        day = day.toString();
      }
      return year+month+day
    }

    function replaceDate(name){
      var partsOfName = name.split("_");
      var noDateFound = true;
      for (var a = 0; a < partsOfName.length; a++) {
        if(checkIfDate(partsOfName[a])){
          partsOfName[a] = createDate();
          noDateFound = false;
        }
      }
      if (noDateFound) {
        if (confirm("No Date was found!\nWould you like to add it at the beginning of the name?")) {
          partsOfName.unshift(createDate());
        }
      }
      return partsOfName.join("_");
    }

    function incrementLast(name){

      //getting number
      var numberToIncrement = "";
      var recordingNumber = false;
      var stopRecording = false;
      var firstNumber = false;
      var lastNumber = false;
      for (var i = name.length-1; i >= 0; i=i-1) {
        if (checkIfNumber(name[i]) && stopRecording == false) {
          recordingNumber = true;
          if (!lastNumber) {
            lastNumber = i;
          }
        } else if (recordingNumber) {
          stopRecording = true;
          recordingNumber = false;
          if (!firstNumber) {
            firstNumber = i+1;
          }
        }
        if (recordingNumber) {
          numberToIncrement = name[i]+numberToIncrement;
        }
      }

      //clipping zeros
      var clippedNumber = "";
      var clipping = true;
      for (var i = 0; i < numberToIncrement.length; i++) {
        if(numberToIncrement[i] != "0"){
          clipping = false;
        }
        if (clipping == false) {
          clippedNumber = clippedNumber+numberToIncrement[i];
        }
      }

      //incrementing number
      var newClippedNumber = parseInt(clippedNumber)+1;

      //adding zeroes
      var newNumber = newClippedNumber.toString();
      while (newNumber.length < numberToIncrement.length) {
        newNumber = "0"+newNumber;
      }

      //replacing with new number
      // var nameArray = name.split("_");
      // for (var i = 0; i < nameArray.length; i++) {
      //   if(nameArray[i]==numberToIncrement){
      //     nameArray[i] = newNumber;
      //   }
      // }
      // return nameArray.join("_")
      var firstPartOfName = name.slice(0,firstNumber);
      var lastPartOfName = name.slice(lastNumber+1,name.length);

      var newNameCombined = firstPartOfName+newNumber+lastPartOfName;
      return newNameCombined
    }

    function replaceOrAddArtist(name){

      // getting artist name
      var artistName;
      var globalsFile = new File("~/Documents/AE_VersionUP_globals.txt");

      globalsFile.open("r");
      var currentPos = 0;
      var notEndOfFile = true;
      var myFileArray = [];
      while (notEndOfFile == true) {
        var currentLine = globalsFile.readln();
        currentPos = currentPos+currentLine.length+1;
        if (currentLine.indexOf("artist initials") !== -1) {
          artistName = currentLine.split(" ");
          artistName = artistName[artistName.length-1];
        }
        notEndOfFile = globalsFile.seek(currentPos);
      }
      globalsFile.close();

      //adding artist name
      var nameArray = name.split("_");
      var nameLast = nameArray[nameArray.length-1];

      //check if artist name exists
      if(nameLast.length == 2 || nameLast.length == 3){
        if (parseInt(nameLast).toString() == "NaN"){
          nameArray[nameArray.length-1] = artistName;
        }else{
          if(confirm("No artist name was found!\nWould you like to add yours?")){
            nameArray.push(artistName);
          }
        }
      } else {
        if(confirm("No artist name was found!\nWould you like to add yours?")){
          nameArray.push(artistName);
        }
      }

      return nameArray.join("_")
    }

    function versionUpName(name){
      var newName;
      newName = replaceDate(name);
      newName = incrementLast(newName);
      newName = replaceOrAddArtist(newName);
      return newName
    }

    function globalsFileCheck(){
      var globalsFile = File("~/Documents/AE_VersionUP_globals.txt");
      if(!globalsFile.exists){
        var artistInitials = prompt("The globals file is missing!\nPlease enter your initials","");
        globalsFile = new File("~/Documents/AE_VersionUP_globals.txt");
        globalsFile.open('w');
        globalsFile.writeln("##Global Variables##");
        globalsFile.writeln("");
        globalsFile.writeln("artist initials = "+artistInitials);
        globalsFile.close();
        alert("The globals file has been seved here:\n~/Documents/AE_VersionUP_globals.txt");
      }
    }

    myPanel.grp.groupOne.versionUpComp.onClick = function () {
      app.beginUndoGroup("VersionUP comps");

      globalsFileCheck();
      var proj = app.project;
      var selectedItems = proj.selection;

      if(selectedItems.length < 1){
        alert("No comps selected...");
      }

      //check if all comps
      var allComps = true;
      for (var i = 0; i < selectedItems.length; i++) {
        if (selectedItems[i].typeName != "Composition") {
          allComps = false;
        }

        if (allComps) {
          if (myPanel.grp.confirmCheckbox.value == true) {
            var newName = versionUpName(selectedItems[i].name);
            if (confirm("The new comp name would be:\n"+newName+"\n\nWould you like to apply the change?")) {
              var newComp = selectedItems[i].duplicate();
              newComp.name = newName;
            }
          } else {
            var newComp = selectedItems[i].duplicate();
            newComp.name = versionUpName(selectedItems[i].name);
          }
        } else {
          alert("Error:\nSomething other than a composition is selected!");
        }
      }
      app.endUndoGroup();
    }

    myPanel.grp.groupOne.versionUpProject.onClick = function () {
      globalsFileCheck();
      var currentProjectName = removeExtension(app.project.file.name);
      var newName = versionUpName(currentProjectName);
      if (myPanel.grp.confirmCheckbox.value == true) {
        if (confirm("The new file name would be:\n"+newName+"\n\nWould you like to save the file?")) {
          var newFile = new File(app.project.file.path+"/"+newName+".aep");
          if (newFile.exists) {
            if(confirm("Careful!\nA file with the new name already exists. Are you sure you want to overwrite it?")){
              app.project.save(newFile);
            }
          } else {
            app.project.save(newFile);
          }
        }
      }else{
        var newFile = new File(app.project.file.path+"/"+newName+".aep");
        app.project.save(newFile);
      }
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
