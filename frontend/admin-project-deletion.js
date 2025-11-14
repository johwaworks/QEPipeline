const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";

let adminUsername = "";
let adminPassword = "";

// Check if user is already logged in as admin
function checkLoggedInAdmin() {
  const loggedIn = localStorage.getItem("qepipeline_logged_in");
  const username = localStorage.getItem("qepipeline_username");
  
  if (loggedIn && username) {
    adminUsername = username;
    
    // Check if user is admin by fetching profile
    fetch(`${API_BASE_URL}/api/profile?username=${encodeURIComponent(username)}`)
      .then(response => response.json())
      .then(result => {
        if (result.profile && result.profile.is_admin) {
          // User is admin, but we need password to access admin functions
          const loginForm = document.getElementById("admin-login-form");
          const pendingSection = document.getElementById("pending-deletions");
          
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
          window.location.href = "index.html";
        }
      })
      .catch(error => {
        console.error("Error checking admin status:", error);
        const loginForm = document.getElementById("admin-login-form");
        if (loginForm) {
          loginForm.style.display = "block";
        }
      });
  } else {
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
  const pendingSection = document.getElementById("pending-deletions");

  adminUsername = document.getElementById("admin-username").value.trim();
  adminPassword = document.getElementById("admin-password").value;

  if (!adminUsername || !adminPassword) {
    setStatus(statusEl, "Please enter admin credentials.", "error");
    return;
  }

  setStatus(statusEl, "Verifying admin access...");

  try {
    // Test admin credentials by fetching pending deletions
    const response = await fetch(
      `${API_BASE_URL}/api/admin/pending-deletions?username=${encodeURIComponent(adminUsername)}&password=${encodeURIComponent(adminPassword)}`
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid admin credentials");
      }
      throw new Error("Failed to verify admin access");
    }

    const result = await response.json();
    
    // Hide login form and show pending deletions
    if (loginForm) {
      loginForm.style.display = "none";
    }
    if (pendingSection) {
      pendingSection.style.display = "block";
    }
    
    loadPendingDeletions();
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Admin login error:", error);
  }
}

async function loadPendingDeletions() {
  const deletionsContent = document.getElementById("deletions-list-content");

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/pending-deletions?username=${encodeURIComponent(adminUsername)}&password=${encodeURIComponent(adminPassword)}`
    );

    if (!response.ok) {
      throw new Error("Failed to load pending deletions");
    }

    const result = await response.json();
    const deletions = result.deletions || [];

    if (deletions.length === 0) {
      deletionsContent.innerHTML = '<div class="empty-pending">No pending deletion requests</div>';
      return;
    }

    deletionsContent.innerHTML = deletions.map(del => `
      <div class="pending-item" data-project-id="${escapeHtml(del.project_id)}">
        <div class="pending-item-header">
          <div>
            <div class="pending-item-name">${escapeHtml(del.project_name || 'Unknown Project')}</div>
            <div class="pending-item-username">Requested by: ${escapeHtml(del.requested_by)}</div>
          </div>
        </div>
        <div class="pending-item-details">
          <div><strong>Project Name:</strong> ${escapeHtml(del.project_name || 'Unknown Project')}</div>
          <div><strong>Project ID:</strong> ${escapeHtml(del.project_id)}</div>
          <div><strong>Requested:</strong> ${formatDate(del.created_at)}</div>
        </div>
        <div class="pending-item-actions">
          <button class="pending-btn approve" onclick="approveDeletion('${escapeHtml(del.project_id)}')">Approve & Delete</button>
          <button class="pending-btn reject" onclick="rejectDeletion('${escapeHtml(del.project_id)}')">Reject</button>
        </div>
      </div>
    `).join("");

  } catch (error) {
    deletionsContent.innerHTML = `<div class="empty-pending">Error: ${error.message}</div>`;
    console.error("Load pending deletions error:", error);
  }
}

async function approveDeletion(projectId) {
  // Get project name from the item
  const item = document.querySelector(`[data-project-id="${escapeHtml(projectId)}"]`);
  const projectName = item ? item.querySelector('.pending-item-name').textContent : 'this project';
  
  if (!confirm(`Are you sure you want to approve and delete "${projectName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/approve-deletion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_username: adminUsername,
        admin_password: adminPassword,
        project_id: projectId,
        approve: true
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to approve deletion");
    }

    // Remove the item from the list
    if (item) {
      item.remove();
    }

    // Reload list
    loadPendingDeletions();

    alert(`Project "${projectName}" deletion approved and project deleted successfully!`);
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error("Approve deletion error:", error);
  }
}

async function rejectDeletion(projectId) {
  // Get project name from the item
  const item = document.querySelector(`[data-project-id="${escapeHtml(projectId)}"]`);
  const projectName = item ? item.querySelector('.pending-item-name').textContent : 'this project';
  
  if (!confirm(`Are you sure you want to reject the deletion request for "${projectName}"?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/approve-deletion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_username: adminUsername,
        admin_password: adminPassword,
        project_id: projectId,
        approve: false
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to reject deletion");
    }

    // Remove the item from the list
    if (item) {
      item.remove();
    }

    // Reload list
    loadPendingDeletions();

    alert(`Deletion request for "${projectName}" has been rejected.`);
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error("Reject deletion error:", error);
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
window.approveDeletion = approveDeletion;
window.rejectDeletion = rejectDeletion;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkLoggedInAdmin();
  
  const adminLoginForm = document.getElementById("admin-login-form");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", handleAdminLogin);
  }
});

