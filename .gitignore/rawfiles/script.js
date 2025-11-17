// place near top of browse.js
let _bugsDataCache = null;
async function loadBugsData(){
  if(_bugsDataCache) return _bugsDataCache;
  try {
    const resp = await fetch('data/bugs.json');
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    _bugsDataCache = await resp.json();
    return _bugsDataCache;
  } catch(e){
    console.warn('Could not load bugs data:', e.message);
    return {};
  }
}

// update showBugImage to use the data
window.showBugImage = async function(path){
  const keyCandidate = path.split('/').pop().replace(/\.(jpg|jpeg|png)$/i,'').replace(/_/g,' ').trim().toLowerCase();
  const data = await loadBugsData();
  // find matching key (case-insensitive)
  const keys = Object.keys(data);
  const matchKey = keys.find(k => k.toLowerCase() === keyCandidate) || null;
  // create or update view as before
  let v = document.getElementById('bug-image');
  if(!v){
    v = document.createElement('section');
    v.id = 'bug-image';
    v.className = 'view';
    v.setAttribute('role','region');
    v.setAttribute('aria-label','Bug image');
    const bugsSection = document.getElementById('bugs');
    bugsSection.parentNode.insertBefore(v, bugsSection.nextSibling);
  }
  const src = encodeURI(path);
  const titleFromFilename = path.split('/').pop().replace(/\.(jpg|jpeg|png)$/i,'').replace(/_/g,' ');
  // build HTML
  let html = `<header class="view-header"><h2>${matchKey ? matchKey : titleFromFilename}</h2></header>`;
  html += `<div style="padding:16px;text-align:center"><img src="${src}" alt="${titleFromFilename}" style="max-width:90%;height:auto;border-radius:8px;border:2px solid #ddd"></div>`;
  if(matchKey){
    const info = data[matchKey];
    for(const section of info.sections || []) {
      html += `<div class="bug-section"><h3>${section.name}</h3>`;
      for(const item of section.items || []){
        html += `<h4>${item.title}</h4><p>${item.description.replace(/\\n/g,'<br>')}</p>`;
      }
      html += `</div>`;
    }
  } else {
    html += `<div style="padding:16px"><p>No descriptive data found for this item.</p></div>`;
  }
  v.innerHTML = html;
  // ensure view toggling (app.showView will be called if needed, but here we directly activate)
  const views = document.querySelectorAll('.view');
  views.forEach(el => el.id === 'bug-image' ? el.classList.add('active') : el.classList.remove('active'));
};