const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";

// Helper function to make API requests with ngrok headers
async function apiFetch(url, options = {}) {
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

let adminUsername = "";
let adminPassword = "";

// Check if user is already logged in as admin
function checkLoggedInAdmin() {
  const loggedIn = localStorage.getItem("qepipeline_logged_in");
  const username = localStorage.getItem("qepipeline_username");
  
  if (loggedIn && username) {
    // Try to use logged in credentials
    adminUsername = username;
    
    // Check if user is admin by fetching profile
    fetch(`${API_BASE_URL}/api/profile?username=${encodeURIComponent(username)}`)
      .then(response => response.json())
      .then(result => {
        if (result.profile && result.profile.is_admin) {
          // User is admin, but we need password to access admin functions
          // Show login form but pre-fill username
          const loginForm = document.getElementById("admin-login-form");
          const pendingSection = document.getElementById("pending-registrations");
          
          if (loginForm) {
            loginForm.style.display = "block";
            const usernameInput = document.getElementById("admin-username");
            if (usernameInput) {
              usernameInput.value = username;
            }
          }
          
          if (pendingSection) {
            pendingSection.style.display = "none";
          }
        } else {
          // Not admin, redirect to login
          window.location.href = "index.html";
        }
      })
      .catch(error => {
        console.error("Error checking admin status:", error);
        // Show login form
        const loginForm = document.getElementById("admin-login-form");
        if (loginForm) {
          loginForm.style.display = "block";
        }
      });
  } else {
    // Not logged in, show login form
    const loginForm = document.getElementById("admin-login-form");
    if (loginForm) {
      loginForm.style.display = "block";
    }
  }
}

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.classList.remove("error", "success");
  if (type) {
    element.classList.add(type);
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const statusEl = document.getElementById("admin-login-status");
  const loginForm = document.getElementById("admin-login-form");
  const pendingSection = document.getElementById("pending-registrations");

  adminUsername = document.getElementById("admin-username").value.trim();
  adminPassword = document.getElementById("admin-password").value;

  if (!adminUsername || !adminPassword) {
    setStatus(statusEl, "Please enter admin credentials.", "error");
    return;
  }

  setStatus(statusEl, "Verifying admin access...");

  try {
    // Test admin credentials by fetching pending registrations
    const response = await apiFetch(
      `${API_BASE_URL}/api/admin/pending?username=${encodeURIComponent(adminUsername)}&password=${encodeURIComponent(adminPassword)}`
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid admin credentials");
      }
      throw new Error("Failed to verify admin access");
    }

    const result = await response.json();
    
    // Hide login form and show pending registrations
    if (loginForm) {
      loginForm.style.display = "none";
    }
    if (pendingSection) {
      pendingSection.style.display = "block";
    }
    
    loadPendingRegistrations();
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Admin login error:", error);
  }
}

async function loadPendingRegistrations() {
  const pendingContent = document.getElementById("pending-list-content");

  try {
    const response = await apiFetch(
      `${API_BASE_URL}/api/admin/pending?username=${encodeURIComponent(adminUsername)}&password=${encodeURIComponent(adminPassword)}`
    );

    if (!response.ok) {
      throw new Error("Failed to load pending registrations");
    }

    const result = await response.json();
    const pending = result.pending || [];

    if (pending.length === 0) {
      pendingContent.innerHTML = '<div class="empty-pending">No pending registrations</div>';
      return;
    }

    pendingContent.innerHTML = pending.map(reg => `
      <div class="pending-item" data-username="${escapeHtml(reg.username)}">
        <div class="pending-item-header">
          <div>
            <div class="pending-item-name">${escapeHtml(reg.name || "N/A")}</div>
            <div class="pending-item-username">@${escapeHtml(reg.username)}</div>
          </div>
        </div>
        <div class="pending-item-details">
          <div><strong>Role:</strong> ${escapeHtml(reg.role || "N/A")}</div>
          <div><strong>Birthdate:</strong> ${formatDate(reg.birthdate)}</div>
          <div><strong>Requested:</strong> ${formatDate(reg.created_at)}</div>
        </div>
        <div class="pending-item-actions">
          <button class="pending-btn approve" onclick="approveRegistration('${escapeHtml(reg.username)}')">Approve</button>
          <button class="pending-btn reject" onclick="rejectRegistration('${escapeHtml(reg.username)}')">Reject</button>
        </div>
      </div>
    `).join("");

  } catch (error) {
    pendingContent.innerHTML = `<div class="empty-pending">Error: ${error.message}</div>`;
    console.error("Load pending error:", error);
  }
}

async function approveRegistration(username) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/admin/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_username: adminUsername,
        admin_password: adminPassword,
        username: username,
        approve: true
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to approve registration");
    }

    // Remove the item from the list
    const item = document.querySelector(`[data-username="${escapeHtml(username)}"]`);
    if (item) {
      item.remove();
    }

    // Reload list
    loadPendingRegistrations();

    alert(`User "${username}" has been approved!`);
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error("Approve error:", error);
  }
}

async function rejectRegistration(username) {
  if (!confirm(`Are you sure you want to reject "${username}"?`)) {
    return;
  }

  try {
    const response = await apiFetch(`${API_BASE_URL}/api/admin/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_username: adminUsername,
        admin_password: adminPassword,
        username: username,
        approve: false
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to reject registration");
    }

    // Remove the item from the list
    const item = document.querySelector(`[data-username="${escapeHtml(username)}"]`);
    if (item) {
      item.remove();
    }

    // Reload list
    loadPendingRegistrations();

    alert(`Registration for "${username}" has been rejected.`);
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error("Reject error:", error);
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions global for onclick handlers
window.approveRegistration = approveRegistration;
window.rejectRegistration = rejectRegistration;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkLoggedInAdmin();
  
  const adminLoginForm = document.getElementById("admin-login-form");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", handleAdminLogin);
  }
});

