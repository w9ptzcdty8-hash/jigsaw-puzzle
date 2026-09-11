(function () {
  "use strict";
  window.JigsawModules=window.JigsawModules||{};
  window.JigsawModules.settings=function(app){
    const KEYS={guidePicture:"jigsaw_guide_picture",guideLine:"jigsaw_guide_line",completionImage:"jigsaw_completion_image",hiddenSamples:"jigsaw_hidden_samples",sampleEnabled:"jigsaw_sample_images",backupHidden:"jigsaw_hidden_samples_before_sample_off"};
    const SAMPLE_IDS=app.SAMPLE_IMAGES.map((img)=>img.id);
    function getBoolSetting(key,defaultValue){const v=localStorage.getItem(key);return v===null?defaultValue:v==="1";}
    function setBoolSetting(key,value){try{localStorage.setItem(key,value?"1":"0");}catch(e){}}
    function getHiddenSamples(){try{const v=JSON.parse(localStorage.getItem(KEYS.hiddenSamples)||"[]");return Array.isArray(v)?v:[];}catch(e){return[];}}
    function setHiddenSamples(ids){try{localStorage.setItem(KEYS.hiddenSamples,JSON.stringify(ids));}catch(e){}}
    function isSampleVisible(id){return !getHiddenSamples().includes(id);}
    function isSampleEnabled(){return getBoolSetting(KEYS.sampleEnabled,true);}
    function setSampleEnabled(enabled){const current=isSampleEnabled();if(enabled===current)return;if(!enabled){try{localStorage.setItem(KEYS.backupHidden,JSON.stringify(getHiddenSamples()));}catch(e){}setHiddenSamples(Array.from(new Set([...getHiddenSamples(),...SAMPLE_IDS])));setBoolSetting(KEYS.sampleEnabled,false);}else{try{const backup=JSON.parse(localStorage.getItem(KEYS.backupHidden)||"null");if(Array.isArray(backup))setHiddenSamples(backup);}catch(e){}setBoolSetting(KEYS.sampleEnabled,true);}}
    function renderSettings(uploadedCount){
      const gp=getBoolSetting(KEYS.guidePicture,true),gl=getBoolSetting(KEYS.guideLine,true),ci=getBoolSetting(KEYS.completionImage,true);
      app.el.settingGuidePicture.querySelector("strong").textContent=gp?"ON":"OFF";app.el.settingGuideLine.querySelector("strong").textContent=gl?"ON":"OFF";app.el.settingCompletionImage.querySelector("strong").textContent=ci?"ON":"OFF";
      app.el.settingGuidePicture.classList.toggle("off",!gp);app.el.settingGuideLine.classList.toggle("off",!gl);app.el.settingCompletionImage.classList.toggle("off",!ci);
      const toggle=document.getElementById("setting-sample-images");if(toggle){const enabled=isSampleEnabled(),canToggle=uploadedCount>0;toggle.querySelector("strong").textContent=enabled?"ON":"OFF";toggle.classList.toggle("off",!enabled);toggle.classList.toggle("disabled",!canToggle);toggle.disabled=!canToggle;}
    }
    function openSettings(){renderSettings(app.imageManager?app.imageManager.getUploadedCount():0);app.ui.showModal(app.modals.settings);}
    app.settings={keys:KEYS,sampleIds:SAMPLE_IDS,getBoolSetting,setBoolSetting,getHiddenSamples,setHiddenSamples,isSampleVisible,isSampleEnabled,setSampleEnabled,renderSettings,openSettings};
  };
})();
