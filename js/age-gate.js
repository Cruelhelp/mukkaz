// Age Gate Verification System

function initAgeGate() {
  // Check if already verified
  if (localStorage.getItem('ageVerified') === 'true') {
    return;
  }

  // Create age gate overlay
  const ageGateHTML = `
    <div id="ageGateOverlay" style="
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.96);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    ">
      <div id="ageGateModal" style="
        max-width: 520px;
        width: 92%;
        background: #0e0e0e;
        border-radius: 18px;
        padding: 42px 34px;
        text-align: center;
        border: 2px solid #e10600;
        box-shadow: 0 0 45px rgba(225, 6, 0, 0.3);
      ">
        <img src="logo.png" alt="Mukkaz" style="width: 96px; margin-bottom: 22px;" onerror="this.style.display='none'">

        <h1 style="color: #ffffff; font-size: 28px; margin-bottom: 18px;">
          This is an adult website
        </h1>

        <p style="color: #bdbdbd; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
          This website contains age-restricted material intended for adults only.
          By entering, you confirm that you are at least <strong>18 years old</strong>
          and legally permitted to view adult content in your jurisdiction.
        </p>

        <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
          <button id="ageGateEnter" style="
            padding: 14px 22px;
            font-size: 15px;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.2s ease;
            min-width: 200px;
            background: #e10600;
            color: #ffffff;
          ">I am 18 or older</button>

          <button id="ageGateExit" style="
            padding: 14px 22px;
            font-size: 15px;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid #555;
            transition: all 0.2s ease;
            min-width: 200px;
            background: transparent;
            color: #cccccc;
          ">I am under 18</button>
        </div>

        <div style="margin-top: 28px; font-size: 13px; color: #888;">
          By entering this site, you agree to our terms and privacy policy.
        </div>
      </div>
    </div>
  `;

  // Add to body
  document.body.insertAdjacentHTML('beforeend', ageGateHTML);

  // Add event listeners
  document.getElementById('ageGateEnter').addEventListener('click', () => {
    localStorage.setItem('ageVerified', 'true');
    document.getElementById('ageGateOverlay').remove();
  });

  document.getElementById('ageGateExit').addEventListener('click', () => {
    window.location.href = 'https://www.google.com';
  });

  // Hover effects
  const enterBtn = document.getElementById('ageGateEnter');
  const exitBtn = document.getElementById('ageGateExit');

  enterBtn.addEventListener('mouseenter', () => {
    enterBtn.style.background = '#ff1a1a';
  });
  enterBtn.addEventListener('mouseleave', () => {
    enterBtn.style.background = '#e10600';
  });

  exitBtn.addEventListener('mouseenter', () => {
    exitBtn.style.borderColor = '#888';
    exitBtn.style.color = '#ffffff';
  });
  exitBtn.addEventListener('mouseleave', () => {
    exitBtn.style.borderColor = '#555';
    exitBtn.style.color = '#cccccc';
  });
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAgeGate);
} else {
  initAgeGate();
}
