/**
 * Time Synchronization Module
 * Synchronizes client time with server time
 */

const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";

// Helper function to make API requests with ngrok headers
// Use existing apiFetch if available, otherwise create one
async function apiFetch(url, options = {}) {
  // Use existing apiFetch from the page if available
  if (window.apiFetch) {
    return window.apiFetch(url, options);
  }
  
  const headers = {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  return response;
}

// Time synchronization state
let timeSyncState = {
  offset: 0, // Client time offset from server time (in milliseconds)
  lastSync: null, // Last sync timestamp
  syncing: false // Whether sync is in progress
};

/**
 * Synchronize client time with server time
 * @returns {Promise<number>} Time offset in milliseconds
 */
async function syncTime() {
  if (timeSyncState.syncing) {
    return timeSyncState.offset;
  }
  
  timeSyncState.syncing = true;
  
  try {
    const clientTimeBefore = Date.now();
    const response = await apiFetch(`${API_BASE_URL}/api/time`);
    
    if (!response.ok) {
      throw new Error("Failed to get server time");
    }
    
    const clientTimeAfter = Date.now();
    const roundTripTime = clientTimeAfter - clientTimeBefore;
    const estimatedServerTime = clientTimeBefore + (roundTripTime / 2);
    
    const result = await response.json();
    const serverTimestamp = result.timestamp * 1000; // Convert to milliseconds
    
    // Calculate offset: server_time - client_time
    timeSyncState.offset = serverTimestamp - estimatedServerTime;
    timeSyncState.lastSync = Date.now();
    
    console.log("Time synchronized:", {
      offset: timeSyncState.offset,
      roundTripTime: roundTripTime,
      serverTime: new Date(serverTimestamp).toISOString(),
      clientTime: new Date(estimatedServerTime).toISOString()
    });
    
    return timeSyncState.offset;
  } catch (error) {
    console.error("Time sync error:", error);
    // Return last known offset if available
    return timeSyncState.offset;
  } finally {
    timeSyncState.syncing = false;
  }
}

/**
 * Get synchronized time (server time)
 * @returns {Date} Synchronized date object
 */
function getSyncedTime() {
  const clientTime = Date.now();
  const syncedTime = clientTime + timeSyncState.offset;
  return new Date(syncedTime);
}

/**
 * Get synchronized timestamp
 * @returns {number} Synchronized timestamp in milliseconds
 */
function getSyncedTimestamp() {
  return Date.now() + timeSyncState.offset;
}

/**
 * Format date using synchronized time
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
function formatSyncedDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  let dateObj;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string' || typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = getSyncedTime();
  }
  
  return dateObj.toLocaleString('en-US', finalOptions);
}

/**
 * Get time since a given date (relative time)
 * @param {Date|string|number} date - Date to compare
 * @returns {string} Relative time string (e.g., "2 minutes ago")
 */
function getTimeAgo(date) {
  const now = getSyncedTime();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return diffSeconds <= 1 ? "just now" : `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  } else {
    return formatSyncedDate(then);
  }
}

/**
 * Initialize time synchronization
 * @param {number} syncInterval - Sync interval in milliseconds (default: 5 minutes)
 */
async function initTimeSync(syncInterval = 5 * 60 * 1000) {
  try {
    // Initial sync (non-blocking)
    syncTime().catch(error => {
      console.error("Initial time sync failed:", error);
      // Continue even if initial sync fails
    });
    
    // Periodic sync
    setInterval(async () => {
      try {
        await syncTime();
      } catch (error) {
        console.error("Periodic time sync failed:", error);
        // Continue even if periodic sync fails
      }
    }, syncInterval);
    
    console.log("Time synchronization initialized");
  } catch (error) {
    console.error("Time sync initialization error:", error);
    // Don't throw, allow page to continue loading
  }
}

/**
 * Check if time is synchronized
 * @returns {boolean} True if synchronized
 */
function isTimeSynced() {
  return timeSyncState.lastSync !== null;
}

/**
 * Get sync status
 * @returns {Object} Sync status information
 */
function getSyncStatus() {
  return {
    offset: timeSyncState.offset,
    lastSync: timeSyncState.lastSync,
    isSynced: isTimeSynced(),
    syncing: timeSyncState.syncing
  };
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
  window.TimeSync = {
    syncTime,
    getSyncedTime,
    getSyncedTimestamp,
    formatSyncedDate,
    getTimeAgo,
    initTimeSync,
    isTimeSynced,
    getSyncStatus
  };
}

