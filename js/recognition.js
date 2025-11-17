// client-side image upload preview and placeholder for future search
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('file-input');
  const preview = document.getElementById('preview');
  const searchBtn = document.getElementById('search-similar');
  const submitBtn = document.getElementById('rec-submit');

  input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="uploaded preview">`;
    // Save the file in memory for potential upload
    window._uploadedFile = file;
  });

  searchBtn.addEventListener('click', () => {
    if(!window._uploadedFile){
      showToast('Please upload an image first');
      return;
    }
    showToast('Placeholder: image ready for recognition integration');
    // Future: send file to recognition endpoint (e.g., fetch('/api/recognize', {method:'POST', body: formData}))
  });

  if(submitBtn){
    submitBtn.addEventListener('click', () => {
      if(!window._uploadedFile){
        showToast('Please upload an image first');
        return;
      }
      // Placeholder - in future this will POST to the AI recognition endpoint
      showToast('Submit placeholder — would send image to recognition service');
    });
  }

  function showToast(msg){
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'),2000);
  }
});