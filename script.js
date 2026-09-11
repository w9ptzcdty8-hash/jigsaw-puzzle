(function () {
  "use strict";
  const LEVELS={KIDS:{label:"KIDS",pieces:6,cols:3,rows:2},EASY:{label:"EASY",pieces:12,cols:4,rows:3},NORMAL:{label:"NORMAL",pieces:35,cols:7,rows:5},HARD:{label:"HARD",pieces:96,cols:12,rows:8}};
  const LEVEL_ORDER=["KIDS","EASY","NORMAL","HARD"];
  const SAMPLE_IMAGES=[{id:"sample1",src:"assets/images/sample1.svg",name:"山と湖"},{id:"sample2",src:"assets/images/sample2.svg",name:"ねこ"},{id:"sample3",src:"assets/images/sample3.svg",name:"花畑"},{id:"sample4",src:"assets/images/sample4.svg",name:"街なみ"},{id:"sample5",src:"assets/images/sample5.svg",name:"宇宙"}];
  const state={selectedLevel:"EASY",currentImage:null,selectedPiece:null,startTimestamp:0,elapsedBeforePause:0,timerHandle:null,isPaused:false,isRunning:false};
  const $=id=>document.getElementById(id);
  const screens={title:$("screen-title"),level:$("screen-level"),imageselect:$("screen-imageselect"),game:$("screen-game"),clear:$("screen-clear")};
  const modals={pause:$("modal-pause"),resume:$("modal-resume"),uploadMenu:$("modal-upload-menu"),uploadList:$("modal-upload-list"),settings:$("modal-settings"),guidePreview:$("modal-guide-preview")};
  const el={bestTimesList:$("best-times-list"),levelGrid:$("level-grid"),imageSelectGrid:$("image-select-grid"),uploadedGrid:$("uploaded-grid"),uploadedEmpty:$("uploaded-empty"),gameLevelTag:$("game-level-tag"),gameTimer:$("game-timer"),gameCanvas:$("game-canvas"),clearTime:$("clear-time"),clearBestTag:$("clear-best-tag"),fileInput:$("file-input"),guideThumbnail:$("guide-thumbnail"),guideThumbnailImage:$("guide-thumbnail-image"),guidePreviewImage:$("guide-preview-image"),settingGuidePicture:$("setting-guide-picture"),settingGuideLine:$("setting-guide-line")};
  const ctx=el.gameCanvas.getContext("2d");
  const app={LEVELS,LEVEL_ORDER,SAMPLE_IMAGES,state,screens,modals,el,ctx};
  window.JigsawModules.bestTimes(app);window.JigsawModules.timer(app);window.JigsawModules.ui(app);window.JigsawModules.settings(app);window.JigsawModules.imageManager(app);window.JigsawModules.puzzle(app);

  function renderLevelGrid(){el.levelGrid.innerHTML="";LEVEL_ORDER.forEach(lvl=>{const cfg=LEVELS[lvl],btn=document.createElement("button");btn.className="level-btn"+(lvl===state.selectedLevel?" active":"");btn.innerHTML=`<span class="lvl-name">${cfg.label}</span><span class="lvl-pieces">${cfg.pieces}ピース</span>`;btn.addEventListener("click",()=>{state.selectedLevel=lvl;renderLevelGrid();});el.levelGrid.appendChild(btn);});}
  function startGame(resumeData){app.puzzle.startGame(resumeData);}
  function goToClear(){app.timer.stopTimer();app.puzzle.stopGameLoop();state.isRunning=false;app.puzzle.clearResumeState();const seconds=app.timer.currentElapsedSeconds(),isNewRecord=app.bestTimes.trySaveBestTime(state.selectedLevel,seconds);el.clearTime.textContent=app.bestTimes.formatTime(seconds);el.clearBestTag.textContent=isNewRecord?"🎉 ベストタイム更新！":"";app.ui.showScreen("clear");}
  app.startGame=startGame;app.goToClear=goToClear;

  function openLevelOrResume(){
    app.imageManager.loadUploadedImagesFromDB().then(()=>{
      const resumeData=app.puzzle.getResumeState();
      if(!resumeData){app.imageManager.guardNoImages();renderLevelGrid();app.ui.showScreen("level");return;}
      if(!app.imageManager.getImageById(resumeData.imageId)){
        app.puzzle.clearResumeState();
        alert("中断したパズルの画像が削除されました。はじめから開始します。");
        app.imageManager.guardNoImages();
        renderLevelGrid();
        app.ui.showScreen("level");
        return;
      }
      app.ui.showModal(modals.resume);
    }).catch(()=>{
      const resumeData=app.puzzle.getResumeState();
      if(resumeData)app.ui.showModal(modals.resume);
      else{app.imageManager.guardNoImages();renderLevelGrid();app.ui.showScreen("level");}
    });
  }

  $("btn-start").addEventListener("click",openLevelOrResume);
  $("btn-level-back").addEventListener("click",()=>{app.bestTimes.renderBestTimes();app.ui.showScreen("title");});
  $("btn-play-random").addEventListener("click",()=>{app.imageManager.guardNoImages();state.currentImage=app.imageManager.pickRandomImage();if(state.currentImage)startGame();});
  $("btn-play-choose").addEventListener("click",()=>{app.imageManager.guardNoImages();app.imageManager.renderImageSelectGrid();app.ui.showScreen("imageselect");});
  $("btn-imageselect-back").addEventListener("click",()=>app.ui.showScreen("level"));

  $("btn-pause").addEventListener("click",()=>{if(!state.isRunning)return;app.timer.pauseTimer();app.ui.showModal(modals.pause);});
  $("btn-resume").addEventListener("click",()=>{app.timer.resumeTimer();app.ui.hideModal(modals.pause);});
  $("btn-pause-title").addEventListener("click",()=>{if(!app.puzzle.saveResumeState())return;app.puzzle.stopGame();app.ui.hideModal(modals.pause);app.bestTimes.renderBestTimes();el.guideThumbnail.classList.add("hidden");app.ui.showScreen("title");});

  $("btn-resume-yes").addEventListener("click",()=>{
    const resumeData=app.puzzle.getResumeState();
    app.ui.hideModal(modals.resume);
    if(!resumeData){renderLevelGrid();app.ui.showScreen("level");return;}
    const image=app.imageManager.getImageById(resumeData.imageId);
    if(!image){app.puzzle.clearResumeState();alert("中断したパズルの画像が削除されました。はじめから開始します。");app.imageManager.guardNoImages();renderLevelGrid();app.ui.showScreen("level");return;}
    state.selectedLevel=resumeData.level;
    state.currentImage=image;
    startGame(resumeData);
  });
  $("btn-resume-no").addEventListener("click",()=>{app.puzzle.clearResumeState();app.ui.hideModal(modals.resume);app.imageManager.guardNoImages();renderLevelGrid();app.ui.showScreen("level");});

  $("btn-clear-retry").addEventListener("click",()=>{app.puzzle.clearResumeState();state.currentImage=app.imageManager.pickRandomImage();if(state.currentImage)startGame();});
  $("btn-clear-title").addEventListener("click",()=>{app.puzzle.clearResumeState();app.bestTimes.renderBestTimes();el.guideThumbnail.classList.add("hidden");app.ui.showScreen("title");});

  $("btn-open-settings").addEventListener("click",()=>app.settings.openSettings());
  $("btn-settings-close").addEventListener("click",()=>app.ui.hideModal(modals.settings));
  el.settingGuidePicture.addEventListener("click",()=>{const key=app.settings.keys.guidePicture;app.settings.setBoolSetting(key,!app.settings.getBoolSetting(key,true));app.settings.renderSettings(app.imageManager.getUploadedCount());app.puzzle.renderGame();});
  el.settingGuideLine.addEventListener("click",()=>{const key=app.settings.keys.guideLine;app.settings.setBoolSetting(key,!app.settings.getBoolSetting(key,true));app.settings.renderSettings(app.imageManager.getUploadedCount());app.puzzle.renderGame();});
  $("setting-sample-images").addEventListener("click",()=>{const toggle=$("setting-sample-images");if(toggle.disabled)return;app.settings.setSampleEnabled(!app.settings.isSampleEnabled());app.settings.renderSettings(app.imageManager.getUploadedCount());});
  el.guideThumbnail.addEventListener("click",()=>{if(!state.currentImage)return;el.guidePreviewImage.src=state.currentImage.src;app.ui.showModal(modals.guidePreview);});
  $("btn-guide-preview-close").addEventListener("click",()=>app.ui.hideModal(modals.guidePreview));

  $("btn-open-upload").addEventListener("click",()=>app.ui.showModal(modals.uploadMenu));
  $("btn-upload-menu-close").addEventListener("click",()=>app.ui.hideModal(modals.uploadMenu));
  $("btn-upload-new").addEventListener("click",()=>el.fileInput.click());
  el.fileInput.addEventListener("change",e=>{const file=e.target.files&&e.target.files[0];app.imageManager.handleFileSelected(file);e.target.value="";app.ui.hideModal(modals.uploadMenu);});
  $("btn-upload-list").addEventListener("click",()=>{app.ui.hideModal(modals.uploadMenu);app.imageManager.renderUploadedGrid();app.ui.showModal(modals.uploadList);});
  $("btn-uploaded-close").addEventListener("click",()=>app.ui.hideModal(modals.uploadList));

  app.bestTimes.renderBestTimes();app.settings.renderSettings(app.imageManager.getUploadedCount());app.imageManager.loadUploadedImagesFromDB();app.ui.showScreen("title");
})();
