// Recognition: Submit image to Google AI (via backend) for identification
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('file-input');
  const preview = document.getElementById('preview');
  const submitBtn = document.getElementById('rec-submit');
  const recStatus = document.getElementById('rec-status');

  // Use centralized backend URL from config.js
  const BACKEND_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'https://mymedguide.onrender.com';

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

  // Submit button - send image to backend for Gemini AI identification
  if(submitBtn){
    submitBtn.addEventListener('click', async () => {
      if(!window._uploadedFile){ 
        showToast('Please upload an image first'); 
        return; 
      }
      
      const file = window._uploadedFile;
      showStatus('Analyzing image with Google AI...');
      showToast('Sending to AI...');
      
      try{
        // Convert image to base64
        const base64Data = await fileToBase64(file);
        const base64Image = base64Data.split(',')[1];
        
        // Determine mime type
        let mimeType = file.type;
        if(!mimeType || !mimeType.startsWith('image/')){
          const ext = file.name.split('.').pop().toLowerCase();
          if(ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
          else if(ext === 'png') mimeType = 'image/png';
          else if(ext === 'gif') mimeType = 'image/gif';
          else if(ext === 'webp') mimeType = 'image/webp';
          else mimeType = 'image/jpeg';
        }
        
        console.log('Sending to backend - mime type:', mimeType);
        
        // Call backend API endpoint
        const response = await fetch(`${BACKEND_URL}/api/recognize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Image,
            mimeType: mimeType
          })
        });

        if(!response.ok){
          const errorData = await response.json().catch(() => ({}));
          console.error('Backend error:', errorData);
          throw new Error(errorData.error || `Backend error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Backend response:', result);
        
        if(!result.ok){
          throw new Error(result.error || 'Recognition failed');
        }

        const aiText = result.aiResponse || '';
        const matches = result.matches || [];
        
        if(!aiText){
          showStatus('No AI response received');
          showToast('No response from AI');
          return;
        }
        
        console.log('AI identified:', aiText);
        
        if(matches.length === 0){
          // No matches - display AI text with half screen width
          if(recStatus) recStatus.style.display = 'none';
          showToast('No local matches found');
          renderLocalResults([], aiText);
        } else {
          // Found matches - hide status and show results
          if(recStatus) recStatus.style.display = 'none';
          showToast('Found ' + matches.length + ' local match(es)!');
          renderLocalResults(matches, '');
        }
        
        // Store results
        localStorage.setItem('recognitionResults', JSON.stringify({ 
          matches, 
          aiResponse: aiText,
          fallback: [], 
          candidates: result.candidates || [] 
        }));
        
      }catch(e){
        console.error('Recognition error:', e);
        showStatus('Error: ' + e.message);
        showToast('AI recognition failed. Make sure the backend server is running (npm start).', 5000);
      }
    });
  }

  // Render results for local recognition into a grid matching search.js format
  function renderLocalResults(items, aiText=''){
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
    
    // If no matches, show AI text with half screen width
    if(!items || items.length === 0){
      if(aiText){
        v.innerHTML = `
          <header class="view-header"><h2>AI Analysis</h2></header>
          <div style="max-width: 50%; margin: 20px auto; padding: 20px; background: #f5f5f5; border-radius: 8px; line-height: 1.6;">
            ${aiText.replace(/\n/g, '<br>')}
          </div>
          <div class="placeholder" style="margin-top: 20px;">No matching entries found in local database.</div>
        `;
      } else {
        v.innerHTML = `<header class="view-header"><h2>Recognition Results</h2></header><div class="placeholder">No local matches found.</div>`;
      }
      // Make the results section visible
      v.style.display = 'block';
      v.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    
    // Build grid like search.js (centered flex layout)
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
      
      // Build URL matching search.js format for modal popup
      const params = new URLSearchParams({ action: 'detail', cls: it.class, kw: it.key, img: it.img || '' });
      const url = window.location.pathname + '#' + params.toString();
      
      const a = document.createElement('a'); 
      a.href = url; 
      a.className = 'result-link';
      
      // Handle click to trigger modal popup
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const cls = it.class.toLowerCase();
        const imgPath = it.img || '';
        
        // Call the appropriate show function based on class
        if(cls === 'bugs' && window.showBugImage) {
          window.showBugImage(imgPath);
        } else if(cls === 'animals' && window.showAnimalImage) {
          window.showAnimalImage(imgPath);
        } else if(cls === 'plants' && window.showPlantImage) {
          window.showPlantImage(imgPath);
        }
      });
      
      const img = document.createElement('img'); 
      img.src = it.img ? encodeURI(it.img) : ''; 
      img.alt = it.key || it.keyword; 
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
      name.textContent = it.key || it.keyword;
      
      card.appendChild(a); 
      card.appendChild(name); 
      container.appendChild(card);
    });
    
    v.innerHTML = `<header class="view-header"><h2>Recognition Results - Local Matches</h2></header>`; 
    v.appendChild(container);
    
    // Make the results section visible and scroll to it
    v.style.display = 'block';
    v.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

});