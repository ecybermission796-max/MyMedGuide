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
});