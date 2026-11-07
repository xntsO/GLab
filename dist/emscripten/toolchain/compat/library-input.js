/* Corrections for Emscripten 3.1.24's GLUT input and mirrored GLFW modifiers. */
mergeInto(LibraryManager.library,{
  $GLLabInput__deps:['$GLUT','$GLFW','$Browser'],
  $GLLabInput__postset:'GLLabInput.install();',
  $GLLabInput:{
    entry:0,
    prepare:function(event){
      if(event.type==='keydown'||event.type==='keyup'){Browser.mouseX=event.x;Browser.mouseY=event.y;}
      // GLFW reads modifier keys from its polling state, not event modifier flags.
      if(GLFW.active){for(var i=0;i<4;i++){if((event.type==='keydown'||event.type==='keyup')&&event.key===['Shift','Control','Alt','Meta'][i])continue;GLFW.active.keys[340+i]=(event.modifiers&(1<<i))?1:0;GLFW.active.keys[344+i]=0;}}
      if(event.type==='entry'&&GLLabInput.entry){GLUT.modifiers=event.modifiers&7;var callback=GLLabInput.entry;{{{ makeDynCall('vi','callback') }}}(event.state);}
    },
    install:function(){
      var special=GLUT.getSpecialKey;
      GLUT.getSpecialKey=function(code){return code===8||code===46?null:special(code);};
      var ascii=GLUT.getASCIIKey;
      GLUT.getASCIIKey=function(event){
        var controls={Backspace:8,Delete:127,Enter:13,Escape:27,Tab:9};
        if(controls[event.key]!==undefined)return controls[event.key];
        if(event.key&&event.key.length===1){var value=event.key.charCodeAt(0);if(event.ctrlKey&&value>=64&&value<=127)return value&31;return value<=255?value:null;}
        return ascii(event);
      };
      // Upstream computes the new position, then mistakenly passes the old one.
      GLUT.onMousemove=function(event){
        var x=Browser.mouseX,y=Browser.mouseY;Browser.calculateMouseEvent(event);
        if(x===Browser.mouseX&&y===Browser.mouseY)return;
        var callback=GLUT.buttons?GLUT.motionFunc:event.target===Module.canvas?GLUT.passiveMotionFunc:0;
        if(callback){event.preventDefault();GLUT.saveModifiers(event);{{{ makeDynCall('vii','callback') }}}(Browser.mouseX,Browser.mouseY);}
      };
      // 3.1.24 registers mousewheel only. Modern wheels also need an UP pulse.
      Module.canvas.addEventListener('wheel',function(event){
        if(!event.deltaY||!GLUT.mouseFunc)return;
        Browser.calculateMouseEvent(event);GLUT.saveModifiers(event);event.preventDefault();
        var callback=GLUT.mouseFunc,button=event.deltaY<0?3:4;
        {{{ makeDynCall('viiii','callback') }}}(button,0,Browser.mouseX,Browser.mouseY);
        {{{ makeDynCall('viiii','callback') }}}(button,1,Browser.mouseX,Browser.mouseY);
      },{passive:false});
    }
  },
  glutEntryFunc__deps:['$GLLabInput'],
  glutEntryFunc:function(callback){GLLabInput.entry=callback;}
});
