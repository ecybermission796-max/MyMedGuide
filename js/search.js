// search.js - client-side search using biterdata_index.json
(function(){
  'use strict';

  function normalize(s){ return (s||'').toString().trim().toLowerCase(); }

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
      base = base.replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
      try{ base = base.normalize('NFD').replace(/\p{Diacritic}/gu,''); }catch(e){ base = base.replace(/[\u0300-\u036f]/g,''); }
      return base.toLowerCase();
    }
    for(const mp of manifestPaths){
      try{
        const r = await fetch(mp, {cache:'no-store'});
        if(r && r.ok){
          const files = await r.json();
          if(!Array.isArray(files)) continue;
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
      const a = document.createElement('a'); a.href = '#'; a.className = 'result-link';
      a.addEventListener('click', (ev)=>{ ev.preventDefault();
        // open a duplicate page and request the detail view via hash params
        const params = new URLSearchParams({ action: 'detail', cls: it.class, kw: it.keyword, img: it.img || '' });
        const url = window.location.pathname + '#' + params.toString();
        window.open(url, '_blank');
      });
      const img = document.createElement('img'); img.src = it.img || ''; img.alt = it.keyword; img.style.maxWidth = '100%'; img.style.height = '140px'; img.style.objectFit = 'cover'; img.style.display = 'block'; img.style.margin = '0 auto';
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
    const qnorm = normalize(q);
    if(!qnorm){ const t=document.getElementById('toast'); if(t){ t.textContent='Enter a search term'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2000);} return; }

    let index = {};
    try{ const r = await fetch('data/biterdata_index.json'); if(!r.ok) throw new Error('HTTP '+r.status); index = await r.json(); }catch(e){ console.warn('Could not load biterdata_index.json:', e.message); const t=document.getElementById('toast'); if(t){ t.textContent='Search index not available'; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),3000);} return; }

    // assemble candidate list filtered by scope
    const candidates = [];
    for(const kw of Object.keys(index)){
      const entry = index[kw];
      if(scope !== 'All' && normalize(entry.class) !== normalize(scope)) continue;
      candidates.push({ keyword: kw, class: entry.class, other: (entry.OtherKeywords||[]).map(x=>normalize(x)) });
    }

    // If exact match to keyword, return only that item
    const exact = candidates.find(c=> normalize(c.keyword) === qnorm);
    if(exact){
      // find image asynchronously
      const img = await findImageForKeyword(exact.keyword, exact.class) || null;
      renderResults([{ keyword: exact.keyword, class: exact.class, img }]);
      return;
    }

    // Tokenise query and perform fuzzy matching against keyword words
    const tokens = qnorm.split(/[_\s\-]+|\W+/).filter(t=>t.length>0);
    const matches = [];
    for(const c of candidates){
      const kwWords = c.keyword.split(/[_\s\-]+/).map(w=>normalize(w)).filter(w=>w.length>0);
      let matched = false;
      for(const tkn of tokens){
        for(const w of kwWords){
          if(w === tkn){ matched = true; break; }
          if(w.includes(tkn) || tkn.includes(w)){ matched = true; break; }
          if(withinOneEdit(w, tkn)){ matched = true; break; }
        }
        if(matched) break;
      }
      if(matched) matches.push(c);
    }

    // de-dupe and fetch images
    const seen = new Set(); const results = [];
    for(const m of matches){
      if(seen.has(m.keyword)) continue; seen.add(m.keyword);
      const img = await findImageForKeyword(m.keyword, m.class) || null;
      results.push({ keyword: m.keyword, class: m.class, img });
    }
    renderResults(results);
  }

  // wire UI
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('search-submit');
    if(btn) btn.addEventListener('click', performSearch);
    const input = document.getElementById('global-search-input');
    if(input) input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); performSearch(); } });
  });

  window.performSearch = performSearch;
})();
