// API Configuration
// This file manages the API base URL for different environments

// Detect if running in production (deployed) or development (local)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Set API base URL based on environment
// Use IIFE to avoid variable conflicts with other scripts
(function() {
  let API_BASE_URL;
  
  if (isLocal) {
    // Local development: Use localhost
    API_BASE_URL = window.API_BASE_URL || "http://localhost:5000";
  } else {
    // Production (deployed): Use deployed backend
    // ============================================
    // IMPORTANT: Replace with your actual deployed backend domain
    // ============================================
    // For AWS Lightsail or other deployment:
    // - Replace 'https://your-backend-domain.com' with your actual backend URL
    // - Or use IP address: 'http://your-ip-address:5000'
    // ============================================
    API_BASE_URL = window.API_BASE_URL || "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
  }
  
  // Make API_BASE_URL available globally immediately
  window.API_BASE_URL = API_BASE_URL;
  
  // Log for debugging
  console.log('[Config] ========================================');
  console.log('[Config] API Configuration Loaded');
  console.log('[Config] Hostname:', window.location.hostname);
  console.log('[Config] Is Local:', isLocal);
  console.log('[Config] API_BASE_URL:', API_BASE_URL);
  console.log('[Config] window.API_BASE_URL:', window.API_BASE_URL);
  console.log('[Config] ========================================');
})();
