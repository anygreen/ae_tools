//alert(app.project.activeItem.selectedLayers[0].property("Effects").property("Corner Pin").property("Upper Left").value);
try{

  function doSave(){
    if (app.project.file == null && app.project.numItems > 0) {
      alert("You have not saved your project yet! \r Let's do it now ;)");
      app.project.saveWithDialog();
    } else {
      //all good, the project has been saved
    }
  };

  app.scheduleTask("doSave()", 600000, true);

}catch(err){
  alert("Error in line: " + err.line + "\n" + err.toString());
}
