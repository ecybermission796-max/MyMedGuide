// Recognition: open Google reverse-image search and allow local index lookup
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('file-input');
  const preview = document.getElementById('preview');
  const searchBtn = document.getElementById('search-similar');
  const submitBtn = document.getElementById('rec-submit');
  const recHelper = document.getElementById('rec-helper');
  const recKeywords = document.getElementById('rec-keywords');
  const recLocalSearch = document.getElementById('rec-local-search');

  function showToast(msg, timeout=2500){
    const t = document.getElementById('toast'); if(!t) return; t.textContent = msg; t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'), timeout);
  }

  // helper: convert File -> base64 data URL
  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = (e) => reject(e);
      fr.readAsDataURL(file);
    });
  }

  input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="uploaded preview">`;
    // Save the file in memory for potential upload
    window._uploadedFile = file;
    // prefill keywords from filename (remove extension and split)
    try{
      const name = (file.name || '').replace(/\.[^.]+$/, '').replace(/[._\-]+/g,' ');
      if(recKeywords) recKeywords.value = name;
    }catch(e){}
  });

  // click -> send the uploaded image to local /api/recognize endpoint (background search)
  if(searchBtn){
    searchBtn.addEventListener('click', async () => {
      if(!window._uploadedFile){ showToast('Please upload an image first'); return; }
      
      // Check if backend is configured
      if(window.API_CONFIG && !window.API_CONFIG.IS_CONFIGURED){
        showToast('Image recognition backend not configured yet. Please contact the site administrator.', 4000);
        return;
      }
      
      showToast('Searching image in background...');
      try{
        const file = window._uploadedFile;
        const b64 = await fileToBase64(file);
        // strip prefix like data:image/png;base64,
        const parts = b64.split(','); const payload = parts.length>1 ? parts[1] : parts[0];
        const apiUrl = (window.API_CONFIG && window.API_CONFIG.BASE_URL) ? window.API_CONFIG.BASE_URL + '/api/recognize' : '/api/recognize';
        const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: payload }) });
        if(!r.ok){ const txt = await r.text(); console.error('recognize failed', r.status, txt); showToast('Recognition failed'); return; }
        const j = await r.json();
        if(j.error){ showToast('Recognition error: '+j.error); return; }
        // populate helper keywords with top candidates
        if(recKeywords && j.candidates && j.candidates.length) recKeywords.value = j.candidates.slice(0,3).join(', ');
        if(recHelper) recHelper.classList.remove('hidden');
        // store results in localStorage and open a new tab to display them
        const results = (j.matches && j.matches.length > 0) ? j.matches : [];
        const fallback = (j.fallbackPages || []).slice(0,5);
        localStorage.setItem('recognitionResults', JSON.stringify({ matches: results, fallback, candidates: j.candidates || [] }));
        // open new tab with results page
        window.open(window.location.pathname + '#recognition-results', '_blank');
      }catch(e){ console.error(e); showToast('Recognition error'); }
    });
  }

  // Submit button (same as 'Search similar')
  if(submitBtn){
    submitBtn.addEventListener('click', (e) => { if(searchBtn) searchBtn.click(); });
  }

  // Local search using pasted/edited keywords - search biterdata_index.json and render up to 3 matches
  if(recLocalSearch){
    recLocalSearch.addEventListener('click', async () => {
      const raw = (recKeywords && recKeywords.value) ? recKeywords.value.trim() : '';
      if(!raw){ showToast('Enter some keywords first'); return; }
      showToast('Searching local index...');
      try{
        const res = await fetch('data/biterdata_index.json', {cache: 'no-store'});
        if(!res.ok) throw new Error('Index load failed');
        const index = await res.json();
        const tokens = raw.toLowerCase().split(/[,;\s]+/).map(s=>s.trim()).filter(Boolean);
        // score entries by number of matched tokens (keyword, Scientific_name, and Other_name)
        const scored = [];
        for(const key of Object.keys(index)){
          const entry = index[key];
          const name = (key||'').toLowerCase();
          const sciName = (entry.Scientific_name||'').toLowerCase();
          const otherName = (entry.Other_name||'').toLowerCase();
          let matchCount = 0;
          for(const t of tokens){
            if(name.includes(t)) matchCount += 3; // stronger weight for name match
            else if(sciName.includes(t)) matchCount += 2;
            else if(otherName.includes(t)) matchCount += 2;
          }
          if(matchCount>0) scored.push({ key, class: entry.class, score: matchCount });
        }
        scored.sort((a,b)=>b.score - a.score);
        const top = scored.slice(0,3);
        if(top.length === 0){
          showToast('No local matches found');
          renderLocalResults([]);
          return;
        }
        // for each top result, try to find an image in class manifest
        const items = [];
        for(const it of top){
          let imgPath = await findImageForKeyword(it.key, it.class);
          console.debug('Recognition search - keyword:', it.key, 'class:', it.class, 'found in manifest:', imgPath);
          // If not found in manifest, construct default path and test it
          if(!imgPath){
            const normalized = it.key.replace(/[(),']/g, '').replace(/[ \-]+/g, '_').toLowerCase();
            const possiblePaths = [
              `images/${it.class.toLowerCase()}/${normalized}.png`,
              `images/${it.class.toLowerCase()}/${normalized}.jpg`
            ];
            // Test which one exists
            for(const testPath of possiblePaths){
              try{
                const testResp = await fetch(testPath, {method: 'HEAD', cache: 'no-store'});
                if(testResp && testResp.ok){
                  imgPath = testPath;
                  console.debug('Recognition search - found fallback image:', imgPath);
                  break;
                }
              }catch(e){/*ignore*/}
            }
            // Default to .png if neither works (will show error in browser)
            if(!imgPath) imgPath = possiblePaths[0];
          }
          items.push({ keyword: it.key, class: it.class, img: imgPath });
        }
        renderLocalResults(items);
        // Also store in localStorage so results can be opened in new tab
        localStorage.setItem('recognitionResults', JSON.stringify({ matches: items, fallback: [], candidates: [] }));
      }catch(e){ console.error(e); showToast('Local search failed'); }
    });
  }

  // find an image for keyword by checking images/<class>/manifest.json (copied approach from search.js)
  async function findImageForKeyword(keyword, cls){
    const manifestPaths = [
      `images/${cls.toLowerCase()}/manifest.json`,
      `./images/${cls.toLowerCase()}/manifest.json`,
      `/images/${cls.toLowerCase()}/manifest.json`
    ];
    function filenameToKey(fname){
      let base = fname.split('/').pop();
      base = base.replace(/\.(jpg|jpeg|png)$/i,'');
      // Standardized normalization: 1) Remove parentheses, commas, and apostrophes, 2) Replace spaces/hyphens with underscores, 3) Lowercase
      base = base.replace(/[(),']/g, '');
      base = base.replace(/[ \-]+/g, '_');
      return base.toLowerCase();
    }
    // Normalize the keyword for matching
    const normalizedKeyword = keyword.replace(/[(),']/g, '').replace(/[ \-]+/g, '_').toLowerCase();
    
    for(const mp of manifestPaths){
      try{
        const r = await fetch(mp, {cache:'no-store'});
        if(r && r.ok){
          let files = await r.json();
          if(!Array.isArray(files)){
            if(typeof files === 'string') files = [files];
            else if(files && typeof files === 'object'){
              if(Array.isArray(files.files)) files = files.files;
              else if(Array.isArray(files.paths)) files = files.paths;
              else {
                try{ files = Object.values(files).flat().filter(v=>typeof v === 'string'); }catch(e){ files = []; }
              }
            } else files = [];
          }
          for(const f of files){ if(filenameToKey(f) === normalizedKeyword) return f; }
        }
      }catch(e){ /* ignore manifest load errors */ }
    }
    return null;
  }

  // Render results for local recognition into a simple grid beneath the recognition view
  function renderLocalResults(items){
    const viewId = 'rec-search-results';
    let v = document.getElementById(viewId);
    if(!v){ v = document.createElement('section'); v.id = viewId; v.className = 'view'; v.setAttribute('role','region'); v.setAttribute('aria-label','Recognition Results');
      const parent = document.getElementById('recognition'); parent.appendChild(v);
    }
    if(!items || items.length === 0){
      v.innerHTML = `<header class="view-header"><h2>Recognition Results</h2></header><div class="placeholder">No results found.</div>`;
      return;
    }
    const container = document.createElement('div'); container.className = 'search-grid'; container.style.display='flex'; container.style.flexWrap='wrap'; container.style.gap='12px'; container.style.justifyContent='center';
    items.forEach(it => {
      const card = document.createElement('div'); card.className='search-card'; card.style.width='220px'; card.style.textAlign='center';
      const params = new URLSearchParams({ action: 'detail', cls: it.class, kw: it.keyword, img: it.img || '' });
      const url = window.location.pathname + '#' + params.toString();
      const a = document.createElement('a'); a.href = url; a.target='_blank'; a.rel='noopener noreferrer';
      const img = document.createElement('img'); img.src = it.img ? encodeURI(it.img) : ''; img.alt = it.keyword; img.style.maxWidth='100%'; img.style.height='140px'; img.style.objectFit='cover'; img.style.display='block'; img.style.margin='0 auto';
      img.onerror = () => { if(it.img && img.src !== it.img) img.src = it.img; };
      a.appendChild(img);
      const name = document.createElement('div'); name.className='result-name'; name.style.marginTop='6px'; name.textContent = it.keyword;
      card.appendChild(a); card.appendChild(name); container.appendChild(card);
    });
    v.innerHTML = `<header class="view-header"><h2>Recognition Results</h2></header>`; v.appendChild(container);
  }

});