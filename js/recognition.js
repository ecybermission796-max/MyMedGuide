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
        
        // Always hide status and show results
        if(recStatus) recStatus.style.display = 'none';
        
        if(matches.length === 0){
          showToast('No local matches found');
          renderLocalResults([], aiText);
        } else {
          showToast('Found ' + matches.length + ' local match(es)!');
          // Pass AI text to show alongside local results
          renderLocalResults(matches, aiText);
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
    
    // Parse AI response to extract top three hits and remaining text
    let topThreeHits = [];
    let remainingText = '';
    
    if(aiText){
      // Extract top three hits section
      const topHitsMatch = aiText.match(/Top three hits?:(.+?)(?=\n\n|$)/is);
      if(topHitsMatch){
        const hitsText = topHitsMatch[1];
        // Extract numbered items
        const itemMatches = hitsText.matchAll(/(\d+)[\.\)]\s*([^\n]+)/g);
        for(const match of itemMatches){
          topThreeHits.push(`${match[1]}. ${match[2].trim()}`);
        }
        // Get remaining text after top three hits
        const endOfTopHits = topHitsMatch.index + topHitsMatch[0].length;
        remainingText = aiText.substring(endOfTopHits).trim();
      } else {
        // If no "Top three hits" found, try to extract numbered list anyway
        const lines = aiText.split('\n');
        for(const line of lines){
          const match = line.match(/^(\d+)[\.\)]\s*(.+)/);
          if(match && parseInt(match[1]) <= 3){
            topThreeHits.push(`${match[1]}. ${match[2].trim()}`);
          }
        }
        remainingText = aiText;
      }
    }
    
    // Extract image URLs from remaining text (markdown or HTML format)
    const imageUrls = [];
    if(remainingText){
      // Match markdown images: ![alt](url)
      const mdMatches = remainingText.matchAll(/!\[([^\]]*)\]\(([^\)]+)\)/g);
      for(const match of mdMatches){
        imageUrls.push(match[2]);
      }
      // Match HTML images: <img src="url">
      const htmlMatches = remainingText.matchAll(/<img[^>]+src=["']([^"']+)["']/g);
      for(const match of htmlMatches){
        imageUrls.push(match[1]);
      }
    }
    
    // Build HTML output
    let html = '<header class="view-header"><h2>Recognition Results</h2></header>';
    
    // Always show top three hits from AI if available
    if(topThreeHits.length > 0){
      html += '<div style="max-width: 800px; margin: 20px auto; padding: 20px; background: #e3f2fd; border-radius: 8px;">';
      html += '<h3 style="margin-top: 0;">Top three hits from AI:</h3>';
      html += '<ol style="margin: 10px 0; padding-left: 20px;">';
      topThreeHits.forEach(hit => {
        html += `<li>${hit.replace(/^\d+\.\s*/, '')}</li>`;
      });
      html += '</ol>';
      html += '</div>';
    }
    
    // If local matches found
    if(items && items.length > 0){
      html += '<div style="max-width: 800px; margin: 20px auto;">';
      html += '<h3>Local search found:</h3>';
      html += '</div>';
      
      // Build grid for local matches
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
        
        const params = new URLSearchParams({ action: 'detail', cls: it.class, kw: it.key, img: it.img || '' });
        const url = window.location.pathname + '#' + params.toString();
        
        const a = document.createElement('a'); 
        a.href = url; 
        a.className = 'result-link';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
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
      
      v.innerHTML = html;
      v.appendChild(container);
      
      // Also show additional AI information below local results
      if(remainingText || imageUrls.length > 0){
        const aiInfoDiv = document.createElement('div');
        aiInfoDiv.style.cssText = 'max-width: 800px; margin: 20px auto; padding: 20px; background: #f0f7ff; border-radius: 8px;';
        
        let aiInfoHtml = '<h3 style="margin-top: 0;">Here are more information from AI:</h3>';
        
        if(remainingText){
          let formattedText = remainingText
            .trim()
            .replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.+<\/li>)/gs, '<ul style="margin: 10px 0; padding-left: 20px;">$1</ul>')
            .split('\n\n')
            .map(para => {
              para = para.trim();
              if(!para) return '';
              if(para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')){
                return para;
              }
              para = para.replace(/\n/g, '<br>');
              return `<p style="margin: 10px 0; line-height: 1.6;">${para}</p>`;
            })
            .join('');
          
          aiInfoHtml += `<div style="margin-top: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">${formattedText}</div>`;
        }
        
        if(imageUrls.length > 0){
          aiInfoHtml += '<div style="margin-top: 20px;">';
          imageUrls.forEach(url => {
            aiInfoHtml += `<img src="${url}" alt="AI result" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;">`;
          });
          aiInfoHtml += '</div>';
        }
        
        aiInfoDiv.innerHTML = aiInfoHtml;
        v.appendChild(aiInfoDiv);
      }
      
    } else {
      // No local matches found - show remaining AI text and images
      html += '<div style="max-width: 800px; margin: 20px auto; padding: 20px; background: #fff3cd; border-radius: 8px;">';
      html += '<h3 style="margin-top: 0;">Local search not found. Here are more information from AI:</h3>';
      
      if(remainingText){
        // Convert markdown/text to HTML with proper paragraph formatting
        let formattedText = remainingText
          .trim()
          // Convert headings: ## Heading -> <h4>Heading</h4>
          .replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')
          // Convert bold: **text** -> <strong>text</strong>
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          // Convert italic: *text* -> <em>text</em>
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          // Convert bullet points: - item -> <li>item</li>
          .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
          // Wrap consecutive <li> in <ul>
          .replace(/(<li>.+<\/li>)/gs, '<ul style="margin: 10px 0; padding-left: 20px;">$1</ul>')
          // Convert double line breaks to paragraphs
          .split('\n\n')
          .map(para => {
            para = para.trim();
            if(!para) return '';
            // Don't wrap if already has HTML tags
            if(para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')){
              return para;
            }
            // Replace single line breaks with <br> within paragraphs
            para = para.replace(/\n/g, '<br>');
            return `<p style="margin: 10px 0; line-height: 1.6;">${para}</p>`;
          })
          .join('');
        
        html += `<div style="margin-top: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">${formattedText}</div>`;
      }
      
      // Display images from AI response
      if(imageUrls.length > 0){
        html += '<div style="margin-top: 20px;">';
        imageUrls.forEach(url => {
          html += `<img src="${url}" alt="AI result" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;">`;
        });
        html += '</div>';
      }
      
      html += '</div>';
      v.innerHTML = html;
    }
    
    // Make the results section visible and scroll to it
    v.style.display = 'block';
    v.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

});