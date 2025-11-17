// API_BASE_URL is loaded from config.js
// Use window.API_BASE_URL directly to avoid redeclaration conflicts
function getApiBaseUrl() {
  if (window.API_BASE_URL) {
    return window.API_BASE_URL;
  }
  // Fallback: detect environment
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const fallbackUrl = isLocal ? "http://localhost:5000" : "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
  window.API_BASE_URL = fallbackUrl; // Set for future use
  return fallbackUrl;
}

// Helper function to make API requests
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Add ngrok header only if using ngrok domain
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  return response;
}

let currentShotId = null;
let currentShot = null;
let currentProjectId = null;

// Check if user is logged in
function checkAuth() {
  const loggedIn = localStorage.getItem("qepipeline_logged_in");
  const username = localStorage.getItem("qepipeline_username");
  
  if (!loggedIn || !username) {
    window.location.href = "index.html";
    return false;
  }
  
  return username;
}

// Get shot ID from URL
function getShotIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load shot details
async function loadShot(shotId) {
  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${shotId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Shot not found");
      }
      throw new Error("Failed to load shot");
    }
    
    const result = await response.json();
    currentShot = result.shot;
    currentShotId = shotId;
    
    if (!currentShot) {
      throw new Error("Shot data not found");
    }
    
    // Store project ID for navigation and chat
    if (currentShot.project_id) {
      currentProjectId = currentShot.project_id;
    } else if (currentShot.project && currentShot.project._id) {
      currentProjectId = currentShot.project._id;
    }
    
    // Update chat context - set on window object for chat.js to access
    window.currentShotId = currentShotId;
    window.currentProjectId = currentProjectId;
    
    // Update chat context
    if (window.updateChatContext) {
      window.updateChatContext(currentProjectId, currentShotId);
    }
    
    // Update back link to project page
    const backLink = document.querySelector(".back-link");
    if (backLink && currentProjectId) {
      backLink.href = `project.html?id=${currentProjectId}`;
      backLink.textContent = "← Back to Project";
    }
    
    // Update page title
    const titleEl = document.getElementById("shot-title");
    if (titleEl && currentShot) {
      titleEl.textContent = currentShot.shot_name || currentShot.name || "Shot";
    }
    
    // Load thumbnail
    loadThumbnail();
    
    // Load resolution
    loadResolution();
    
    // Load duration
    loadDuration();
    
    // Load description
    loadDescription();
    
    // Load workers assignment
    await loadWorkersAssignment();
    
  } catch (error) {
    console.error("Error loading shot:", error);
    alert("Failed to load shot: " + error.message);
    if (currentProjectId) {
      window.location.href = `project.html?id=${currentProjectId}`;
    } else {
      window.location.href = "dashboard.html";
    }
  }
}

// Load thumbnail
async function loadThumbnail() {
  if (!currentShotId) return;
  
  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/thumbnail`);
    if (response.ok) {
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      displayThumbnail(imageUrl);
    } else {
      // No thumbnail uploaded yet
      showThumbnailPlaceholder();
    }
  } catch (error) {
    console.error("Error loading thumbnail:", error);
    showThumbnailPlaceholder();
  }
}

// Display thumbnail
function displayThumbnail(imageUrl) {
  const preview = document.getElementById("thumbnail-preview");
  const placeholder = document.getElementById("thumbnail-placeholder");
  const removeBtn = document.getElementById("thumbnail-remove-btn");
  
  if (preview) {
    preview.src = imageUrl;
    preview.style.display = "block";
  }
  if (placeholder) {
    placeholder.style.display = "none";
  }
  if (removeBtn) {
    removeBtn.style.display = "block";
  }
}

// Show thumbnail placeholder
function showThumbnailPlaceholder() {
  const preview = document.getElementById("thumbnail-preview");
  const placeholder = document.getElementById("thumbnail-placeholder");
  const removeBtn = document.getElementById("thumbnail-remove-btn");
  
  if (preview) {
    preview.src = "";
    preview.style.display = "none";
  }
  if (placeholder) {
    placeholder.style.display = "block";
  }
  if (removeBtn) {
    removeBtn.style.display = "none";
  }
}

// Handle file upload
async function uploadThumbnail(file) {
  if (!currentShotId) {
    alert("Shot ID not found");
    return;
  }
  
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select an image file");
    return;
  }
  
  // Show progress
  const progressContainer = document.getElementById("thumbnail-upload-progress");
  const progressFill = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");
  
  if (progressContainer) {
    progressContainer.style.display = "block";
  }
  if (progressFill) {
    progressFill.style.width = "0%";
  }
  if (progressText) {
    progressText.textContent = "Uploading...";
  }
  
  try {
    const formData = new FormData();
    formData.append("thumbnail", file);
    
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        if (progressFill) {
          progressFill.style.width = `${percentComplete}%`;
        }
        if (progressText) {
          progressText.textContent = `Uploading... ${Math.round(percentComplete)}%`;
        }
      }
    });
    
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        // Upload successful
        if (progressText) {
          progressText.textContent = "Upload complete!";
        }
        
        // Reload thumbnail
        setTimeout(() => {
          loadThumbnail();
          if (progressContainer) {
            progressContainer.style.display = "none";
          }
        }, 500);
      } else {
        // Upload failed
        const error = JSON.parse(xhr.responseText).error || "Upload failed";
        alert(`Failed to upload thumbnail: ${error}`);
        if (progressContainer) {
          progressContainer.style.display = "none";
        }
      }
    });
    
    xhr.addEventListener("error", () => {
      alert("Network error while uploading thumbnail");
      if (progressContainer) {
        progressContainer.style.display = "none";
      }
    });
    
    const API_BASE_URL = getApiBaseUrl();
    xhr.open("POST", `${API_BASE_URL}/api/shot/${currentShotId}/thumbnail`);
    xhr.send(formData);
    
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    alert("Failed to upload thumbnail: " + error.message);
    if (progressContainer) {
      progressContainer.style.display = "none";
    }
  }
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    uploadThumbnail(file);
  }
}

// Handle paste event (Ctrl+V)
function handlePaste(event) {
  // Check if clipboard contains image
  const items = event.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        uploadThumbnail(blob);
        event.preventDefault();
        break;
      }
    }
  }
}

// Handle remove thumbnail
async function handleRemoveThumbnail() {
  if (!currentShotId) {
    alert("Shot ID not found");
    return;
  }
  
  if (!confirm("Are you sure you want to remove the thumbnail?")) {
    return;
  }
  
  try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/thumbnail`, {
      method: "DELETE",
    });
    
    if (response.ok) {
      showThumbnailPlaceholder();
    } else {
      const result = await response.json();
      alert(`Failed to remove thumbnail: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error removing thumbnail:", error);
    alert("Failed to remove thumbnail: " + error.message);
  }
}

// Load resolution
function loadResolution() {
  if (!currentShot) return;
  
  const widthInput = document.getElementById("resolution-width");
  const heightInput = document.getElementById("resolution-height");
  const statusEl = document.getElementById("resolution-status");
  const lockBtn = document.getElementById("resolution-lock-btn");
  const lockIcon = document.getElementById("resolution-lock-icon");
  
  if (currentShot.resolution) {
    const resolution = currentShot.resolution;
    if (widthInput) {
      widthInput.value = resolution.width || "";
    }
    if (heightInput) {
      heightInput.value = resolution.height || "";
    }
  } else {
    if (widthInput) {
      widthInput.value = "";
    }
    if (heightInput) {
      heightInput.value = "";
    }
  }
  
  // Load lock status
  const isLocked = currentShot.resolution_locked || false;
  if (widthInput) {
    widthInput.disabled = isLocked;
  }
  if (heightInput) {
    heightInput.disabled = isLocked;
  }
  if (lockBtn) {
    if (isLocked) {
      lockBtn.classList.add("locked");
      if (lockIcon) {
        // Locked icon (closed lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      }
    } else {
      lockBtn.classList.remove("locked");
      if (lockIcon) {
        // Unlocked icon (open lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      }
    }
  }
  
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "resolution-status";
  }
}

// Debounce timer for resolution
let resolutionSaveTimer = null;

// Handle resolution save (with debounce)
async function handleResolutionSave() {
  if (!currentShotId) {
    return;
  }
  
  const widthInput = document.getElementById("resolution-width");
  const heightInput = document.getElementById("resolution-height");
  const statusEl = document.getElementById("resolution-status");
  
  if (!widthInput || !heightInput) {
    return;
  }
  
  // Check if locked
  if (widthInput.disabled || heightInput.disabled) {
    return;
  }
  
  const width = parseInt(widthInput.value.trim());
  const height = parseInt(heightInput.value.trim());
  
  // Validate inputs
  if (isNaN(width) || width < 1 || isNaN(height) || height < 1) {
    // Don't save if inputs are invalid
    return;
  }
  
  // Clear previous timer
  if (resolutionSaveTimer) {
    clearTimeout(resolutionSaveTimer);
  }
  
  // Set new timer (save after 1 second of no changes)
  resolutionSaveTimer = setTimeout(async () => {
    if (statusEl) {
      statusEl.textContent = "Saving...";
      statusEl.className = "resolution-status";
    }
    
    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/resolution`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          width: width,
          height: height,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Update current shot data
        if (currentShot) {
          currentShot.resolution = {
            width: width,
            height: height,
          };
        }
        
        if (statusEl) {
          statusEl.textContent = "Saved";
          statusEl.className = "resolution-status success";
        }
        
        // Clear status after 1.5 seconds
        setTimeout(() => {
          if (statusEl) {
            statusEl.textContent = "";
            statusEl.className = "resolution-status";
          }
        }, 1500);
      } else {
        const result = await response.json();
        if (statusEl) {
          statusEl.textContent = result.error || "Failed to save";
          statusEl.className = "resolution-status error";
        }
        
        // If locked, reload lock status
        if (response.status === 403) {
          loadResolution();
        }
      }
    } catch (error) {
      console.error("Error saving resolution:", error);
      if (statusEl) {
        statusEl.textContent = "Failed to save";
        statusEl.className = "resolution-status error";
      }
    }
  }, 1000);
}

// Handle resolution lock toggle
async function handleResolutionLockToggle() {
  if (!currentShotId) {
    return;
  }
  
  const widthInput = document.getElementById("resolution-width");
  const heightInput = document.getElementById("resolution-height");
  const lockBtn = document.getElementById("resolution-lock-btn");
  const lockIcon = document.getElementById("resolution-lock-icon");
  
  if (!lockBtn || !lockIcon) {
    return;
  }
  
  const isCurrentlyLocked = lockBtn.classList.contains("locked");
  const newLockState = !isCurrentlyLocked;
  
  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/resolution/lock`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locked: newLockState,
      }),
    });
    
    if (response.ok) {
      // Update UI
      if (widthInput) {
        widthInput.disabled = newLockState;
      }
      if (heightInput) {
        heightInput.disabled = newLockState;
      }
      
      if (newLockState) {
        lockBtn.classList.add("locked");
        // Locked icon (closed lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      } else {
        lockBtn.classList.remove("locked");
        // Unlocked icon (open lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      }
      
      // Update current shot data
      if (currentShot) {
        currentShot.resolution_locked = newLockState;
      }
    } else {
      const result = await response.json();
      alert(`Failed to update lock status: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error updating lock status:", error);
    alert("Failed to update lock status: " + error.message);
  }
}

// Load duration
function loadDuration() {
  if (!currentShot) return;
  
  const startInput = document.getElementById("duration-start");
  const endInput = document.getElementById("duration-end");
  const totalInput = document.getElementById("duration-total");
  const statusEl = document.getElementById("duration-status");
  const lockBtn = document.getElementById("duration-lock-btn");
  const lockIcon = document.getElementById("duration-lock-icon");
  
  if (currentShot.duration) {
    const duration = currentShot.duration;
    if (startInput) {
      startInput.value = duration.start_frame !== undefined ? duration.start_frame : "";
    }
    if (endInput) {
      endInput.value = duration.end_frame !== undefined ? duration.end_frame : "";
    }
    if (totalInput) {
      totalInput.value = duration.total_frames !== undefined ? duration.total_frames : "";
    }
  } else {
    if (startInput) {
      startInput.value = "";
    }
    if (endInput) {
      endInput.value = "";
    }
    if (totalInput) {
      totalInput.value = "";
    }
  }
  
  // Load lock status
  const isLocked = currentShot.duration_locked || false;
  if (startInput) {
    startInput.disabled = isLocked;
  }
  if (endInput) {
    endInput.disabled = isLocked;
  }
  // Total input can be disabled separately or remain editable
  // For now, disable it only when locked (user can still manually override auto-calculation)
  if (totalInput) {
    totalInput.disabled = isLocked;
  }
  if (lockBtn) {
    if (isLocked) {
      lockBtn.classList.add("locked");
      if (lockIcon) {
        // Locked icon (closed lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      }
    } else {
      lockBtn.classList.remove("locked");
      if (lockIcon) {
        // Unlocked icon (open lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      }
    }
  }
  
  // Auto-calculate total if start and end are available and not locked
  if (!isLocked && startInput && endInput && totalInput) {
    const startValue = startInput.value.trim();
    const endValue = endInput.value.trim();
    // Only auto-calculate if we loaded from DB and both values exist
    // Don't override if user manually entered total
    if (startValue !== "" && endValue !== "" && (totalInput.value === "" || totalInput.value === "0")) {
      const startFrame = parseInt(startValue);
      const endFrame = parseInt(endValue);
      if (!isNaN(startFrame) && !isNaN(endFrame) && endFrame >= startFrame) {
        const calculatedTotal = endFrame - startFrame + 1;
        totalInput.value = calculatedTotal;
      }
    }
  }
  
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "duration-status";
  }
}

// Calculate total frames from start and end frames
function calculateTotalFrames() {
  const startInput = document.getElementById("duration-start");
  const endInput = document.getElementById("duration-end");
  const totalInput = document.getElementById("duration-total");
  
  if (!startInput || !endInput || !totalInput) {
    return;
  }
  
  // Check if locked - don't auto-calculate if locked
  if (startInput.disabled || endInput.disabled) {
    return;
  }
  
  const startValue = startInput.value.trim();
  const endValue = endInput.value.trim();
  
  // Only calculate if both start and end are provided
  if (startValue === "" || endValue === "") {
    return;
  }
  
  const startFrame = parseInt(startValue);
  const endFrame = parseInt(endValue);
  
  // Validate inputs
  if (isNaN(startFrame) || isNaN(endFrame) || startFrame < 0 || endFrame < 0) {
    return;
  }
  
  // Calculate total frames: end_frame - start_frame + 1
  // Example: start=10, end=20 -> total=11 frames (10, 11, 12, ..., 20)
  if (endFrame >= startFrame) {
    const calculatedTotal = endFrame - startFrame + 1;
    totalInput.value = calculatedTotal;
  } else {
    // If end is less than start, clear total
    totalInput.value = "";
  }
  
  // Trigger save after calculation
  handleDurationSave();
}

// Debounce timer for duration
let durationSaveTimer = null;

// Handle duration save (with debounce)
async function handleDurationSave() {
  if (!currentShotId) {
    return;
  }
  
  const startInput = document.getElementById("duration-start");
  const endInput = document.getElementById("duration-end");
  const totalInput = document.getElementById("duration-total");
  const statusEl = document.getElementById("duration-status");
  
  if (!startInput || !endInput || !totalInput) {
    return;
  }
  
  // Check if locked
  if (startInput.disabled || endInput.disabled || totalInput.disabled) {
    return;
  }
  
  const startFrame = startInput.value.trim() !== "" ? parseInt(startInput.value.trim()) : null;
  const endFrame = endInput.value.trim() !== "" ? parseInt(endInput.value.trim()) : null;
  const totalFrames = totalInput.value.trim() !== "" ? parseInt(totalInput.value.trim()) : null;
  
  // Validate inputs
  if (startFrame !== null && (isNaN(startFrame) || startFrame < 0)) {
    return;
  }
  if (endFrame !== null && (isNaN(endFrame) || endFrame < 0)) {
    return;
  }
  if (totalFrames !== null && (isNaN(totalFrames) || totalFrames < 0)) {
    return;
  }
  
  // Clear previous timer
  if (durationSaveTimer) {
    clearTimeout(durationSaveTimer);
  }
  
  // Set new timer (save after 1 second of no changes)
  durationSaveTimer = setTimeout(async () => {
    if (statusEl) {
      statusEl.textContent = "Saving...";
      statusEl.className = "duration-status";
    }
    
    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/duration`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_frame: startFrame,
          end_frame: endFrame,
          total_frames: totalFrames,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Update current shot data
        if (currentShot) {
          currentShot.duration = {
            start_frame: startFrame,
            end_frame: endFrame,
            total_frames: totalFrames,
          };
        }
        
        if (statusEl) {
          statusEl.textContent = "Saved";
          statusEl.className = "duration-status success";
        }
        
        // Clear status after 1.5 seconds
        setTimeout(() => {
          if (statusEl) {
            statusEl.textContent = "";
            statusEl.className = "duration-status";
          }
        }, 1500);
      } else {
        const result = await response.json();
        if (statusEl) {
          statusEl.textContent = result.error || "Failed to save";
          statusEl.className = "duration-status error";
        }
        
        // If locked, reload lock status
        if (response.status === 403) {
          loadDuration();
        }
      }
    } catch (error) {
      console.error("Error saving duration:", error);
      if (statusEl) {
        statusEl.textContent = "Failed to save";
        statusEl.className = "duration-status error";
      }
    }
  }, 1000);
}

// Handle duration lock toggle
async function handleDurationLockToggle() {
  if (!currentShotId) {
    return;
  }
  
  const startInput = document.getElementById("duration-start");
  const endInput = document.getElementById("duration-end");
  const totalInput = document.getElementById("duration-total");
  const lockBtn = document.getElementById("duration-lock-btn");
  const lockIcon = document.getElementById("duration-lock-icon");
  
  if (!lockBtn || !lockIcon) {
    return;
  }
  
  const isCurrentlyLocked = lockBtn.classList.contains("locked");
  const newLockState = !isCurrentlyLocked;
  
  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/duration/lock`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locked: newLockState,
      }),
    });
    
    if (response.ok) {
      // Update UI
      if (startInput) {
        startInput.disabled = newLockState;
      }
      if (endInput) {
        endInput.disabled = newLockState;
      }
      if (totalInput) {
        totalInput.disabled = newLockState;
      }
      
      if (newLockState) {
        lockBtn.classList.add("locked");
        // Locked icon (closed lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      } else {
        lockBtn.classList.remove("locked");
        // Unlocked icon (open lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      }
      
      // Update current shot data
      if (currentShot) {
        currentShot.duration_locked = newLockState;
      }
    } else {
      const result = await response.json();
      alert(`Failed to update lock status: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error updating lock status:", error);
    alert("Failed to update lock status: " + error.message);
  }
}

// Load description
function loadDescription() {
  if (!currentShot) return;
  
  const descriptionInput = document.getElementById("description-input");
  const statusEl = document.getElementById("description-status");
  const lockBtn = document.getElementById("description-lock-btn");
  const lockIcon = document.getElementById("description-lock-icon");
  
  if (descriptionInput) {
    descriptionInput.value = currentShot.description || "";
  }
  
  // Load lock status
  const isLocked = currentShot.description_locked || false;
  if (descriptionInput) {
    descriptionInput.disabled = isLocked;
  }
  if (lockBtn) {
    if (isLocked) {
      lockBtn.classList.add("locked");
      if (lockIcon) {
        // Locked icon (closed lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      }
    } else {
      lockBtn.classList.remove("locked");
      if (lockIcon) {
        // Unlocked icon (open lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      }
    }
  }
  
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "description-status";
  }
}

// Debounce timer for description
let descriptionSaveTimer = null;

// Handle description save (with debounce)
async function handleDescriptionSave() {
  if (!currentShotId) {
    return;
  }
  
  const descriptionInput = document.getElementById("description-input");
  const statusEl = document.getElementById("description-status");
  
  if (!descriptionInput) {
    return;
  }
  
  // Check if locked
  if (descriptionInput.disabled) {
    return;
  }
  
  const description = descriptionInput.value.trim();
  
  // Clear previous timer
  if (descriptionSaveTimer) {
    clearTimeout(descriptionSaveTimer);
  }
  
  // Set new timer (save after 1 second of no changes)
  descriptionSaveTimer = setTimeout(async () => {
    if (statusEl) {
      statusEl.textContent = "Saving...";
      statusEl.className = "description-status";
    }
    
    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/description`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Update current shot data
        if (currentShot) {
          currentShot.description = description;
        }
        
        if (statusEl) {
          statusEl.textContent = "Saved";
          statusEl.className = "description-status success";
        }
        
        // Clear status after 1.5 seconds
        setTimeout(() => {
          if (statusEl) {
            statusEl.textContent = "";
            statusEl.className = "description-status";
          }
        }, 1500);
      } else {
        const result = await response.json();
        if (statusEl) {
          statusEl.textContent = result.error || "Failed to save";
          statusEl.className = "description-status error";
        }
        
        // If locked, reload lock status
        if (response.status === 403 && result.error && result.error.includes("locked")) {
          loadDescription();
        }
      }
    } catch (error) {
      console.error("Error saving description:", error);
      if (statusEl) {
        statusEl.textContent = "Failed to save";
        statusEl.className = "description-status error";
      }
    }
  }, 1000);
}

// Handle description lock toggle
async function handleDescriptionLockToggle() {
  if (!currentShotId) {
    return;
  }
  
  const descriptionInput = document.getElementById("description-input");
  const lockBtn = document.getElementById("description-lock-btn");
  const lockIcon = document.getElementById("description-lock-icon");
  
  if (!lockBtn || !lockIcon) {
    return;
  }
  
  const isCurrentlyLocked = lockBtn.classList.contains("locked");
  const newLockState = !isCurrentlyLocked;
  
  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/description/lock`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locked: newLockState,
      }),
    });
    
    if (response.ok) {
      // Update UI
      if (descriptionInput) {
        descriptionInput.disabled = newLockState;
      }
      
      if (newLockState) {
        lockBtn.classList.add("locked");
        // Locked icon (closed lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      } else {
        lockBtn.classList.remove("locked");
        // Unlocked icon (open lock)
        lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      }
      
      // Update current shot data
      if (currentShot) {
        currentShot.description_locked = newLockState;
      }
    } else {
      const result = await response.json();
      alert(`Failed to update lock status: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error updating lock status:", error);
    alert("Failed to update lock status: " + error.message);
  }
}

// Open edit shot modal
function openEditShotModal() {
  const modal = document.getElementById("edit-shot-modal");
  if (modal && currentShot) {
    modal.style.display = "flex";
    
    // Populate form with current shot data
    document.getElementById("edit-shot-name").value = currentShot.shot_name || currentShot.name || "";
    document.getElementById("edit-shot-description").value = currentShot.description || "";
    
    // Clear status message
    const statusEl = document.getElementById("edit-shot-status-message");
    if (statusEl) {
      statusEl.textContent = "";
    }
  }
}

// Close edit shot modal
function closeEditShotModal() {
  const modal = document.getElementById("edit-shot-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Handle shot update
async function handleShotUpdate(event) {
  event.preventDefault();
  const statusEl = document.getElementById("edit-shot-status-message");
  
  if (!currentShotId || !currentShot) {
    setStatus(statusEl, "Shot information not found.", "error");
    return;
  }
  
  const shotName = document.getElementById("edit-shot-name").value.trim();
  const description = document.getElementById("edit-shot-description").value.trim();
  
  if (!shotName) {
    setStatus(statusEl, "Shot name is required.", "error");
    return;
  }
  
  setStatus(statusEl, "Updating shot...", "");
  
  try {
    // TODO: Implement shot update API endpoint
    // For now, just show a message
    setStatus(statusEl, "Shot update functionality will be implemented soon.", "error");
    
    // After API is implemented, uncomment this:
    /*
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shot_name: shotName,
        description: description
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to update shot");
    }
    
    setStatus(statusEl, "Shot updated successfully!", "success");
    
    // Reload shot and close modal after delay
    setTimeout(() => {
      closeEditShotModal();
      loadShot(currentShotId);
    }, 1000);
    */
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Update shot error:", error);
  }
}

// Open delete shot modal
function openDeleteShotModal() {
  const modal = document.getElementById("delete-shot-modal");
  if (modal && currentShot) {
    modal.style.display = "flex";
    document.getElementById("delete-shot-form").reset();
    const statusEl = document.getElementById("delete-shot-status-message");
    if (statusEl) {
      statusEl.textContent = "";
    }
  }
}

// Close delete shot modal
function closeDeleteShotModal() {
  const modal = document.getElementById("delete-shot-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Handle shot deletion
async function handleShotDeletion(event) {
  event.preventDefault();
  const statusEl = document.getElementById("delete-shot-status-message");
  
  if (!currentShotId || !currentShot) {
    setStatus(statusEl, "Shot information not found.", "error");
    return;
  }
  
  const confirmName = document.getElementById("confirm-shot-name").value.trim();
  const shotName = currentShot.shot_name || currentShot.name || "";
  
  if (confirmName !== shotName) {
    setStatus(statusEl, "Shot name does not match.", "error");
    return;
  }
  
  setStatus(statusEl, "Deleting shot...", "");
  
  try {
    // TODO: Implement shot delete API endpoint
    // For now, just show a message
    setStatus(statusEl, "Shot deletion functionality will be implemented soon.", "error");
    
    // After API is implemented, uncomment this:
    /*
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}`, {
      method: "DELETE",
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to delete shot");
    }
    
    setStatus(statusEl, "Shot deleted successfully!", "success");
    
    // Redirect to project page after delay
    setTimeout(() => {
      if (currentProjectId) {
        window.location.href = `project.html?id=${currentProjectId}`;
      } else {
        window.location.href = "dashboard.html";
      }
    }, 1500);
    */
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Delete shot error:", error);
  }
}

function setStatus(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("error", "success");
  if (type) {
    element.classList.add(type);
  }
}

// Update user activity (heartbeat)
async function updateUserActivity() {
  const username = localStorage.getItem("qepipeline_username");
  if (!username) {
    return;
  }
  
  try {
    await apiFetch(`${API_BASE_URL}/api/users/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username
      }),
    });
  } catch (error) {
    console.error("Error updating user activity:", error);
  }
}

// Initialize shot page
function initShot() {
  const username = checkAuth();
  if (!username) return;
  
  currentShotId = getShotIdFromURL();
  if (!currentShotId) {
    alert("Shot ID not found in URL");
    window.location.href = "dashboard.html";
    return;
  }
  
  loadShot(currentShotId);
  
  // Edit shot button
  const editBtn = document.getElementById("edit-shot-btn");
  if (editBtn) {
    editBtn.addEventListener("click", openEditShotModal);
  }
  
  // Delete shot button
  const deleteBtn = document.getElementById("delete-shot-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", openDeleteShotModal);
  }
  
  // Edit shot modal close buttons
  const editShotModalClose = document.getElementById("edit-shot-modal-close");
  const cancelEditShot = document.getElementById("cancel-edit-shot");
  if (editShotModalClose) {
    editShotModalClose.addEventListener("click", closeEditShotModal);
  }
  if (cancelEditShot) {
    cancelEditShot.addEventListener("click", closeEditShotModal);
  }
  
  // Delete shot modal close buttons
  const deleteShotModalClose = document.getElementById("delete-shot-modal-close");
  const cancelDeleteShot = document.getElementById("cancel-delete-shot");
  if (deleteShotModalClose) {
    deleteShotModalClose.addEventListener("click", closeDeleteShotModal);
  }
  if (cancelDeleteShot) {
    cancelDeleteShot.addEventListener("click", closeDeleteShotModal);
  }
  
  // Close modals when clicking outside
  const editShotModal = document.getElementById("edit-shot-modal");
  const deleteShotModal = document.getElementById("delete-shot-modal");
  if (editShotModal) {
    editShotModal.addEventListener("click", (e) => {
      if (e.target === editShotModal) {
        closeEditShotModal();
      }
    });
  }
  if (deleteShotModal) {
    deleteShotModal.addEventListener("click", (e) => {
      if (e.target === deleteShotModal) {
        closeDeleteShotModal();
      }
    });
  }
  
  // Edit shot form submission
  const editShotForm = document.getElementById("edit-shot-form");
  if (editShotForm) {
    editShotForm.addEventListener("submit", handleShotUpdate);
  }
  
  // Delete shot form submission
  const deleteShotForm = document.getElementById("delete-shot-form");
  if (deleteShotForm) {
    deleteShotForm.addEventListener("submit", handleShotDeletion);
  }
  
  // Thumbnail upload handlers
  const thumbnailFileInput = document.getElementById("thumbnail-file-input");
  const thumbnailUploadArea = document.getElementById("thumbnail-upload-area");
  const thumbnailPreviewContainer = document.getElementById("thumbnail-preview-container");
  const thumbnailRemoveBtn = document.getElementById("thumbnail-remove-btn");
  
  // File input change
  if (thumbnailFileInput) {
    thumbnailFileInput.addEventListener("change", handleFileSelect);
  }
  
  // Click to upload
  if (thumbnailPreviewContainer) {
    thumbnailPreviewContainer.addEventListener("click", () => {
      if (thumbnailFileInput) {
        thumbnailFileInput.click();
      }
    });
  }
  
  // Drag and drop
  if (thumbnailUploadArea) {
    thumbnailUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (thumbnailPreviewContainer) {
        thumbnailPreviewContainer.classList.add("dragover");
      }
    });
    
    thumbnailUploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (thumbnailPreviewContainer) {
        thumbnailPreviewContainer.classList.remove("dragover");
      }
    });
    
    thumbnailUploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (thumbnailPreviewContainer) {
        thumbnailPreviewContainer.classList.remove("dragover");
      }
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadThumbnail(files[0]);
      }
    });
  }
  
  // Paste handler (Ctrl+V)
  document.addEventListener("paste", handlePaste);
  
  // Remove thumbnail button
  if (thumbnailRemoveBtn) {
    thumbnailRemoveBtn.addEventListener("click", handleRemoveThumbnail);
  }
  
  // Resolution handlers
  const resolutionWidthInput = document.getElementById("resolution-width");
  const resolutionHeightInput = document.getElementById("resolution-height");
  const resolutionLockBtn = document.getElementById("resolution-lock-btn");
  
  // Auto-save on input change
  if (resolutionWidthInput) {
    resolutionWidthInput.addEventListener("input", handleResolutionSave);
    resolutionWidthInput.addEventListener("change", handleResolutionSave);
  }
  
  if (resolutionHeightInput) {
    resolutionHeightInput.addEventListener("input", handleResolutionSave);
    resolutionHeightInput.addEventListener("change", handleResolutionSave);
  }
  
  // Lock button
  if (resolutionLockBtn) {
    resolutionLockBtn.addEventListener("click", handleResolutionLockToggle);
  }
  
  // Duration handlers
  const durationStartInput = document.getElementById("duration-start");
  const durationEndInput = document.getElementById("duration-end");
  const durationTotalInput = document.getElementById("duration-total");
  const durationLockBtn = document.getElementById("duration-lock-btn");
  
  // Auto-calculate total frames when start or end changes
  if (durationStartInput) {
    durationStartInput.addEventListener("input", calculateTotalFrames);
    durationStartInput.addEventListener("change", calculateTotalFrames);
  }
  
  if (durationEndInput) {
    durationEndInput.addEventListener("input", calculateTotalFrames);
    durationEndInput.addEventListener("change", calculateTotalFrames);
  }
  
  // Allow manual total input as well
  if (durationTotalInput) {
    durationTotalInput.addEventListener("input", handleDurationSave);
    durationTotalInput.addEventListener("change", handleDurationSave);
  }
  
  // Lock button
  if (durationLockBtn) {
    durationLockBtn.addEventListener("click", handleDurationLockToggle);
  }
  
  // Description handlers
  const descriptionInput = document.getElementById("description-input");
  const descriptionLockBtn = document.getElementById("description-lock-btn");
  
  // Auto-save on input change
  if (descriptionInput) {
    descriptionInput.addEventListener("input", handleDescriptionSave);
    descriptionInput.addEventListener("change", handleDescriptionSave);
  }
  
  // Lock button
  if (descriptionLockBtn) {
    descriptionLockBtn.addEventListener("click", handleDescriptionLockToggle);
  }
}


// Open media in fullscreen modal
function openMediaFullscreen(mediaUrl, mediaType, filename) {
  // Create modal overlay
  const modal = document.createElement("div");
  modal.className = "media-fullscreen-modal";
  modal.id = "media-fullscreen-modal";
  
  // Create close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "media-fullscreen-close";
  closeBtn.innerHTML = "×";
  closeBtn.addEventListener("click", () => {
    closeMediaFullscreen();
  });
  
  // Create media container
  const mediaContainer = document.createElement("div");
  mediaContainer.className = "media-fullscreen-container";
  
  // Create media element
  let mediaElement;
  if (mediaType === "image") {
    mediaElement = document.createElement("img");
    mediaElement.src = mediaUrl;
    mediaElement.alt = filename;
    mediaElement.className = "media-fullscreen-image";
  } else if (mediaType === "video") {
    mediaElement = document.createElement("video");
    mediaElement.src = mediaUrl;
    mediaElement.controls = true;
    mediaElement.autoplay = false;
    mediaElement.className = "media-fullscreen-video";
    mediaElement.controlsList = "nodownload";
  }
  
  // Create filename display
  const filenameEl = document.createElement("div");
  filenameEl.className = "media-fullscreen-filename";
  filenameEl.textContent = filename;
  
  // Assemble modal
  mediaContainer.appendChild(mediaElement);
  modal.appendChild(closeBtn);
  modal.appendChild(mediaContainer);
  modal.appendChild(filenameEl);
  
  // Add to body
  document.body.appendChild(modal);
  
  // Close on background click - close if clicking anywhere except the media element itself
  modal.addEventListener("click", (e) => {
    // Close if clicking on modal background, close button, filename, or anywhere except the media element
    const clickedElement = e.target;
    
    // Don't close if clicking on the media element itself (image or video) or its direct children
    // Check if the clicked element is the media element or is contained within it
    if (clickedElement === mediaElement || 
        (mediaElement && mediaElement.contains(clickedElement))) {
      return;
    }
    
    // Close for all other clicks (background, filename, container area, etc.)
    closeMediaFullscreen();
  });
  
  // Prevent clicks on media element from closing modal
  if (mediaElement) {
    mediaElement.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      closeMediaFullscreen();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);
  
  // Prevent body scroll
  document.body.style.overflow = "hidden";
}

// Close media fullscreen modal
function closeMediaFullscreen() {
  const modal = document.getElementById("media-fullscreen-modal");
  if (modal) {
    // Stop any playing video
    const video = modal.querySelector("video");
    if (video) {
      video.pause();
      video.src = "";
    }
    
    modal.remove();
    document.body.style.overflow = "";
  }
}


// Load shot files
async function loadShotFiles() {
  if (!currentShotId) {
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/files`);
    
    if (!response.ok) {
      console.error("Failed to load files");
      return;
    }
    
    const result = await response.json();
    const files = result.files || [];
    
    const filesList = document.getElementById("shot-files-list");
    if (!filesList) {
      return;
    }
    
    // Clear existing files
    filesList.innerHTML = "";
    
    if (files.length === 0) {
      filesList.innerHTML = '<div class="chat-empty">No files uploaded yet.</div>';
      return;
    }
    
    // Display files
    files.forEach((file) => {
      const fileEl = document.createElement("div");
      fileEl.className = "file-item";
      fileEl.setAttribute("data-file-id", file._id || file.id);
      
      // Get file icon based on file type
      const fileIcon = getFileIcon(file.file_type || "");
      
      const iconEl = document.createElement("div");
      iconEl.className = "file-item-icon";
      iconEl.textContent = fileIcon;
      
      const infoEl = document.createElement("div");
      infoEl.className = "file-item-info";
      
      const nameEl = document.createElement("div");
      nameEl.className = "file-item-name";
      nameEl.textContent = file.filename || "Unknown file";
      nameEl.title = file.filename || "Unknown file";
      
      const metaEl = document.createElement("div");
      metaEl.className = "file-item-meta";
      
      const sizeEl = document.createElement("span");
      sizeEl.textContent = formatFileSize(file.file_size || 0);
      
      const authorEl = document.createElement("span");
      authorEl.textContent = file.author_name || file.author_username || "Unknown";
      
      const dateEl = document.createElement("span");
      if (file.created_at) {
        const fileDate = new Date(file.created_at);
        dateEl.textContent = fileDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      
      metaEl.appendChild(sizeEl);
      metaEl.appendChild(authorEl);
      metaEl.appendChild(dateEl);
      
      infoEl.appendChild(nameEl);
      infoEl.appendChild(metaEl);
      
      const actionsEl = document.createElement("div");
      actionsEl.className = "file-item-actions";
      
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "file-item-btn";
      downloadBtn.textContent = "Download";
      downloadBtn.addEventListener("click", () => {
        downloadShotFile(file._id || file.id);
      });
      
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "file-item-btn delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        deleteShotFile(file._id || file.id);
      });
      
      actionsEl.appendChild(downloadBtn);
      actionsEl.appendChild(deleteBtn);
      
      fileEl.appendChild(iconEl);
      fileEl.appendChild(infoEl);
      fileEl.appendChild(actionsEl);
      
      filesList.appendChild(fileEl);
    });
    
  } catch (error) {
    console.error("Error loading files:", error);
  }
}

// Get file icon based on file type
function getFileIcon(fileType) {
  if (!fileType) return "📄";
  
  if (fileType.startsWith("video/")) return "🎬";
  if (fileType.startsWith("audio/")) return "🎵";
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.includes("pdf")) return "📕";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  if (fileType.includes("excel") || fileType.includes("spreadsheet")) return "📊";
  if (fileType.includes("zip") || fileType.includes("archive")) return "📦";
  
  return "📄";
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Handle shot file upload
async function handleShotFileUpload(files) {
  if (!currentShotId || !files || files.length === 0) {
    return;
  }
  
  const username = localStorage.getItem("qepipeline_username");
  
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("username", username);
      
      const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/files`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to upload file");
      }
      
      // Reload files list
      await loadShotFiles();
      
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file: " + error.message);
    }
  }
}


// Download shot file
function downloadShotFile(fileId) {
  if (!currentShotId) {
    return;
  }
  
  window.open(`${API_BASE_URL}/api/shot/${currentShotId}/files/${fileId}`, "_blank");
}

// Delete shot file
async function deleteShotFile(fileId) {
  if (!currentShotId) {
    return;
  }
  
  if (!confirm("Are you sure you want to delete this file?")) {
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/files/${fileId}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Failed to delete file");
    }
    
    // Reload files list
    await loadShotFiles();
    
  } catch (error) {
    console.error("Error deleting file:", error);
    alert("Failed to delete file: " + error.message);
  }
}

// Part types for workers assignment
const PART_TYPES = [
  "Modeling",
  "Texturing",
  "Lighting",
  "Layout",
  "Crowd",
  "Animation",
  "FX",
  "Compositing",
  "Motion Graphic",
  "Rigging",
  "Matchmove",
  "CFX",
  "LookDev"
];

let currentProject = null;
let projectWorkers = []; // List of all workers in the project
let selectedParts = new Set(); // Set of enabled part keys
let selectedWorkers = new Set(); // Set of workers participating in this shot
let dropdownClickListenerAttached = false; // Flag to prevent duplicate listeners

// Load project information to get workers
async function loadProjectInfo() {
  if (!currentProjectId) {
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/project/${currentProjectId}`);
    if (!response.ok) {
      console.error("Failed to load project info");
      return;
    }
    
    const result = await response.json();
    currentProject = result.project;
    
    if (currentProject) {
      // Collect all project participants (owner, members, workers, vfx_supervisors)
      const allUsernames = new Set();
      
      if (currentProject.owner) {
        allUsernames.add(currentProject.owner);
      }
      
      if (currentProject.members && Array.isArray(currentProject.members)) {
        currentProject.members.forEach(m => allUsernames.add(m));
      }
      
      if (currentProject.workers && Array.isArray(currentProject.workers)) {
        currentProject.workers.forEach(w => allUsernames.add(w));
      }
      
      if (currentProject.vfx_supervisors && Array.isArray(currentProject.vfx_supervisors)) {
        currentProject.vfx_supervisors.forEach(v => allUsernames.add(v));
      }
      
      // Get user details for all usernames
      // Use batch loading from project data if available (members_info, workers_info, etc.)
      const userDetails = [];
      const userMap = new Map();
      
      // First, try to get user info from project's info fields
      if (currentProject.members_info && Array.isArray(currentProject.members_info)) {
        currentProject.members_info.forEach(member => {
          userMap.set(member.username, {
            username: member.username,
            name: member.name || member.username,
            role: member.role || ""
          });
        });
      }
      
      if (currentProject.workers_info && Array.isArray(currentProject.workers_info)) {
        currentProject.workers_info.forEach(worker => {
          userMap.set(worker.username, {
            username: worker.username,
            name: worker.name || worker.username,
            role: worker.role || ""
          });
        });
      }
      
      if (currentProject.vfx_supervisors_info && Array.isArray(currentProject.vfx_supervisors_info)) {
        currentProject.vfx_supervisors_info.forEach(vfx => {
          userMap.set(vfx.username, {
            username: vfx.username,
            name: vfx.name || vfx.username,
            role: vfx.role || ""
          });
        });
      }
      
      // Add owner if exists
      if (currentProject.owner) {
        if (!userMap.has(currentProject.owner)) {
          // Try to get owner info from members_info
          const ownerInfo = currentProject.members_info?.find(m => m.username === currentProject.owner);
          if (ownerInfo) {
            userMap.set(currentProject.owner, {
              username: ownerInfo.username,
              name: ownerInfo.name || ownerInfo.username,
              role: ownerInfo.role || ""
            });
          } else {
            // Fallback: fetch owner info
            try {
              const userResponse = await apiFetch(`${API_BASE_URL}/api/users/${currentProject.owner}`);
              if (userResponse.ok) {
                const userResult = await userResponse.json();
                if (userResult.user) {
                  userMap.set(currentProject.owner, {
                    username: userResult.user.username,
                    name: userResult.user.name || userResult.user.username,
                    role: userResult.user.role || ""
                  });
                }
              }
            } catch (error) {
              console.error(`Error loading owner ${currentProject.owner}:`, error);
            }
          }
        }
      }
      
      // For any usernames not in the map, try to fetch them
      for (const username of allUsernames) {
        if (!userMap.has(username)) {
          try {
            const userResponse = await apiFetch(`${API_BASE_URL}/api/users/${username}`);
            if (userResponse.ok) {
              const userResult = await userResponse.json();
              if (userResult.user) {
                userMap.set(username, {
                  username: userResult.user.username,
                  name: userResult.user.name || userResult.user.username,
                  role: userResult.user.role || ""
                });
              } else {
                // Fallback: add username only
                userMap.set(username, {
                  username: username,
                  name: username,
                  role: ""
                });
              }
            } else {
              // Fallback: add username only
              userMap.set(username, {
                username: username,
                name: username,
                role: ""
              });
            }
          } catch (error) {
            console.error(`Error loading user ${username}:`, error);
            // Still add username if user detail fetch fails
            userMap.set(username, {
              username: username,
              name: username,
              role: ""
            });
          }
        }
      }
      
      // Convert map to array
      userDetails.push(...Array.from(userMap.values()));
      
      projectWorkers = userDetails;
    }
  } catch (error) {
    console.error("Error loading project info:", error);
  }
}

// Load workers assignment
async function loadWorkersAssignment() {
  if (!currentShotId) {
    return;
  }
  
  const container = document.getElementById("workers-assignment-table-container");
  if (!container) {
    return;
  }
  
  try {
    // Load project info first to get workers list
    await loadProjectInfo();
    
    // Get shot data with workers assignment
    const shotResponse = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}`);
    if (!shotResponse.ok) {
      container.innerHTML = '<div class="empty-state">Failed to load workers assignment.</div>';
      return;
    }
    
    const shotResult = await shotResponse.json();
    const shot = shotResult.shot;
    
    // Get workers assignment from shot (if exists)
    const workersAssignment = shot.workers_assignment || {};
    
    // Initialize selected parts from workers assignment
    selectedParts.clear();
    PART_TYPES.forEach(partType => {
      const partKey = partType.toLowerCase().replace(/\s+/g, "_");
      const partData = workersAssignment[partKey] || { enabled: false, workers: [] };
      if (partData.enabled) {
        selectedParts.add(partKey);
      }
    });
    
    // Initialize selected workers from shot (if exists)
    selectedWorkers.clear();
    const shotWorkers = shot.shot_workers || [];
    shotWorkers.forEach(workerUsername => {
      selectedWorkers.add(workerUsername);
    });
    
    // If no shot_workers specified, include all project workers by default
    if (selectedWorkers.size === 0 && projectWorkers.length > 0) {
      projectWorkers.forEach(worker => {
        selectedWorkers.add(worker.username);
      });
    }
    
    // Render selectors first
    renderPartSelector(workersAssignment);
    renderWorkerSelector(workersAssignment);
    
    // Render workers assignment UI
    renderWorkersAssignment(workersAssignment);
    
    // Render assignment summary spreadsheet
    renderAssignmentSummary(workersAssignment);
    
    // Render task descriptions tab (must be after summary to get same worker order)
    renderTaskDescriptions(workersAssignment);
    
    // Setup tab switching (only once)
    const tabContent = document.getElementById("assignment-tab-content");
    if (tabContent && !tabContent.hasAttribute("data-tabs-setup")) {
      setupAssignmentTabs();
      tabContent.setAttribute("data-tabs-setup", "true");
    }
    
    // Setup workers assignment section toggle (only once)
    setupWorkersAssignmentToggle();
    
  } catch (error) {
    console.error("Error loading workers assignment:", error);
    const container = document.getElementById("workers-assignment-table-container");
    if (container) {
      container.innerHTML = '<div class="empty-state">Error loading workers assignment.</div>';
    }
  }
}

// Render part selector list
function renderPartSelector(workersAssignment) {
  const selectorList = document.getElementById("part-selector-list");
  if (!selectorList) {
    return;
  }
  
  selectorList.innerHTML = "";
  
  PART_TYPES.forEach(partType => {
    const partKey = partType.toLowerCase().replace(/\s+/g, "_");
    const partData = workersAssignment[partKey] || { enabled: false, workers: [] };
    const isSelected = selectedParts.has(partKey);
    
    const partItem = document.createElement("label");
    partItem.className = "part-selector-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = partKey;
    checkbox.checked = isSelected;
    checkbox.setAttribute("data-part", partKey);
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation(); // Prevent dropdown from closing
      const checked = e.target.checked;
      if (checked) {
        selectedParts.add(partKey);
      } else {
        selectedParts.delete(partKey);
      }
      // Update workers assignment data
      handlePartToggle(partKey, checked);
      // Update button text
      updatePartSelectorButton();
    });
    
    const partLabel = document.createElement("span");
    partLabel.className = "part-selector-label-text";
    partLabel.textContent = partType;
    
    partItem.appendChild(checkbox);
    partItem.appendChild(partLabel);
    
    selectorList.appendChild(partItem);
  });
  
  // Update button text
  updatePartSelectorButton();
  
  // Setup button click handler (only once)
  const button = document.getElementById("part-selector-button");
  const dropdown = document.getElementById("part-selector-dropdown");
  
  if (button && dropdown && !button.hasAttribute("data-listener-attached")) {
    button.setAttribute("data-listener-attached", "true");
    
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display !== "none";
      dropdown.style.display = isVisible ? "none" : "block";
      
      // Update arrow
      const arrow = button.querySelector(".part-selector-button-arrow");
      if (arrow) {
        arrow.textContent = isVisible ? "▼" : "▲";
      }
    });
    
    // Close dropdown when clicking outside (only attach once)
    if (!dropdownClickListenerAttached) {
      dropdownClickListenerAttached = true;
      document.addEventListener("click", (e) => {
        const partButton = document.getElementById("part-selector-button");
        const partDropdown = document.getElementById("part-selector-dropdown");
        const workerButton = document.getElementById("worker-selector-button");
        const workerDropdown = document.getElementById("worker-selector-dropdown");
        
        if (partButton && partDropdown && !partButton.contains(e.target) && !partDropdown.contains(e.target)) {
          partDropdown.style.display = "none";
          const arrow = partButton.querySelector(".part-selector-button-arrow");
          if (arrow) {
            arrow.textContent = "▼";
          }
        }
        
        if (workerButton && workerDropdown && !workerButton.contains(e.target) && !workerDropdown.contains(e.target)) {
          workerDropdown.style.display = "none";
          const arrow = workerButton.querySelector(".part-selector-button-arrow");
          if (arrow) {
            arrow.textContent = "▼";
          }
        }
      });
    }
  }
}

// Render worker selector list
function renderWorkerSelector(workersAssignment) {
  const selectorList = document.getElementById("worker-selector-list");
  if (!selectorList) {
    return;
  }
  
  if (projectWorkers.length === 0) {
    selectorList.innerHTML = '<div class="empty-state">No workers in this project.</div>';
    return;
  }
  
  selectorList.innerHTML = "";
  
  projectWorkers.forEach(worker => {
    const workerUsername = worker.username;
    const isSelected = selectedWorkers.has(workerUsername);
    
    const workerItem = document.createElement("label");
    workerItem.className = "part-selector-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = workerUsername;
    checkbox.checked = isSelected;
    checkbox.setAttribute("data-worker", workerUsername);
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation(); // Prevent dropdown from closing
      const checked = e.target.checked;
      if (checked) {
        selectedWorkers.add(workerUsername);
      } else {
        selectedWorkers.delete(workerUsername);
      }
      // Update workers assignment data and save
      saveShotWorkers();
      // Re-render assignment table and summary
      renderWorkersAssignment(workersAssignment);
      renderAssignmentSummary(workersAssignment);
      renderTaskDescriptions(workersAssignment);
      // Update button text
      updateWorkerSelectorButton();
    });
    
    const workerLabel = document.createElement("span");
    workerLabel.className = "part-selector-label-text";
    workerLabel.textContent = worker.name || worker.username;
    
    workerItem.appendChild(checkbox);
    workerItem.appendChild(workerLabel);
    
    selectorList.appendChild(workerItem);
  });
  
  // Update button text
  updateWorkerSelectorButton();
  
  // Setup button click handler (only once)
  const button = document.getElementById("worker-selector-button");
  const dropdown = document.getElementById("worker-selector-dropdown");
  
  if (button && dropdown && !button.hasAttribute("data-listener-attached")) {
    button.setAttribute("data-listener-attached", "true");
    
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display !== "none";
      dropdown.style.display = isVisible ? "none" : "block";
      
      // Update arrow
      const arrow = button.querySelector(".part-selector-button-arrow");
      if (arrow) {
        arrow.textContent = isVisible ? "▼" : "▲";
      }
    });
  }
}

// Update worker selector button text
function updateWorkerSelectorButton() {
  const button = document.getElementById("worker-selector-button");
  if (!button) return;
  
  const buttonText = button.querySelector(".part-selector-button-text");
  if (!buttonText) return;
  
  const selectedCount = selectedWorkers.size;
  if (selectedCount === 0) {
    buttonText.textContent = "Select Workers";
  } else if (selectedCount === projectWorkers.length) {
    buttonText.textContent = "All Workers Selected";
  } else {
    buttonText.textContent = `${selectedCount} Worker${selectedCount > 1 ? 's' : ''} Selected`;
  }
}

// Save shot workers to backend
async function saveShotWorkers() {
  if (!currentShotId) {
    return;
  }
  
  try {
    const shotWorkers = Array.from(selectedWorkers);
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/workers`, {
      method: "PUT",
      body: JSON.stringify({
        shot_workers: shotWorkers
      })
    });
    
    if (!response.ok) {
      console.error("Failed to save shot workers");
    }
  } catch (error) {
    console.error("Error saving shot workers:", error);
  }
}

// Update part selector button text
function updatePartSelectorButton() {
  const button = document.getElementById("part-selector-button");
  if (!button) return;
  
  const buttonText = button.querySelector(".part-selector-button-text");
  if (!buttonText) return;
  
  const selectedCount = selectedParts.size;
  if (selectedCount === 0) {
    buttonText.textContent = "Select Parts";
  } else if (selectedCount === PART_TYPES.length) {
    buttonText.textContent = "All Parts Selected";
  } else {
    buttonText.textContent = `${selectedCount} Part${selectedCount > 1 ? 's' : ''} Selected`;
  }
}

// Render workers assignment UI (Spreadsheet style)
function renderWorkersAssignment(workersAssignment) {
  const container = document.getElementById("workers-assignment-table-container");
  if (!container) {
    return;
  }
  
  if (projectWorkers.length === 0) {
    container.innerHTML = '<div class="empty-state">No workers in this project.</div>';
    return;
  }
  
  // Create table
  const table = document.createElement("table");
  table.className = "workers-assignment-table";
  
  // Create header row
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  
  // First column: Worker info header
  const workerHeader = document.createElement("th");
  workerHeader.className = "workers-assignment-header workers-assignment-worker-col";
  workerHeader.textContent = "Worker";
  headerRow.appendChild(workerHeader);
  
  // Part type columns (only show selected parts)
  PART_TYPES.forEach(partType => {
    const partKey = partType.toLowerCase().replace(/\s+/g, "_");
    
    // Only show if part is selected
    if (!selectedParts.has(partKey)) {
      return;
    }
    
    const partData = workersAssignment[partKey] || { enabled: true, workers: [] };
    
    const partHeader = document.createElement("th");
    partHeader.className = "workers-assignment-header workers-assignment-part-col";
    
    const partTitle = document.createElement("span");
    partTitle.className = "workers-assignment-part-title";
    partTitle.textContent = partType;
    
    partHeader.appendChild(partTitle);
    partHeader.setAttribute("data-part", partKey);
    headerRow.appendChild(partHeader);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body with worker rows (only show selected workers)
  const tbody = document.createElement("tbody");
  
  const visibleWorkers = projectWorkers.filter(worker => selectedWorkers.has(worker.username));
  
  if (visibleWorkers.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "workers-assignment-row";
    const emptyCell = document.createElement("td");
    emptyCell.className = "workers-assignment-empty-cell";
    emptyCell.colSpan = selectedParts.size + 1; // +1 for worker column
    emptyCell.textContent = "No workers selected. Select workers to assign parts.";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  }
  
  visibleWorkers.forEach(worker => {
    const row = document.createElement("tr");
    row.className = "workers-assignment-row";
    
    // Worker info cell
    const workerCell = document.createElement("td");
    workerCell.className = "workers-assignment-worker-cell";
    
    const workerInfo = document.createElement("div");
    workerInfo.className = "workers-assignment-worker-info";
    
    const workerName = document.createElement("div");
    workerName.className = "workers-assignment-worker-name";
    workerName.textContent = worker.name || worker.username;
    
    workerInfo.appendChild(workerName);
    
    if (worker.role) {
      const workerRole = document.createElement("div");
      workerRole.className = "workers-assignment-worker-role";
      workerRole.textContent = worker.role;
      workerInfo.appendChild(workerRole);
    }
    
    workerCell.appendChild(workerInfo);
    row.appendChild(workerCell);
    
    // Part cells with checkboxes (only show selected parts)
    PART_TYPES.forEach(partType => {
      const partKey = partType.toLowerCase().replace(/\s+/g, "_");
      
      // Only show if part is selected
      if (!selectedParts.has(partKey)) {
        return;
      }
      
      const partData = workersAssignment[partKey] || { enabled: true, workers: [] };
      
      const partCell = document.createElement("td");
      partCell.className = "workers-assignment-part-cell";
      
      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "workers-assignment-cell-checkbox";
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = worker.username;
      checkbox.checked = partData.workers && partData.workers.includes(worker.username);
      checkbox.setAttribute("data-part", partKey);
      checkbox.setAttribute("data-worker", worker.username);
      checkbox.addEventListener("change", () => {
        handleWorkerSelection(partKey, worker.username, checkbox.checked);
      });
      
      checkboxLabel.appendChild(checkbox);
      partCell.appendChild(checkboxLabel);
      
      row.appendChild(partCell);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  container.innerHTML = "";
  container.appendChild(table);
}

// Render assignment summary (shows worker | parts format)
function renderAssignmentSummary(workersAssignment) {
  const container = document.getElementById("workers-assignment-summary-container");
  if (!container) {
    return;
  }
  
  // Filter to only selected workers
  const visibleWorkers = projectWorkers.filter(worker => selectedWorkers.has(worker.username));
  
  if (visibleWorkers.length === 0) {
    container.innerHTML = '<div class="empty-state">No workers selected. Select workers to see assignment summary.</div>';
    return;
  }
  
  // Build worker to parts mapping
  const workerPartsMap = new Map();
  
  // Initialize selected workers with empty arrays
  visibleWorkers.forEach(worker => {
    workerPartsMap.set(worker.username, []);
  });
  
  // Collect parts for each worker
  PART_TYPES.forEach(partType => {
    const partKey = partType.toLowerCase().replace(/\s+/g, "_");
    const partData = workersAssignment[partKey] || { enabled: false, workers: [] };
    
    // Only include enabled parts
    if (selectedParts.has(partKey) && partData.enabled && partData.workers) {
      partData.workers.forEach(username => {
        if (workerPartsMap.has(username)) {
          workerPartsMap.get(username).push(partType);
        }
      });
    }
  });
  
  // Create summary list
  const summaryList = document.createElement("div");
  summaryList.className = "assignment-summary-list";
  
  // Sort visible workers by name
  const sortedWorkers = [...visibleWorkers].sort((a, b) => {
    const nameA = (a.name || a.username).toLowerCase();
    const nameB = (b.name || b.username).toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  sortedWorkers.forEach(worker => {
    const workerParts = workerPartsMap.get(worker.username) || [];
    
    const summaryItem = document.createElement("div");
    summaryItem.className = "assignment-summary-item";
    
    const workerName = document.createElement("span");
    workerName.className = "assignment-summary-worker-name";
    workerName.textContent = worker.name || worker.username;
    
    const separator = document.createElement("span");
    separator.className = "assignment-summary-separator";
    separator.textContent = " | ";
    
    const partsList = document.createElement("span");
    partsList.className = "assignment-summary-parts";
    
    if (workerParts.length === 0) {
      partsList.textContent = "No assignments";
      partsList.classList.add("no-assignments");
    } else {
      partsList.textContent = workerParts.join(", ");
    }
    
    summaryItem.appendChild(workerName);
    summaryItem.appendChild(separator);
    summaryItem.appendChild(partsList);
    
    summaryList.appendChild(summaryItem);
  });
  
  container.innerHTML = "";
  container.appendChild(summaryList);
}

// Handle part toggle
function handlePartToggle(partKey, enabled) {
  // Save assignment data first
  saveWorkersAssignment().then(() => {
    // Reload to update table with selected parts and summary
    loadWorkersAssignment();
  });
}

// Render task descriptions tab (same worker order and style as summary)
function renderTaskDescriptions(workersAssignment) {
  const container = document.getElementById("workers-assignment-tasks-container");
  if (!container) {
    return;
  }
  
  // Filter to only selected workers
  const visibleWorkers = projectWorkers.filter(worker => selectedWorkers.has(worker.username));
  
  if (visibleWorkers.length === 0) {
    container.innerHTML = '<div class="empty-state">No workers selected. Select workers to see task descriptions.</div>';
    return;
  }
  
  // Build worker to parts mapping (same as summary)
  const workerPartsMap = new Map();
  
  // Initialize selected workers with empty arrays
  visibleWorkers.forEach(worker => {
    workerPartsMap.set(worker.username, []);
  });
  
  // Collect parts for each worker (same logic as summary)
  PART_TYPES.forEach(partType => {
    const partKey = partType.toLowerCase().replace(/\s+/g, "_");
    const partData = workersAssignment[partKey] || { enabled: false, workers: [] };
    
    // Only include enabled parts
    if (selectedParts.has(partKey) && partData.enabled && partData.workers) {
      partData.workers.forEach(username => {
        if (workerPartsMap.has(username)) {
          workerPartsMap.get(username).push(partType);
        }
      });
    }
  });
  
  // Create summary list (same structure as Assignment Summary)
  const summaryList = document.createElement("div");
  summaryList.className = "assignment-summary-list";
  
  // Sort visible workers by name (same order as summary)
  const sortedWorkers = [...visibleWorkers].sort((a, b) => {
    const nameA = (a.name || a.username).toLowerCase();
    const nameB = (b.name || b.username).toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  sortedWorkers.forEach(worker => {
    const workerParts = workerPartsMap.get(worker.username) || [];
    
    const summaryItem = document.createElement("div");
    summaryItem.className = "assignment-summary-item";
    
    // Left side: Worker name only (no parts in Task Descriptions)
    const leftSection = document.createElement("div");
    leftSection.className = "assignment-summary-left";
    
    const workerName = document.createElement("span");
    workerName.className = "assignment-summary-worker-name";
    workerName.textContent = worker.name || worker.username;
    
    leftSection.appendChild(workerName);
    
    // Right side: Task description input
    const rightSection = document.createElement("div");
    rightSection.className = "assignment-summary-right";
    
    const taskInput = document.createElement("input");
    taskInput.type = "text";
    taskInput.className = "assignment-task-input";
    taskInput.placeholder = "Enter task description...";
    taskInput.value = getWorkerTask(worker.username, workersAssignment) || "";
    taskInput.setAttribute("data-worker", worker.username);
    
    // Save task on blur or Enter key
    taskInput.addEventListener("blur", () => {
      saveWorkerTask(worker.username, taskInput.value);
    });
    
    taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        taskInput.blur();
      }
    });
    
    rightSection.appendChild(taskInput);
    
    summaryItem.appendChild(leftSection);
    summaryItem.appendChild(rightSection);
    
    summaryList.appendChild(summaryItem);
  });
  
  container.innerHTML = "";
  container.appendChild(summaryList);
}

// Setup tab switching
function setupAssignmentTabs() {
  const tabs = document.querySelectorAll(".assignment-tab");
  const panels = document.querySelectorAll(".assignment-tab-panel");
  
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.getAttribute("data-tab");
      
      // Remove active class from all tabs and panels
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => {
        p.classList.remove("active");
        p.style.display = "none";
      });
      
      // Add active class to clicked tab
      tab.classList.add("active");
      
      // Show corresponding panel
      if (targetTab === "summary") {
        const summaryPanel = document.getElementById("workers-assignment-summary-container");
        if (summaryPanel) {
          summaryPanel.classList.add("active");
          summaryPanel.style.display = "block";
        }
      } else if (targetTab === "tasks") {
        const tasksPanel = document.getElementById("workers-assignment-tasks-container");
        if (tasksPanel) {
          tasksPanel.classList.add("active");
          tasksPanel.style.display = "block";
        }
      }
    });
  });
}

// Setup workers assignment section toggle
function setupWorkersAssignmentToggle() {
  const toggleBtn = document.getElementById("workers-assignment-toggle");
  const content = document.getElementById("workers-assignment-content");
  
  if (!toggleBtn || !content) {
    return;
  }
  
  // Check if already set up
  if (toggleBtn.hasAttribute("data-listener-attached")) {
    return;
  }
  
  toggleBtn.setAttribute("data-listener-attached", "true");
  
  toggleBtn.addEventListener("click", () => {
    const isVisible = content.style.display !== "none";
    const icon = toggleBtn.querySelector(".toggle-icon");
    
    if (isVisible) {
      content.style.display = "none";
      if (icon) {
        icon.textContent = "▶";
      }
    } else {
      content.style.display = "block";
      if (icon) {
        icon.textContent = "▼";
      }
    }
  });
}

// Get worker task description
function getWorkerTask(username, workersAssignment) {
  if (!workersAssignment.worker_tasks) {
    return "";
  }
  return workersAssignment.worker_tasks[username] || "";
}

// Save worker task description
async function saveWorkerTask(username, taskDescription) {
  if (!currentShotId) {
    return;
  }
  
  try {
    // Get current workers assignment
    const shotResponse = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}`);
    if (!shotResponse.ok) {
      console.error("Failed to load shot data");
      return;
    }
    
    const shotResult = await shotResponse.json();
    const shot = shotResult.shot;
    const workersAssignment = shot.workers_assignment || {};
    
    // Initialize worker_tasks if it doesn't exist
    if (!workersAssignment.worker_tasks) {
      workersAssignment.worker_tasks = {};
    }
    
    // Update task for this worker
    if (taskDescription.trim()) {
      workersAssignment.worker_tasks[username] = taskDescription.trim();
    } else {
      // Remove task if empty
      delete workersAssignment.worker_tasks[username];
    }
    
    // Save updated workers assignment
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/workers-assignment`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workers_assignment: workersAssignment
      }),
    });
    
    if (!response.ok) {
      const result = await response.json();
      console.error("Failed to save worker task:", result.error);
    }
    
  } catch (error) {
    console.error("Error saving worker task:", error);
  }
}

// Handle worker selection
function handleWorkerSelection(partKey, username, selected) {
  // Update shot data
  saveWorkersAssignment().then(() => {
    // Reload assignment summary
    loadWorkersAssignment();
  });
}

// Save workers assignment
async function saveWorkersAssignment() {
  if (!currentShotId) {
    return;
  }
  
  try {
    // Collect all part assignments from table
    const workersAssignment = {};
    
    PART_TYPES.forEach(partType => {
      const partKey = partType.toLowerCase().replace(/\s+/g, "_");
      const partHeader = document.querySelector(`th[data-part="${partKey}"]`);
      
      // Check if part is selected (enabled) from selectedParts set
      const enabled = selectedParts.has(partKey);
      
      const selectedWorkers = [];
      if (enabled) {
        const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-part="${partKey}"][data-worker]:checked`);
        checkboxes.forEach(checkbox => {
          if (checkbox.value && checkbox.hasAttribute("data-worker")) {
            selectedWorkers.push(checkbox.value);
          }
        });
      }
      
      workersAssignment[partKey] = {
        enabled: enabled,
        workers: selectedWorkers
      };
    });
    
    // Save to backend
    const response = await apiFetch(`${API_BASE_URL}/api/shot/${currentShotId}/workers-assignment`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workers_assignment: workersAssignment
      }),
    });
    
    if (!response.ok) {
      const result = await response.json();
      console.error("Failed to save workers assignment:", result.error);
      // Don't show alert, just log the error
    }
    
  } catch (error) {
    console.error("Error saving workers assignment:", error);
  }
}

// Display username
function displayUserInfo(username) {
  const usernameDisplay = document.getElementById("username-display");
  if (usernameDisplay) {
    usernameDisplay.textContent = username;
  }
}

// Logout function
function handleLogout() {
  localStorage.removeItem("qepipeline_logged_in");
  localStorage.removeItem("qepipeline_username");
  window.location.href = "index.html";
}

// Load notifications
async function loadNotifications(username) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/partner-requests?username=${encodeURIComponent(username)}`);
    
    if (!response.ok) {
      throw new Error("Failed to load notifications");
    }
    
    const result = await response.json();
    const requests = result.requests || [];
    
    // Update badge
    const badge = document.getElementById("notification-badge");
    if (badge) {
      if (requests.length > 0) {
        badge.textContent = requests.length > 99 ? "99+" : requests.length;
        badge.style.display = "block";
      } else {
        badge.style.display = "none";
      }
    }
    
    // Update notification list
    const notificationList = document.getElementById("notification-list");
    if (notificationList) {
      if (requests.length === 0) {
        notificationList.innerHTML = '<div class="empty-notifications">No new notifications</div>';
      } else {
        notificationList.innerHTML = requests.map(request => {
          const fromUsername = request.from_username || request.from;
          return `
            <div class="notification-item">
              <div class="notification-content">
                <strong>${escapeHtml(fromUsername)}</strong> wants to be your partner
              </div>
              <div class="notification-actions">
                <button class="notification-action-btn accept" onclick="handlePartnerRequest('${fromUsername}', 'accept')">Accept</button>
                <button class="notification-action-btn reject" onclick="handlePartnerRequest('${fromUsername}', 'reject')">Reject</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
    
  } catch (error) {
    console.error("Error loading notifications:", error);
    const notificationList = document.getElementById("notification-list");
    if (notificationList) {
      notificationList.innerHTML = '<div class="empty-notifications">Failed to load notifications</div>';
    }
  }
}

// Handle partner request (accept/reject)
async function handlePartnerRequest(fromUsername, action) {
  try {
    const username = localStorage.getItem("qepipeline_username");
    if (!username) return;
    
    const response = await apiFetch(`${API_BASE_URL}/api/partner-request/${action}`, {
      method: "POST",
      body: JSON.stringify({
        from_username: fromUsername,
        to_username: username
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to handle partner request");
    }
    
    // Reload notifications
    loadNotifications(username);
    
  } catch (error) {
    console.error("Error handling partner request:", error);
    alert("Failed to handle partner request. Please try again.");
  }
}

// Open notification dropdown
function openNotificationDropdown(username) {
  const dropdown = document.getElementById("notification-dropdown");
  if (dropdown) {
    dropdown.style.display = "block";
    loadNotifications(username);
  }
}

// Close notification dropdown
function closeNotificationDropdown() {
  const dropdown = document.getElementById("notification-dropdown");
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

// Update the DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", () => {
  initShot();
  
  // Update user activity on page load and periodically
  const username = checkAuth();
  if (username) {
    // Display user info
    displayUserInfo(username);
    
    // Load notifications
    loadNotifications(username);
    
    // Update notifications periodically
    setInterval(() => {
      loadNotifications(username);
    }, 30000); // Every 30 seconds
    
    updateUserActivity();
    // Update activity every 2 minutes
    setInterval(updateUserActivity, 120000);
  }
  
  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
  
  // Notification button
  const notificationBtn = document.getElementById("notification-btn");
  const notificationDropdown = document.getElementById("notification-dropdown");
  const closeNotificationsBtn = document.getElementById("close-notifications");
  
  if (notificationBtn && notificationDropdown) {
    notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = notificationDropdown.style.display !== "none";
      if (isVisible) {
        closeNotificationDropdown();
      } else {
        openNotificationDropdown(username);
      }
    });
  }
  
  if (closeNotificationsBtn) {
    closeNotificationsBtn.addEventListener("click", () => {
      closeNotificationDropdown();
    });
  }
  
  // Close notification dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (notificationDropdown && 
        !notificationDropdown.contains(e.target) && 
        !notificationBtn?.contains(e.target) &&
        notificationDropdown.style.display !== "none") {
      closeNotificationDropdown();
    }
  });
});


