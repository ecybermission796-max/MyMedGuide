// Simple client-side routing and UI glue
document.addEventListener('DOMContentLoaded', () => {
  const toast = id => {
    const t = document.getElementById('toast');
    t.textContent = id; t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'),2500);
  };

  function showView(name){
    // Query views at call time so dynamically-created views (like #bug-image)
    // are included and properly toggled when navigating.
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.id === name ? v.classList.add('active') : v.classList.remove('active'));
    // if browse show categories by default
    if(name==='browse'){ window.loadCategories && window.loadCategories() }
    if(name==='providers'){ window.initProviders && window.initProviders() }
    if(name==='bugs'){
      window.loadBugsImages && window.loadBugsImages();
      // attempt to run or refresh the bugs manifest when entering the bugs view
      if(window.generateBugsManifest){
        window.generateBugsManifest();
      } else if(window.maybeGenerateBugsManifest){
        window.maybeGenerateBugsManifest();
      }
    }
    if(name==='animals'){
      // attempt to run or refresh the animals manifest when entering the animals view
      if(window.generateAnimalsManifest){
        window.generateAnimalsManifest();
      } else if(window.maybeGenerateAnimalsManifest){
        window.maybeGenerateAnimalsManifest();
      }
    }
    if(name==='plants'){
      // attempt to run or refresh the plants manifest when entering the plants view
      if(window.generatePlantsManifest){
        window.generatePlantsManifest();
      } else if(window.maybeGeneratePlantsManifest){
        window.maybeGeneratePlantsManifest();
      }
    }
    // ensure the top navigation (buttons) remains visible across view switches
    const topNav = document.getElementById('main-nav') || document.querySelector('nav.buttons, .buttons');
    if(topNav){
      topNav.removeAttribute('hidden');
      topNav.setAttribute('aria-hidden','false');
      // ensure it's shown even if some code added inline styles
      topNav.style.display = 'flex';
      topNav.style.visibility = 'visible';
    }
  }

  // expose showView globally so other scripts can call it
  window.showView = showView;

  document.body.addEventListener('click', (e) => {
    const route = e.target.closest('[data-route]');
    if(route){
      e.preventDefault();
      const r = route.getAttribute('data-route');
      if(r==='home'){ showView('home') } else { showView(r) }
    }
  });

  // initial view
  showView('home');

  // If page opened with hash params (e.g. from search results opened in new window),
  // support showing a detail view via: #action=detail&cls=Bugs&kw=bed%20bug&img=/images/bugs/filename.jpg
  // Also support #recognition-results to show AI recognition results
  try{
    const h = window.location.hash ? window.location.hash.slice(1) : '';
    if(h){
      const params = new URLSearchParams(h);
      if(params.get('action') === 'detail'){
        const cls = params.get('cls') || '';
        const kw = params.get('kw') || '';
        const img = params.get('img') || '';
        const clsLower = cls.toLowerCase();
        // compute a sensible path if none provided
        let path = img && img.length ? decodeURIComponent(img) : `images/${clsLower}/${kw.replace(/\s+/g,'_')}.png`;
        if(clsLower === 'bugs' && window.showBugImage) window.showBugImage(path);
        else if(clsLower === 'animals' && window.showAnimalImage) window.showAnimalImage(path);
        else if(clsLower === 'plants' && window.showPlantImage) window.showPlantImage(path);
      } else if(h === 'recognition-results'){
        // show recognition results from localStorage
        showView('recognition-results');
        const stored = localStorage.getItem('recognitionResults');
        if(stored){
          try{
            const data = JSON.parse(stored);
            const container = document.getElementById('rec-results-container');
            if(!container) return;
            const matches = data.matches || [];
            const fallback = data.fallback || [];
            if(matches.length === 0 && fallback.length === 0){
              container.innerHTML = `<div class="placeholder">No similar picture was found.</div>`;
              return;
            }
            // render matches grid
            let html = '';
            if(matches.length > 0){
              html += `<div style="text-align:center; margin-bottom:20px;"><h3>Local Matches (${matches.length})</h3></div>`;
              html += `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:12px;">`;
              matches.forEach(m => {
                const params = new URLSearchParams({ action: 'detail', cls: m.class, kw: m.keyword, img: m.img || '' });
                const url = window.location.pathname + '#' + params.toString();
                const img = m.img ? `<img src="${encodeURI(m.img)}" alt="${m.keyword}" style="max-width:100%; height:140px; object-fit:cover; display:block; margin:0 auto;" onerror="this.parentElement.innerHTML='<div style=&quot;width:140px; height:140px; background:#eee; display:flex; align-items:center; justify-content:center;&quot;>No Image</div>';" />` : '<div style="width:140px; height:140px; background:#eee; display:flex; align-items:center; justify-content:center;">No Image</div>';
                html += `<div style="width:220px; text-align:center;"><a href="${url}" target="_blank" rel="noopener noreferrer">${img}</a><div style="margin-top:6px; font-weight:bold;">${m.keyword}</div></div>`;
              });
              html += `</div>`;
            }
            if(fallback.length > 0){
              html += `<div style="text-align:center; margin-top:30px; margin-bottom:20px;"><h3>Related Links from Google</h3></div>`;
              html += `<ul style="margin-left:20px; line-height:1.8;">`;
              fallback.forEach(url => {
                html += `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></li>`;
              });
              html += `</ul>`;
            }
            container.innerHTML = html;
          }catch(e){ console.warn('Error parsing recognition results:', e); container.innerHTML = `<div class="placeholder">Error displaying results.</div>`; }
        } else {
          container.innerHTML = `<div class="placeholder">No results stored.</div>`;
        }
      }
    }
  }catch(e){ console.warn('Error processing hash params:', e); }
});