// GrowthBook Feature Flags
// Initialize GrowthBook SDK for feature management and A/B testing

let growthbook = null;

async function initGrowthBook() {
  try {
    // Load GrowthBook SDK from CDN
    if (typeof GrowthBook === 'undefined') {
      await loadGrowthBookSDK();
    }

    const user = await getCurrentUser();

    // Initialize GrowthBook
    growthbook = new GrowthBook({
      apiHost: 'https://cdn.growthbook.io',
      clientKey: 'sdk-k7HFeZNMH4ZXRzZz',
      enableDevMode: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
      subscribeToChanges: true,
      trackingCallback: (experiment, result) => {
        // Track experiment views (integrate with Vercel Analytics if needed)
        console.log('Experiment viewed:', {
          experimentId: experiment.key,
          variationId: result.variationId
        });
      },
      attributes: {
        id: user?.id || 'anonymous',
        email: user?.email || null,
        username: user?.username || null,
        isLoggedIn: !!user,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    });

    // Load features from GrowthBook API
    await growthbook.loadFeatures({ timeout: 1000 });

    console.log('GrowthBook initialized with features:', growthbook.getFeatures());
  } catch (error) {
    console.error('Failed to initialize GrowthBook:', error);
  }
}

function loadGrowthBookSDK() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@growthbook/growthbook@1.1.0/dist/bundles/index.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Helper Functions

/**
 * Check if a feature is enabled
 * @param {string} featureKey - Feature flag key
 * @param {*} fallback - Default value if feature not found
 * @returns {*} Feature value
 */
function isFeatureEnabled(featureKey, fallback = false) {
  if (!growthbook) {
    console.warn('GrowthBook not initialized');
    return fallback;
  }
  return growthbook.isOn(featureKey) || fallback;
}

/**
 * Get feature value (for complex features with values)
 * @param {string} featureKey - Feature flag key
 * @param {*} fallback - Default value
 * @returns {*} Feature value
 */
function getFeatureValue(featureKey, fallback = null) {
  if (!growthbook) {
    console.warn('GrowthBook not initialized');
    return fallback;
  }
  return growthbook.getFeatureValue(featureKey, fallback);
}

/**
 * Run an A/B test experiment
 * @param {string} experimentKey - Experiment key
 * @returns {number} Variation index (0, 1, 2, etc.)
 */
function getExperimentVariation(experimentKey) {
  if (!growthbook) {
    console.warn('GrowthBook not initialized');
    return 0;
  }
  const result = growthbook.run({
    key: experimentKey,
    variations: [0, 1] // Default to 2 variations
  });
  return result.variationId || 0;
}

/**
 * Update user attributes (call when user logs in/out)
 * @param {Object} attributes - User attributes
 */
function updateGrowthBookAttributes(attributes) {
  if (!growthbook) {
    console.warn('GrowthBook not initialized');
    return;
  }
  growthbook.setAttributes({
    ...growthbook.getAttributes(),
    ...attributes
  });
}

// Example Feature Flags (create these in GrowthBook dashboard):
// - new_video_editor: boolean - Enable new video editor
// - video_hover_preview: boolean - Enable video hover preview
// - ads_enabled: boolean - Enable/disable ads
// - max_upload_size: number - Max upload size in MB
// - trending_algorithm: string - "views" | "engagement" | "recent"
// - notification_style: string - "toast" | "dropdown" | "both"

// Example Usage:
/*
// Simple on/off feature
if (isFeatureEnabled('new_video_editor')) {
  showNewVideoEditor();
} else {
  showOldVideoEditor();
}

// Feature with value
const maxUploadSize = getFeatureValue('max_upload_size', 100);
if (file.size > maxUploadSize * 1024 * 1024) {
  alert('File too large');
}

// A/B test
const variation = getExperimentVariation('homepage_layout_test');
if (variation === 0) {
  showGridLayout();
} else {
  showListLayout();
}
*/

// Auto-initialize on load
if (typeof getCurrentUser !== 'undefined') {
  // Wait for app to be ready
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => initGrowthBook(), 1000);
  });
}
