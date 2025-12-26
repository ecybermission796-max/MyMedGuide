// search.js - client-side search using biterdata_index.json
(function(){
  'use strict';

  function normalize(s){ 
    if(!s) return '';
    let result = s.toString().trim().toLowerCase();
    // Apply same normalization as filenameToKey for consistency
    result = result.replace(/[(),']/g, '');
    result = result.replace(/[ \-]+/g, '_');
    return result;
  }

  // return true if two strings are within one edit (insert/delete/substitute)
  function withinOneEdit(a,b){
    if(a === b) return true;
    let la = a.length, lb = b.length;
    if(Math.abs(la-lb) > 1) return false;
    // ensure a is shorter or equal
    if(la > lb){ const t=a; a=b; b=t; const tmp=la; la=lb; lb=tmp; }
    let i=0,j=0,diff=0;
    while(i<a.length && j<b.length){
      if(a[i] === b[j]){ i++; j++; continue; }
      diff++;
      if(diff > 1) return false;
      if(la === lb){ // substitution
        i++; j++; 
      } else { // insertion in b or deletion in b
        j++; 
      }
    }
    if(i < a.length || j < b.length) diff += (a.length - i) + (b.length - j);
    return diff <= 1;
  }

  // find image for a given keyword by scanning the class manifest (if present)
  async function findImageForKeyword(keyword, cls){
    const manifestPaths = [
      `images/${cls.toLowerCase()}/manifest.json`,
      `./images/${cls.toLowerCase()}/manifest.json`,
      `/images/${cls.toLowerCase()}/manifest.json`
    ];
    // helper to normalize filenames same as browse.js
    function filenameToKey(fname){
      let base = fname.split('/').pop();
      base = base.replace(/\.(jpg|jpeg|png)$/i,'');
      // Standardized normalization: 1) Remove parentheses, commas, and apostrophes, 2) Replace spaces/hyphens with underscores, 3) Lowercase
      base = base.replace(/[(),']/g, '');
      base = base.replace(/[ \-]+/g, '_');
      return base.toLowerCase();
    }
    for(const mp of manifestPaths){
      try{
        const r = await fetch(mp, {cache:'no-store'});
        if(r && r.ok){
          let files = await r.json();
          // coerce non-array manifest formats (string or object) into an array, like browse.js does
          if(!Array.isArray(files)){
            if(typeof files === 'string') files = [files];
            else if(files && typeof files === 'object'){
              if(Array.isArray(files.files)) files = files.files;
              else if(Array.isArray(files.paths)) files = files.paths;
              else {
                try{ files = Object.values(files).flat().filter(v=>typeof v === 'string'); }catch(e){ files = []; }
              }
            } else {
              files = [];
            }
          }
          for(const f of files){
            if(filenameToKey(f) === normalize(keyword)) return f;
          }
        }
      }catch(e){ /* ignore */ }
    }
    return null;
  }

  // render results grid (items: [{keyword, class, img}])
  function renderResults(items){
    const viewId = 'search-results';
    let v = document.getElementById(viewId);
    if(!v){
      v = document.createElement('section'); v.id = viewId; v.className='view'; v.setAttribute('role','region'); v.setAttribute('aria-label','Search Results');
      const browse = document.getElementById('browse'); browse.parentNode.insertBefore(v, browse.nextSibling);
    }
    if(!items || !items.length){
      v.innerHTML = `<header class="view-header"><h2>Search Results</h2></header><div class="placeholder">No results found.</div>`;
      if(window.showView) window.showView(viewId); else document.querySelectorAll('.view').forEach(el=> el.id===viewId?el.classList.add('active'):el.classList.remove('active'));
      return;
    }

    // build centered flex grid (up to 4 per row visually)
    const container = document.createElement('div'); container.className = 'search-grid';
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';
    container.style.gap = '12px';

    items.forEach(it => {
      const card = document.createElement('div'); card.className = 'search-card'; card.style.width = '220px'; card.style.textAlign = 'center';
      const params = new URLSearchParams({ action: 'detail', cls: it.class, kw: it.keyword, img: it.img || '' });
      const url = window.location.pathname + '#' + params.toString();
      const a = document.createElement('a');
      a.href = url;
      a.className = 'result-link';
      // force open in new tab like Ctrl+Click
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const img = document.createElement('img'); img.src = it.img ? encodeURI(it.img) : ''; img.alt = it.keyword; img.style.maxWidth = '100%'; img.style.height = '140px'; img.style.objectFit = 'cover'; img.style.display = 'block'; img.style.margin = '0 auto';
      // fallback: if encoded URL fails to load, try the raw path (some manifests may already be encoded)
      img.onerror = () => { if(it.img && img.src !== it.img) img.src = it.img; };
      a.appendChild(img);
      const name = document.createElement('div'); name.className = 'result-name'; name.style.marginTop = '6px'; name.textContent = it.keyword;
      card.appendChild(a); card.appendChild(name); container.appendChild(card);
    });

    v.innerHTML = `<header class="view-header"><h2>Search Results</h2></header>`; v.appendChild(container);
    if(window.showView) window.showView(viewId); else document.querySelectorAll('.view').forEach(el=> el.id===viewId?el.classList.add('active'):el.classList.remove('active'));
  }

  async function performSearch(){
    const q = document.getElementById('global-search-input').value || '';
    const scope = document.getElementById('search-scope').value || 'All';
    const categoryFilter = document.getElementById('search-category') ? document.getElementById('search-category').value.trim() : '';
    const stateFilter = document.getElementById('search-state') ? document.getElementById('search-state').value.trim() : '';
    const qnorm = normalize(q);
    if(!qnorm){ const t=document.getElementById('toast'); if(t){ t.textContent='Enter a search term'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2000);} return; }

    let index = {};
    try{ const r = await fetch('data/biterdata_index.json'); if(!r.ok) throw new Error('HTTP '+r.status); index = await r.json(); }catch(e){ console.warn('Could not load biterdata_index.json:', e.message); const t=document.getElementById('toast'); if(t){ t.textContent='Search index not available'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),3000);} return; }

    // Helper to split keywords by comma, semicolon, and, or
    function splitKeywords(str){
      if(!str) return [];
      return (str.toString().split(/[,;]|\band\b|\bor\b/i))
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0);
    }

    // assemble candidate list filtered by scope, category, and state
    const candidates = [];
    for(const kw of Object.keys(index)){
      const entry = index[kw];
      
      // Filter by class (scope)
      if(scope !== 'All' && normalize(entry.class) !== normalize(scope)) continue;
      
      // Filter by category if specified
      if(categoryFilter && normalize(entry.Category) !== normalize(categoryFilter)) continue;
      
      // Filter by state if specified
      if(stateFilter){
        const states = entry.state || [];
        const stateMatched = states.some(s => normalize(s) === normalize(stateFilter));
        if(!stateMatched) continue;
      }
      
      // Collect all searchable keywords
      const searchableKeywords = [];
      
      // Add Category
      if(entry.Category) searchableKeywords.push(...splitKeywords(entry.Category));
      
      // Add state(s)
      if(entry.state && Array.isArray(entry.state)){
        entry.state.forEach(s => searchableKeywords.push(...splitKeywords(s)));
      }
      
      // Add Scientific_name
      if(entry.Scientific_name) searchableKeywords.push(...splitKeywords(entry.Scientific_name));
      
      // Add Other_name
      if(entry.Other_name) searchableKeywords.push(...splitKeywords(entry.Other_name));
      
      candidates.push({ 
        keyword: kw, 
        class: entry.class, 
        other: searchableKeywords 
      });
    }

    // Scoring: exact keyword matches first; otherwise rank by number of token matches and closeness
    const tokens = qnorm.split(/[_\s\-]+|\W+/).filter(t=>t.length>0);

    // Levenshtein distance for fine-grained closeness
    function levenshtein(a,b){
      if(a === b) return 0;
      const al = a.length, bl = b.length;
      if(al === 0) return bl;
      if(bl === 0) return al;
      const prev = new Array(bl+1); const cur = new Array(bl+1);
      for(let j=0;j<=bl;j++) prev[j] = j;
      for(let i=1;i<=al;i++){
        cur[0] = i;
        for(let j=1;j<=bl;j++){
          const cost = a[i-1] === b[j-1] ? 0 : 1;
          cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
        }
        for(let j=0;j<=bl;j++) prev[j] = cur[j];
      }
      return cur[bl];
    }

    const scored = [];
    for(const c of candidates){
      const kw = normalize(c.keyword);
      // exact keyword or exact otherKeywords
      const isExactKeyword = kw === qnorm;
      const exactOther = (c.other||[]).some(ok => normalize(ok) === qnorm);
      if(isExactKeyword || exactOther){
        // give exact keyword a big boost so they appear first
        const base = isExactKeyword ? 10000 : 9000;
        scored.push({ item: c, score: base });
        continue;
      }

      // otherwise compute token match counts and distances
      const kwWords = c.keyword.split(/[_\s\-]+/).map(w=>normalize(w)).filter(Boolean);
      const okWords = (c.other||[]).flatMap(ok => ok.split(/[_\s\-]+/)).map(w=>normalize(w)).filter(Boolean);
      const allWords = kwWords.concat(okWords);
      let tokenMatches = 0;
      let distSum = 0;
      for(const tkn of tokens){
        // find best matching word for this token
        let bestDist = Infinity; let matched = false;
        for(const w of allWords){
          if(w === tkn){ bestDist = 0; matched = true; break; }
          if(w.includes(tkn) || tkn.includes(w)){
            bestDist = 0; matched = true; break; // treat substring as exact-like
          }
          const d = levenshtein(w, tkn);
          if(d < bestDist) bestDist = d;
        }
        if(bestDist !== Infinity){
          // count as match if distance <=1 or substring/exact
          if(bestDist <= 1) { tokenMatches++; }
          distSum += bestDist;
        }
      }
      if(tokenMatches > 0){
        // score: prefer keyword-word matches slightly higher than other-word matches by using word position
        // combine tokenMatches and average distance into score
        const avgDist = distSum / tokens.length;
        const score = tokenMatches * 100 - Math.round(avgDist * 10);
        scored.push({ item: c, score });
      }
    }

    // sort scored descending by score, higher first
    scored.sort((a,b) => b.score - a.score);

    // prepare results (dedupe)
    const seen = new Set(); const results = [];
    for(const s of scored){
      const k = s.item.keyword; if(seen.has(k)) continue; seen.add(k);
      const img = await findImageForKeyword(s.item.keyword, s.item.class) || null;
      results.push({ keyword: s.item.keyword, class: s.item.class, img });
    }
    renderResults(results);
  }

  // wire UI
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('search-submit');
    if(btn) btn.addEventListener('click', (e)=>{ e.preventDefault(); performSearch(); });
    const input = document.getElementById('global-search-input');
    if(input) input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); performSearch(); } });
    
    // Load and populate category/state options from index
    loadFilterOptions();
  });

  // Load available categories and states from biterdata_index.json
  async function loadFilterOptions(){
    try{
      const r = await fetch('data/biterdata_index.json');
      if(!r.ok) return;
      const index = await r.json();
      
      const categories = new Set();
      const states = new Set();
      
      for(const kw of Object.keys(index)){
        const entry = index[kw];
        if(entry.Category) categories.add(entry.Category.trim());
        if(entry.state && Array.isArray(entry.state)){
          entry.state.forEach(s => {
            // Split by delimiters
            const parts = s.toString().split(/[,;]|\band\b|\bor\b/i);
            parts.forEach(p => {
              const trimmed = p.trim();
              if(trimmed) states.add(trimmed);
            });
          });
        }
      }
      
      // Populate category select dropdown
      const categorySelect = document.getElementById('search-category');
      if(categorySelect){
        // Clear existing options except "All"
        categorySelect.innerHTML = '<option value="" selected>All</option>';
        Array.from(categories).sort().forEach(cat => {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat;
          categorySelect.appendChild(option);
        });
      }
      
      // Populate state select dropdown
      const stateSelect = document.getElementById('search-state');
      if(stateSelect){
        // Clear existing options except "All"
        stateSelect.innerHTML = '<option value="" selected>All</option>';
        Array.from(states).sort().forEach(state => {
          const option = document.createElement('option');
          option.value = state;
          option.textContent = state;
          stateSelect.appendChild(option);
        });
      }
    }catch(e){
      console.warn('Could not load filter options:', e);
    }
  }

  window.performSearch = performSearch;
})();
