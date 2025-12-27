// Tutorial system: First-time user onboarding with slideshow
document.addEventListener('DOMContentLoaded', () => {
  const TUTORIAL_KEY = 'tutorialCompleted';
  const SLIDE_COUNT = 14;
  
  // Check if tutorial has been completed
  function isTutorialCompleted() {
    return localStorage.getItem(TUTORIAL_KEY) === 'true';
  }
  
  // Mark tutorial as completed
  function markTutorialCompleted() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
  }
  
  // Show the first-time tutorial prompt
  function showFirstTimePrompt() {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-prompt-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      padding: 20px;
    `;
    
    // Doctor image
    const doctorImg = document.createElement('img');
    doctorImg.src = 'images/Tutorial/Doctor_firsttime.png';
    doctorImg.alt = 'Tutorial Prompt';
    doctorImg.style.cssText = 'max-width: 400px; width: 90%; display: block;';
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 20px; justify-content: center;';
    
    // Yes button
    const yesBtn = document.createElement('img');
    yesBtn.src = 'images/Tutorial/Yes.png';
    yesBtn.alt = 'Yes - Start Tutorial';
    yesBtn.style.cssText = 'cursor: pointer; max-width: 120px; transition: transform 0.2s;';
    yesBtn.onmouseover = () => yesBtn.style.transform = 'scale(1.1)';
    yesBtn.onmouseout = () => yesBtn.style.transform = 'scale(1)';
    yesBtn.onclick = () => {
      document.body.removeChild(overlay);
      startSlideshow();
    };
    
    // No button
    const noBtn = document.createElement('img');
    noBtn.src = 'images/Tutorial/No.png';
    noBtn.alt = 'No - Skip Tutorial';
    noBtn.style.cssText = 'cursor: pointer; max-width: 120px; transition: transform 0.2s;';
    noBtn.onmouseover = () => noBtn.style.transform = 'scale(1.1)';
    noBtn.onmouseout = () => noBtn.style.transform = 'scale(1)';
    noBtn.onclick = () => {
      document.body.removeChild(overlay);
      markTutorialCompleted();
      showDoctorSecondButton();
    };
    
    buttonContainer.appendChild(yesBtn);
    buttonContainer.appendChild(noBtn);
    overlay.appendChild(doctorImg);
    overlay.appendChild(buttonContainer);
    document.body.appendChild(overlay);
  }
  
  // Show Doctor_second.png button after tutorial completion
  function showDoctorSecondButton() {
    // Check if button already exists
    if (document.getElementById('doctor-second-btn')) return;
    
    // Create button container between nav and search box
    const btnContainer = document.createElement('div');
    btnContainer.id = 'doctor-second-btn';
    btnContainer.style.cssText = `
      position: fixed;
      top: 95px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      cursor: pointer;
      transition: transform 0.2s;
    `;
    
    const doctorImg = document.createElement('img');
    doctorImg.src = 'images/Tutorial/Doctor_second.png';
    doctorImg.alt = 'Tutorial';
    doctorImg.style.cssText = 'max-width: 150px; display: block;';
    
    btnContainer.onmouseover = () => btnContainer.style.transform = 'translateX(-50%) scale(1.1)';
    btnContainer.onmouseout = () => btnContainer.style.transform = 'translateX(-50%) scale(1)';
    btnContainer.onclick = () => startSlideshow();
    
    btnContainer.appendChild(doctorImg);
    document.body.appendChild(btnContainer);
  }
  
  // Start the slideshow
  function startSlideshow() {
    let currentSlide = 1;
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'tutorial-slideshow';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    `;
    
    // Create image container with fade transition
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      position: relative;
    `;
    
    const slideImg = document.createElement('img');
    slideImg.src = `images/Tutorial/Slide${currentSlide}.JPG`;
    slideImg.alt = `Tutorial Slide ${currentSlide}`;
    slideImg.style.cssText = `
      max-width: 100%;
      max-height: 90vh;
      display: block;
      opacity: 1;
      transition: opacity 0.5s ease-in-out;
    `;
    
    // Progress indicator
    const progress = document.createElement('div');
    progress.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      color: white;
      font-size: 18px;
      font-weight: bold;
      background: rgba(0, 0, 0, 0.6);
      padding: 10px 15px;
      border-radius: 5px;
    `;
    progress.textContent = `${currentSlide}/${SLIDE_COUNT}`;
    
    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      color: white;
      font-size: 40px;
      font-weight: bold;
      cursor: pointer;
      background: rgba(0, 0, 0, 0.6);
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.3s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 0, 0, 0.8)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(0, 0, 0, 0.6)';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeSlideshow();
    };
    
    imgContainer.appendChild(slideImg);
    modal.appendChild(closeBtn);
    modal.appendChild(progress);
    modal.appendChild(imgContainer);
    document.body.appendChild(modal);
    
    // Handle click to advance
    modal.onclick = (e) => {
      if (e.target === closeBtn || closeBtn.contains(e.target)) return;
      
      if (currentSlide >= SLIDE_COUNT) {
        closeSlideshow();
      } else {
        // Fade out
        slideImg.style.opacity = '0';
        
        // After fade out, change image and fade in
        setTimeout(() => {
          currentSlide++;
          slideImg.src = `images/Tutorial/Slide${currentSlide}.JPG`;
          slideImg.alt = `Tutorial Slide ${currentSlide}`;
          progress.textContent = `${currentSlide}/${SLIDE_COUNT}`;
          
          // Fade in
          setTimeout(() => {
            slideImg.style.opacity = '1';
          }, 50);
        }, 500);
      }
    };
    
    function closeSlideshow() {
      document.body.removeChild(modal);
      markTutorialCompleted();
      showDoctorSecondButton();
    }
  }
  
  // Initialize tutorial on page load
  if (!isTutorialCompleted()) {
    // Show first-time prompt after a brief delay to let page load
    setTimeout(showFirstTimePrompt, 500);
  } else {
    // Show Doctor_second button for returning users
    showDoctorSecondButton();
  }
  
  // Expose function globally for manual trigger
  window.startTutorial = startSlideshow;
});
