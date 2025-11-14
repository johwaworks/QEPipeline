const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";

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

// Display username
function displayUserInfo(username) {
  const usernameDisplay = document.getElementById("username-display");
  if (usernameDisplay) {
    usernameDisplay.textContent = username;
  }
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "Not set";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (e) {
    return dateString;
  }
}

// Load profile
async function loadProfile(username) {
  const profileContent = document.getElementById("profile-content");
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/profile?username=${encodeURIComponent(username)}`);
    
    if (!response.ok && response.status === 0) {
      throw new Error("Cannot connect to backend server. Please make sure the backend is running on http://localhost:5000");
    }
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to load profile");
    }
    
    const profile = result.profile || {};
    
    profileContent.innerHTML = `
      <div class="profile-item">
        <div class="profile-label">Name</div>
        <div class="profile-value">${escapeHtml(profile.name || "Not set")}</div>
      </div>
      
      <div class="profile-item">
        <div class="profile-label">Username</div>
        <div class="profile-value">${escapeHtml(profile.username || "")}</div>
      </div>
      
      <div class="profile-item">
        <div class="profile-label">Role</div>
        <div class="profile-value ${!profile.role ? 'empty' : ''}">${escapeHtml(profile.role || "Not set")}</div>
      </div>
      
      <div class="profile-item">
        <div class="profile-label">Birthdate</div>
        <div class="profile-value ${!profile.birthdate ? 'empty' : ''}">${formatDate(profile.birthdate)}</div>
      </div>
      
      <div class="profile-item">
        <div class="profile-label">Account Type</div>
        <div class="profile-value">${profile.is_admin ? "Administrator" : "User"}</div>
      </div>
      
      <div class="profile-item">
        <div class="profile-label">Member Since</div>
        <div class="profile-value">${formatDate(profile.created_at)}</div>
      </div>
    `;
    
  } catch (error) {
    let errorMessage = error.message;
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      errorMessage = "Cannot connect to server. Please check if the backend is running on http://localhost:5000";
    }
    profileContent.innerHTML = `
      <div class="error">
        <h3>Error</h3>
        <p>${errorMessage}</p>
      </div>
    `;
    console.error("Load profile error:", error);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Logout function
function handleLogout() {
  localStorage.removeItem("qepipeline_logged_in");
  localStorage.removeItem("qepipeline_username");
  window.location.href = "index.html";
}

// Initialize profile page
function initProfile() {
  const username = checkAuth();
  if (!username) return;
  
  displayUserInfo(username);
  loadProfile(username);
  
  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
}

// Run when page loads
document.addEventListener("DOMContentLoaded", initProfile);

