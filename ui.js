(function () {
  "use strict";
  window.JigsawModules=window.JigsawModules||{};
  window.JigsawModules.ui=function(app){
    function showScreen(name){Object.values(app.screens).forEach((s)=>s.classList.add("hidden"));app.screens[name].classList.remove("hidden");}
    function showModal(modal){modal.classList.remove("hidden");}
    function hideModal(modal){modal.classList.add("hidden");}
    app.ui={showScreen,showModal,hideModal};
  };
})();
