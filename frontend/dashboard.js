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

// Logout function
function handleLogout() {
  localStorage.removeItem("qepipeline_logged_in");
  localStorage.removeItem("qepipeline_username");
  window.location.href = "index.html";
}

// Load projects
async function loadProjects(username) {
  const projectsList = document.getElementById("projects-list");
  
  try {
    // Get projects where user is in workers list
    const response = await apiFetch(`${API_BASE_URL}/api/projects?username=${encodeURIComponent(username)}`);
    
    if (!response.ok && response.status === 0) {
      throw new Error("Cannot connect to backend server. Please make sure the backend is running on http://localhost:5000");
    }
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to load projects");
    }
    
    const projects = result.projects || [];
    
    if (projects.length === 0) {
      projectsList.innerHTML = `
        <div class="empty-state">
          <p>No projects yet.</p>
          <p>Click "+ New Project" to create one.</p>
        </div>
      `;
      return;
    }
    
    projectsList.innerHTML = projects.map(project => {
      const status = project.production_status || project.status || 'Pre-Production';
      const statusClass = status.toLowerCase().replace(/\s+/g, '-');
      
      return `
      <div class="project-item-simple" data-project-id="${project._id}">
        <div class="project-info-left">
          <div class="project-name-simple">${escapeHtml(project.name)}</div>
          ${project.director ? `<div class="project-director-simple">${escapeHtml(project.director)} 감독님</div>` : ''}
        </div>
        <div class="project-status-simple status-badge ${statusClass}">${escapeHtml(status)}</div>
      </div>
    `;
    }).join('');
    
    // Add click handlers to project items
    document.querySelectorAll('.project-item-simple').forEach(item => {
      item.addEventListener('click', () => {
        const projectId = item.getAttribute('data-project-id');
        window.location.href = `project.html?id=${projectId}`;
      });
    });
    
  } catch (error) {
    let errorMessage = error.message;
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      errorMessage = "Cannot connect to server. Please check if the backend is running on http://localhost:5000";
    }
    projectsList.innerHTML = `
      <div class="empty-state">
        <h3>Error</h3>
        <p>${errorMessage}</p>
      </div>
    `;
    console.error("Load projects error:", error);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (e) {
    return dateString;
  }
}

// Get status color
function getStatusColor(status) {
  const statusKey = status.toLowerCase().replace(/\s+/g, '-');
  const colors = {
    'pre-production': 'background: rgba(0, 255, 0, 0.2); color: #00ff00; border-color: #00ff00;',
    'production': 'background: rgba(0, 100, 255, 0.2); color: #0064ff; border-color: #0064ff;',
    'post-production': 'background: rgba(255, 0, 0, 0.2); color: #ff0000; border-color: #ff0000;',
    'finish': 'background: rgba(255, 255, 255, 0.2); color: #ffffff; border-color: #ffffff;'
  };
  return colors[statusKey] || '';
}

// Load users for project creation
async function loadUsers() {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users`);
    if (!response.ok) {
      throw new Error("Failed to load users");
    }
    const result = await response.json();
    return result.users || [];
  } catch (error) {
    console.error("Error loading users:", error);
    return [];
  }
}

// Populate user select containers with checkboxes
async function populateUserSelects() {
  const users = await loadUsers();
  const vfxContainer = document.getElementById("vfx-supervisors-container");
  const membersContainer = document.getElementById("members-container");
  
  // Clear existing content
  if (vfxContainer) {
    vfxContainer.innerHTML = '';
  }
  if (membersContainer) {
    membersContainer.innerHTML = '';
  }
  
  if (users.length === 0) {
    if (vfxContainer) {
      vfxContainer.innerHTML = '<div class="loading">No users available</div>';
    }
    if (membersContainer) {
      membersContainer.innerHTML = '<div class="loading">No users available</div>';
    }
    return;
  }
  
  users.forEach((user, index) => {
    const displayName = user.name ? `${user.name} (${user.username})` : user.username;
    // Use unique IDs with index to prevent any conflicts
    const checkboxIdVfx = `vfx-${user.username}-${index}`;
    const checkboxIdMember = `member-${user.username}-${index}`;
    
    // VFX Supervisors checkbox
    if (vfxContainer) {
      const item = document.createElement('label');
      item.className = 'multi-select-item';
      item.setAttribute('for', checkboxIdVfx);
      item.setAttribute('data-user-id', user.username);
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxIdVfx;
      checkbox.name = 'vfx-supervisor';
      checkbox.value = user.username;
      checkbox.setAttribute('data-user-id', user.username);
      
      const labelText = document.createElement('span');
      labelText.textContent = displayName;
      
      // Update checked state when checkbox changes
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          item.classList.add('checked');
        } else {
          item.classList.remove('checked');
        }
      });
      
      item.appendChild(checkbox);
      item.appendChild(labelText);
      
      if (user.role) {
        const roleSpan = document.createElement('span');
        roleSpan.className = 'user-role';
        roleSpan.textContent = user.role;
        item.appendChild(roleSpan);
      }
      
      vfxContainer.appendChild(item);
    }
    
    // Team Members checkbox
    if (membersContainer) {
      const item = document.createElement('label');
      item.className = 'multi-select-item';
      item.setAttribute('for', checkboxIdMember);
      item.setAttribute('data-user-id', user.username);
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxIdMember;
      checkbox.name = 'member';
      checkbox.value = user.username;
      checkbox.setAttribute('data-user-id', user.username);
      
      const labelText = document.createElement('span');
      labelText.textContent = displayName;
      
      // Update checked state when checkbox changes
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          item.classList.add('checked');
        } else {
          item.classList.remove('checked');
        }
      });
      
      item.appendChild(checkbox);
      item.appendChild(labelText);
      
      if (user.role) {
        const roleSpan = document.createElement('span');
        roleSpan.className = 'user-role';
        roleSpan.textContent = user.role;
        item.appendChild(roleSpan);
      }
      
      membersContainer.appendChild(item);
    }
  });
}

// Open project creation modal
function openProjectModal() {
  const modal = document.getElementById("project-modal");
  if (modal) {
    modal.style.display = "flex";
    populateUserSelects();
    document.getElementById("project-form").reset();
  }
}

// Close project creation modal
function closeProjectModal() {
  const modal = document.getElementById("project-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Handle project creation
async function handleProjectCreation(event) {
  event.preventDefault();
  const statusEl = document.getElementById("project-status-message");
  const username = localStorage.getItem("qepipeline_username");
  
  if (!username) {
    setStatus(statusEl, "You must be logged in to create a project.", "error");
    return;
  }
  
  const name = document.getElementById("project-name").value.trim();
  const director = document.getElementById("project-director").value.trim();
  const deadline = document.getElementById("project-deadline").value;
  const productionStatus = document.getElementById("project-status").value;
  
  // Get selected VFX Supervisors from checkboxes
  const vfxSupervisors = Array.from(document.querySelectorAll('#vfx-supervisors-container input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  
  // Get selected Team Members from checkboxes
  const members = Array.from(document.querySelectorAll('#members-container input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  
  const description = document.getElementById("project-description").value.trim();
  
  if (!name || !director || !deadline || !productionStatus) {
    setStatus(statusEl, "Please fill in all required fields.", "error");
    return;
  }
  
  if (vfxSupervisors.length === 0) {
    setStatus(statusEl, "Please select at least one VFX Supervisor.", "error");
    return;
  }
  
  if (members.length === 0) {
    setStatus(statusEl, "Please select at least one team member.", "error");
    return;
  }
  
  setStatus(statusEl, "Creating project...", "");
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        owner: username,
        director,
        deadline,
        production_status: productionStatus,
        vfx_supervisors: vfxSupervisors,
        members,
        description
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to create project");
    }
    
    setStatus(statusEl, "Project created successfully!", "success");
    
    // Reload projects and close modal after delay
    setTimeout(() => {
      closeProjectModal();
      loadProjects(username);
    }, 1000);
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Create project error:", error);
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

// Check if user is admin
async function checkAdminStatus(username) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/profile?username=${encodeURIComponent(username)}`);
    if (response.ok) {
      const result = await response.json();
      const profile = result.profile;
      const adminLink = document.getElementById("admin-link");
      const adminDeletionLink = document.getElementById("admin-deletion-link");
      if (profile && profile.is_admin) {
        if (adminLink) {
          adminLink.style.display = "block";
        }
        if (adminDeletionLink) {
          adminDeletionLink.style.display = "block";
        }
        console.log("Admin links displayed for:", username);
      } else {
        if (adminLink) {
          adminLink.style.display = "none";
        }
        if (adminDeletionLink) {
          adminDeletionLink.style.display = "none";
        }
      }
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
    // If error, check if username is "admin" as fallback
    const adminLink = document.getElementById("admin-link");
    const adminDeletionLink = document.getElementById("admin-deletion-link");
    if (username.toLowerCase() === "admin") {
      if (adminLink) {
        adminLink.style.display = "block";
      }
      if (adminDeletionLink) {
        adminDeletionLink.style.display = "block";
      }
    }
  }
}

// Initialize dashboard
async function initDashboard() {
  // Initialize time synchronization (non-blocking)
  if (window.TimeSync) {
    try {
      await window.TimeSync.initTimeSync();
    } catch (error) {
      console.error("Time sync initialization failed, continuing without sync:", error);
      // Continue even if time sync fails
    }
  }
  const username = checkAuth();
  if (!username) return;
  
  displayUserInfo(username);
  
  // Show admin links immediately if username is "admin"
  if (username.toLowerCase() === "admin") {
    const adminLink = document.getElementById("admin-link");
    const adminDeletionLink = document.getElementById("admin-deletion-link");
    if (adminLink) {
      adminLink.style.display = "block";
    }
    if (adminDeletionLink) {
      adminDeletionLink.style.display = "block";
    }
    console.log("Admin links shown for admin user");
  }
  
  checkAdminStatus(username);
  loadProjects(username);
  
  // Load partners (with real-time status)
  loadPartners(username);
  
  // Load partner requests (no longer needed, using notifications instead)
  // loadPartnerRequests(username);
  
  // Load notifications
  loadNotifications(username);
  
  // Update notifications periodically
  setInterval(() => {
    loadNotifications(username);
  }, 30000); // Every 30 seconds
  
  // Update user activity on page load
  updateUserActivity();
  
  // Update user activity periodically (every 2 minutes)
  setInterval(() => {
    updateUserActivity();
  }, 120000); // 2 minutes
  
  // Refresh partners list with real-time status periodically (every 30 seconds)
  setInterval(() => {
    loadPartners(username);
  }, 30000); // 30 seconds
  
  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
  
  // New project button
  const newProjectBtn = document.getElementById("new-project-btn");
  if (newProjectBtn) {
    newProjectBtn.addEventListener("click", openProjectModal);
  }
  
  // Modal close buttons
  const modalClose = document.getElementById("modal-close");
  const cancelBtn = document.getElementById("cancel-project");
  if (modalClose) {
    modalClose.addEventListener("click", closeProjectModal);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeProjectModal);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById("project-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeProjectModal();
      }
    });
  }
  
  // Project form submission
  const projectForm = document.getElementById("project-form");
  if (projectForm) {
    projectForm.addEventListener("submit", handleProjectCreation);
  }
  
  // Partner button
  const addPartnerBtn = document.getElementById("add-partner-btn");
  if (addPartnerBtn) {
    addPartnerBtn.addEventListener("click", openAddPartnerModal);
  }
  
  // Add partner modal close buttons
  const addPartnerModalClose = document.getElementById("add-partner-modal-close");
  const cancelAddPartner = document.getElementById("cancel-add-partner");
  if (addPartnerModalClose) {
    addPartnerModalClose.addEventListener("click", closeAddPartnerModal);
  }
  if (cancelAddPartner) {
    cancelAddPartner.addEventListener("click", closeAddPartnerModal);
  }
  
  // Close add partner modal when clicking outside
  const addPartnerModal = document.getElementById("add-partner-modal");
  if (addPartnerModal) {
    addPartnerModal.addEventListener("click", (e) => {
      if (e.target === addPartnerModal) {
        closeAddPartnerModal();
      }
    });
  }
  
  // Partner search input
  const partnerSearchInput = document.getElementById("partner-search-input");
  if (partnerSearchInput) {
    let searchTimeout;
    partnerSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length < 1) {
        hidePartnerSearchResults();
        return;
      }
      
      searchTimeout = setTimeout(() => {
        searchUsersForPartner(query);
      }, 300);
    });
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
}

// Load active users
async function loadActiveUsers() {
  const activeUsersList = document.getElementById("active-users-list");
  
  if (!activeUsersList) {
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users/active?minutes=5`);
    
    if (!response.ok) {
      throw new Error("Failed to load active users");
    }
    
    const result = await response.json();
    const users = result.users || [];
    
    if (users.length === 0) {
      activeUsersList.innerHTML = `
        <div class="empty-active-users">No active workers</div>
      `;
      return;
    }
    
    activeUsersList.innerHTML = users.map(user => {
      const displayName = user.name || user.username;
      const role = user.role ? `<span class="active-user-role">${escapeHtml(user.role)}</span>` : '';
      return `
        <div class="active-user-item">
          <div class="active-user-name">
            ${escapeHtml(displayName)}
            <span class="active-user-status"></span>
          </div>
          ${role}
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error("Error loading active users:", error);
    activeUsersList.innerHTML = `
      <div class="empty-active-users">Failed to load active workers</div>
    `;
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

// Load partners with real-time activity status
async function loadPartners(username) {
  const partnersList = document.getElementById("partners-list");
  
  if (!partnersList) {
    return;
  }
  
  try {
    // Get partners
    const partnersResponse = await apiFetch(`${API_BASE_URL}/api/users/${username}/partners`);
    
    const currentUsername = localStorage.getItem("qepipeline_username");
    let partners = [];
    
    if (!partnersResponse.ok) {
      if (partnersResponse.status === 404) {
        // No partners yet, but we still need to add current user
        partners = [];
      } else {
        throw new Error("Failed to load partners");
      }
    } else {
      const partnersResult = await partnersResponse.json();
      partners = partnersResult.partners || [];
    }
    
    // Add current user to partners list if not already included
    const currentUserInPartners = partners.some(p => (p.username || p) === currentUsername);
    if (!currentUserInPartners) {
      try {
        // Get current user info
        const userResponse = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}`);
        if (userResponse.ok) {
          const userResult = await userResponse.json();
          const currentUser = userResult.user;
          if (currentUser) {
            partners.unshift({
              username: currentUser.username || currentUsername,
              name: currentUser.name || currentUser.username || currentUsername,
              role: currentUser.role || ""
            });
          } else {
            // If user data is not available, add with username
            partners.unshift({
              username: currentUsername,
              name: currentUsername,
              role: ""
            });
          }
        } else {
          // If API call fails, add with username
          partners.unshift({
            username: currentUsername,
            name: currentUsername,
            role: ""
          });
        }
      } catch (error) {
        console.error("Error loading current user info:", error);
        // If we can't get user info, just add with username
        partners.unshift({
          username: currentUsername,
          name: currentUsername,
          role: ""
        });
      }
    }
    
    if (partners.length === 0) {
      partnersList.innerHTML = `
        <div class="empty-partners">No partners yet. Click "+" to add one.</div>
      `;
      return;
    }
    
    // Get active users to check partner status
    let activeUsers = [];
    try {
      const activeResponse = await fetch(`${API_BASE_URL}/api/users/active?minutes=5`);
      if (activeResponse.ok) {
        const activeResult = await activeResponse.json();
        activeUsers = (activeResult.users || []).map(u => u.username);
      }
    } catch (error) {
      console.error("Error loading active users:", error);
    }
    
    partnersList.innerHTML = partners.map(partner => {
      const displayName = partner.name || partner.username;
      const role = partner.role ? `<span class="partner-role">${escapeHtml(partner.role)}</span>` : '';
      const isActive = activeUsers.includes(partner.username);
      const statusIndicator = isActive ? '<span class="partner-status-indicator active" title="Active"></span>' : '<span class="partner-status-indicator" title="Offline"></span>';
      const isCurrentUser = partner.username === currentUsername;
      const userClass = isCurrentUser ? 'partner-current-user' : '';
      
      return `
        <div class="partner-item ${userClass}" data-partner-username="${partner.username}">
          <div class="partner-info">
            <div class="partner-name-row">
              <div class="partner-name">${escapeHtml(displayName)}</div>
              ${isCurrentUser ? '<span class="partner-me-badge">Me</span>' : ''}
              ${statusIndicator}
            </div>
            ${role}
          </div>
          <button class="remove-partner-btn" data-partner-username="${partner.username}" title="Remove partner" ${isCurrentUser ? 'style="display: none;"' : ''}>×</button>
        </div>
      `;
    }).join('');
    
    // Add remove partner event listeners
    document.querySelectorAll('.remove-partner-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const partnerUsername = e.target.getAttribute('data-partner-username');
        if (partnerUsername && confirm(`Remove ${partnerUsername} from partners?`)) {
          await removePartner(username, partnerUsername);
        }
      });
    });
    
  } catch (error) {
    console.error("Error loading partners:", error);
    partnersList.innerHTML = `
      <div class="empty-partners">Failed to load partners.</div>
    `;
  }
}

// Open add partner modal
function openAddPartnerModal() {
  const modal = document.getElementById("add-partner-modal");
  if (modal) {
    modal.style.display = "flex";
    const searchInput = document.getElementById("partner-search-input");
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
      hidePartnerSearchResults();
    }
  }
}

// Close add partner modal
function closeAddPartnerModal() {
  const modal = document.getElementById("add-partner-modal");
  if (modal) {
    modal.style.display = "none";
    const searchInput = document.getElementById("partner-search-input");
    if (searchInput) {
      searchInput.value = "";
    }
    hidePartnerSearchResults();
    const statusMessage = document.getElementById("add-partner-status-message");
    if (statusMessage) {
      statusMessage.textContent = "";
      statusMessage.className = "form-status";
    }
  }
}

// Search users for partner
let allUsersList = [];

async function searchUsersForPartner(query) {
  const searchResults = document.getElementById("partner-search-results");
  if (!searchResults) {
    return;
  }
  
  try {
    // Load all users if not already loaded
    if (allUsersList.length === 0) {
      const response = await apiFetch(`${API_BASE_URL}/api/users`);
      if (!response.ok) {
        throw new Error("Failed to load users");
      }
      const result = await response.json();
      allUsersList = result.users || [];
    }
    
    const currentUsername = localStorage.getItem("qepipeline_username");
    
    // Get current partners and pending requests
    let currentPartners = [];
    let pendingRequests = [];
    try {
      const partnersResponse = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}/partners`);
      if (partnersResponse.ok) {
        const partnersResult = await partnersResponse.json();
        currentPartners = (partnersResult.partners || []).map(p => p.username);
      }
      
      const requestsResponse = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}/partners/requests`);
      if (requestsResponse.ok) {
        const requestsResult = await requestsResponse.json();
        pendingRequests = (requestsResult.requests || []).map(r => r.username);
      }
    } catch (error) {
      console.error("Error loading current partners/requests:", error);
    }
    
    // Filter users: exclude current user, already added partners, and users who already sent requests
    const filteredUsers = allUsersList.filter(user => {
      const username = user.username || user;
      return username.toLowerCase().includes(query.toLowerCase()) &&
             username !== currentUsername &&
             !currentPartners.includes(username) &&
             !pendingRequests.includes(username);
    });
    
    if (filteredUsers.length === 0) {
      searchResults.innerHTML = `
        <div class="partner-search-no-results">No users found matching "${escapeHtml(query)}"</div>
      `;
      searchResults.style.display = "block";
      return;
    }
    
    searchResults.innerHTML = filteredUsers.slice(0, 10).map(user => {
      const username = user.username || user;
      const displayName = user.name || username;
      const role = user.role || "";
      return `
        <div class="partner-search-item" data-username="${escapeHtml(username)}">
          <div class="partner-search-info">
            <div class="partner-search-name">${escapeHtml(displayName)}</div>
            ${role ? `<div class="partner-search-role">${escapeHtml(role)}</div>` : ''}
          </div>
          <button class="add-partner-action-btn" data-username="${escapeHtml(username)}">Add</button>
        </div>
      `;
    }).join('');
    
    searchResults.style.display = "block";
    
    // Add click handlers
    document.querySelectorAll('.partner-search-item, .add-partner-action-btn').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const username = item.getAttribute('data-username') || 
                        item.closest('.partner-search-item')?.getAttribute('data-username');
        if (username) {
          await addPartner(currentUsername, username);
        }
      });
    });
    
  } catch (error) {
    console.error("Error searching users:", error);
    searchResults.innerHTML = `
      <div class="partner-search-error">Error searching users.</div>
    `;
    searchResults.style.display = "block";
  }
}

// Hide partner search results
function hidePartnerSearchResults() {
  const searchResults = document.getElementById("partner-search-results");
  if (searchResults) {
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
  }
}

// Add partner (send request)
async function addPartner(currentUsername, partnerUsername) {
  const statusMessage = document.getElementById("add-partner-status-message");
  
  try {
    setStatus(statusMessage, "Sending partner request...", "info");
    
    const response = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}/partners/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        partner_username: partnerUsername
      }),
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Failed to send partner request");
    }
    
    setStatus(statusMessage, "Partner request sent successfully!", "success");
    
    // Reload partner requests
    setTimeout(async () => {
      closeAddPartnerModal();
      // Clear search results for next time
      allUsersList = [];
    }, 1000);
    
  } catch (error) {
    setStatus(statusMessage, error.message, "error");
    console.error("Error sending partner request:", error);
  }
}

// Remove partner
async function removePartner(currentUsername, partnerUsername) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}/partners/${partnerUsername}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Failed to remove partner");
    }
    
    // Reload partners list
    await loadPartners(currentUsername);
    
  } catch (error) {
    console.error("Error removing partner:", error);
    alert("Failed to remove partner: " + error.message);
  }
}

// Load partner requests
async function loadPartnerRequests(username) {
  const requestsList = document.getElementById("partner-requests-list");
  
  if (!requestsList) {
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${username}/partners/requests`);
    
    if (!response.ok) {
      if (response.status === 404) {
        // No requests yet
        requestsList.innerHTML = `
          <div class="empty-partners">No partner requests.</div>
        `;
        return;
      }
      throw new Error("Failed to load partner requests");
    }
    
    const result = await response.json();
    const requests = result.requests || [];
    
    if (requests.length === 0) {
      requestsList.innerHTML = `
        <div class="empty-partners">No partner requests.</div>
      `;
      return;
    }
    
    requestsList.innerHTML = requests.map(request => {
      const displayName = request.name || request.username;
      const role = request.role ? `<span class="partner-role">${escapeHtml(request.role)}</span>` : '';
      return `
        <div class="partner-request-item" data-requester-username="${request.username}">
          <div class="partner-info">
            <div class="partner-name">${escapeHtml(displayName)}</div>
            ${role}
          </div>
          <div class="partner-request-actions">
            <button class="accept-partner-btn" data-requester-username="${request.username}" title="Accept">✓</button>
            <button class="reject-partner-btn" data-requester-username="${request.username}" title="Reject">×</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add accept/reject event listeners
    document.querySelectorAll('.accept-partner-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const requesterUsername = e.target.getAttribute('data-requester-username');
        if (requesterUsername) {
          await acceptPartnerRequest(username, requesterUsername);
        }
      });
    });
    
    document.querySelectorAll('.reject-partner-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const requesterUsername = e.target.getAttribute('data-requester-username');
        if (requesterUsername && confirm(`Reject partner request from ${requesterUsername}?`)) {
          await rejectPartnerRequest(username, requesterUsername);
        }
      });
    });
    
  } catch (error) {
    console.error("Error loading partner requests:", error);
    requestsList.innerHTML = `
      <div class="empty-partners">Failed to load partner requests.</div>
    `;
  }
}

// Accept partner request
async function acceptPartnerRequest(username, fromUsername) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${username}/partners/requests/${fromUsername}/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Failed to accept partner request");
    }
    
    // Reload partners and notifications
    await loadPartners(username);
    await loadNotifications(username);
    
  } catch (error) {
    console.error("Error accepting partner request:", error);
    alert("Failed to accept partner request: " + error.message);
  }
}

// Reject partner request
async function rejectPartnerRequest(username, fromUsername) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${username}/partners/requests/${fromUsername}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Failed to reject partner request");
    }
    
    // Reload requests and notifications
    await loadNotifications(username);
    
  } catch (error) {
    console.error("Error rejecting partner request:", error);
    alert("Failed to reject partner request: " + error.message);
  }
}

// Load notifications
async function loadNotifications(username) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${username}/partners/requests`);
    
    if (!response.ok) {
      if (response.status === 404) {
        updateNotificationBadge(0);
        const notificationList = document.getElementById("notification-list");
        if (notificationList && notificationList.parentElement.style.display !== "none") {
          notificationList.innerHTML = `
            <div class="empty-notifications">No notifications.</div>
          `;
        }
        return;
      }
      throw new Error("Failed to load notifications");
    }
    
    const result = await response.json();
    const requests = result.requests || [];
    
    // Update badge
    updateNotificationBadge(requests.length);
    
    // Update notification list if dropdown is open
    const notificationDropdown = document.getElementById("notification-dropdown");
    if (notificationDropdown && notificationDropdown.style.display !== "none") {
      renderNotificationList(requests, username);
    }
    
  } catch (error) {
    console.error("Error loading notifications:", error);
    updateNotificationBadge(0);
  }
}

// Update notification badge
function updateNotificationBadge(count) {
  const badge = document.getElementById("notification-badge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
}

// Render notification list
function renderNotificationList(requests, username) {
  const notificationList = document.getElementById("notification-list");
  if (!notificationList) {
    return;
  }
  
  if (requests.length === 0) {
    notificationList.innerHTML = `
      <div class="empty-notifications">No notifications.</div>
    `;
    return;
  }
  
  notificationList.innerHTML = requests.map(request => {
    const displayName = request.name || request.username;
    return `
      <div class="notification-item" data-requester-username="${request.username}">
        <div class="notification-item-content">
          <div class="notification-item-message">
            <span class="notification-item-requester">${escapeHtml(displayName)}</span> wants to be your partner.
          </div>
          <div class="notification-item-actions">
            <button class="notification-action-btn accept-notification-btn" data-requester-username="${request.username}" data-username="${username}">
              Accept
            </button>
            <button class="notification-action-btn reject-notification-btn" data-requester-username="${request.username}" data-username="${username}">
              Reject
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  notificationList.querySelectorAll('.accept-notification-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const requesterUsername = btn.getAttribute('data-requester-username');
      const currentUsername = btn.getAttribute('data-username');
      if (requesterUsername && currentUsername) {
        await acceptPartnerRequest(currentUsername, requesterUsername);
      }
    });
  });
  
  notificationList.querySelectorAll('.reject-notification-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const requesterUsername = btn.getAttribute('data-requester-username');
      const currentUsername = btn.getAttribute('data-username');
      if (requesterUsername && currentUsername) {
        await rejectPartnerRequest(currentUsername, requesterUsername);
      }
    });
  });
}

// Open notification dropdown
function openNotificationDropdown(username) {
  const notificationDropdown = document.getElementById("notification-dropdown");
  if (notificationDropdown) {
    notificationDropdown.style.display = "flex";
    loadNotifications(username);
  }
}

// Close notification dropdown
function closeNotificationDropdown() {
  const notificationDropdown = document.getElementById("notification-dropdown");
  if (notificationDropdown) {
    notificationDropdown.style.display = "none";
  }
}

// Run when page loads
document.addEventListener("DOMContentLoaded", initDashboard);

