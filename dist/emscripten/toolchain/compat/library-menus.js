/* Emscripten's built-in GLUT implements windows and callbacks, but omits menus.
 * Keep menu selection in the existing GL Lab UI and invoke the Wasm callback. */
var GLLabMenuLibrary = {
  $GLLabMenus__deps: ['$GLUT', 'glutPostRedisplay'],
  $GLLabMenus__postset: 'GLLabMenus.install();',
  $GLLabMenus: {
    next: 0, current: 0, menus: {}, attached: {},
    show: function(id,x,y) {
      var menu=GLLabMenus.menus[id];
      if(menu && Module.gllabEvent) Module.gllabEvent('menu',{menu:id,items:menu.items,x:x,y:y});
    },
    install: function() {
      Module.gllabInput=function(event) {
        if(event.type==='menuOpen') {GLLabMenus.show(event.menu,event.x,event.y);return true;}
        if(event.type==='menu') {
          var menu=GLLabMenus.menus[event.menu];
          if(menu && menu.callback) {var callback=menu.callback; {{{ makeDynCall('vi','callback') }}}(event.value);_glutPostRedisplay();}
          return true;
        }
        if(event.type==='mouse' && event.state===0 && GLLabMenus.attached[event.button]) {
          GLLabMenus.show(GLLabMenus.attached[event.button],event.x,event.y);return true;
        }
        return false;
      };
    }
  },
  glutCreateMenu__deps: ['$GLLabMenus'],
  glutCreateMenu: function(callback) {var id=++GLLabMenus.next;GLLabMenus.menus[id]={callback:callback,items:[]};GLLabMenus.current=id;return id;},
  glutDestroyMenu__deps: ['$GLLabMenus'],
  glutDestroyMenu: function(id) {delete GLLabMenus.menus[id];if(GLLabMenus.current===id)GLLabMenus.current=0;for(var b in GLLabMenus.attached)if(GLLabMenus.attached[b]===id)delete GLLabMenus.attached[b];},
  glutGetMenu__deps: ['$GLLabMenus'], glutGetMenu: function(){return GLLabMenus.current;},
  glutSetMenu__deps: ['$GLLabMenus'], glutSetMenu: function(id){GLLabMenus.current=id;},
  glutAddMenuEntry__deps: ['$GLLabMenus'],
  glutAddMenuEntry: function(label,value){GLLabMenus.menus[GLLabMenus.current].items.push({label:UTF8ToString(label),value:value});},
  glutAddSubMenu__deps: ['$GLLabMenus'],
  glutAddSubMenu: function(label,sub){GLLabMenus.menus[GLLabMenus.current].items.push({label:UTF8ToString(label),sub:sub});},
  glutChangeToMenuEntry__deps: ['$GLLabMenus'],
  glutChangeToMenuEntry: function(item,label,value){GLLabMenus.menus[GLLabMenus.current].items[item-1]={label:UTF8ToString(label),value:value};},
  glutChangeToSubMenu__deps: ['$GLLabMenus'],
  glutChangeToSubMenu: function(item,label,sub){GLLabMenus.menus[GLLabMenus.current].items[item-1]={label:UTF8ToString(label),sub:sub};},
  glutRemoveMenuItem__deps: ['$GLLabMenus'], glutRemoveMenuItem: function(item){GLLabMenus.menus[GLLabMenus.current].items.splice(item-1,1);},
  glutAttachMenu__deps: ['$GLLabMenus'], glutAttachMenu: function(button){GLLabMenus.attached[button]=GLLabMenus.current;},
  glutDetachMenu__deps: ['$GLLabMenus'], glutDetachMenu: function(button){delete GLLabMenus.attached[button];},
  glutGetWindow: function(){return 1;},
  glutSetWindow: function(id){if(id!==1)throw new Error('The browser GLUT runtime supports one canvas window.');},
  glutShowWindow: function(){Module.canvas.style.visibility='visible';},
  glutHideWindow: function(){Module.canvas.style.visibility='hidden';},
  glutIconifyWindow: function(){Module.canvas.style.visibility='hidden';}
};
mergeInto(LibraryManager.library,GLLabMenuLibrary);
