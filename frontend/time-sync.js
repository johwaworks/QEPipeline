/**
 * Time Synchronization Module
 * Synchronizes client time with server time
 */

// Get API_BASE_URL from window or use default
function getApiBaseUrl() {
  if (window.API_BASE_URL) {
    return window.API_BASE_URL;
  }
  // Fallback to default if not set
  return "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
}

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
    const apiUrl = getApiBaseUrl();
    const response = await apiFetch(`${apiUrl}/api/time`);
    
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
 * Get synchronized time (server time) in KST
 * @returns {Date} Synchronized date object (server time in KST)
 */
function getSyncedTime() {
  const clientTime = Date.now();
  const syncedTime = clientTime + timeSyncState.offset;
  // Server time is in UTC, convert to KST (UTC+9)
  const kstTime = syncedTime + (9 * 60 * 60 * 1000); // Add 9 hours for KST
  return new Date(kstTime);
}

/**
 * Get synchronized timestamp in KST
 * @returns {number} Synchronized timestamp in milliseconds (KST)
 */
function getSyncedTimestamp() {
  const synced = Date.now() + timeSyncState.offset;
  // Convert UTC to KST (UTC+9)
  return synced + (9 * 60 * 60 * 1000);
}

/**
 * Convert server UTC time to KST
 * @param {Date|string|number} serverTime - Server time (UTC)
 * @returns {Date} Date object in KST
 */
function serverTimeToKST(serverTime) {
  let dateObj;
  if (serverTime instanceof Date) {
    dateObj = serverTime;
  } else if (typeof serverTime === 'string' || typeof serverTime === 'number') {
    dateObj = new Date(serverTime);
  } else {
    dateObj = new Date();
  }
  
  // Server time is UTC, convert to KST (UTC+9)
  const kstTime = dateObj.getTime() + (9 * 60 * 60 * 1000);
  return new Date(kstTime);
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
    timeZone: 'Asia/Seoul' // Default to KST
    // Don't include timeZoneName by default - only add if explicitly requested
  };
  
  // Merge options, but only add timeZoneName if explicitly provided
  const finalOptions = { ...defaultOptions };
  if (options.timeZoneName !== undefined) {
    finalOptions.timeZoneName = options.timeZoneName;
  }
  // Add other options
  Object.assign(finalOptions, options);
  
  let dateObj;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string' || typeof date === 'number') {
    // Server time is UTC, convert to KST
    dateObj = serverTimeToKST(date);
  } else {
    dateObj = getSyncedTime(); // Already in KST
  }
  
  // Format in Korean locale with KST timezone
  const formatted = dateObj.toLocaleString('ko-KR', finalOptions);
  
  // Replace GMT+9 with KST if it appears
  return formatted.replace(/GMT\+9/g, 'KST').replace(/GMT\+09/g, 'KST');
}

/**
 * Get time since a given date (relative time)
 * @param {Date|string|number} date - Date to compare
 * @returns {string} Relative time string (e.g., "2 minutes ago")
 */
function getTimeAgo(date) {
  const now = getSyncedTime(); // Already in KST
  // Convert server time (UTC) to KST for comparison
  const then = serverTimeToKST(date);
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
    return formatSyncedDate(then, { timeZone: 'Asia/Seoul' });
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
    serverTimeToKST,
    initTimeSync,
    isTimeSynced,
    getSyncStatus
  };
}

