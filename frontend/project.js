const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";

let currentProjectId = null;
let currentProject = null;

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

// Get project ID from URL
function getProjectIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

// Load project details
async function loadProject(projectId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/${projectId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Project not found");
      }
      throw new Error("Failed to load project");
    }
    
    const result = await response.json();
    
    if (!result || !result.project) {
      throw new Error("Invalid project data received");
    }
    
    currentProject = result.project;
    
    // Update page title
    const titleEl = document.getElementById("project-title");
    if (titleEl && currentProject) {
      titleEl.textContent = currentProject.name || "Project";
    }
    
    // Update director and production status
    const directorEl = document.getElementById("project-director");
    if (directorEl && currentProject) {
      if (currentProject.director && currentProject.director.trim()) {
        directorEl.textContent = `${currentProject.director} 감독님`;
        directorEl.style.display = "";
      } else {
        directorEl.style.display = "none";
      }
    }
    
    const statusEl = document.getElementById("project-status");
    if (statusEl && currentProject) {
      const status = currentProject.production_status || "Pre-Production";
      statusEl.textContent = status;
      // Convert status to CSS class name (e.g., "Pre-Production" -> "pre-production")
      const statusClass = status.toLowerCase().replace(/\s+/g, '-');
      statusEl.className = `status-badge ${statusClass}`;
    }
    
    // Update VFX Supervisors (use names instead of usernames)
    const vfxSupervisorsEl = document.getElementById("vfx-supervisors");
    if (vfxSupervisorsEl && currentProject) {
      // Try to use vfx_supervisors_info (with names) first, fallback to vfx_supervisors (usernames)
      let supervisors = [];
      if (currentProject.vfx_supervisors_info && currentProject.vfx_supervisors_info.length > 0) {
        supervisors = currentProject.vfx_supervisors_info.map(s => s.name || s.username);
      } else if (currentProject.vfx_supervisors && currentProject.vfx_supervisors.length > 0) {
        supervisors = currentProject.vfx_supervisors;
      }
      
      if (supervisors.length > 0) {
        vfxSupervisorsEl.textContent = supervisors.join(", ");
        vfxSupervisorsEl.style.display = "";
      } else {
        vfxSupervisorsEl.style.display = "none";
      }
    }
    
    // Show delete button only to project owner
    const deleteBtn = document.getElementById("delete-project-btn");
    const username = localStorage.getItem("qepipeline_username");
    if (deleteBtn && currentProject) {
      const isOwner = username === currentProject.owner;
      deleteBtn.style.display = isOwner ? "block" : "none";
    }
    
  } catch (error) {
    console.error("Error loading project:", error);
    console.error("Error details:", error.message, error.stack);
    
    // Don't redirect immediately - show error message
    const titleEl = document.getElementById("project-title");
    if (titleEl) {
      titleEl.textContent = "Error loading project";
    }
    
    alert("Failed to load project: " + error.message);
    
    // Still try to load shots and workers even if project load fails
    // They might work independently
  }
  
  // Load workers after project is loaded (even if it failed, try anyway)
  if (currentProject) {
    loadWorkers();
  } else {
    console.warn("Project not loaded, skipping workers load");
  }
}

// Note: Delete button is only visible to project owner
// Owner can request deletion, and admin approval is required

// Load workers
async function loadWorkers() {
  const workersList = document.getElementById("workers-list");
  
  if (!workersList) {
    console.error("Workers list element not found");
    return;
  }
  
  try {
    if (!currentProject) {
      workersList.innerHTML = '<div class="loading">Loading workers...</div>';
      return;
    }
    
    // Get workers from current project
    const workers = currentProject.workers_info || currentProject.workers || [];
    
    if (workers.length === 0) {
      workersList.innerHTML = `
        <div class="empty-state">
          <p>No workers yet.</p>
          <p>Click "+ Add Worker" to add workers to this project.</p>
        </div>
      `;
      return;
    }
    
    const owner = currentProject.owner || '';
    const currentUsername = localStorage.getItem("qepipeline_username");
    
    // Get active users to check worker status
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
    
    workersList.innerHTML = workers.map(worker => {
      const displayName = worker.name || worker.username || worker;
      const username = worker.username || worker;
      const role = worker.role || '';
      const isOwner = username === owner;
      const isCurrentUser = username === currentUsername;
      const isActive = activeUsers.includes(username);
      const statusIndicator = isActive ? '<span class="worker-status-indicator active" title="Active"></span>' : '<span class="worker-status-indicator" title="Offline"></span>';
      const userClass = isCurrentUser ? 'worker-current-user' : '';
      return `
      <div class="worker-item ${userClass}" data-worker-username="${username}">
        <div class="worker-info">
          <div class="worker-name-row">
            <span class="worker-name">${escapeHtml(displayName)}</span>
            ${isCurrentUser ? '<span class="worker-me-badge">Me</span>' : ''}
            ${isOwner ? '<span class="worker-owner-badge">Project Owner</span>' : ''}
            ${statusIndicator}
          </div>
          ${role ? `<span class="worker-role">${escapeHtml(role)}</span>` : '<span class="worker-role" style="opacity: 0.5;">No Role</span>'}
        </div>
        <button class="remove-worker-btn" data-worker-username="${username}" title="Remove worker" ${isOwner ? 'style="display: none;"' : ''}>×</button>
      </div>
    `;
    }).join('');
    
    // Add remove worker event listeners
    document.querySelectorAll('.remove-worker-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const username = e.target.getAttribute('data-worker-username');
        if (username && confirm(`Remove ${username} from this project?`)) {
          await handleRemoveWorker(username);
        }
      });
    });
    
  } catch (error) {
    console.error("Error loading workers:", error);
    workersList.innerHTML = `
      <div class="empty-state">
        <p>Error loading workers.</p>
      </div>
    `;
  }
}

// Load shots
async function loadShots(projectId) {
  const shotsList = document.getElementById("shots-list");
  
  if (!shotsList) {
    console.error("Shots list element not found");
    return;
  }
  
  try {
    if (!projectId) {
      shotsList.innerHTML = '<div class="empty-state"><p>No project ID provided.</p></div>';
      return;
    }
    
    console.log("Loading shots for project:", projectId);
    const response = await fetch(`${API_BASE_URL}/api/project/${projectId}/shots`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to load shots:", response.status, errorText);
      shotsList.innerHTML = `<div class="empty-state"><p>Error loading shots: ${response.status}</p></div>`;
      return;
    }
    
    const result = await response.json();
    console.log("Shots API response:", result);
    
    if (!result || !result.shots) {
      console.error("Invalid shots response:", result);
      shotsList.innerHTML = '<div class="empty-state"><p>Invalid response from server.</p></div>';
      return;
    }
    
    const shots = result.shots || [];
    console.log("Shots array:", shots);
    
    if (shots.length === 0) {
      shotsList.innerHTML = `
        <div class="empty-state">
          <p>No shots yet.</p>
          <p>Click "+ New Shot" to create one.</p>
        </div>
      `;
      return;
    }
    
    shotsList.innerHTML = shots.map(shot => {
      console.log("Rendering shot:", shot);
      return `
      <div class="shot-item" data-shot-id="${shot._id}">
        <div class="shot-name">${escapeHtml(shot.shot_name || shot.name || 'Unnamed Shot')}</div>
        <div class="shot-description">${escapeHtml(shot.description || '')}</div>
      </div>
    `;
    }).join('');
    
    // Add click handlers to shot items
    document.querySelectorAll('.shot-item').forEach(item => {
      item.addEventListener('click', () => {
        const shotId = item.getAttribute('data-shot-id');
        if (shotId) {
          window.location.href = `shot.html?id=${shotId}`;
        }
      });
    });
    
    console.log("Shots loaded successfully");
    
  } catch (error) {
    console.error("Load shots error:", error);
    shotsList.innerHTML = `
      <div class="empty-state">
        <h3>Error</h3>
        <p>${error.message}</p>
        <p>Please check the console for more details.</p>
      </div>
    `;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open shot creation modal
function openShotModal() {
  const modal = document.getElementById("shot-modal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("shot-form").reset();
    const statusEl = document.getElementById("shot-status-message");
    if (statusEl) {
      statusEl.textContent = "";
    }
  }
}

// Close shot creation modal
function closeShotModal() {
  const modal = document.getElementById("shot-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Handle shot creation
async function handleShotCreation(event) {
  event.preventDefault();
  const statusEl = document.getElementById("shot-status-message");
  
  if (!currentProjectId) {
    setStatus(statusEl, "Project ID not found.", "error");
    return;
  }
  
  const shotName = document.getElementById("shot-name").value.trim();
  const description = document.getElementById("shot-description").value.trim();
  
  if (!shotName) {
    setStatus(statusEl, "Shot name is required.", "error");
    return;
  }
  
  setStatus(statusEl, "Creating shot...", "");
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/shots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shot_name: shotName,
        description: description
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to create shot");
    }
    
    setStatus(statusEl, "Shot created successfully!", "success");
    
    // Reload shots and close modal after delay
    setTimeout(() => {
      closeShotModal();
      loadShots(currentProjectId);
    }, 1000);
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Create shot error:", error);
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

// Open delete project modal
function openDeleteModal() {
  const modal = document.getElementById("delete-modal");
  if (modal && currentProject) {
    modal.style.display = "flex";
    document.getElementById("delete-form").reset();
    const statusEl = document.getElementById("delete-status-message");
    if (statusEl) {
      statusEl.textContent = "";
    }
  }
}

// Close delete project modal
function closeDeleteModal() {
  const modal = document.getElementById("delete-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Populate workers select container with checkboxes
async function populateWorkersSelect() {
  const users = await loadUsers();
  const workersContainer = document.getElementById("workers-container");
  
  // Clear existing content
  if (workersContainer) {
    workersContainer.innerHTML = '';
  }
  
  if (users.length === 0) {
    if (workersContainer) {
      workersContainer.innerHTML = '<div class="loading">No users available</div>';
    }
    return;
  }
  
  // Get current project's workers
  const currentWorkers = currentProject?.workers || [];
  
  users.forEach((user, index) => {
    const displayName = user.name ? `${user.name} (${user.username})` : user.username;
    // Use unique IDs with index to prevent any conflicts
    const checkboxId = `worker-${user.username}-${index}`;
    const isSelected = currentWorkers.includes(user.username);
    
    // Create worker checkbox item
    if (workersContainer) {
      const item = document.createElement('label');
      item.className = 'multi-select-item';
      item.setAttribute('for', checkboxId);
      item.setAttribute('data-user-id', user.username);
      if (isSelected) {
        item.classList.add('checked');
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.name = 'worker';
      checkbox.value = user.username;
      checkbox.setAttribute('data-user-id', user.username);
      checkbox.checked = isSelected;
      
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
      
      workersContainer.appendChild(item);
    }
  });
}

// Open add worker modal
function openAddWorkerModal() {
  const modal = document.getElementById("add-worker-modal");
  if (modal && currentProject) {
    modal.style.display = "flex";
    populateWorkersSelect();
    const statusEl = document.getElementById("add-worker-status-message");
    if (statusEl) {
      statusEl.textContent = "";
    }
  }
}

// Close add worker modal
function closeAddWorkerModal() {
  const modal = document.getElementById("add-worker-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Handle add workers
async function handleAddWorkers(event) {
  event.preventDefault();
  const statusEl = document.getElementById("add-worker-status-message");
  
  if (!currentProjectId || !currentProject) {
    setStatus(statusEl, "Project information not found.", "error");
    return;
  }
  
  // Get selected workers from checkboxes
  const selectedWorkers = Array.from(document.querySelectorAll('#workers-container input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  
  setStatus(statusEl, "Adding workers...", "");
  
  try {
    const username = localStorage.getItem("qepipeline_username");
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/workers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        workers: selectedWorkers
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to add workers");
    }
    
    setStatus(statusEl, "Workers updated successfully!", "success");
    
    // Update current project and reload workers
    currentProject = result.project;
    loadWorkers();
    
    // Close modal after delay
    setTimeout(() => {
      closeAddWorkerModal();
    }, 1000);
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Add workers error:", error);
  }
}

// Handle remove worker
async function handleRemoveWorker(username) {
  if (!currentProjectId || !currentProject) {
    alert("Project information not found.");
    return;
  }
  
  try {
    // Get current workers and remove the specified worker
    const currentWorkers = currentProject.workers || [];
    const updatedWorkers = currentWorkers.filter(w => w !== username);
    
    const username = localStorage.getItem("qepipeline_username");
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/workers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        workers: updatedWorkers
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to remove worker");
    }
    
    // Update current project and reload workers
    currentProject = result.project;
    loadWorkers();
    
  } catch (error) {
    alert("Failed to remove worker: " + error.message);
    console.error("Remove worker error:", error);
  }
}

// Handle project deletion request
async function handleDeleteRequest(event) {
  event.preventDefault();
  const statusEl = document.getElementById("delete-status-message");
  const username = localStorage.getItem("qepipeline_username");
  
  if (!currentProjectId || !currentProject) {
    setStatus(statusEl, "Project information not found.", "error");
    return;
  }
  
  const confirmName = document.getElementById("confirm-project-name").value.trim();
  
  if (confirmName !== currentProject.name) {
    setStatus(statusEl, "Project name does not match.", "error");
    return;
  }
  
  setStatus(statusEl, "Submitting deletion request...", "");
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        project_name: confirmName
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to request deletion");
    }
    
    setStatus(statusEl, result.message || "Deletion request submitted.", "success");
    
    // Close modal and redirect after delay
    setTimeout(() => {
      closeDeleteModal();
      window.location.href = "dashboard.html";
    }, 2000);
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Delete request error:", error);
  }
}

// Load users for edit project modal
async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users`);
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

// Populate user select containers with checkboxes for edit modal
async function populateEditUserSelects() {
  const users = await loadUsers();
  const vfxContainer = document.getElementById("edit-vfx-supervisors-container");
  const membersContainer = document.getElementById("edit-members-container");
  
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
  
  // Get current project's VFX supervisors and members
  const currentVfxSupervisors = currentProject?.vfx_supervisors || [];
  const currentMembers = currentProject?.members || [];
  
  users.forEach((user, index) => {
    const displayName = user.name ? `${user.name} (${user.username})` : user.username;
    // Use unique IDs with index to prevent any conflicts
    const checkboxIdVfx = `edit-vfx-${user.username}-${index}`;
    const checkboxIdMember = `edit-member-${user.username}-${index}`;
    const isVfxSelected = currentVfxSupervisors.includes(user.username);
    const isMemberSelected = currentMembers.includes(user.username);
    
    // VFX Supervisors checkbox
    if (vfxContainer) {
      const item = document.createElement('label');
      item.className = 'multi-select-item';
      item.setAttribute('for', checkboxIdVfx);
      item.setAttribute('data-user-id', user.username);
      if (isVfxSelected) {
        item.classList.add('checked');
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxIdVfx;
      checkbox.name = 'edit-vfx-supervisor';
      checkbox.value = user.username;
      checkbox.setAttribute('data-user-id', user.username);
      checkbox.checked = isVfxSelected;
      
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
      if (isMemberSelected) {
        item.classList.add('checked');
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxIdMember;
      checkbox.name = 'edit-member';
      checkbox.value = user.username;
      checkbox.setAttribute('data-user-id', user.username);
      checkbox.checked = isMemberSelected;
      
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

// Open edit project modal
function openEditProjectModal() {
  const modal = document.getElementById("edit-project-modal");
  if (modal && currentProject) {
    modal.style.display = "flex";
    
    // Populate form with current project data
    document.getElementById("edit-project-name").value = currentProject.name || "";
    document.getElementById("edit-project-director").value = currentProject.director || "";
    document.getElementById("edit-project-deadline").value = currentProject.deadline || "";
    document.getElementById("edit-project-status").value = currentProject.production_status || "Pre-Production";
    document.getElementById("edit-project-description").value = currentProject.description || "";
    
    // Populate user selects
    populateEditUserSelects();
    
    // Clear status message
    const statusEl = document.getElementById("edit-project-status-message");
    if (statusEl) {
      statusEl.textContent = "";
    }
  }
}

// Close edit project modal
function closeEditProjectModal() {
  const modal = document.getElementById("edit-project-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Handle project update
async function handleProjectUpdate(event) {
  event.preventDefault();
  const statusEl = document.getElementById("edit-project-status-message");
  
  if (!currentProjectId || !currentProject) {
    setStatus(statusEl, "Project information not found.", "error");
    return;
  }
  
  const name = document.getElementById("edit-project-name").value.trim();
  const director = document.getElementById("edit-project-director").value.trim();
  const deadline = document.getElementById("edit-project-deadline").value;
  const productionStatus = document.getElementById("edit-project-status").value;
  
  // Get selected VFX Supervisors from checkboxes
  const vfxSupervisors = Array.from(document.querySelectorAll('#edit-vfx-supervisors-container input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  
  // Get selected Team Members from checkboxes
  const members = Array.from(document.querySelectorAll('#edit-members-container input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  
  const description = document.getElementById("edit-project-description").value.trim();
  
  if (!name || !productionStatus) {
    setStatus(statusEl, "Project name and production status are required.", "error");
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
  
  setStatus(statusEl, "Updating project...", "");
  
  try {
    const username = localStorage.getItem("qepipeline_username");
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        name,
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
      throw new Error(result.error || "Failed to update project");
    }
    
    setStatus(statusEl, "Project updated successfully!", "success");
    
    // Reload project and close modal after delay
    setTimeout(() => {
      closeEditProjectModal();
      loadProject(currentProjectId);
    }, 1000);
    
  } catch (error) {
    setStatus(statusEl, error.message, "error");
    console.error("Update project error:", error);
  }
}

// Initialize project page
function initProject() {
  const username = checkAuth();
  if (!username) return;
  
  currentProjectId = getProjectIdFromURL();
  if (!currentProjectId) {
    alert("Project ID not found in URL");
    window.location.href = "dashboard.html";
    return;
  }
  
  loadProject(currentProjectId);
  loadShots(currentProjectId);
  
  // New shot button
  const newShotBtn = document.getElementById("new-shot-btn");
  if (newShotBtn) {
    newShotBtn.addEventListener("click", openShotModal);
  }
  
  // Edit project button
  const editBtn = document.getElementById("edit-project-btn");
  if (editBtn) {
    editBtn.addEventListener("click", openEditProjectModal);
  }
  
  // Delete project button - only visible to project owner (will be shown/hidden in loadProject)
  const deleteBtn = document.getElementById("delete-project-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", openDeleteModal);
    // Initially hide the button, it will be shown in loadProject if user is owner
    deleteBtn.style.display = "none";
  }
  
  // Shot modal close buttons
  const shotModalClose = document.getElementById("shot-modal-close");
  const cancelShot = document.getElementById("cancel-shot");
  if (shotModalClose) {
    shotModalClose.addEventListener("click", closeShotModal);
  }
  if (cancelShot) {
    cancelShot.addEventListener("click", closeShotModal);
  }
  
  // Edit project modal close buttons
  const editProjectModalClose = document.getElementById("edit-project-modal-close");
  const cancelEditProject = document.getElementById("cancel-edit-project");
  if (editProjectModalClose) {
    editProjectModalClose.addEventListener("click", closeEditProjectModal);
  }
  if (cancelEditProject) {
    cancelEditProject.addEventListener("click", closeEditProjectModal);
  }
  
  // Delete modal close buttons
  const deleteModalClose = document.getElementById("delete-modal-close");
  const cancelDelete = document.getElementById("cancel-delete");
  if (deleteModalClose) {
    deleteModalClose.addEventListener("click", closeDeleteModal);
  }
  if (cancelDelete) {
    cancelDelete.addEventListener("click", closeDeleteModal);
  }
  
  // Close modals when clicking outside
  const shotModal = document.getElementById("shot-modal");
  const editProjectModal = document.getElementById("edit-project-modal");
  const deleteModal = document.getElementById("delete-modal");
  if (shotModal) {
    shotModal.addEventListener("click", (e) => {
      if (e.target === shotModal) {
        closeShotModal();
      }
    });
  }
  if (editProjectModal) {
    editProjectModal.addEventListener("click", (e) => {
      if (e.target === editProjectModal) {
        closeEditProjectModal();
      }
    });
  }
  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) {
        closeDeleteModal();
      }
    });
  }
  
  // Shot form submission
  const shotForm = document.getElementById("shot-form");
  if (shotForm) {
    shotForm.addEventListener("submit", handleShotCreation);
  }
  
  // Edit project form submission
  const editProjectForm = document.getElementById("edit-project-form");
  if (editProjectForm) {
    editProjectForm.addEventListener("submit", handleProjectUpdate);
  }
  
  // Delete form submission
  const deleteForm = document.getElementById("delete-form");
  if (deleteForm) {
    deleteForm.addEventListener("submit", handleDeleteRequest);
  }
  
  // Add Worker button
  const addWorkerBtn = document.getElementById("add-worker-btn");
  if (addWorkerBtn) {
    addWorkerBtn.addEventListener("click", openAddWorkerModal);
  }
  
  // Add Worker modal close buttons
  const addWorkerModalClose = document.getElementById("add-worker-modal-close");
  const cancelAddWorker = document.getElementById("cancel-add-worker");
  if (addWorkerModalClose) {
    addWorkerModalClose.addEventListener("click", closeAddWorkerModal);
  }
  if (cancelAddWorker) {
    cancelAddWorker.addEventListener("click", closeAddWorkerModal);
  }
  
  // Close Add Worker modal when clicking outside
  const addWorkerModal = document.getElementById("add-worker-modal");
  if (addWorkerModal) {
    addWorkerModal.addEventListener("click", (e) => {
      if (e.target === addWorkerModal) {
        closeAddWorkerModal();
      }
    });
  }
  
  // Add Worker form submission
  const addWorkerForm = document.getElementById("add-worker-form");
  if (addWorkerForm) {
    addWorkerForm.addEventListener("submit", handleAddWorkers);
  }
}


// Load project files
async function loadProjectFiles() {
  if (!currentProjectId) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/files`);
    
    if (!response.ok) {
      console.error("Failed to load files");
      return;
    }
    
    const result = await response.json();
    const files = result.files || [];
    
    const filesList = document.getElementById("project-files-list");
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
        downloadProjectFile(file._id || file.id);
      });
      
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "file-item-btn delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        deleteProjectFile(file._id || file.id);
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

// Handle project file upload
async function handleProjectFileUpload(files) {
  if (!currentProjectId || !files || files.length === 0) {
    return;
  }
  
  const username = localStorage.getItem("qepipeline_username");
  
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("username", username);
      
      const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/files`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to upload file");
      }
      
      // Reload files list
      await loadProjectFiles();
      
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file: " + error.message);
    }
  }
}


// Download project file
function downloadProjectFile(fileId) {
  if (!currentProjectId) {
    return;
  }
  
  window.open(`${API_BASE_URL}/api/project/${currentProjectId}/files/${fileId}`, "_blank");
}

// Delete project file
async function deleteProjectFile(fileId) {
  if (!currentProjectId) {
    return;
  }
  
  if (!confirm("Are you sure you want to delete this file?")) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/project/${currentProjectId}/files/${fileId}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Failed to delete file");
    }
    
    // Reload files list
    await loadProjectFiles();
    
  } catch (error) {
    console.error("Error deleting file:", error);
    alert("Failed to delete file: " + error.message);
  }
}

// Update user activity (heartbeat)
async function updateUserActivity() {
  const username = localStorage.getItem("qepipeline_username");
  if (!username) {
    return;
  }
  
  try {
    await fetch(`${API_BASE_URL}/api/users/activity`, {
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

// Run when page loads
document.addEventListener("DOMContentLoaded", () => {
  initProject();
  
  // Update user activity on page load and periodically
  const username = checkAuth();
  if (username) {
    updateUserActivity();
    // Update activity every 2 minutes
    setInterval(updateUserActivity, 120000);
    
    // Refresh workers list with real-time status periodically (every 30 seconds)
    setInterval(() => {
      if (currentProjectId) {
        loadWorkers();
      }
    }, 30000); // 30 seconds
  }
});

