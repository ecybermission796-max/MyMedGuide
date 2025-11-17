// loads categories and items from data JSON files and creates detail view
window.loadCategories = async function(){
  const cbox = document.getElementById('categories');
  const itemsBox = document.getElementById('items');
  const detail = document.getElementById('detail');
  cbox.innerHTML = ''; itemsBox.classList.add('hidden'); detail.classList.add('hidden');

  const resp = await fetch('data/categories.json');
  const cats = await resp.json();

  cats.forEach(cat => {
    const d = document.createElement('div'); d.className = 'card'; d.innerHTML = `
      <img src="${cat.image}" alt="${cat.title}">
      <div class="meta"><strong>${cat.title}</strong><div>${cat.desc}</div></div>
    `;
    d.addEventListener('click', ()=> loadItems(cat.id));
    cbox.appendChild(d);
  });

  async function loadItems(catId){
    const listResp = await fetch(`data/${catId}.json`);
    const list = await listResp.json();
    document.getElementById('categories').classList.add('hidden');
    itemsBox.classList.remove('hidden');
    itemsBox.innerHTML = '';
    list.forEach(item => {
      const c = document.createElement('div'); c.className='card';
      c.innerHTML = `<img src="${item.thumb}" alt="${item.name}"><div class="meta"><strong>${item.name}</strong></div>`;
      c.addEventListener('click', ()=> showDetail(item));
      itemsBox.appendChild(c);
    });
  }

  function showDetail(item){
    document.getElementById('items').classList.add('hidden');
    const d = detail;
    d.classList.remove('hidden');
    d.innerHTML = `
      <h3>${item.name}</h3>
      <img src="${item.image}" alt="${item.name}" style="max-width:100%;border-radius:8px">
      <p>${item.description || ''}</p>
      <h4>Symptoms / Effects</h4><p>${item.symptoms || 'N/A'}</p>
      <h4>First Aid</h4><p>${item.first_aid || 'Seek medical care if severe'}</p>
    `;
  }
};

// (removed extra click handler; app routing handles navigation and triggers loadBugsImages via showView)

// load all images for bugs view from a manifest and render a 4-column table
window.loadBugsImages = async function(){
  const grid = document.getElementById('bugs-grid');
  if(!grid) return;
  // prevent concurrent runs which previously caused multiple tables to be appended
  if(grid.dataset.loading === '1'){
    console.debug('loadBugsImages: already loading, skipping concurrent call');
    return;
  }
  grid.dataset.loading = '1';
  grid.innerHTML = '<p class="placeholder">Loading images...</p>'; // show loading placeholder

  // try to fetch a manifest that lists files in images/bugs
  let files = [];
  let lastError = null;
  const manifestCandidates = [
    'images/bugs/manifest.json',
    './images/bugs/manifest.json',
    '/images/bugs/manifest.json'
  ];
  let manifestLoaded = false;
  for(const mp of manifestCandidates){
    try{
      const resp = await fetch(mp);
      if(resp && resp.ok){
        try{
          files = await resp.json();
          manifestLoaded = true;
          break;
        }catch(parseErr){
          lastError = `JSON parse error for ${mp}: ${parseErr.message}`;
        }
      } else {
        lastError = `HTTP ${resp ? resp.status : 'no response'} ${resp ? resp.statusText : ''} for ${mp}`;
      }
    }catch(e){
      lastError = `Fetch error for ${mp}: ${e.message}`;
    }
  }

  // fallback: if manifest couldn't be fetched, use a built-in list so the page still works
  if(!manifestLoaded || !files || !files.length){
    console.warn('could not load manifest or manifest empty', lastError);
    // Only include top-level images directly under images/bugs/ (no subfolders)
    const fallbackFiles = [
      'images/bugs/bed_bug.png',
      'images/bugs/black_widow.png',
      'images/bugs/bumble_bee.jpg',
      'images/bugs/Chigger_Trombiculidae.png',
      'images/bugs/mosquito.png',
      'images/bugs/wheel bug.png'
    ];
    files = fallbackFiles;
  }

  // Filter out any files that are not directly in images/bugs/ (no subfolders)
  const topLevelPattern = /^images\/bugs\/[^\/]+\.(jpg|jpeg|png)$/i;
  files = files.filter(p => topLevelPattern.test(p));

  // Remove duplicates while preserving order
  files = files.filter((v, i, a) => a.indexOf(v) === i);
  console.debug('loadBugsImages - final files list:', files);

  // helper: process filename string according to rules
  function processName(path){
    // extract base name
    const base = path.split('/').pop();
    // remove extension
    const name = base.replace(/\.(jpg|jpeg|png)$/i, '');
    // replace underscores with spaces
    let s = name.replace(/_/g, ' ');
    // trim
    s = s.trim();
    // wrap to max 30 chars per line, prefer wrapping at spaces
    if(s.length <= 30) return s;
    const lines = [];
    let remaining = s;
    while(remaining.length){
      if(remaining.length <= 30){ lines.push(remaining); break; }
      // find last space before 30
      const segment = remaining.slice(0,30);
      const lastSpace = segment.lastIndexOf(' ');
      if(lastSpace > 0){
        lines.push(remaining.slice(0,lastSpace));
        remaining = remaining.slice(lastSpace+1);
      } else {
        // no space - hard wrap and add hyphen
        lines.push(remaining.slice(0,29) + '-');
        remaining = remaining.slice(29);
      }
    }
    return lines.join('\n');
  }

  // build table: groups of up to 4 images, each group -> two rows (images row, filenames row)
  const table = document.createElement('table');
  table.className = 'bugs-table';
  const tbody = document.createElement('tbody');

  const rows = Math.ceil(files.length / 4) || 0;
  for(let r=0; r<rows; r++){
    const trImg = document.createElement('tr');
    const trName = document.createElement('tr');
    for(let c=0; c<4; c++){
      const tdImg = document.createElement('td');
      const tdName = document.createElement('td');
      const idx = r * 4 + c;
      if(idx < files.length){
        const p = files[idx];
        // encode URI for src
        const src = encodeURI(p);
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'bug-thumb-link';
        a.dataset.src = src;
        // on click show a dedicated view
        a.addEventListener('click', (ev)=>{
          ev.preventDefault();
          window.showBugImage && window.showBugImage(p);
        });
        const img = document.createElement('img');
        img.src = src;
        img.alt = p.split('/').pop();
        img.style.maxWidth = '100%';
        img.style.height = '120px';
        img.style.objectFit = 'cover';
        a.appendChild(img);
        tdImg.appendChild(a);

        // filename processing for display
        const processed = processName(p);
        // create text with line breaks
        const lines = processed.split('\n');
        lines.forEach((ln, idx)=>{
          const span = document.createElement('div');
          span.textContent = ln;
          tdName.appendChild(span);
        });
      }
      trImg.appendChild(tdImg);
      trName.appendChild(tdName);
    }
    tbody.appendChild(trImg);
    tbody.appendChild(trName);
  }

  table.appendChild(tbody);
  grid.innerHTML = '';
  grid.appendChild(table);
  // finished
  delete grid.dataset.loading;
};

// show a single bug image in a dedicated view
window.showBugImage = function(path){
  // create or select a view element with id 'bug-image'
  let v = document.getElementById('bug-image');
  if(!v){
    v = document.createElement('section');
    v.id = 'bug-image';
    v.className = 'view';
    v.setAttribute('role','region');
    v.setAttribute('aria-label','Bug image');
    // insert after bugs section
    const bugsSection = document.getElementById('bugs');
    bugsSection.parentNode.insertBefore(v, bugsSection.nextSibling);
  }

  // helper: load and cache Biterdata.json
  async function loadBiterData(){
    if(window._biterDataCache) return window._biterDataCache;
    try{
      const resp = await fetch('data/Biterdata.json');
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const j = await resp.json();
      window._biterDataCache = j;
      return j;
    }catch(e){
      console.warn('Could not load Biterdata.json:', e.message);
      window._biterDataCache = {};
      return window._biterDataCache;
    }
  }

  // normalize filename -> keyword key
  function filenameToKey(fname){
    let base = fname.split('/').pop();
    base = base.replace(/\.(jpg|jpeg|png)$/i,'');
    // replace underscores, hyphens with spaces, trim and collapse spaces
    base = base.replace(/[_\-]+/g, ' ').replace(/\s+/g,' ').trim();
    // normalize diacritics and lower-case
    try{
      base = base.normalize('NFD').replace(/\p{Diacritic}/gu,'');
    }catch(e){
      // if Unicode property escapes not supported, fallback to simple replacement
      base = base.replace(/[\u0300-\u036f]/g,'');
    }
    return base.toLowerCase();
  }

  // populate view with image and (async) data
  (async ()=>{
    const src = encodeURI(path);
    const fileBase = path.split('/').pop();
    const keyCandidate = filenameToKey(fileBase);

    // build header + image
    let html = `<header class="view-header"><h2>${keyCandidate}</h2></header>`;
    html += `<div style="padding:16px;text-align:center"><img src="${src}" alt="${keyCandidate}" style="max-width:90%;height:auto;border-radius:8px;border:2px solid #ddd"></div>`;

    // load data and render matching sections
    const data = await loadBiterData();
    // find matching key in data keys using normalized comparison
    const keys = Object.keys(data || {});
    // build a map of normalizedKey -> originalKey for faster lookup
    const normMap = {};
    keys.forEach(k => {
      const nk = (k || '').toString().trim();
      let norm = nk.replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
      try{ norm = norm.normalize('NFD').replace(/\p{Diacritic}/gu,''); }catch(e){ norm = norm.replace(/[\u0300-\u036f]/g,''); }
      norm = norm.toLowerCase();
      normMap[norm] = k;
    });
    let matchKey = null;
    // candidate variants to try (ordered):
    const baseRaw = fileBase.replace(/\.(jpg|jpeg|png)$/i,'');
    const baseRawLower = baseRaw.trim().toLowerCase();
    const candidates = [];
    // 1) exact filename lower (preserve underscores)
    candidates.push(baseRawLower);
    // 2) filename -> replace underscores/hyphens with spaces (normal form)
    candidates.push(baseRawLower.replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim());
    // 3) normalized keyCandidate we already computed
    candidates.push(keyCandidate);
    // 4) collapsed (remove spaces)
    candidates.push(baseRawLower.replace(/\s+/g,''));
    // 5) relaxed (strip non-word)
    candidates.push(baseRawLower.replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim());
    // 6) try variants derived from keyCandidate
    candidates.push(keyCandidate.replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim());

    // dedupe candidates while preserving order
    const seen = new Set();
    const uniqCandidates = candidates.filter(c => {
      if(!c) return false; if(seen.has(c)) return false; seen.add(c); return true;
    });

    // try to find a matching normalized key
    for(const cand of uniqCandidates){
      if(normMap[cand]){ matchKey = normMap[cand]; console.debug('showBugImage: matched candidate', cand, '->', matchKey); break; }
    }
    if(!matchKey){
      console.debug('showBugImage: no match. keyCandidate=', keyCandidate, 'fileBase=', baseRaw);
      console.debug('showBugImage: tried candidates=', uniqCandidates);
      console.debug('showBugImage: available normalized keys=', Object.keys(normMap));
    }
    if(matchKey){
      const info = data[matchKey];
      if(info && Array.isArray(info.sections)){
        for(const section of info.sections){
          html += `<div class="bug-section"><h3>${section.name}</h3>`;
          for(const item of (section.items || [])){
            // create safe paragraph preserving newlines
            const title = item.title || '';
            const desc = (item.description || '').toString();
            html += `<h4>${title}</h4>`;
            // convert description newlines to <br>
            const parts = desc.split(/\r?\n/).map(p=>p.trim()).filter(p=>p.length>0);
            if(parts.length){
              html += '<p style="text-align:center">' + parts.map(p => escapeHtml(p)).join('<br><br>') + '</p>';
            }
          }
          html += `</div>`;
        }
      }
    } else {
      html += `<div style="padding:16px"><p>No descriptive data found for this item.</p></div>`;
    }

    v.innerHTML = html;
    // activate the view using the app's showView if available so navigation behaves consistently
    if(window.showView) window.showView('bug-image');
    else {
      const views = document.querySelectorAll('.view');
      views.forEach(el => el.id === 'bug-image' ? el.classList.add('active') : el.classList.remove('active'));
    }
  })();
};

// simple HTML escape helper
function escapeHtml(str){
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}