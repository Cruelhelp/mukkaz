// Mukkaz Configuration
// This file loads environment variables for the application
//
// SECURITY NOTE: For production deployment, these values should be injected
// at build time using a bundler (Webpack, Vite, etc.) that loads from .env
//
// For development, manually create a config.local.js file with your actual values
// and it will override these defaults

const defaultConfig = {
  // Supabase Configuration
  supabase: {
    url: '',
    publishableKey: ''
  },

  // Application Configuration
  app: {
    name: 'Mukkaz',
    env: 'development',
    url: window.location.origin
  },

  // Feature Flags
  features: {
    enableDebugLogging: false,
    enableAnalytics: false
  },

  // Security Settings
  security: {
    sessionTimeout: 3600000, // 1 hour in milliseconds
    maxUploadSize: 104857600, // 100MB in bytes
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false
  },

  // Rate Limiting
  rateLimiting: {
    maxLoginAttempts: 5,
    loginCooldownSeconds: 300
  },

  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://vjs.zencdn.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://vjs.zencdn.net", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    mediaSrc: ["'self'", "blob:", "https:"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    connectSrc: ["'self'", "https://*.supabase.co"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"]
  }
};

// Try to load local configuration (not committed to git)
let localConfig = {};
try {
  if (typeof window.CONFIG_LOCAL !== 'undefined') {
    localConfig = window.CONFIG_LOCAL;
  }
} catch (e) {
  console.warn('Local config not found, using defaults');
}

// Merge configurations (local overrides defaults)
const config = {
  supabase: {
    ...defaultConfig.supabase,
    ...localConfig.supabase
  },
  app: {
    ...defaultConfig.app,
    ...localConfig.app
  },
  features: {
    ...defaultConfig.features,
    ...localConfig.features
  },
  security: {
    ...defaultConfig.security,
    ...localConfig.security
  },
  rateLimiting: {
    ...defaultConfig.rateLimiting,
    ...localConfig.rateLimiting
  },
  csp: defaultConfig.csp
};

// Validation
if (!config.supabase.url || !config.supabase.publishableKey) {
  console.error('⚠️ CONFIGURATION ERROR: Supabase credentials not set!');
  console.error('Please create config.local.js with your Supabase credentials.');
  console.error('See config.js for the required format.');
}

// Export configuration
window.APP_CONFIG = Object.freeze(config);

// Helper function to get config values
function getConfig(path) {
  const keys = path.split('.');
  let value = config;
  for (const key of keys) {
    value = value?.[key];
  }
  return value;
}

// Helper to check if debug logging is enabled
function isDebugEnabled() {
  return config.features.enableDebugLogging;
}

// Secure console.log wrapper
function debugLog(...args) {
  if (isDebugEnabled()) {
    console.log('[DEBUG]', ...args);
  }
}

// Export helpers
window.getConfig = getConfig;
window.isDebugEnabled = isDebugEnabled;
window.debugLog = debugLog;
