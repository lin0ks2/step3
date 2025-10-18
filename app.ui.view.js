
;(function(){
  const App = window.App || (window.App = {});
  App.settings = App.settings || {};
  if (!App.settings.mode) App.settings.mode = (localStorage.getItem('lexitron.mode') || 'normal'); // default: normal
  App.getMode = function(){ return (App.settings && App.settings.mode) || 'normal'; };
  App.getStarStep = function(){
    return (App.getMode() === 'normal') ? 1 : 0.5;
  };
  App.getReverseThreshold = function(){
    return (App.getMode() === 'normal') ? 3.0 : 2.5;
  };
  App.saveSettings = App.saveSettings || function(s){ try{ localStorage.setItem('lexitron.settings', JSON.stringify(s||App.settings||{})); localStorage.setItem('lexitron.mode', App.getMode()); }catch(_){ } };
})();

/*!
 * app.ui.view.js — Lexitron
 * Version: 1.6.2 (full-deck source, single-slice per set)
 * Date: 2025-09-22
 *
 * Changes in this build (safe, minimal):
 *  - Added getFullDeck() that always returns the FULL dictionary deck (no trainer slices).
 *  - current(), renderCard(), nextWord() now use full deck and slice it ONCE by App.Sets.activeBounds().
 *  - No other behavior changed (keeps absolute App.state.index semantics and prior bugfixes).
 */

;(function () {
  const App = window.App || (window.App = {});
  const D = App.DOM || (App.DOM = {});

  function keyLang(key){
    const m = String(key||'').match(/^([a-z]{2})_/i);
    return m ? m[1].toLowerCase() : 'xx';
  }
  function langOfKey(k){ try{ const m = String(k||'').match(/^([a-z]{2})_/i); return m?m[1].toLowerCase():null; }catch(e){ return null; } }
  function isEndlessDict(key){ return key === 'mistakes' || key === 'fav' || key === 'favorites'; }

  function getFullDeck() {
    try {
      return (App.Decks && App.Decks.resolveDeckByKey)
        ? (App.Decks.resolveDeckByKey(App.dictRegistry.activeKey) || [])
        : [];
    } catch (_) {
      return [];
    }
  }

  function renderDictTitle(){
    try{
      const el = document.getElementById('dictActiveTitle');
      if (!el) return;
      const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      const name = (App.Decks && App.Decks.resolveNameByKey) ? App.Decks.resolveNameByKey(key) : (key||'');
      el.textContent = '';
      try{
        const flag = (App.Decks && App.Decks.flagForKey) ? (App.Decks.flagForKey(key)||'') : '';
        if (flag){
          const span=document.createElement('span'); span.className='dictFlag'; span.textContent=flag;
          el.appendChild(span); el.appendChild(document.createTextNode(' '));
        }
      }catch(_){}
      el.appendChild(document.createTextNode(name||''));
    }catch(_){}
  }

  function renderSetStats(){
    try{
      const host = document.getElementById('setStats');
      if (!host || !App.Sets) return;
      const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      const deck = getFullDeck();
      const b = App.Sets.activeBounds ? App.Sets.activeBounds() : {start:0,end:deck.length};
      const sMax = (App.Trainer && App.Trainer.starsMax) ? App.Trainer.starsMax() : 6;
      const total = Math.max(0, (b.end - b.start));
      let learned = 0;

      if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
        for (let i=b.start;i<b.end;i++){
          const w = deck[i]; if(!w) continue;
          const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
          const sc = App.Mistakes.getStars(sk, w.id);
          if (sc >= sMax) learned++;
        }
      } else {
    try{document.dispatchEvent(new CustomEvent("lexitron:answer-wrong",{detail:{word:w}}));}catch(_){}

        const stars = (App.state && App.state.stars) || {};
        for (let i=b.start;i<b.end;i++){
          const w = deck[i]; if(!w) continue;
          if ((stars[App.starKey(w.id)]||0) >= sMax) learned++;
        }
      }

      const t = (typeof App.i18n === 'function') ? (App.i18n() || {}) : {};
      host.textContent = (t.badgeSetWords||'Слов в наборе') + ': ' + String(total) + ' / ' + (t.badgeLearned||'Выучено') + ': ' + String(learned);
    }catch(_){}
  }

  function _categoryRank(key){
    try{
      const k = String(key||'').toLowerCase().replace(/\s+/g,'');
      const suf = k.replace(/^[a-z]{2}_/, '');
      const order = { verbs:0, nouns:1, adjectives:2, adverbs:3, pronouns:4, prepositions:5, numbers:6, conjunctions:7, particles:8 };
      return (suf in order) ? order[suf] : 999;
    } catch(e){ return 999; }
  }
  function _sortKeysByCategory(keys){
    return (keys||[]).slice().sort((a,b)=>{
      const ra=_categoryRank(a), rb=_categoryRank(b);
      if (ra!==rb) return ra-rb;
      return String(a).localeCompare(String(b));
    });
  }

  function current() {
    const deck = getFullDeck();
    if (!deck.length) return { id:  - App.getStarStep(), word: '', uk: '', ru: '' };
    const b = App.Sets ? App.Sets.activeBounds() : { start: 0, end: deck.length };
    if (App.state.index < b.start || App.state.index >= b.end) App.state.index = b.start;
    const local = App.state.index - b.start;
    return deck[b.start + local];
  }

  function decideModeForWord(w) {
    const succ = App.state.successes[App.starKey(w.id)] || 0;
    let reverse = (succ >= App.Trainer.unlockThreshold()) ? (Math.random() < 0.5) : false;
    try {
      if (App.Penalties) {
        const p = App.Penalties.reverseProbFor(w.id);
        if (Math.random() < p) reverse = true;
      }
    } catch (e) {}
    return reverse;
  }

  function drawOptions(correct, pool) {
    const uniq = [];
    const seen = new Set();
    for (let i=0;i<pool.length;i++){
      const v = pool[i];
      const s = String(v||'').trim();
      if (!s || s === correct) continue;
      if (!seen.has(s)){ seen.add(s); uniq.push(s); }
      if (uniq.length >= 12) break;
    }
    const distractors = App.shuffle(uniq).slice(0, 3);
    const variants = App.shuffle([correct, ...distractors]);
    variants.forEach(v => {
      const b = document.createElement('button');
      b.className = 'optionBtn';
      b.textContent = v;
      if (v === correct) b.dataset.correct = '1';
      b.addEventListener('click', () => onChoice(b, v === correct));
      D.optionsRow.appendChild(b);
    });
  }

  function addIDontKnowButton() {
    if (!D || !D.optionsRow) return;
    const t = (typeof App.i18n === 'function') ? (App.i18n() || {}) : {};
    const wrap = document.createElement('div');
    wrap.className = 'idkWrapper';
    const btn = document.createElement('button');
    btn.className = 'ghost';
    btn.textContent = t.iDontKnow || 'Не знаю';
    btn.addEventListener('click', onIDontKnow);
    wrap.appendChild(btn);
    D.optionsRow.appendChild(wrap);
  }

  function getMistakesDistractorPool(currentWord) {
    const out = [];
    const seen = new Set();
    const push = (w) => {
      if (!w || !w.id || String(w.id) === String(currentWord.id)) return;
      const label = ((App.settings.lang === 'ru') ? (w.ru || w.uk) : (w.uk || w.ru)) || w.translation || w.meaning; try{ App.applyI18nTitles(document); }catch(_){}
      if (!label) return;
      const key = String(w.id) + '::' + String(label);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(w);
    };

    let srcKey = null;
    try { srcKey = (App.Mistakes && App.Mistakes.sourceKeyFor) ? App.Mistakes.sourceKeyFor(currentWord.id) : (currentWord._mistakeSourceKey || null); } catch (_) {}
    const dictLang = langOfKey(srcKey) || null;

    if (srcKey) {
      const srcDeck = App.Decks.resolveDeckByKey(srcKey) || [];
      for (let i = 0; i < srcDeck.length; i++) push(srcDeck[i]);
    }

    if (out.length < 12 && dictLang) {
      const keys = (App.Decks && App.Decks.builtinKeys) ? App.Decks.builtinKeys() : Object.keys(window.decks || {});
      for (let k of keys) {
        if (langOfKey(k) !== dictLang) continue;
        if (k === srcKey) continue;
        const d = App.Decks.resolveDeckByKey(k) || [];
        for (let i = 0; i < d.length; i++) push(d[i]);
        if (out.length >= 24) break;
      }
    }

    if (out.length < 24 && App.Mistakes && typeof App.Mistakes.deck === 'function') {
      const arr = App.Mistakes.deck() || [];
      for (let i = 0; i < arr.length; i++) push(arr[i]);
    }

    return out;
  }

  function allLearned(sub, key){
    const max = App.Trainer.starsMax();
    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      for (let i=0;i<sub.length;i++){
        const w = sub[i];
        const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
        if ((App.Mistakes.getStars(sk, w.id) || 0) < max) return false;
      }
      return true;
    }
    const stars = (App.state && App.state.stars) || {};
    for (let i=0;i<sub.length;i++){ const w=sub[i]; if ((stars[App.starKey(w.id)]||0) < max) return false; }
    return true;
  }

  function pickIndexWithFallback(sub, key) {
    if (!Array.isArray(sub) || sub.length === 0) return  - App.getStarStep();
    if (isEndlessDict(key) && allLearned(sub, key)) {
      return Math.floor(Math.random() * sub.length);
    }
    return (App && App.Trainer && typeof App.Trainer.sampleNextIndexWeighted==="function") ? App.Trainer.sampleNextIndexWeighted(sub) : Math.floor(Math.random()*sub.length);
  }

function renderStars() {
  const w = current();
  try {
  document.dispatchEvent(new CustomEvent('lexitron:word-shown', { detail: { word: w } }));
} catch (_) { }
try {
  if (App.Trainer && typeof App.Trainer.rememberShown === 'function') { App.Trainer.rememberShown(w.id); }
} catch (_) { }
if (!w) return;

  const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
  const max = (App.Trainer && App.Trainer.starsMax ? App.Trainer.starsMax() : 5);
  let score = 0;

  if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
    const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
    score = App.Mistakes.getStars(sk, w.id) || 0;
  } else {
    score = (App.state && App.state.stars && App.state.stars[App.starKey(w.id)]) || 0;
  }

  const host = App.DOM && App.DOM.starsEl ? App.DOM.starsEl : document.getElementById('stars');
  if (!host) return;
  host.innerHTML = '';
  const filled = Math.floor(Math.max(0, Math.min(max, score)));
  for (let i = 0; i < max; i++) {
    const s = document.createElement('span');
    s.className = 'starIcon' + (i < filled ? ' filled' : '');
    s.textContent = '★';
    host.appendChild(s);
  }

  try {
    if (window.HalfStars && typeof HalfStars.render === 'function') {
      HalfStars.render(score, max);
    }
  } catch (_) {}
}

  function updateStats() {
    try {
      const t = App.i18n ? App.i18n() : { totalWords: 'Всего слов', learned: 'Выучено' };
      const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      const fullDeck = getFullDeck();
      const sMax = (App.Trainer && typeof App.Trainer.starsMax === 'function') ? App.Trainer.starsMax() : 5;

      let learned = 0;

      if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars) {
        for (let i = 0; i < fullDeck.length; i++) {
          const w = fullDeck[i]; if (!w) continue;
          const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
          if ((App.Mistakes.getStars(sk, w.id) || 0) >= sMax) learned++;
        }
      } else {
        const setSize = (App.Trainer && App.Trainer.getSetSize) ? (App.Trainer.getSetSize(key) || 4) : 4;
        const totalSets = Math.max(1, Math.ceil(fullDeck.length / setSize));
        const doneMap = (App.Sets && App.Sets.state && App.Sets.state.completedByDeck && App.Sets.state.completedByDeck[key]) || {};

        for (let si = 0; si < totalSets; si++) {
          if (doneMap[si]) {
            const start = si * setSize;
            const end = Math.min(fullDeck.length, start + setSize);
            learned += (end - start);
          }
        }

        const activeSet = (App.Sets && App.Sets.getActiveSetIndex) ? App.Sets.getActiveSetIndex() : 0;
        if (!doneMap[activeSet]) {
          const start = activeSet * setSize;
          const end = Math.min(fullDeck.length, start + setSize);
          const starsScoped = (App.state && App.state.stars) || {};
          for (let j = start; j < end; j++) {
            const w = fullDeck[j]; if (!w) continue;
            if ((starsScoped[App.starKey(w.id)] || 0) >= sMax) learned++;
          }
        }
      }

      if (App.DOM && App.DOM.statsBar) {
        App.DOM.statsBar.textContent = `${t.totalWords || 'Всего слов'}: ${fullDeck.length} / ${(t.learned || 'Выучено')}: ${learned}`;
      }
    } catch (e) {}
  }
  function applyCardModeClass(){
    try{
      var card = document.querySelector('.card');
      if(!card) return;
      var hard = (App.getMode && App.getMode()==='hard');
      card.classList.toggle('mode-hard', !!hard);
      card.classList.toggle('mode-normal', !hard);
    }catch(_){}
  }

  function renderCard(force = false) {
    applyCardModeClass();

  try{document.dispatchEvent(new CustomEvent("lexitron:word-shown",{detail:{word:w}}));}catch(_){}
  try{if(App.Trainer&&typeof App.Trainer.rememberShown==="function"){App.Trainer.rememberShown(w.id);}}catch(_){}

    if (document.activeElement && document.activeElement.blur) { try { document.activeElement.blur(); } catch (e) {} }
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const deckFull = getFullDeck();
    if (!deckFull.length) {
      if (key === 'mistakes') {
        if (D.wordEl) D.wordEl.textContent = '—';
        if (D.hintEl) D.hintEl.textContent = '—';
        if (D.optionsRow) D.optionsRow.innerHTML = '';
        renderStars(); try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ } updateStats();
        return;
      }
      if (D.wordEl) D.wordEl.textContent = '—';
      if (D.hintEl) D.hintEl.textContent = '—';
      if (D.optionsRow) D.optionsRow.innerHTML = '';
      renderStars(); try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      updateStats();
      return;
    }

    const b = App.Sets ? App.Sets.activeBounds() : { start: 0, end: deckFull.length };
    const sub = deckFull.slice(b.start, b.end);

    if (force || App.state.index === App.state.lastIndex) {
      const picked = pickIndexWithFallback(sub, key);
      if (picked >= 0) App.state.index = b.start + picked;
    }

    const w = current();
    if (App.state.lastShownWordId !== w.id) {
      App.state.totals.shown += 1;
      App.state.lastShownWordId = w.id;
      App.state.lastSeen[App.starKey(w.id)] = Date.now();
      App.saveState();
      if (!isEndlessDict(key)) {
        try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){};
      }
    }

    const t = App.i18n();
    const isReverse = decideModeForWord(w);

    renderStars();
    D.optionsRow.innerHTML = '';

    if (!isReverse) {
      if (D.wordEl) D.wordEl.textContent = w.word;
      let poolWords;
      if (key === 'mistakes') {
        poolWords = getMistakesDistractorPool(w)
          .map(x => (App.settings.lang === 'ru') ? (x.ru || x.uk || x.translation || x.meaning) : (x.uk || x.ru || x.translation || x.meaning))
          .filter(Boolean); try{ App.applyI18nTitles(document); }catch(_){}
      } else {
        poolWords = sub.filter(x => x.id !== w.id)
          .map(x => (App.settings.lang === 'ru') ? (x.ru || x.uk || x.translation || x.meaning) : (x.uk || x.ru || x.translation || x.meaning))
          .filter(Boolean); try{ App.applyI18nTitles(document); }catch(_){}
      }
      const correct = (App.settings.lang === 'ru') ? (w.ru || w.uk || w.translation || w.meaning || '') : (w.uk || w.ru || w.translation || w.meaning || ''); try{ App.applyI18nTitles(document); }catch(_){}
      drawOptions(correct, poolWords);
    } else {
      if (D.wordEl) D.wordEl.textContent = (App.settings.lang === 'ru') ? (w.ru || w.uk || w.translation || w.meaning || '') : (w.uk || w.ru || w.translation || w.meaning || ''); try{ App.applyI18nTitles(document); }catch(_){}
      let poolWords;
      if (key === 'mistakes') {
        poolWords = getMistakesDistractorPool(w).map(x => x.word).filter(Boolean);
      } else {
        poolWords = sub.filter(x => x.id !== w.id).map(x => x.word).filter(Boolean);
      }
      const correct = w.word;
      drawOptions(correct, poolWords);
    }

    if (D.hintEl) D.hintEl.textContent = t.choose;

    if (D.favBtn) {
      D.favBtn.disabled = (key === 'fav' || key === 'favorites' || key === 'mistakes');
      const dictKey = (key === 'mistakes')
        ? ((w && (w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)))) || 'mistakes')
        : key;
      D.favBtn.textContent = (App.isFavorite && App.isFavorite(dictKey, w.id)) ? '♥' : '♡';
    }

    addIDontKnowButton();
    updateStats();
  }

  function addToMistakesOnFailure(word) {
    if (!word) return;
    try {
      const sk = (word._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(word.id)) || (App.dictRegistry && App.dictRegistry.activeKey));
      if (App.isFavorite && App.isFavorite(sk, word.id)) return;

      const active = (App && App.dictRegistry && App.dictRegistry.activeKey) || null;
      let sourceKey;
      if (active === 'mistakes') {
        sourceKey = sk || 'mistakes';
      } else {
        sourceKey = active;
      }
      if (App && App.Mistakes && typeof App.Mistakes.add === 'function') {
        App.Mistakes.add(String(word.id), word, sourceKey);
      }
    } catch (e) {}
  }

  function onChoice(btn, correct) {

    const w = current();
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const max = App.Trainer.starsMax();

    if (correct) {
    try{document.dispatchEvent(new CustomEvent("lexitron:answer-correct",{detail:{word:w}}));}catch(_){}

      btn.classList.add('correct');
      D.optionsRow.querySelectorAll('button.optionBtn').forEach(b => b.disabled = true);

      if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
        const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
        const cur = App.Mistakes.getStars(sk, w.id) || 0;
        App.Mistakes.setStars(sk, w.id, Math.max(0, Math.min(max, cur + App.getStarStep())));
      } else {
        const cur = Math.max(0, Math.min(max, App.state.stars[App.starKey(w.id)] || 0));
        App.state.stars[App.starKey(w.id)] = Math.max(0, Math.min(max, cur + App.getStarStep()));
        App.state.successes[App.starKey(w.id)] = (App.state.successes[App.starKey(w.id)] || 0)  + App.getStarStep();
      }

      App.saveState();
      if (!isEndlessDict(key)) {
        try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){};
      }
      renderStars();
      renderSetStats(); updateStats();

      setTimeout(nextWord, 500);
      return;
    }

    btn.classList.add('wrong');
    try{ document.dispatchEvent(new CustomEvent('lexitron:answer-wrong', { detail:{ word: w } })); }catch(_){}
        btn.disabled = true;

    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
      const cur = App.Mistakes.getStars(sk, w.id) || 0;
      App.Mistakes.setStars(sk, w.id, Math.max(0, Math.min(max, cur - App.getStarStep())));
    } else {
      const cur = Math.max(0, Math.min(max, App.state.stars[App.starKey(w.id)] || 0));
      App.state.stars[App.starKey(w.id)] = Math.max(0, Math.min(max, cur - App.getStarStep()));
    }

    App.state.totals.errors += 1;
    App.state.totals.sessionErrors = (App.state.totals.sessionErrors || 0)  + App.getStarStep();

    if (!(App.isFavorite && App.isFavorite((w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)) || (App.dictRegistry && App.dictRegistry.activeKey)), w.id))) {
      if(window.MistakesGate&&typeof MistakesGate.onFail==="function"){MistakesGate.onFail(w);}else{addToMistakesOnFailure(w);}
    }

    App.saveState();
    if (!isEndlessDict(key)) {
      try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){};
    }
    renderStars();
    updateStats();
  }

  function onIDontKnow(){
  const w = current(); if (!w) return;
  try{
    const row = App.DOM?.optionsRow || document.getElementById('optionsRow');
    if (row){
      const c = row.querySelector('button.optionBtn[data-correct="1"]');
      if (c) c.classList.add('correct');
      row.querySelectorAll('button.optionBtn').forEach(b => b.disabled = true);
    }
  }catch(_){}
  try { document.dispatchEvent(new CustomEvent('lexitron:idk', { detail:{ word:w } })); } catch(_){}
  renderStars();
  updateStats();
  setTimeout(nextWord, 500);
}

  App._renderSetsBarOriginal = function () {
    const host = document.getElementById('setsBar');
    if (!host) return;
    host.innerHTML = '';
    const total = (App.Sets && App.Sets.setTotalCount) ? App.Sets.setTotalCount() : 1;
    const active = (App.Sets && App.Sets.getActiveSetIndex) ? App.Sets.getActiveSetIndex() : 0;
    for (let i = 0; i < total; i++) {
      const btn = document.createElement('button');
      btn.className = 'setTile' + (i === active ? ' active' : '') + (App.Sets.isSetDone(i) ? ' done' : '');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', i === active ? 'true' : 'false');
      if (i === active) btn.setAttribute('aria-current','true');
      btn.textContent = (i + 1);
      btn.addEventListener('click', () => {
        App.Sets.setActiveSetIndex(i);
        App.switchToSetImmediate();
      });
      host.appendChild(btn);
    }
    renderDictTitle();
    renderSetStats();
  };

  App.switchToSetImmediate = function () {
    const deck = getFullDeck();
    const b = App.Sets ? App.Sets.activeBounds() : { start: 0, end: deck.length };
    if (App.state.index < b.start || App.state.index >= b.end) App.state.index = b.start;
    renderCard(true);
    renderSetStats();
    App.saveState && App.saveState();
  };

  function nextWord() {
    App.state.lastIndex = App.state.index;
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const deckFull = getFullDeck();
    const b = App.Sets ? App.Sets.activeBounds() : { start: 0, end: deckFull.length };
    const sub = deckFull.slice(b.start, b.end);
    if (!sub.length) { renderCard(true); return; }
    const picked = pickIndexWithFallback(sub, key);
    if (picked < 0) { renderCard(true); return; }
    App.state.index = b.start + picked;
    renderCard(true);
  }

  function toggleFav() {
    const w = current();
    const activeKey = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const dictKey = (activeKey === 'mistakes')
      ? ((w && (w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)))) || 'mistakes')
      : activeKey;

    App.toggleFavorite && App.toggleFavorite(dictKey, w.id);
    if (D.favBtn) {
      D.favBtn.textContent = (App.isFavorite && App.isFavorite(dictKey, w.id)) ? '♥' : '♡';
      D.favBtn.style.transform = 'scale(1.2)';
      setTimeout(() => { D.favBtn.style.transform = 'scale(1)'; }, 140);
    }
    if (typeof App._renderSetsBarOriginal === 'function') App._renderSetsBarOriginal();
  try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      }

  function _applyActiveKeyChange(key){
    try{
      if (!key) return;
      App.dictRegistry.activeKey = key;
      try{
        localStorage.setItem('lexitron.deckKey', String(key));
        localStorage.setItem('lexitron.activeKey', String(key));
      }catch(_){}
      App.saveDictRegistry && App.saveDictRegistry();
      if (App.state){
        App.state.index = 0;
        try{
          if (typeof App.getStarStep==='function') App.state.lastIndex = - App.getStarStep();
          else App.state.lastIndex = 0;
        }catch(_){ App.state.lastIndex = 0; }
      }
      try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){}
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){}
      try{ App._renderSetsBarOriginal && App._renderSetsBarOriginal(); }catch(_){}
      try{ renderCard && renderCard(true); }catch(_){}
      try{ updateStats && updateStats(); }catch(_){}
    }catch(_){}
  }
function renderDictList() {
    const host = D.dictListHost;
    if (!host) return;
    host.innerHTML = '';

    (function appendMistakesRowFirst() {
      try {
        const row = makeDictRow('mistakes');
        if (!row) return;
        host.appendChild(row);
        let cnt = 0;
        if (App.Mistakes && typeof App.Mistakes.count === 'function') cnt = App.Mistakes.count();
        if (cnt < 4) {
          row.classList.add('disabled');
          row.setAttribute('aria-disabled', 'true');
        }
      } catch (e) {}
    })();

    (function appendFavoritesRow(){
      try{
        const row = makeDictRow('fav');
        if (!row) return;
        host.appendChild(row);
        let cnt = 0;
        try{
          App.migrateFavoritesToV2 && App.migrateFavoritesToV2();
          const v2 = (App.state && App.state.favorites_v2) || {};
          const lang = (App.settings && (App.settings.dictsLangFilter || App.settings.studyLang || App.settings.lang)) || null;
          if (lang){
            Object.keys(v2).forEach(sourceKey => {
              const m = String(sourceKey||'').match(/^([a-z]{2})_/i);
              const kLang = m ? m[1].toLowerCase() : null;
              if (kLang === String(lang).toLowerCase()) {
                cnt += Object.keys(v2[sourceKey] || {}).filter(x => v2[sourceKey][x]).length;
              }
            });
          }
        }catch(_){}
        if (cnt < 4) {
          row.classList.add('disabled');
          row.setAttribute('aria-disabled', 'true');
        }
      }catch(e){}
    })();

    (function(){
      const all = App.Decks.builtinKeys();
      const lg = (App.settings && App.settings.dictsLangFilter) || null;
      let keys = all;
      if (lg) keys = all.filter(k => keyLang(k) === lg);
      keys = _sortKeysByCategory(keys);
      keys.forEach(k => host.appendChild(makeDictRow(k)));
    })();

    for (const k of Object.keys(App.dictRegistry.user || {})) host.appendChild(makeDictRow(k));
  }

  function canShowFav() {
  try {
    App.migrateFavoritesToV2 && App.migrateFavoritesToV2();
    const v2 = (App.state && App.state.favorites_v2) || {};
    const lang = (App.settings && (App.settings.dictsLangFilter || App.settings.studyLang || App.settings.lang)) || null;
    if (!lang) return false;
    let cnt = 0;
    Object.keys(v2).forEach(sourceKey => {
      const m = String(sourceKey||'').match(/^([a-z]{2})_/i);
      const kLang = m ? m[1].toLowerCase() : null;
      if (kLang === String(lang).toLowerCase()) {
        cnt += Object.keys(v2[sourceKey] || {}).filter(x => v2[sourceKey][x]).length;
      }
    });
    return cnt >= 4;
  } catch (e) { return false; }
}

  function makeDictRow(key) {
    const words = getFullDeck();
    const row = document.createElement('div');
    row.className = 'dictRow' + (key === App.dictRegistry.activeKey ? ' active' : '');
    row.dataset.key = key;

    const flag = document.createElement('div');
    flag.className = 'dictFlag';
    if (key === 'mistakes') flag.textContent = '⚠️';
    else flag.textContent = App.Decks.flagForKey(key, words);

    const name = document.createElement('div');
    name.className = 'dictName';
    if (key === 'mistakes') {
      const t = (typeof App.i18n === 'function') ? (App.i18n() || {}) : {};
      name.textContent = (t && t.mistakesName) ? t.mistakesName : 'Мои ошибки';
    } else if (key === 'fav' || key === 'favorites') {
      name.textContent = (App.settings.lang === 'ru') ? 'Избранное' : 'Обране'; try{ App.applyI18nTitles(document); }catch(_){}
    } else {
      name.textContent = App.Decks.resolveNameByKey(key);
    }
    name.title = name.textContent;

    const actions = document.createElement('div');
    actions.className = 'dictActions';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'iconOnly';
    prevBtn.title = (App.i18n().ttPreview || 'Предпросмотр');
    prevBtn.textContent = '👁️';
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); App.Decks.openPreview(words, name.textContent); });
    actions.appendChild(prevBtn);

    if (key === 'mistakes') {
      const delBtn = document.createElement('button');
      delBtn.className = 'iconOnly';
      delBtn.title = (App.settings.lang === 'ru') ? 'Очистить «Мои ошибки»' : 'Очистити «Мої помилки»'; try{ App.applyI18nTitles(document); }catch(_){}
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const msg = App.i18n().confirmMistakesReset;
        if (!(await App.showConfirmModal({text: msg, title: App.i18n().confirmTitle, okText: App.i18n().confirmOk, cancelText: App.i18n().confirmCancel, title: (App.i18n&&App.i18n().confirmTitle)||'Подтверждение'}))) return;
        if (App.Mistakes && typeof App.Mistakes.clearActive==='function') App.Mistakes.clearActive();

        var defKey = null;
        try {
          if (App.Decks && typeof App.Decks.pickDefaultKey === 'function') {
            defKey = App.Decks.pickDefaultKey();
          } else if (App.Decks && typeof App.Decks.builtinKeys === 'function') {
            var arr = App.Decks.builtinKeys() || [];
            var lang = (App.settings && (App.settings.dictsLangFilter || App.settings.studyLang || App.settings.lang)) || null;
            if (lang) {
              var verbKey = null;
              for (var i=0;i<arr.length;i++){
                var k = arr[i];
                if (String(k).indexOf(lang + '_') === 0 && String(k).toLowerCase().indexOf('verb') !== -1) { verbKey = k; break; }
              }
              if (verbKey) defKey = verbKey;
              else defKey = arr && arr.length ? arr[0] : null;
            } else {
              defKey = arr && arr.length ? arr[0] : null;
            }
          }
        } catch(_) {}
        if (defKey) App.dictRegistry.activeKey = defKey;
        try{ localStorage.setItem('lexitron.deckKey', String(defKey)); localStorage.setItem('lexitron.activeKey', String(defKey)); }catch(_){}

        App.saveDictRegistry && App.saveDictRegistry();
        (function(){
          const key = pickPreferredKeyForLang(lg);
          if (key) {
            App.dictRegistry.activeKey = key;
            if (!App.dictRegistry.lastByLang) App.dictRegistry.lastByLang = {};
            App.dictRegistry.lastByLang[lg] = key;
            App.saveDictRegistry && App.saveDictRegistry();
            try{ localStorage.setItem('lexitron.deckKey', String(key)); localStorage.setItem('lexitron.activeKey', String(key)); }catch(_){}
          }
        })();
        renderDictList(); App._renderSetsBarOriginal && App._renderSetsBarOriginal(); try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      renderCard(true); updateStats();
      });
      actions.appendChild(delBtn);
    }

    if (key === 'fav' || key === 'favorites') {
      const delBtn = document.createElement('button');
      delBtn.className = 'iconOnly';
      delBtn.title = (App.settings.lang === 'ru') ? 'Очистить «Избранное»' : 'Очистити «Обране»'; try{ App.applyI18nTitles(document); }catch(_){}
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const msg = (App.settings.lang === 'ru') ? 'Очистить «Избранное»? Это действие нельзя отменить.' : 'Очистити «Обране»? Дію не можна скасувати.'; try{ App.applyI18nTitles(document); }catch(_){}
        if (!(await App.showConfirmModal({text: msg, title: App.i18n().confirmTitle, okText: App.i18n().confirmOk, cancelText: App.i18n().confirmCancel, title: (App.i18n&&App.i18n().confirmTitle)||'Подтверждение'}))) return;
        if (App.clearFavoritesForLang) App.clearFavoritesForLang();

        var defKey = null;
        try {
          if (App.Decks && typeof App.Decks.pickDefaultKey === 'function') {
            defKey = App.Decks.pickDefaultKey();
          } else if (App.Decks && typeof App.Decks.builtinKeys === 'function') {
            var arr = App.Decks.builtinKeys() || [];
            defKey = arr && arr.length ? arr[0] : null;
          }
        } catch(_) {}
        if (defKey) App.dictRegistry.activeKey = defKey;
        try{ localStorage.setItem('lexitron.deckKey', String(defKey)); localStorage.setItem('lexitron.activeKey', String(defKey)); }catch(_){}

        App.saveDictRegistry && App.saveDictRegistry();
        renderDictList(); App._renderSetsBarOriginal(); try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      renderCard(true); updateStats();
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(flag);
    row.appendChild(name);
    row.appendChild(actions);

    row.addEventListener('click', () => {

      try{ localStorage.setItem('lexitron.deckKey', String(key)); localStorage.setItem('lexitron.activeKey', String(key)); }catch(_){}
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ }
      try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
if (row.classList.contains('disabled')) return;
      App.dictRegistry.activeKey = key;
        try{
          var m = String(key||'').match(/^([a-z]{2})[_-]/i);
          var lang = m ? m[1].toLowerCase() : null;
          if (lang) {
            if (!App.dictRegistry.lastByLang) App.dictRegistry.lastByLang = {};
            App.dictRegistry.lastByLang[lang] = key;
            App.saveDictRegistry && App.saveDictRegistry();
          }
        }catch(_){}

        try{ localStorage.setItem('lexitron.deckKey', String(key)); localStorage.setItem('lexitron.activeKey', String(key)); }catch(_){}

      App.saveDictRegistry();

      App.state.index = 0;
      App.state.lastIndex =  - App.getStarStep();
      renderDictList();
      App._renderSetsBarOriginal();
      try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      renderCard(true);
      updateStats();
    });

    return row;
  }

  const FLAG_EMOJI = { ru:'🇷🇺', uk:'🇺🇦', en:'🇬🇧', de:'🇩🇪', es:'🇪🇸', fr:'🇫🇷', it:'🇮🇹', pl:'🇵🇱', sr:'🇷🇸', tr:'🇹🇷' };

  function pickPreferredKeyForLang(langCode) {
    try{
      const all = (App.Decks && typeof App.Decks.builtinKeys === 'function')
        ? (App.Decks.builtinKeys() || [])
        : Object.keys(window.decks || {});
      let byLang = all.filter(k => String(k).indexOf(langCode + '_') === 0);
      try{ byLang = (typeof _sortKeysByCategory==='function') ? _sortKeysByCategory(byLang) : byLang; }catch(_){}
      return byLang.length ? byLang[0] : null;
    }catch(_){ return null; }
  }

App.renderLangFlags = function(){
    if (!D.langFlags) return;
    const set = new Set();
    try {
      const keys = (App.Decks && typeof App.Decks.builtinKeys === 'function')
        ? App.Decks.builtinKeys()
        : Object.keys(window.decks || {});
      keys.forEach(k => {
        const m = String(k||'').match(/^([a-z]{2})_/i);
        const lg = m ? m[1].toLowerCase() : null;
        if (lg) set.add(lg);
      });
    } catch(_) {}
    const langs = Array.from(set);
    D.langFlags.innerHTML = '';
    if (!langs.length) return;
    const active = App.settings.dictsLangFilter || null;
    langs.forEach(lg => {
      const b = document.createElement('button');
      b.className = 'flagBtn' + ((active===lg)?' active':'');
      b.title = (App.i18n()['lang_'+lg] || lg.toUpperCase());
      b.textContent = FLAG_EMOJI[lg] || lg.toUpperCase();
      b.addEventListener('click', () => {
        App.settings.dictsLangFilter = lg;
        try{
          var _pref = (typeof pickPreferredKeyForLang==='function') ? pickPreferredKeyForLang(lg) : null;
          if (_pref) {
                        if (!App.dictRegistry.lastByLang) App.dictRegistry.lastByLang = {};
            App.dictRegistry.lastByLang[lg] = _pref;
            _applyActiveKeyChange(_pref);
          }
        }catch(_){}
renderDictList();
        App.renderLangFlags();
      });
      D.langFlags.appendChild(b);
    });
  };

  const _origBootstrap = App.bootstrap || function(){};
  App.bootstrap = function () {
    _origBootstrap();
    if (!App.state || !App.state.totals) App.state.totals = {};
    App.state.totals.sessionErrors = 0;

    if (!App.dictRegistry.activeKey) {
      var defKey = null;
      try {
        if (App.Decks && typeof App.Decks.pickDefaultKey === 'function') {
          defKey = App.Decks.pickDefaultKey();
        } else if (App.Decks && typeof App.Decks.builtinKeys === 'function') {
          var arr = App.Decks.builtinKeys() || [];
          defKey = arr && arr.length ? arr[0] : null;
        }
      } catch(_) {}
      if (defKey) App.dictRegistry.activeKey = defKey;
        try{ localStorage.setItem('lexitron.deckKey', String(defKey)); localStorage.setItem('lexitron.activeKey', String(defKey)); }catch(_){}

      App.saveDictRegistry && App.saveDictRegistry();
    }

    applyLang();
    App.applyTheme && App.applyTheme();
    bindHeaderButtons();
    renderCard(true);
  };

  function applyLang() {
    const t = App.i18n();
    if (D.titleEl && D.titleEl.firstChild) D.titleEl.firstChild.textContent = (t.appTitle || 'App') + ' ';
    if (D.appVerEl) D.appVerEl.textContent = 'v' + (App.APP_VER || '1.0.0');
    if (D.taglineEl) D.taglineEl.textContent = t.tagline || '';
    if (D.dictsBtn) D.dictsBtn.title = t.dictsHeader || 'Словари';
    renderDictList();
    App._renderSetsBarOriginal && App._renderSetsBarOriginal();
    try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      updateStats();
  }

  function openModal() { if (D.modal) D.modal.classList.remove('hidden'); var t=App.i18n?App.i18n():null; var el=document.getElementById('modalTitle'); if(el&&t&&t.modalTitle) el.textContent=t.modalTitle; }
  function closeModal() { if (D.modal) D.modal.classList.add('hidden'); }

  function bindHeaderButtons() {
    if (D.langToggleBtn) {
      D.langToggleBtn.addEventListener('click', () => {
        App.settings.lang = (App.settings.lang === 'ru') ? 'uk' : 'ru'; try{ App.applyI18nTitles(document); }catch(_){}
        D.langToggleBtn.textContent = (App.settings.lang === 'ru') ? '🇷🇺' : '🇺🇦'; try{ App.applyI18nTitles(document); }catch(_){}
        App.saveSettings(App.settings);
        applyLang();
        App.applyTheme && App.applyTheme();
        renderCard(true);
      });
    }
    if (D.themeToggleBtn) {
      const updateIcon = () => {
        const mode = document.documentElement.getAttribute('data-theme');
        D.themeToggleBtn.textContent = (mode === 'dark') ? '🌙' : '🌞';
      };
      D.themeToggleBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = (cur === 'dark') ? 'light' : 'dark';
        App.settings.theme = next;
        App.saveSettings(App.settings);
        App.applyTheme && App.applyTheme();
        updateIcon();
      });
      updateIcon();
    }
    if (D.dictsBtn) { D.dictsBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); /* PREFER-ON-OPEN */
      try{
        if (!App.settings.dictsLangFilter){
          var lg = (App.settings && (App.settings.studyLang || App.settings.lang)) || 'en';
          App.settings.dictsLangFilter = String(lg).toLowerCase();
        }
        var _lg = App.settings && App.settings.dictsLangFilter;
        if (_lg && typeof pickPreferredKeyForLang==='function'){
          var _pref = pickPreferredKeyForLang(_lg);
          if (_pref){
            App.dictRegistry.activeKey = _pref;
            if (!App.dictRegistry.lastByLang) App.dictRegistry.lastByLang = {};
            App.dictRegistry.lastByLang[_lg] = _pref;
            App.saveDictRegistry && App.saveDictRegistry();
            try{ localStorage.setItem('lexitron.deckKey', String(_pref)); localStorage.setItem('lexitron.activeKey', String(_pref)); }catch(_){}
          }
        }
      }catch(_){}
      openModal(); App.renderLangFlags && App.renderLangFlags(); }); }
    if (D.okBtn) { D.okBtn.addEventListener('click', () => { closeModal(); }); }
    if (D.backdrop) { D.backdrop.addEventListener('click', () => { closeModal(); }); }
    if (D.favBtn) { D.favBtn.addEventListener('click', toggleFav); }
  }
})();

;(function(){
  const infoBtn   = document.getElementById('btnInfo');
  const modal     = document.getElementById('infoModal');
  const titleEl   = document.getElementById('infoTitle');
  const contentEl = document.getElementById('infoContent');
  const closeEl   = document.getElementById('infoClose');

  function fillFromI18n(){
    try{
      const t = (typeof App.i18n === 'function') ? (App.i18n() || {}) : {};
      if (titleEl && t.infoTitle) titleEl.textContent = t.infoTitle;
      if (Array.isArray(t.infoSteps) && contentEl){
        const ul = document.createElement('ul');
        t.infoSteps.forEach(function(s){ const li=document.createElement('li'); li.textContent=String(s||''); ul.appendChild(li); });
        contentEl.appendChild(ul);
      }

      (function(){
        try{
          const msEl = contentEl && contentEl.querySelector('[data-i18n="modeSelection"]');
          if (msEl && t.modeSelection) msEl.textContent = String(t.modeSelection);
          const bTitle = contentEl && contentEl.querySelector('[data-i18n="backupTitle"]');
          if (bTitle && t.backupTitle) bTitle.textContent = String(t.backupTitle);
          const expBtn = document.getElementById('btnBackupExport');
          if (expBtn && t.backupExport) expBtn.textContent = String(t.backupExport);
          const impBtn = document.getElementById('btnBackupImport');
          if (impBtn && t.backupImport) impBtn.textContent = String(t.backupImport);
          const mN = contentEl && contentEl.querySelector('[data-i18n="modeNormal"]');
          if (mN && t.modeNormal) mN.textContent = String(t.modeNormal);
          const mH = contentEl && contentEl.querySelector('[data-i18n="modeHard"]');
          if (mH && t.modeHard) mH.textContent = String(t.modeHard);
        }catch(_){}
      })();
    }catch(_){}
  }
/*__settings_listener__*/
try{
  if(!window.__lex_settings_fill_hooked){
    window.__lex_settings_fill_hooked=true;
    document.addEventListener('lexitron:ui-lang-changed', function(){ try{ fillFromI18n(); }catch(_){ } });
  }
}catch(_){ }

  function openInfo(){ try{ fillFromI18n(); modal && modal.classList.remove('hidden'); }catch(_){} }
  function closeInfo(){ try{ modal && modal.classList.add('hidden'); }catch(_){} }

  if (infoBtn) infoBtn.addEventListener('click', openInfo, { passive:true });
  if (closeEl) closeEl.addEventListener('click', closeInfo, { passive:true });
  if (modal) modal.addEventListener('click', function(e){ if (e.target===modal) closeInfo(); }, { passive:true });

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', fillFromI18n);
  else fillFromI18n();
})();

;(function(){
  const btn   = document.getElementById('btnSettings');
  const modal = document.getElementById('settingsModal');
  if (!btn || !modal) return;
  const titleEl   = document.getElementById('settingsTitle');
  const contentEl = document.getElementById('settingsContent');
  const closeEl   = document.getElementById('settingsClose');
  const okEl      = document.getElementById('settingsOk');

  const toggleEl  = document.getElementById('modeToggle');
  if (toggleEl) toggleEl.addEventListener('change', function(){ try{ App.applyFromUI && App.applyFromUI(); }catch(e){} });

  function fillFromI18n(){
    try{
      const t = (typeof App.i18n === 'function') ? (App.i18n() || {}) : {};
if (titleEl && t.settingsTitle) titleEl.textContent = String(t.settingsTitle);
      if (contentEl){
        const normalEl = contentEl.querySelector('[data-i18n="modeNormal"]');
        if (normalEl && t.modeNormal) normalEl.textContent = String(t.modeNormal);
        const hardEl = contentEl.querySelector('[data-i18n="modeHard"]');
        if (hardEl && t.modeHard) hardEl.textContent = String(t.modeHard);

        const text = (t.settingsInDev!=null) ? String(t.settingsInDev) : '';
        (function(){
          const sel = '[data-i18n="settingsInDev"]';
          let p = contentEl.querySelector(sel);
          if (!p && text && String(text).trim().length){
            p = document.createElement('p');
            p.setAttribute('data-i18n','settingsInDev');
            contentEl.prepend(p);
          }
          p.textContent = text;
        })();
      }
    }catch(_){}
  }
  function open(){ try{ fillFromI18n(); modal.classList.remove('hidden'); }catch(_){} }
/*__donate_listener__*/
try{
  if(!window.__lex_donate_fill_hooked){
    window.__lex_donate_fill_hooked=true;
    document.addEventListener('lexitron:ui-lang-changed', function(){ try{ fillFromI18n(); }catch(_){ } });
  }
}catch(_){ }

  function close(){ try{ modal.classList.add('hidden'); }catch(_){} }

  btn.addEventListener('click', open, { passive:true });
  if (closeEl) closeEl.addEventListener('click', close, { passive:true });
  if (okEl) okEl.addEventListener('click', close, { passive:true });
  modal.addEventListener('click', function(e){ if (e.target===modal) close(); }, { passive:true });

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', fillFromI18n);
  else fillFromI18n();
})();

;(function(){
  var modal   = document.getElementById('infoModal');
  if (!modal) return;

  var okBtn   = modal.querySelector('#infoOk');
  var xBtn    = modal.querySelector('#infoClose');
  var titleEl = modal.querySelector('#infoTitle');
  var bodyEl  = modal.querySelector('#infoContent');
  var infoBtn = document.getElementById('btnInfo');

  function t(){ try{ return (typeof App!=='undefined' && typeof App.i18n==='function') ? (App.i18n()||{}) : {}; }catch(_){ return {}; } }

  function fill(){
    var tr = t();
    if (titleEl && tr.infoTitle) titleEl.textContent = tr.infoTitle;
    if (okBtn) okBtn.textContent = tr.ok || 'OK';
    if (infoBtn && tr.infoTitle) infoBtn.title = tr.infoTitle; // тултип «Инструкция»
    if (Array.isArray(tr.infoSteps) && bodyEl){
      bodyEl.innerHTML = '<ul>' + tr.infoSteps.map(function(s){ return '<li>' + String(s||'') + '</li>'; }).join('') + '</ul>';
    }
  }
  function open(){ fill(); modal.classList.remove('hidden'); }
/*__info_listener__*/
try{
  if(!window.__lex_info_fill_hooked){
    window.__lex_info_fill_hooked=true;
    document.addEventListener('lexitron:ui-lang-changed', function(){ try{ fill(); }catch(_){ } });
  }
}catch(_){ }

      window.addEventListener('lexi:lang-changed', function(){ try{ renderAboutDynamic(); }catch(_){} });
function close(){ modal.classList.add('hidden'); }

  if (infoBtn) infoBtn.addEventListener('click', open);
  if (okBtn)   okBtn.addEventListener('click', close);
  if (xBtn)    xBtn.addEventListener('click', close);
  modal.addEventListener('click', function(e){ if (e.target === modal) close(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill, {once:true});
  else fill();
})();

/*!
 * stars.half.visual.patch.js
 * Version: 1.6.1
 *  - Рисует дробные ★
 *  Подключать последним, после всех скриптов
 */
;(function(){
  'use strict';
  var D=document,W=window;

  var css=[
  '#stars.halfstars{display:flex;gap:6px;align-items:center;font-size:22px}', // базовый размер
'#stars.halfstars .star{position:relative;display:inline-block;width:1em;height:1em;line-height:1}',

'#stars.halfstars .star::before{content:"☆";position:absolute;left:0;top:0;right:0;bottom:0;color:#cbd5e1;opacity:.35}',

'#stars.halfstars .star::after{content:"★";position:absolute;left:0;top:0;bottom:0;width:var(--p,0%);overflow:hidden;color:#fbbf24;white-space:nowrap;}',

'#stars.halfstars .star::after{transition:width .15s ease}',
  ].join('');
  var st=D.createElement('style'); st.textContent=css; (D.head||D.documentElement).appendChild(st);

  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}

  function valFor(w){
    try{
      if(!w)return 0;
      var id=String(w.id);
      return Number(App.state?.stars?.[id])||0;
    }catch(_){return 0;}
  }

  function render(v,max){
    var host=D.getElementById('stars'); if(!host)return;
    max=max||(App.Trainer?.starsMax?.()||5);
    host.classList.add('halfstars');
    host.innerHTML='';
    for(var i=1;i<=max;i++){
      var s=D.createElement('span'); s.className='star';
      var p=clamp((v-(i-1))*100,0,100);
      s.style.setProperty('--p',p+'%');
      host.appendChild(s);
    }
  }

  D.addEventListener('lexitron:word-shown',e=>render(valFor(e?.detail?.word)));
  D.addEventListener('lexitron:answer-correct',e=>render(valFor(e?.detail?.word)));
  D.addEventListener('lexitron:idk',e=>render(valFor(e?.detail?.word)));

  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',()=>render(0),{once:true});
  else render(0);

  W.HalfStars={render};

/*!
 * lang-flag.fix.js — keeps header language flag in sync
 * Version: 1.6.1
 */
;(function(){
  'use strict';

  function currentLang(){
    try{
      if (window.App && App.settings && App.settings.lang)
        return String(App.settings.lang).toLowerCase();
      var ls = localStorage.getItem('lexitron.uiLang');
      if (ls) return String(ls).toLowerCase();
    }catch(_){}
    return 'ru';
  }

  function flagFor(lang){
    lang = (lang||'ru').toLowerCase();
    return (lang.indexOf('uk')===0)
      ? {flag:'🇺🇦', title:'Українська мова'}
      : {flag:'🇷🇺', title:'Русский язык'};
  }

  function applyFlag(){
    try{
      var el = document.getElementById('langToggleBtn');
      if (!el) return;
      var meta = flagFor(currentLang());
      el.textContent = meta.flag;
      el.setAttribute('title', meta.title);
      el.setAttribute('aria-label', meta.title);
    }catch(_){}
  }

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyFlag,{once:true});
  }else{
    applyFlag();
  };
  document.addEventListener('i18n:lang-changed',applyFlag);
  document.addEventListener('lexitron:setup:done',applyFlag);
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden) applyFlag();
  });

})();

})();

;(function(){
  const btn   = document.getElementById('btnDonate');
  const modal = document.getElementById('donateModal');
  if (!btn || !modal) return;

  const titleEl   = document.getElementById('donateTitle');
  const contentEl = document.getElementById('donateContent');
  const closeEl   = document.getElementById('donateClose');
  const okEl      = document.getElementById('donateOk');

  function fillFromI18n(){
    try{
      const t = (typeof App==='object' && typeof App.i18n==='function') ? (App.i18n()||{};
  document.addEventListener('lexitron:ui-lang-changed', function(){ try{ fillFromI18n(); }catch(_){} });

      if (titleEl && t.donateTitle)  titleEl.textContent = String(t.donateTitle);
      if (contentEl && t.donateText){
        const p = contentEl.querySelector('p');
        if (p) p.textContent = String(t.donateText);
      }
    }catch(_){}
  }
  function open(){ try{ fillFromI18n(); modal.classList.remove('hidden'); }catch(_){} }
/*__donate_listener__*/
try{
  if(!window.__lex_donate_fill_hooked){
    window.__lex_donate_fill_hooked=true;
    document.addEventListener('lexitron:ui-lang-changed', function(){ try{ fillFromI18n(); }catch(_){ } });
  }
}catch(_){ }

  function close(){ try{ modal.classList.add('hidden'); }catch(_){} }

  btn.addEventListener('click', function(e){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){ } open(); }, { passive:false });
  if (closeEl) closeEl.addEventListener('click', close, { passive:true });
  if (okEl)    okEl.addEventListener('click', close, { passive:true });
  modal.addEventListener('click', function(e){ if (e.target===modal) close(); }, { passive:true });

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', fillFromI18n, {once:true});
  else fillFromI18n();
})();

;(function(){
  try{
    const App = window.App || {};
    App.Trainer = App.Trainer || {};
    const orig = App.Trainer.unlockThreshold || function(){ return 2.5; };
    App.Trainer.unlockThreshold = function(){ return App.getReverseThreshold(); }; /* unlock threshold override */
  }catch(_){}
})();

App.hasProgress = function(){
  try {
    if (!App.Decks) return false;
    for (const deckName in App.Decks) {
      const deck = App.Decks[deckName];
      if (deck && deck.words) {
        for (const w of deck.words) {
          if (w.stars && w.stars > 0) return true;
        }
      }
    }
    return false;
  } catch(e){ return false; }
};

App.resetProgress = function(){
  try {
    if (!App.Decks) return;
    for (const deckName in App.Decks) {
      const deck = App.Decks[deckName];
      if (deck && deck.words) {
        for (const w of deck.words) {
          if (w.stars) w.stars = 0;
        }
      }
    }
    try { localStorage.removeItem('lexitron.progress'); } catch(_){}
    if (typeof App.renderStats === 'function') App.renderStats();
  } catch(e){(void 0); }
};
;(function(){
  const App = window.App || (window.App = {});
  function syncFromSettings(){
    try{
      const el = document.getElementById('modeToggle');
      if (!el) return;
      const isHard = (App.getMode() === 'hard');
      el.checked = isHard; // checked means "hard" (to match label Hard on the right)
      el.setAttribute('aria-checked', String(isHard));
    }catch(_){}
  }
  App.applyFromUI = async function(){
    const el = document.getElementById('modeToggle');
    if (!el) return;
    const newIsHard = !!el.checked;
    const currentIsHard = (App.getMode() === 'hard');

    if (newIsHard !== currentIsHard) {
      var dictKey = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      var msg = App.i18n().confirmModeReset;
      if (!(await App.showConfirmModal({text: msg, title: App.i18n().confirmTitle, okText: App.i18n().confirmOk, cancelText: App.i18n().confirmCancel, title: (App.i18n&&App.i18n().confirmTitle)||'Подтверждение'}))) { el.checked = currentIsHard; // revert toggle
        el.setAttribute('aria-checked', String(currentIsHard));
        return;
       }
      try {
        if (dictKey) {
          if (typeof App.resetDeckProgress === 'function') App.resetDeckProgress(dictKey); // App.state.*
          if (App.ProgressV2 && typeof App.ProgressV2.resetDeck === 'function') App.ProgressV2.resetDeck(dictKey); // progress.v2
          if (typeof App.saveState === 'function') App.saveState();
        }
      } catch (_){}
      try {
        if (App.Stats && typeof App.Stats.recomputeAndRender === 'function') App.Stats.recomputeAndRender();
      } catch(_){}
      try { if (typeof renderSetStats === 'function') renderSetStats(); } catch(_){}
      try { if (typeof App._renderSetsBarOriginal === 'function') App._renderSetsBarOriginal(); try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      } catch(_){}
      try { if (typeof renderStars === 'function') renderStars(); } catch(_){}
    }

    const isHard = newIsHard;
    App.settings = App.settings || {};
    App.settings.mode = isHard ? 'hard' : 'normal';
    try{ localStorage.setItem('lexitron.mode', App.settings.mode); }catch(_){}
    if (typeof App.saveSettings === 'function') App.saveSettings(App.settings);
    try{ if (typeof renderStars==='function') renderStars(); }catch(_){}
    try{ if (typeof App._renderSetsBarOriginal==='function') App._renderSetsBarOriginal(); try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      }catch(_){}
  }
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromSettings, {once:true});
  } else {
    syncFromSettings();
  }
})();
;(function(){
  const App = window.App || (window.App = {});
  App.showConfirmModal = function(opts){
    opts = opts || {};
    return new Promise(function(resolve){
      try{
        const modal = document.getElementById('confirmModal');
        const body = document.body || document.documentElement;

        const titleEl = document.getElementById('confirmTitle');
        const textEl = document.getElementById('confirmText');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        const closeBtn = document.getElementById('confirmClose');
        const t = (typeof App.i18n === 'function') ? (App.i18n() || {}) : {};

        titleEl.textContent = opts.title || (t && t.confirmTitle) || 'Подтверждение';
        textEl.textContent = opts.text || (t && t.confirmText) || 'Вы уверены?';
        okBtn.textContent = opts.okText || (t && t.ok) || 'OK';
        cancelBtn.textContent = opts.cancelText || (t && t.cancel) || 'Отмена';

        function open(){ modal.classList.remove('hidden'); body && body.classList.add('modal-open'); }
        function close(){ modal.classList.add('hidden'); body && body.classList.remove('modal-open'); cleanup(); }
        function cleanup(){
          okBtn.onclick = null;
          cancelBtn.onclick = null;
          if (closeBtn) closeBtn.onclick = null;
          document.removeEventListener('keydown', onKey, true);
          document.removeEventListener('keydown', onTrapTab, true);
          modal.removeEventListener('click', onBackdrop, true);
        }
        function onKey(e){
          if (e.key === 'Escape') { resolve(false); close(); }
          if (e.key === 'Enter')  { resolve(true);  close(); }
        }
        function onBackdrop(e){
          if (e.target === modal) { resolve(false); close(); }
        }

        okBtn.onclick = function(){ resolve(true); close(); };
        setTimeout(function(){ try{ okBtn.focus(); }catch(_){ } }, 0);
        function onTrapTab(e){
          if (e.key === 'Tab'){
            const focusables = [okBtn, cancelBtn, closeBtn].filter(Boolean);
            const idx = focusables.indexOf(document.activeElement);
            if (e.shiftKey){
              if (idx <= 0){ e.preventDefault(); focusables[focusables.length-1].focus(); }
            } else {
              if (idx === focusables.length-1){ e.preventDefault(); focusables[0].focus(); }
            }
          }
        }
        cancelBtn.onclick = function(){ resolve(false); close(); };
        if (closeBtn) closeBtn.onclick = function(){ resolve(false); close(); };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('keydown', onTrapTab, true);
        modal.addEventListener('click', onBackdrop, true);
        open();
      }catch(e){
        resolve(window.confirm(opts.text || 'Вы уверены?'));
      }
    });
  };
})();

;(function(){
  var G = (typeof window!=='undefined')?window:self;
  var App = G.App || (G.App={});
  var decks = G.decks || G.DECKS || (App.decks && App.decks.all) || (App.decks && App.decks) || {};

  function deckKeys(){
    var ks = Object.keys(decks);
    return ks.filter(function(k){ return typeof decks[k] === 'object'; });
  }
  function deckName(k){
    try {
      if (App.decks && App.decks.getName) return App.decks.getName(k);
      var d = decks[k]||{};
      if (d.title && typeof d.title==='object'){
        var lang = (App.settings && App.settings.lang) || 'en';
        return d.title[lang] || d.title.en || d.title.ru || d.title.uk || (k||'').toUpperCase();
      }
      if (typeof d.title==='string') return d.title;
    } catch(e){}
    return (k||'').toUpperCase();
  }
  function deckFlag(k){
    try { if (App.decks && App.decks.getFlag) return App.decks.getFlag(k); } catch(e){}
    var map={de:'🇩🇪', en:'🇬🇧', fr:'🇫🇷', sr:'🇷🇸', ru:'🇷🇺', uk:'🇺🇦'};
    return map[k]||'📚';
  }
  function setActive(k){
    try { if (App.decks && App.decks.setActive) App.decks.setActive(k); } catch(e){}
  }

  function renderSpoilers(host){
    if (!host) host = document.getElementById('setsBar');
    if (!host) return;
    host.innerHTML='';

    function activeKey(){
      try {
        if (App.decks && App.decks.getActiveKey) return App.decks.getActiveKey();
      } catch(e){}
      try {
        return localStorage.getItem('lexitron.deckKey') || localStorage.getItem('lexitron.activeKey') || 'de';
      } catch(e){}
      return 'de';
    }
    function deckName(k){
      try { if (App.decks && App.decks.getName) return App.decks.getName(k); }catch(e){}
      var d = (window.decks && window.decks[k]) || {};
      if (d && typeof d.title==='object'){
        var lang = (App.settings && App.settings.lang) || 'en';
        return d.title[lang] || d.title.en || d.title.ru || d.title.uk || (k||'').toUpperCase();
      }
      if (d && typeof d.title==='string') return d.title;
      return (k||'').toUpperCase();
    }
    function deckFlag(k){
      try { if (App.decks && App.decks.getFlag) return App.decks.getFlag(k); }catch(e){}
      var map={de:'🇩🇪', en:'🇬🇧', fr:'🇫🇷', sr:'🇷🇸', ru:'🇷🇺', uk:'🇺🇦'};
      return map[k]||'📚';
    }

    var k = activeKey();
    var details = document.createElement('details');
    details.className='dictSpoiler';
    var summary = document.createElement('summary');
    summary.innerHTML = '<span class="flag" id="dictFlag"></span><span class="name" id="dictTitleInSpoiler"></span>'; updateSpoilerHeader();
    var body = document.createElement('div');
    body.className='setsSpoilerBody';

    details.appendChild(summary);
    details.appendChild(body);
    host.appendChild(details);
    if (details.open) { try { details.dispatchEvent(new Event('toggle')); } catch(_){} }
    try{
      var so = localStorage.getItem('lexitron.spoilerOpen'); if (so==='1') details.setAttribute('open','open');
    }catch(_){}

    details.addEventListener('toggle', function(){
      if (details.open){
        var kk = activeKey();
        summary.innerHTML = '<span class="flag" id="dictFlag"></span><span class="name" id="dictTitleInSpoiler"></span>'; updateSpoilerHeader();
        var origHost = document.getElementById('setsBar');
        var had = false, oldId = '';
        if (origHost){
          oldId = origHost.id;
          if (oldId) had = true;
          origHost.id = 'setsBar__orig';
        }
        var prev = body.id;
        body.id = 'setsBar';
        try {
          if (App.ui && App.ui._renderSetsBarOriginal) App.ui._renderSetsBarOriginal();
          else if (App._renderSetsBarOriginal) App._renderSetsBarOriginal();
          try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try { var statsEl = document.getElementById('setStats'); if (statsEl && statsEl.parentElement !== body) body.appendChild(statsEl); } catch(_){ }
        } finally {
          body.id = prev || '';
          if (origHost) origHost.id = had ? oldId : '';
          try{ localStorage.setItem('lexitron.spoilerOpen','1'); }catch(_){}
        }
      } else {
        body.innerHTML='';
        try{ localStorage.setItem('lexitron.spoilerOpen','0'); }catch(_){}
      }
    });
  }

  if (App.ui && App.ui._renderSetsBarOriginal) {
    App.ui.renderSetsBar = function(host){
  var el = host || document.getElementById('setsBar');
  if (el && el.closest && el.closest('.setsSpoilerBody')){
    if (App.ui && App.ui._renderSetsBarOriginal) return App.ui._renderSetsBarOriginal();
    if (App._renderSetsBarOriginal) return App._renderSetsBarOriginal();
  try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      }
  return renderSpoilers(host);
};
  } else if (App._renderSetsBarOriginal) {
    App.renderSetsBar = function(host){
  var el = host || document.getElementById('setsBar');
  if (el && el.closest && el.closest('.setsSpoilerBody')){
    if (App.ui && App.ui._renderSetsBarOriginal) return App.ui._renderSetsBarOriginal();
    if (App._renderSetsBarOriginal) return App._renderSetsBarOriginal();
  try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      }
  return renderSpoilers(host);
};
  }

  if (App.applyLang && !App.__applyLangSpoilers) {
    var orig = App.applyLang.bind(App);
    App.applyLang = function(){
      var r = orig();
      try{
        var keys = deckKeys();
        document.querySelectorAll('.dictSpoiler > summary .name').forEach(function(n,i){
          var k = keys[i];
          if (k) n.textContent = deckName(k);
        });
      }catch(e){}
      if (App.refreshTooltips) App.refreshTooltips();
      return r;
    };
    App.__applyLangSpoilers = true;
  }
})(); // end injected wrapper

;(function(){
  function updateSpoilerHeader(){
  try{
    var flagEl = document.getElementById('dictFlag');
    var nameEl = document.getElementById('dictTitleInSpoiler');
    if (!flagEl || !nameEl || !window.App || !App.Decks) return;
    var k = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    if (!k){ nameEl.textContent='—'; flagEl.textContent='📚'; return; }

    function flagForLang(lg){
      var MAP = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', pl:'🇵🇱', sr:'🇷🇸', ru:'🇷🇺', uk:'🇺🇦', tr:'🇹🇷' };
      return MAP[(lg||'').toLowerCase()] || '🌐';
    }

    var kk = String(k).toLowerCase();
    if (kk === 'fav' || kk === 'favorites'){
      var favTitle = (App.Decks.resolveNameByKey && App.Decks.resolveNameByKey('favorites')) || 'Избранное';
      nameEl.textContent = favTitle;

      var lg = (App.settings && App.settings.dictsLangFilter) || (App.settings && App.settings.studyLang) || (App.settings && App.settings.lang) || null;
      if (!lg){
        try{
          var deck = (App.Decks.resolveDeckByKey && App.Decks.resolveDeckByKey('favorites')) || [];
          if (deck && deck.length){
            var w0 = deck[0];
            var sk = w0 && (w0._favSourceKey || w0._mistakeSourceKey || w0._sourceKey);
            if (sk && App.Decks.langOfKey) lg = App.Decks.langOfKey(sk);
          }
        }catch(_){}
      }
      flagEl.textContent = lg ? flagForLang(lg) : '🌐';
      return;
    }
    if (kk === 'mistakes'){
      var misTitle = (App.Decks.resolveNameByKey && App.Decks.resolveNameByKey('mistakes')) || 'Мои ошибки';
      nameEl.textContent = misTitle;

      var lg2 = (App.settings && App.settings.dictsLangFilter) || null;
      if (!lg2){
        try{
          var mdeck = (App.Decks.resolveDeckByKey && App.Decks.resolveDeckByKey('mistakes')) || [];
          if (mdeck && mdeck.length){
            var w = mdeck[0];
            var srcKey = w && w._mistakeSourceKey;
            if (srcKey && App.Decks.langOfKey) lg2 = App.Decks.langOfKey(srcKey);
          }
        }catch(_){}
      }
      flagEl.textContent = lg2 ? flagForLang(lg2) : '🌐';
      return;
    }

    flagEl.textContent = App.Decks.flagForKey ? (App.Decks.flagForKey(k) || '📚') : '📚';
    nameEl.textContent = App.Decks.resolveNameByKey ? (App.Decks.resolveNameByKey(k) || '') : '';
  }catch(_){}
}
  window.updateSpoilerHeader = updateSpoilerHeader;

  function rebind(){
    try{
      if (App && App._renderSetsBarOriginal){
        App.renderSetsBar = function(host){
          var el = host || document.getElementById('setsBar');
          if (!el) return;
          App._renderSetsBarOriginal();
          try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ if (typeof updateSpoilerHeader==='function') updateSpoilerHeader(); }catch(_){ } try{ if (typeof renderSetStats==='function') renderSetStats(); }catch(_){ }
      try{ updateSpoilerHeader(); }catch(_){}
          try{ if (typeof renderSetStats === 'function') renderSetStats(); }catch(_){}
        };
      }
    }catch(_){}
  }

  if (document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', function(){ updateSpoilerHeader(); rebind(); }, {once:true}); }
  else { updateSpoilerHeader(); rebind(); }

  if (window.App){
    if (!App.__spoilerHeaderHook){
      var ap = App.applyLang && App.applyLang.bind(App);
      if (ap){
        App.applyLang = function(){ var r = ap(); try{ updateSpoilerHeader(); }catch(_){}; try{ App.renderSetsBar && App.renderSetsBar(); }catch(_){}; return r; };
      }
      App.__spoilerHeaderHook = true;
    }
  }
})();

;(function(){
  try{
    const modal = document.getElementById('infoModal');
    if (!modal) return;

    let frame = modal.querySelector('.modalFrame');
    if (!frame){
      frame = document.createElement('div');
      frame.className = 'modalFrame';
      modal.appendChild(frame);
    }
    frame.setAttribute('tabindex','-1');

    frame.innerHTML = `
      <div class="modalHeader">
        <div class="modalTitle" id="infoTitle"></div>
        <button class="iconBtn small" id="infoClose" aria-label="Close">✖️</button>
      </div>
      <div id="infoTabs" class="tabs" role="tablist" aria-label="Info">
        <button class="tab" id="tab-instr" role="tab" aria-controls="panel-instr" aria-selected="true" tabindex="0"></button>
        <button class="tab" id="tab-about" role="tab" aria-controls="panel-about" aria-selected="false" tabindex="-1"></button>
      </div>
      <div class="modalBody">
        <section id="panel-instr" class="tabPanel" role="tabpanel" aria-labelledby="tab-instr">
          <div id="infoContent" class="infoContent scrollArea"></div>
        </section>
        <section id="panel-about" class="tabPanel hidden" role="tabpanel" aria-labelledby="tab-about">
          <div class="aboutGrid">
            <div class="aboutRow">
              <div class="aboutLabel">Версия</div>
              <div class="aboutValue"><span id="appVersion">—</span></div>
            </div>
            <div class="aboutRow">
              <div class="aboutLabel">Статус</div>
              <div class="aboutValue">
                <span id="licStatus">—</span>
                <span id="licUser" class="muted"></span>
              </div>
            </div>
          </div>
          <div class="actionsRow">
            <button id="btnCheckUpdates" class="btnPill"></button>
          </div>

          <div class="aboutSep"></div>
<div class="regBlock">
            <label for="regKey" id="regKeyLabel"></label>
            <div class="regRow">
              <input id="regKey" type="text" inputmode="latin" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX">
              <button id="btnRegister" class="btnPill"></button>
            </div>
            <div id="regHint" class="muted"></div>
          </div>
        </section>
      </div>
      <div class="modalActions" style="text-align:center">
        <button id="infoOk" class="primary">OK</button>
      </div>
    `;

    const tabInstr = document.getElementById('tab-instr');
    const tabAbout = document.getElementById('tab-about');
    const panelInstr = document.getElementById('panel-instr');
    const panelAbout = document.getElementById('panel-about');
    const titleEl = document.getElementById('infoTitle');
    const okBtn = document.getElementById('infoOk');
    const xBtn = document.getElementById('infoClose');
    const btnUpdates = document.getElementById('btnCheckUpdates');
    const btnRegister = document.getElementById('btnRegister');
    const regKeyEl = document.getElementById('regKey');
    const regHintEl = document.getElementById('regHint');
    const regKeyLabel = document.getElementById('regKeyLabel');
    const bodyEl = document.getElementById('infoContent');
    const verEl = document.getElementById('appVersion');
    const licStatusEl = document.getElementById('licStatus');
    const licUserEl = document.getElementById('licUser');

    function lang(){ return (window.App && App.settings && App.settings.lang) || (App.settings && (App.settings.uiLang || App.settings.lang)) || 'uk'; }
    function pack(){
      const L = lang();
      return (window.I18N && (I18N[L] || I18N.uk)) || {};
    }
    function T(k, def){
      const p = pack();
      if (p && p[k] != null) return p[k];
      const d = {
        ru: {infoTitle:'Информация', tabInstruction:'Инструкция', tabAbout:'О программе', ok:'OK', checkUpdates:'Проверить обновления', regKey:'Ключ регистрации', register:'Зарегистрировать',
regStubHint:'Пока заглушка — логика активации будет добавлена позже.'},
        uk: {infoTitle:'Інформація', tabInstruction:'Інструкція', tabAbout:'Про програму', ok:'OK', checkUpdates:'Перевірити оновлення', regKey:'Ключ реєстрації', register:'Зареєструвати',
regStubHint:'Поки заглушка — логіку активації додамо пізніше.'},
        en: {infoTitle:'Information', tabInstruction:'Instruction', tabAbout:'About', ok:'OK', checkUpdates:'Check for updates', regKey:'Registration key', register:'Register',
regStubHint:'Placeholder — activation logic will be added later.'}
      };
      const L = lang();
      return (d[L] && d[L][k]) || (d.ru[k]) || def || '';
    }

    function fillLabels(){
      titleEl.textContent = T('infoTitle');
      tabInstr.textContent = T('tabInstruction');
      tabAbout.textContent = T('tabAbout');
      okBtn.textContent = T('ok','OK');
      btnUpdates.textContent = T('checkUpdates');
      regKeyLabel.textContent = T('regKey');
      btnRegister.textContent = T('register');
      regHintEl.textContent = T('regStubHint');
    }

    function switchTab(which){
      const instr = which==='instr';
      tabInstr.classList.toggle('active', instr);
      tabAbout.classList.toggle('active', !instr);
      panelInstr.classList.toggle('hidden', !instr);
      panelAbout.classList.toggle('hidden', instr);
      tabInstr.setAttribute('aria-selected', instr?'true':'false');
      tabAbout.setAttribute('aria-selected', !instr?'true':'false');
    }
    function lockBodyHeight(){
      const body = modal.querySelector('.modalBody');
      if (!body) return;
      const instrActive = !panelInstr.classList.contains('hidden');
      panelInstr.classList.remove('hidden');
      panelAbout.classList.remove('hidden');
      const h1 = panelInstr.scrollHeight;
      const h2 = panelAbout.scrollHeight;
      const maxH = Math.max(h1, h2, 240);
      panelInstr.classList.toggle('hidden', !instrActive);
      panelAbout.classList.toggle('hidden', instrActive);
      body.style.height = maxH + 'px';
    }

    tabInstr.addEventListener('click', ()=> { switchTab('instr'); lockBodyHeight(); });
    tabAbout.addEventListener('click', ()=> { switchTab('about'); lockBodyHeight(); });

    function ensureOnShow(){
      fillLabels();                            renderAboutDynamic();
      switchTab('instr');                // show only Instruction
      lockBodyHeight();                // fix height
    }
    ensureOnShow();
    try{
      const obs = new MutationObserver(()=>{ if (!modal.classList.contains('hidden')) ensureOnShow(); });
      obs.observe(modal, { attributes:true, attributeFilter:['class'] });
    }catch(_){}

    try{
      const p = pack();
      if (bodyEl){
        if (!(Array.isArray(p.infoSteps) && p.infoSteps.length)){
          const fb=['Запоминайте слова — увидели слово — выберите перевод.','Добавляйте в Избранное — отмечайте важные слова, чтобы вернуться к ним позже.','Используйте кнопку «Не знаю» — это помогает продвигаться дальше и не считается ошибкой.'];
          bodyEl.innerHTML = '<ul>' + fb.map(s=>`<li>${s}</li>`).join('') + '</ul>';
        }
      }
      if (Array.isArray(p.infoSteps)){
        bodyEl.innerHTML = '<ul>' + p.infoSteps.map(s=>`<li>${String(s||'')}</li>`).join('') + '</ul>';
      }
    }catch(_){}

    function renderAboutDynamic(){
      try{
        const meta = {
          version: (window.App && (App.meta && App.meta.version)) || (window.App && App.version) || (window.App && App.APP_VER) || '—',
          isActivated: !!(window.App && App.lic && App.lic.isActivated),
          userName: (window.App && App.lic && App.lic.userName) || ''
        };
        if (verEl) verEl.textContent = meta.version;
        if (licStatusEl){
          if (meta.isActivated){
            licStatusEl.textContent = T('licensed');
            if (licUserEl) licUserEl.textContent = meta.userName ? ('— ' + meta.userName) : '';
          } else {
            licStatusEl.textContent = T('notLicensed');
            licStatusEl.classList.add('muted');
            if (licUserEl) licUserEl.textContent = '';
          }
        }
      }catch(_){}
    }
    renderAboutDynamic();
    function close(){ modal.classList.add('hidden'); }
    okBtn.addEventListener('click', close);
    xBtn.addEventListener('click', close);
    modal.addEventListener('click', e=>{ if (e.target===modal) close(); });

    document.addEventListener('keydown', e=>{
      if (e.key==='Escape') close();
      if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
        switchTab(tabInstr.classList.contains('active') ? 'about' : 'instr');
      }
    });

    async function fetchRemoteVersion(){
      try{
        const r = await fetch('./app.core.js?ts='+Date.now(), {cache:'no-store'});
        const t = await r.text();
        const m = t.match(/APP_VER\s*=\s*['"]([^'"]+)['"]/);
        return m?m[1]:null;
      }catch(_){ return null; }
    }
    async function updateServiceWorker(){
      if(!('serviceWorker' in navigator)) return {waiting:false};
      const reg = await navigator.serviceWorker.getRegistration();
      if(!reg) return {waiting:false};
      await reg.update().catch(()=>{});
      if(reg.waiting) return {waiting:true, reg};
      return {waiting:false, reg};
    }
    async function applyUpdate(reg){
      const worker = reg.waiting || reg.installing;
      if(!worker) return;
      const changed = new Promise(res=>navigator.serviceWorker.addEventListener('controllerchange',()=>res(),{once:true}));
      worker.postMessage({type:'SKIP_WAITING'});
      await changed; location.reload();
    }
    btnUpdates.addEventListener('click', async ()=>{
      const current = meta.version;
      const remote = await fetchRemoteVersion();
      const sw = await updateServiceWorker();
      if ((remote && remote !== current) || sw.waiting){
        if (confirm(`${T('checkUpdates')}: ${remote || ''}. Перезагрузить?`)){
          if (sw.waiting) await applyUpdate(sw.reg);
          else location.reload();
        }
      } else {
        alert(`${T('checkUpdates')}: обновлений нет. (${current})`);
      }
    });

    const infoBtn = document.getElementById('btnInfo');
    if (infoBtn) infoBtn.addEventListener('click', ensureOnShow);
  }catch(e){(void 0); }
})();

;(function(){
  try{
    var modal = document.getElementById('infoModal');
    if (!modal) return;

    function lang(){ try{ return (window.App && App.settings && App.settings.lang) || (App.settings && (App.settings.uiLang || App.settings.lang)) || 'uk'; }catch(_){ return 'uk'; } }
    function pack(){
      var L = lang();
      return (window.I18N && (I18N[L] || I18N.uk)) || {};
    }
    function defaults(){
      var L = lang(), D={
        ru:{title:'Информация', instr:'Инструкция', about:'О программе'},
        uk:{title:'Інформація', instr:'Інструкція', about:'Про програму'},
        en:{title:'Information', instr:'Instruction', about:'About'}
      }; return D[L] || D.ru;
    }

    function applyOnce(){
      var t = pack(), d = defaults();
      var title = (t.infoTitle!=null)?String(t.infoTitle):d.title;
      var tab1  = (t.tabInstruction!=null)?String(t.tabInstruction):d.instr;
      var tab2  = (t.tabAbout!=null)?String(t.tabAbout):d.about;
      if (title === tab1) title = d.title;

      var titleEl = modal.querySelector('#infoTitle'); if (titleEl) titleEl.textContent = title;
      var ti = modal.querySelector('#tab-instr'); if (ti && !ti.textContent.trim()) ti.textContent = tab1;
      var ta = modal.querySelector('#tab-about'); if (ta && !ta.textContent.trim()) ta.textContent = tab2;

      var hint = modal.querySelector('#regHint'); if (hint) hint.remove();

      var btnUpd = modal.querySelector('#btnCheckUpdates');
      if (btnUpd){
        var actions = btnUpd.closest('.actionsRow') || btnUpd.parentElement;
        if (actions && !modal.querySelector('.aboutSep')){
          var sep = document.createElement('div');
          sep.className = 'aboutSep';
          actions.insertAdjacentElement('afterend', sep);
        }
      }
    }

    var run = function(){ if (!modal.classList.contains('hidden')) applyOnce(); };
    run();
    try{
      var obs = new MutationObserver(run);
      obs.observe(modal, {attributes:true, attributeFilter:['class']});
    }catch(_){}
  }catch(e){(void 0); }
})();

/*HOOK_UI_LANG_SELECT*/
;(function(){
  try{
    var sel = document.querySelector("select[name='uiLang'], #uiLang, [data-role='uiLang']");
    if(sel && !sel.__lex_hooked){
      sel.__lex_hooked = true;
      sel.addEventListener('change', function(ev){
        try{ App.setUiLang && App.setUiLang(ev.target.value); }catch(_){}
      }, { passive:true });
    }
  }catch(_){}
})();

/*LANG_CHANGE_LISTENER_SETTINGS*/
try{document.addEventListener('lexitron:ui-lang-changed', function(){ try{ fillFromI18n(); }catch(_){} });}catch(_){ }