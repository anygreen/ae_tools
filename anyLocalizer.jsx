try{

  ///////////////////
  //CREATING WINDOW//
  ///////////////////

  var myWin = new Window("palette", "anyLocalizer", undefined);
      myWin.orientation = "row";

  var mainGroup = myWin.add("group", undefined, "MainGroup");
      mainGroup.orientation = "column";
      mainGroup.add("statictext", undefined, "anyLocalizer v0.1");

  var myMultiColumnListGroup = mainGroup.add("group", [0, 0, 800, 500], "MultiColumnListGroup");
  var myMultiColumnList = myMultiColumnListGroup.add("listbox", [0, 0, 800, 500], "My Label", {numberOfColumns: 3, showHeaders: true, columnTitles: ["Local","Name","Path"]});

  var buttonsGroup = mainGroup.add("group", undefined, "ButtonsGroup");
      buttonsGroup.orientation = "row";
      var getFootageBtn = buttonsGroup.add("button", undefined, "Refresh List");
      var localizeFootageBtn = buttonsGroup.add("button", undefined, "Localize Footage");
      var relinkToServerBtn = buttonsGroup.add("button", undefined, "Relink to Server");
      // var testBtn = buttonsGroup.add("button", undefined, "Tester");

  var myConsole = mainGroup.add("statictext", [0,0,700,25], "");
  var progressBar = mainGroup.add("progressbar", [0,0,700,10], "ProgressBar");
  var myConsoleDetail = mainGroup.add("statictext", [0,0,700,15], "");
  var progressBarDetail = mainGroup.add("progressbar", [0,0,700,5], "ProgressBarDetail");
  progressBar.value = 0;
  progressBarDetail.value = 0;
  // progressBar.hide();

  myWin.center();
  myWin.show();


  /////////////
  //FUNCTIONS//
  /////////////

  var localFolder = false;
  var localDrive  = false;
  var artistInitials = "";

  function globalsFileCheck(){
    var globalsFile = File("~/Documents/AE_Localizer_globals.txt");
    if(!globalsFile.exists){
      var artistInitialsTmp = prompt("The globals file is missing!\nPlease enter your initials","LS");
      var localDriveTmp = prompt("The globals file is missing!\nPlease enter your lard drives name","Macintosh HD");
      var localFolderTmp = prompt("The globals file is missing!\nPlease enter your user name","nhb");
      globalsFile = new File("~/Documents/AE_Localizer_globals.txt");
      globalsFile.open('w');
      globalsFile.writeln("##Global Variables##");
      globalsFile.writeln("");
      globalsFile.writeln('localFolder = "/Users/'+localFolderTmp+'/Documents/AE_Localizer"');
      globalsFile.writeln('localDrive = "'+localDriveTmp+'"');
      globalsFile.writeln('artist initials = "'+artistInitialsTmp+'"');
      globalsFile.close();
      alert("The globals file has been saved here:\n~/Documents/AE_Localizer_globals.txt");
    }
  }

  function setGlobals(){
    var globalFile = new File("~/Documents/AE_Localizer_globals.txt");
    if(globalFile.exists){
      globalFile.open("r");
      var currentPos = 0;
      var notEndOfFile = true;
      while (notEndOfFile == true) {
        var currentLine = globalFile.readln();
        currentPos = currentPos+currentLine.length+1;
        if (currentLine.indexOf("localFolder") !== -1) {
          localFolder = currentLine.split("\"")[1];
        }
        if (currentLine.indexOf("localDrive") !== -1) {
          localDrive = currentLine.split("\"")[1];
        }
        notEndOfFile = globalFile.seek(currentPos);
      }
      globalFile.close();
      // alert(localFolder+localDrive);
    } else {
      alert("Error:\nThe file with the globals is missing");
      myWin.close();
    }


  }


  function getFiles(option){
    var proj = app.project;
    var files = [];

    for (var i = 1; i <= proj.numItems; i++) {
    // for (var i = 1; i < 10; i++) {
      var cItem = proj.item(i);
      if (cItem.typeName == "Footage") {
        if(cItem.file != null){
          var newFile = {
            file:cItem,
            sourceName:cItem.mainSource.file.name,
            sourcePath:cItem.mainSource.file.path+"/"+cItem.mainSource.file.name,
            // hasProxy:false,
            // proxyName:cItem.proxySource.file.name,
            // proxySource:cItem.proxySource.file.path+"/"+cItem.proxySource.file.name,
            index:i,
            id:cItem.id
          };

          function pushNewFile(newFile){
            if(option == "all"){
              files.push(newFile);
            } else {
              var alreadyExists = false;
              for (var a = 0; a < files.length; a++) {
                if(files[a].sourcePath == newFile.sourcePath){
                  alreadyExists = true;
                }
              }
              if (alreadyExists == false) {
                files.push(newFile);
              }
            }
          }

          pushNewFile(newFile);

          if(cItem.proxySource){
            var newFile = {
              file:cItem,
              sourceName:cItem.proxySource.file.name,
              sourcePath:cItem.proxySource.file.path+"/"+cItem.proxySource.file.name,
              index:i,
              id:cItem.id
            }
            pushNewFile(newFile);
          }

        }
      }
    }
    return files
  };

  function refreshList(){
    var myMultiColumnList = myMultiColumnListGroup.add("listbox", [0, 0, 800, 500], "My Label", {numberOfColumns: 3, showHeaders: true, columnTitles: ["Local","Name","Path"]});
    var files = getFiles();
    for (var i = 0; i < files.length; i++) {
      var fileName = files[i].sourceName;
      var filePath = files[i].sourcePath;
      if (filePath.indexOf("/ServerHamburg") == 0) {
        eval("var footageItem_"+i+" = myMultiColumnList.add('item','NO');");
      } else if (filePath.indexOf("/SAN_Projects") == 0) {
        eval("var footageItem_"+i+" = myMultiColumnList.add('item','NO');");
      } else if (filePath.indexOf("/projects") == 0) {
        eval("var footageItem_"+i+" = myMultiColumnList.add('item','NO');");
      } else {
        eval("var footageItem_"+i+" = myMultiColumnList.add('item','YES');");
      }
      // eval("var footageItem_"+i+" = myMultiColumnList.add('item','NO');");
      eval("footageItem_"+i+".subItems[0].text = '"+fileName+"';");
      eval("footageItem_"+i+".subItems[1].text = '"+filePath+"';");
    }
    myWin.hide();
    myWin.show();
  };

  // function localize(path,option){
  //   var serverFolder = "/Volumes";
  //   var pathTerminal = path.split("%20").join("\\ ");
  //   var cutPath = pathTerminal;
  //   if(option == "folder"){
  //     cutPath = cutPath.split("/");
  //     cutPath.pop();
  //     cutPath = cutPath.join("/");
  //   }
  //   if(Folder(localFolder+path).exists){
  //     system.callSystem('time command rsync --ignore-existing --recursive '+serverFolder+pathTerminal+' '+localFolder+cutPath);
  //   }else{
  //     system.callSystem('time command ditto '+serverFolder+pathTerminal+' '+localFolder+pathTerminal);
  //     system.callSystem('time command rsync --ignore-existing --recursive '+serverFolder+pathTerminal+' '+localFolder+cutPath);
  //   }
  // };

  function localize(path,option){
    try {

    var serverFolder = "/Volumes";
    var cutPath = path;
    if(option == "folder"){
      cutPath = cutPath.split("/");
      cutPath.pop();
      cutPath = cutPath.join("/");
    }
    if(File(localFolder+path).exists){
      // system.callSystem('time command rsync --ignore-existing --recursive '+serverFolder+pathTerminal+' '+localFolder+cutPath);
      //Do nothing?
    }else{
      if (option == "folder") {
        // alert("copy folder: "+serverFolder+cutPath+"\noriginal: "+serverFolder+path);
        copyFolder(new Folder(serverFolder+path), new Folder(localFolder+path))
      }else{
        copyFile(new File(serverFolder+path), new File(localFolder+path))
      }
    }

    } catch (e) {
      alert("Error in line: " + e.line + "\n" + e.toString());
    }
  }

  function getExtension(path){
    var ext = path.split(".");
    ext = ext[ext.length-1];
    return ext;
  };

  function checkSequence(file){
    var isSequence = false;
    var tempIO = new ImportOptions(file);
    tempIO.importAs = ImportAsType.FOOTAGE;
    var tempFI = app.project.importFile(tempIO);
    isSequence = tempFI.mainSource.isStill;
    tempFI.remove();
    return isSequence;
  };

  function saveTempAsXML(){
    var xmlFile = new File(localFolder+"/tmp.aepx");
    app.project.save(xmlFile);
  }

  function removeTempXML(){
    var xmlFile = new File(localFolder+"/tmp.aepx");
    var xmlFileCopy = new File(localFolder+"/tmp_copy.aepx");
    xmlFile.remove();
    xmlFileCopy.remove();
  }

  function convertLineToLocal(line){
    line = line.replace('fullpath=\"/Volumes','fullpath=\"'+localFolder);

    //ServerHamburg
    line = line.replace('server_name=\"192.168.0.4','server_name=\"');
    line = line.replace('server_volume_name=\"ServerHamburg','server_volume_name=\"'+localDrive);

    //SAN_Projects & projects
    line = line.replace('server_name=\"192.168.0.10','server_name=\"');
    line = line.replace('server_volume_name=\"SAN_Projects','server_volume_name=\"'+localDrive);
    line = line.replace('server_volume_name=\"projects','server_volume_name=\"'+localDrive);

    return line
  }

  function convertLineToServer(line){

    //Check if ServerHamburg
    if(line.indexOf(localFolder+"/ServerHamburg") !== -1){
      line = line.replace('fullpath=\"'+localFolder,'fullpath=\"/Volumes');
      line = line.replace('server_name=\"','server_name=\"192.168.0.4');
      line = line.replace('server_volume_name=\"'+localDrive,'server_volume_name=\"ServerHamburg');
    }

    //Check if SAN_Projects
    if(line.indexOf(localFolder+"/SAN_Projects") !== -1){
      line = line.replace('fullpath=\"'+localFolder,'fullpath=\"/Volumes');
      line = line.replace('server_name=\"','server_name=\"192.168.0.10');
      line = line.replace('server_volume_name=\"'+localDrive,'server_volume_name=\"SAN_Projects');
    }

    //Check if Projects
    if(line.indexOf(localFolder+"/projects") !== -1){
      line = line.replace('fullpath=\"'+localFolder,'fullpath=\"/Volumes');
      line = line.replace('server_name=\"','server_name=\"192.168.0.10');
      line = line.replace('server_volume_name=\"'+localDrive,'server_volume_name=\"projects');
    }

    line = line.split("fullpath");
    line = "<fileReference fullpath"+line[1];

    return line
  }

  function getFileContent(option){ //"convert to local","convert to server"
    var myFile = new File(localFolder+"/tmp.aepx");
    var myFileCopy = new File(localFolder+"/tmp_copy.aepx")
    var myFileLength = myFile.length;
    myFile.open("r");
    myFileCopy.open("w");
    var currentPos = 0;
    var notEndOfFile = true;
    var myFileArray = [];
    while (notEndOfFile == true) {
      var currentLine = myFile.readln();
      currentPos = currentPos+currentLine.length+1;
      if (currentLine.indexOf("fullpath") !== -1) {
        if (option == "convert to local") {
          currentLine = convertLineToLocal(currentLine);
        }
        if (option == "convert to server") {
          currentLine = convertLineToServer(currentLine);
        }
      }
      myFileCopy.writeln(currentLine);
      myConsoleDetail.text = "converting file - "+currentPos+"/"+myFileLength;
      progressBarDetail.value = (currentPos/myFileLength)*100;
      notEndOfFile = myFile.seek(currentPos);
    }
    myFile.close();
    myFileCopy.close();
    // return myFileArray;
  }

  function writeFileContent(content){
    var myFile = new File(localFolder+"/tmp.aepx");
    myFile.length = 0;
    myFile.open("e");
    for (var i = 0; i < content.length; i++) {
      myFile.writeln(content[i]);
    }
    myFile.close();
  }

  function copyFolder(sourceFolder, destinationFolder) {
    var sourceChildrenArr = sourceFolder.getFiles();
    for (var i = 0; i < sourceChildrenArr.length; i++) {
      var sourceChild = sourceChildrenArr[i];
      var destinationChildStr = destinationFolder.fsName + "/" + sourceChild.name;
      if (sourceChild instanceof File) {
        copyFile(sourceChild, new File(destinationChildStr));
      }
      else {
        copyFolder(sourceChild, new Folder(destinationChildStr));
      }
    }
  }


  function copyFile(sourceFile, destinationFile) {
    createFolder(destinationFile.parent);
    sourceFile.copy(destinationFile);
  }


  function createFolder(folder) {
    if (folder.parent !== null && !folder.parent.exists) {
      createFolder(folder.parent);
    }
    folder.create();
  }

  globalsFileCheck();
  refreshList();
  setGlobals();

  ///////////////////
  //BINDING BUTTONS//
  ///////////////////

  getFootageBtn.onClick = function () {
    refreshList();
  };

  localizeFootageBtn.onClick = function () {
    myConsole.text = "Step 1: Localizing";
    progressBar.value = (100/6)*1;
    var files = getFiles();
    for (var i = 0; i < files.length; i++) {
      var myProgress = (i+1)/files.length*100;
      progressBarDetail.value = myProgress;
      myConsoleDetail.text = "File "+i+"/"+files.length+": "+files[i].file.name;
      if(files[i].file.mainSource.isStill == true){
        localize(files[i].sourcePath);
      } else {
        if(checkSequence(files[i].file.file)){
          localize(files[i].file.mainSource.file.path,"folder");
        }else{
          localize(files[i].sourcePath);
        }
      }
    }
    progressBarDetail.value = 0;
    myConsoleDetail.text = "";
    progressBar.value = (100/6)*2;
    myConsole.text = "Step 2: Saving current file";
    app.project.save();
    var currentFile = app.project.file;

    progressBar.value = (100/6)*3;
    myConsole.text = "Step 3: Saving file as XML";
    saveTempAsXML();
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);

    progressBar.value = (100/6)*4;
    myConsole.text = "Step 4: Replacing filenames...";

    // writeFileContent(getFileContent("convert to local"));
    getFileContent("convert to local");

    myConsoleDetail.text = "";
    progressBarDetail.value = 0;

    progressBar.value = (100/6)*5;
    myConsole.text = "Step 5: Opening XML project";

    var tmpProject = new File(localFolder+"/tmp_copy.aepx");
    app.open(tmpProject);

    progressBar.value = (100/6)*6;
    myConsole.text = "Step 6: Saving AEP";

    var currentPath = currentFile.path;
    var currentName = currentFile.name;
    currentName = currentName.slice(0,currentName.length-4);
    var newName = currentName+"_localized";
    newName = prompt("Enter name of new file:",newName);

    var newFile = new File(currentPath+"/"+newName+".aep");
    if (newFile.exists) {
      if(confirm("Wait! This file already exists!\nAre you sure you want to replace it?")){
        app.project.save(newFile);
      } else {
        newName = prompt("Alright then, just enter a new name below:",newName+"_new");
        newFile = new File(currentPath+"/"+newName+".aep");
        if (newFile.exists){
          if(confirm("Srsly?! This file also exists!\nOne last time: Do you want to replace it?")){
            app.project.save(newFile);
          } else {
            newName = prompt("This is your last chance!\nThe name you now enter eil be used.\nIf the file already exists it will be replaced:",newName+"_final_2_revised");
            newFile = new File(currentPath+"/"+newName+".aep");
            app.project.save(newFile);
          }
        }
      }
    }
    // app.project.save(newFile);

    removeTempXML();

    progressBar.value = 0;
    myConsole.text = "";
    refreshList();

    alert("Done!\nAll files have been localized");
  };

  relinkToServerBtn.onClick = function () {
    progressBar.value = (100/5)*1;
    myConsole.text = "Step 1: Saving current file";
    app.project.save();
    var currentFile = app.project.file;

    progressBar.value = (100/5)*2;
    myConsole.text = "Step 2: Saving file as XML";
    saveTempAsXML();
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);

    progressBar.value = (100/5)*3;
    myConsole.text = "Step 3: Replacing filenames...";

    getFileContent("convert to server");
    myConsoleDetail.text = "";
    progressBarDetail.value = 0;

    progressBar.value = (100/5)*4;
    myConsole.text = "Step 4: Opening XML project";

    var tmpProject = new File(localFolder+"/tmp_copy.aepx");
    app.open(tmpProject);

    progressBar.value = (100/5)*5;
    myConsole.text = "Step 5: Saving AEP";

    var currentPath = currentFile.path;
    var currentName = currentFile.name;
    currentName = currentName.slice(0,currentName.length-4);
    // currentName = currentName.slice(0,currentName.length-14);
    var newName = currentName.split("_localized");
    newName = newName.join("");
    newName = prompt("Enter name of new file:",newName);
    var newFile = new File(currentPath+"/"+newName+".aep");
    
    if (newFile.exists) {
      if(confirm("Wait! This file already exists!\nAre you sure you want to replace it?")){
        app.project.save(newFile);
      } else {
        newName = prompt("Alright then, just enter a new name below:",newName+"_new");
        newFile = new File(currentPath+"/"+newName+".aep");
        if (newFile.exists){
          if(confirm("Srsly?! This file also exists!\nOne last time: Do you want to replace it?")){
            app.project.save(newFile);
          } else {
            newName = prompt("This is your last chance!\nThe name you now enter eil be used.\nIf the file already exists it will be replaced:",newName+"_final_2_revised");
            newFile = new File(currentPath+"/"+newName+".aep");
            app.project.save(newFile);
          }
        }
      }
    }

    removeTempXML();

    progressBar.value = 0;
    myConsole.text = "";
    refreshList();

    alert("Done!\nAll files have been relinked to the server");
  };

  // testBtn.onClick = function () {
  //   try {
  //     globalsFileCheck();
  //   } catch (error) {
  //       alert("Error in line: " + error.line + "\n" + error.toString());
  //   }
  //
  // }

} catch(err) {
  alert("Error in line: " + err.line + "\n" + err.toString());
}
