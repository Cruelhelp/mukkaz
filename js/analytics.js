/**
 * Vercel Analytics Integration - Vanilla JS
 */
(function() {
  // Load Vercel Analytics
  const script = document.createElement('script');
  script.src = 'https://va.vercel-scripts.com/v1/script.js';
  script.defer = true;
  script.setAttribute('data-website-id', 'auto'); // Auto-detect from Vercel deployment
  document.head.appendChild(script);
})();
