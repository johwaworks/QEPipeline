// User Context Menu - Shared functionality for user actions
// This file provides functions to show context menus for users (workers, partners, etc.)

let currentContextMenu = null;

/**
 * Show user context menu
 * @param {HTMLElement} targetElement - The element to position the menu relative to
 * @param {string} username - The username to show menu for
 * @param {boolean} isPartner - Whether the user is already a partner
 */
async function showUserContextMenu(targetElement, username, isPartner) {
  // Close any existing menu
  closeUserContextMenu();
  
  // Create menu element
  const menu = document.createElement('div');
  menu.className = 'user-context-menu';
  menu.setAttribute('data-username', username);
  
  const currentUsername = localStorage.getItem("qepipeline_username");
  if (username === currentUsername) {
    // Don't show menu for current user
    return;
  }
  
  // Build menu items
  const menuItems = [];
  
  // Only show "Send Message" option if users are partners
  if (isPartner) {
    menuItems.push({
      label: 'Send Message',
      icon: '💬',
      action: () => openUserChat(username)
    });
    menuItems.push({
      label: 'Remove Partner',
      icon: '❌',
      action: () => removeUserPartner(username)
    });
  } else {
    menuItems.push({
      label: 'Add Partner',
      icon: '➕',
      action: () => addUserPartner(username)
    });
  }
  
  // Create menu HTML
  menu.innerHTML = menuItems.map(item => `
    <button class="user-context-menu-item" data-action="${item.label}">
      <span class="user-context-menu-icon">${item.icon}</span>
      <span class="user-context-menu-label">${item.label}</span>
    </button>
  `).join('');
  
  // Add menu to document
  document.body.appendChild(menu);
  currentContextMenu = menu;
  
  // Position menu
  positionMenu(menu, targetElement);
  
  // Add event listeners
  menuItems.forEach(item => {
    const menuItem = menu.querySelector(`[data-action="${item.label}"]`);
    if (menuItem) {
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        closeUserContextMenu();
      });
    }
  });
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', closeUserContextMenuOnClick, true);
  }, 0);
}

/**
 * Close user context menu
 */
function closeUserContextMenu() {
  if (currentContextMenu) {
    currentContextMenu.remove();
    currentContextMenu = null;
    document.removeEventListener('click', closeUserContextMenuOnClick, true);
  }
}

/**
 * Close menu when clicking outside
 */
function closeUserContextMenuOnClick(e) {
  if (currentContextMenu && !currentContextMenu.contains(e.target)) {
    closeUserContextMenu();
  }
}

/**
 * Position menu relative to target element
 */
function positionMenu(menu, targetElement) {
  const rect = targetElement.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  
  // Position below and to the right of the target
  let top = rect.bottom + 4;
  let left = rect.right - menuRect.width;
  
  // Adjust if menu would go off screen
  if (left + menuRect.width > window.innerWidth) {
    left = window.innerWidth - menuRect.width - 10;
  }
  if (left < 0) {
    left = 10;
  }
  if (top + menuRect.height > window.innerHeight) {
    top = rect.top - menuRect.height - 4;
  }
  
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

/**
 * Open personal chat with a user
 */
async function openUserChat(username) {
  // First, open the chat window if not already open
  if (typeof openChat === 'function') {
    openChat();
  } else if (typeof window.openChat === 'function') {
    window.openChat();
  }
  
  // Wait a bit for chat window to open
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Then open personal chat
  if (typeof openPersonalChat === 'function') {
    await openPersonalChat(username);
  } else if (typeof window.openPersonalChat === 'function') {
    await window.openPersonalChat(username);
  } else {
    // Fallback: try again after a longer delay
    console.log('Opening chat with user:', username);
    setTimeout(async () => {
      if (typeof openPersonalChat === 'function') {
        await openPersonalChat(username);
      } else if (typeof window.openPersonalChat === 'function') {
        await window.openPersonalChat(username);
      } else {
        console.error('openPersonalChat function not found');
        alert('Chat functionality not available. Please refresh the page.');
      }
    }, 500);
  }
}

/**
 * Add user as partner
 */
async function addUserPartner(username) {
  const currentUsername = localStorage.getItem("qepipeline_username");
  if (!currentUsername) {
    alert('You must be logged in to add a partner.');
    return;
  }
  
  try {
    // Get API_BASE_URL with fallback
    function getApiBaseUrl() {
      if (window.API_BASE_URL) {
        return window.API_BASE_URL;
      }
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      return isLocal ? "http://localhost:5000" : "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
    }
    const API_BASE_URL = getApiBaseUrl();
    
    // Helper function for API calls
    async function apiFetch(url, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      // Add ngrok header only if using ngrok domain
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }
      
      return fetch(url, { ...options, headers });
    }
    
    const response = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}/partners/request`, {
      method: 'POST',
      body: JSON.stringify({ partner_username: username })
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(`Partner request sent to ${username}`);
      
      // Reload partners list if function exists
      if (typeof loadPartners === 'function') {
        const currentUsername = localStorage.getItem("qepipeline_username");
        await loadPartners(currentUsername);
      }
      
      // Reload workers if on project page
      if (typeof loadWorkers === 'function') {
        await loadWorkers();
      }
    } else {
      const error = await response.json();
      alert(`Failed to send partner request: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error adding partner:', error);
    alert(`Failed to add partner: ${error.message}`);
  }
}

/**
 * Remove user as partner
 */
async function removeUserPartner(username) {
  const currentUsername = localStorage.getItem("qepipeline_username");
  if (!currentUsername) {
    alert('You must be logged in to remove a partner.');
    return;
  }
  
  if (!confirm(`Remove ${username} from your partners?`)) {
    return;
  }
  
  try {
    // Get API_BASE_URL with fallback
    function getApiBaseUrl() {
      if (window.API_BASE_URL) {
        return window.API_BASE_URL;
      }
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      return isLocal ? "http://localhost:5000" : "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
    }
    const API_BASE_URL = getApiBaseUrl();
    
    // Helper function for API calls
    async function apiFetch(url, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      // Add ngrok header only if using ngrok domain
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }
      
      return fetch(url, { ...options, headers });
    }
    
    const response = await apiFetch(`${API_BASE_URL}/api/users/${currentUsername}/partners/${username}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert(`${username} removed from partners`);
      
      // Reload partners list if function exists
      if (typeof loadPartners === 'function') {
        const currentUsername = localStorage.getItem("qepipeline_username");
        await loadPartners(currentUsername);
      }
      
      // Reload workers if on project page
      if (typeof loadWorkers === 'function') {
        await loadWorkers();
      }
    } else {
      const error = await response.json();
      alert(`Failed to remove partner: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error removing partner:', error);
    alert(`Failed to remove partner: ${error.message}`);
  }
}

// Make functions globally available
window.showUserContextMenu = showUserContextMenu;
window.closeUserContextMenu = closeUserContextMenu;
window.openUserChat = openUserChat;
window.addUserPartner = addUserPartner;
window.removeUserPartner = removeUserPartner;

