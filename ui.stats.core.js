(function(){
  window.App = window.App || {};
  var App = window.App;
  App.Stats = App.Stats || {};

  App.Stats.recomputeAndRender = function(){
    try{ if (typeof renderSetStats === 'function') renderSetStats(); }catch(e){}
    try{ if (typeof updateStats === 'function') updateStats(); }catch(e){}
  };
})();
