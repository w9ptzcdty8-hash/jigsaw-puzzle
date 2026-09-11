(function () {
  "use strict";
  window.JigsawModules=window.JigsawModules||{};
  window.JigsawModules.timer=function(app){
    function currentElapsedSeconds(){const running=app.state.isPaused?0:(Date.now()-app.state.startTimestamp);return(app.state.elapsedBeforePause+running)/1000;}
    function updateTimerDisplay(){app.el.gameTimer.textContent=app.bestTimes.formatTime(currentElapsedSeconds()).slice(0,5);}
    function startTimer(){startTimerFromElapsed(0);}
    function startTimerFromElapsed(elapsedMs){app.state.elapsedBeforePause=Math.max(0,Number(elapsedMs)||0);app.state.startTimestamp=Date.now();app.state.isPaused=false;if(app.state.timerHandle)clearInterval(app.state.timerHandle);app.state.timerHandle=setInterval(updateTimerDisplay,100);updateTimerDisplay();}
    function pauseTimer(){app.state.elapsedBeforePause+=Date.now()-app.state.startTimestamp;app.state.isPaused=true;}
    function resumeTimer(){app.state.startTimestamp=Date.now();app.state.isPaused=false;updateTimerDisplay();}
    function stopTimer(){if(app.state.timerHandle)clearInterval(app.state.timerHandle);app.state.timerHandle=null;}
    app.timer={currentElapsedSeconds,updateTimerDisplay,startTimer,startTimerFromElapsed,pauseTimer,resumeTimer,stopTimer};
  };
})();
