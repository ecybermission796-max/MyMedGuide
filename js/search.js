// search.js - client-side search using biterdata_index.json
(function(){
  'use strict';

  function normalize(s){ return (s||'').toString().trim().toLowerCase(); }

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
    // create a container similar to bugs view table
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
    // build table grid (4 columns)
    const table = document.createElement('table'); table.className='bugs-table'; const tbody = document.createElement('tbody');
    const rows = Math.ceil(items.length / 4) || 0;
    for(let r=0;r<rows;r++){
      const trImg = document.createElement('tr'); const trName = document.createElement('tr');
      for(let c=0;c<4;c++){
        const tdImg = document.createElement('td'); const tdName = document.createElement('td');
        const idx = r*4 + c; if(idx < items.length){
          const it = items[idx];
          const a = document.createElement('a'); a.href='#'; a.className='result-link';
          a.addEventListener('click',(ev)=>{ ev.preventDefault();
            const path = it.img || `images/${it.class.toLowerCase()}/${encodeURIComponent(it.keyword)}.png`;
            if(it.class.toLowerCase()==='bugs') window.showBugImage && window.showBugImage(path);
            else if(it.class.toLowerCase()==='animals') window.showAnimalImage && window.showAnimalImage(path);
            else if(it.class.toLowerCase()==='plants') window.showPlantImage && window.showPlantImage(path);
          });
          const img = document.createElement('img'); img.src = it.img || ''; img.alt = it.keyword; img.style.maxWidth='100%'; img.style.height='120px'; img.style.objectFit='cover';
          a.appendChild(img); tdImg.appendChild(a);
          const nameLink = document.createElement('a'); nameLink.href='#'; nameLink.textContent = it.keyword; nameLink.className='result-name';
          nameLink.addEventListener('click',(ev)=>{ ev.preventDefault(); const path = it.img || `images/${it.class.toLowerCase()}/${encodeURIComponent(it.keyword)}.png`; if(it.class.toLowerCase()==='bugs') window.showBugImage && window.showBugImage(path); else if(it.class.toLowerCase()==='animals') window.showAnimalImage && window.showAnimalImage(path); else if(it.class.toLowerCase()==='plants') window.showPlantImage && window.showPlantImage(path); });
          tdName.appendChild(nameLink);
        }
        trImg.appendChild(tdImg); trName.appendChild(tdName);
      }
      tbody.appendChild(trImg); tbody.appendChild(trName);
    }
    table.appendChild(tbody);
    v.innerHTML = `<header class="view-header"><h2>Search Results</h2></header>`; v.appendChild(table);
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

    // tokenise query and count matching otherKeywords
    const tokens = qnorm.split(/\W+/).filter(t=>t.length>0);
    const scored = [];
    for(const c of candidates){
      let count = 0;
      for(const ok of c.other){
        for(const tkn of tokens){ if(ok === tkn || ok.includes(tkn) || tkn.includes(ok)){ count++; break; } }
      }
      if(count>0) scored.push({ item: c, score: count });
    }
    scored.sort((a,b)=> b.score - a.score);
    // limit results to top 40 for performance
    const results = [];
    for(const s of scored.slice(0,40)){
      const img = await findImageForKeyword(s.item.keyword, s.item.class) || null;
      results.push({ keyword: s.item.keyword, class: s.item.class, img });
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
