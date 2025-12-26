// Recognition: Submit image to Google AI for identification
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('file-input');
  const preview = document.getElementById('preview');
  const submitBtn = document.getElementById('rec-submit');
  const recStatus = document.getElementById('rec-status');

  // Google AI API key
  const GOOGLE_AI_API_KEY = 'AIzaSyBPzetzEYwObWy2tEDLFbSv9YEEYNFhNRI';

  function showToast(msg, timeout=2500){
    const t = document.getElementById('toast'); 
    if(!t) return; 
    t.textContent = msg; 
    t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'), timeout);
  }

  function showStatus(msg){
    if(recStatus){
      recStatus.textContent = msg;
      recStatus.style.display = 'block';
    }
  }

  // Convert File to base64 data URL
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
    window._uploadedFile = file;
    if(recStatus) recStatus.style.display = 'none';
  });

  // Submit button - send image to Google AI for identification
  if(submitBtn){
    submitBtn.addEventListener('click', async () => {
      if(!window._uploadedFile){ 
        showToast('Please upload an image first'); 
        return; 
      }
      
      const file = window._uploadedFile;
      showStatus('Analyzing image with Google AI...');
      showToast('Sending to Google AI...');
      
      try{
        // Convert image to base64
        const base64Data = await fileToBase64(file);
        const base64Image = base64Data.split(',')[1];
        
        // Determine mime type
        let mimeType = file.type;
        if(!mimeType || !mimeType.startsWith('image/')){
          // Fallback based on file extension
          const ext = file.name.split('.').pop().toLowerCase();
          if(ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
          else if(ext === 'png') mimeType = 'image/png';
          else if(ext === 'gif') mimeType = 'image/gif';
          else if(ext === 'webp') mimeType = 'image/webp';
          else mimeType = 'image/jpeg'; // default
        }
        
        console.log('Sending to Gemini - mime type:', mimeType, 'file size:', base64Image.length);
        
        // Call Google AI Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: "What is shown in this picture? Return common name or scientific names. If similar to multiple animals/plants, return the top three possibilities."
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                }
              ]
            }]
          })
        });

        if(!response.ok){
          const errorText = await response.text();
          console.error('Google AI error response:', errorText);
          throw new Error(`Google AI API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Google AI response:', result);
        
        // Extract text from response
        let aiText = '';
        if(result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts){
          aiText = result.candidates[0].content.parts.map(p => p.text || '').join(' ');
        }
        
        if(!aiText){
          showStatus('Google AI returned no response. Raw response: ' + JSON.stringify(result));
          showToast('No response from AI');
          return;
        }
        
        showStatus('AI Response: ' + aiText);
        console.log('AI identified:', aiText);
        
        // Search local index for matches
        showToast('Searching local database...');
        await searchLocalIndex(aiText);
        
      }catch(e){
        console.error('Google AI error:', e);
        showStatus('Error: ' + e.message);
        showToast('AI recognition failed. Check console for details.', 4000);
      }
    });
  }

  // Search local index using AI-identified names
  async function searchLocalIndex(aiText){
    try{
      const res = await fetch('data/biterdata_index.json', {cache: 'no-store'});
      if(!res.ok) throw new Error('Index load failed');
      const index = await res.json();
      
      // Extract potential names from AI text
      const tokens = aiText.toLowerCase()
        .replace(/[,;.\n\r()]/g, ' ')
        .split(/\s+/)
        .map(s=>s.trim())
        .filter(s => s.length > 2);
      
      console.log('Searching for tokens:', tokens);
      
      // Score entries by matched tokens
      const scored = [];
      for(const key of Object.keys(index)){
        const entry = index[key];
        const name = (key||'').toLowerCase();
        const sciName = (entry.Scientific_name||'').toLowerCase();
        const otherName = (entry.Other_name||'').toLowerCase();
        
        let matchCount = 0;
        
        // Check each token
        for(const t of tokens){
          if(name.includes(t)){
            matchCount += 3;
          } else if(sciName.includes(t)){
            matchCount += 2;
          } else if(otherName.includes(t)){
            matchCount += 2;
          }
        }
        
        // Check if full phrases match
        if(name && aiText.toLowerCase().includes(name)){
          matchCount += 10;
        }
        if(sciName && aiText.toLowerCase().includes(sciName)){
          matchCount += 10;
        }
        if(otherName && aiText.toLowerCase().includes(otherName)){
          matchCount += 10;
        }
        
        if(matchCount > 0){
          scored.push({ key, class: entry.class, score: matchCount });
        }
      }
      
      scored.sort((a,b) => b.score - a.score);
      const top = scored.slice(0, 3);
      
      console.log('Local matches:', top);
      
      if(top.length === 0){
        // No matches - display AI text
        showStatus('AI Response: ' + aiText + '\n\nNo matches found in local database.');
        showToast('No local matches. See AI response above.');
        renderLocalResults([]);
        return;
      }
      
      // Found matches - get images and display
      showStatus('Found ' + top.length + ' local match(es)! AI Response: ' + aiText);
      showToast('Found local matches!');
      
      const items = [];
      for(const it of top){
        let imgPath = await findImageForKeyword(it.key, it.class);
        if(!imgPath){
          const normalized = it.key.replace(/[(),']/g, '').replace(/[ \-]+/g, '_').toLowerCase();
          imgPath = `images/${it.class.toLowerCase()}/${normalized}.png`;
        }
        items.push({ keyword: it.key, class: it.class, img: imgPath, score: it.score });
      }
      
      renderLocalResults(items);
      
      localStorage.setItem('recognitionResults', JSON.stringify({ 
        matches: items, 
        aiResponse: aiText,
        fallback: [], 
        candidates: [] 
      }));
      
    }catch(e){
      console.error('Local search error:', e);
      showStatus('Error searching local database: ' + e.message);
    }
  }

  // find an image for keyword by checking images/<class>/manifest.json
  async function findImageForKeyword(keyword, cls){
    const manifestPaths = [
      `images/${cls.toLowerCase()}/manifest.json`,
      `./images/${cls.toLowerCase()}/manifest.json`,
      `/images/${cls.toLowerCase()}/manifest.json`
    ];
    
    // Normalize the keyword for matching
    const normalizedKeyword = keyword.replace(/[(),']/g, '').replace(/[ \-]+/g, '_').toLowerCase();
    
    for(const mp of manifestPaths){
      try{
        const r = await fetch(mp, {cache:'no-store'});
        if(r && r.ok){
          let manifest = await r.json();
          // New manifest structure: {keyword: {images: [...], thumbnails: [...]}}
          if(manifest && manifest[normalizedKeyword]){
            const imgs = manifest[normalizedKeyword].images || [];
            if(imgs.length > 0) return imgs[0]; // Return first image
          }
          // Also check logos
          if(manifest && manifest.logos && Array.isArray(manifest.logos)){
            for(const logo of manifest.logos){
              if(logo.toLowerCase().includes(normalizedKeyword)){
                return logo;
              }
            }
          }
        }
      }catch(e){ /* ignore manifest load errors */ }
    }
    return null;
  }

  // Render results for local recognition into a simple grid
  function renderLocalResults(items){
    const viewId = 'rec-search-results';
    let v = document.getElementById(viewId);
    if(!v){ 
      v = document.createElement('section'); 
      v.id = viewId; 
      v.className = 'view'; 
      v.setAttribute('role','region'); 
      v.setAttribute('aria-label','Recognition Results');
      const parent = document.getElementById('recognition'); 
      if(parent) parent.appendChild(v);
    }
    if(!items || items.length === 0){
      v.innerHTML = `<header class="view-header"><h2>Recognition Results</h2></header><div class="placeholder">No local matches found.</div>`;
      return;
    }
    const container = document.createElement('div'); 
    container.className = 'search-grid'; 
    container.style.display='flex'; 
    container.style.flexWrap='wrap'; 
    container.style.gap='12px'; 
    container.style.justifyContent='center';
    
    items.forEach(it => {
      const card = document.createElement('div'); 
      card.className='search-card'; 
      card.style.width='220px'; 
      card.style.textAlign='center';
      
      const params = new URLSearchParams({ action: 'detail', cls: it.class, kw: it.keyword, img: it.img || '' });
      const url = window.location.pathname + '#' + params.toString();
      
      const a = document.createElement('a'); 
      a.href = url; 
      a.target='_blank'; 
      a.rel='noopener noreferrer';
      
      const img = document.createElement('img'); 
      img.src = it.img ? encodeURI(it.img) : ''; 
      img.alt = it.keyword; 
      img.style.maxWidth='100%'; 
      img.style.height='140px'; 
      img.style.objectFit='cover'; 
      img.style.display='block'; 
      img.style.margin='0 auto';
      img.onerror = () => { if(it.img && img.src !== it.img) img.src = it.img; };
      
      a.appendChild(img);
      const name = document.createElement('div'); 
      name.className='result-name'; 
      name.style.marginTop='6px'; 
      name.textContent = it.keyword;
      
      card.appendChild(a); 
      card.appendChild(name); 
      container.appendChild(card);
    });
    
    v.innerHTML = `<header class="view-header"><h2>Local Matches Found</h2></header>`; 
    v.appendChild(container);
  }

});