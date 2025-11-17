// Get API_BASE_URL from window or use default
function getApiBaseUrl() {
  if (window.API_BASE_URL) {
    return window.API_BASE_URL;
  }
  // Fallback to default if not set
  return "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
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

// Chat state
let chatState = {
  isOpen: false,
  isMaximized: false,
  isResizing: false,
  chatRooms: [], // All chat rooms (project, shot, personal)
  currentChatRoomId: null,
  currentChatRoom: null,
  messages: [],
  currentUser: null,
  lastMessageCheck: null, // Timestamp of last message check
  pollingInterval: null, // Interval ID for polling
  isPolling: false // Flag to prevent multiple polling intervals
};

// Initialize chat
function initChat() {
  const currentUser = localStorage.getItem("qepipeline_username");
  if (!currentUser) {
    console.warn("Chat: No user found, initializing anyway");
  }
  
  chatState.currentUser = currentUser || "guest";
  
  // Initialize time sync if available
  if (window.TimeSync && window.TimeSync.initTimeSync) {
    window.TimeSync.initTimeSync().catch(error => {
      console.warn("Chat: Time sync initialization failed:", error);
    });
  }
  
  // Start polling for real-time updates
  startChatPolling();
  
  // Stop polling when page is about to unload
  window.addEventListener("beforeunload", () => {
    stopChatPolling();
  });
  
  // Also stop polling when page becomes hidden (to save resources)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Page is hidden, can optionally pause polling
      // For now, keep polling even when hidden so notifications work
    } else {
      // Page is visible again, ensure polling is active
      if (!chatState.isPolling && chatState.currentUser && chatState.currentUser !== "guest") {
        startChatPolling();
      }
    }
  });
  
  // Get current project ID and shot ID from page context
  // Check if we're on project page
  if (typeof currentProjectId !== 'undefined' && currentProjectId) {
    chatState.currentProjectId = currentProjectId;
  }
  
  // Check if we're on shot page
  if (typeof currentShotId !== 'undefined' && currentShotId) {
    chatState.currentShotId = currentShotId;
  }
  
  // Chat toggle button
  const toggleBtn = document.getElementById("chat-toggle-btn");
  const chatWindow = document.getElementById("chat-window");
  const closeBtn = document.getElementById("chat-close-btn");
  const minimizeBtn = document.getElementById("chat-minimize-btn");
  const maximizeBtn = document.getElementById("chat-maximize-btn");
  const fullscreenBtn = document.getElementById("chat-fullscreen-btn");
  const chatTitle = document.getElementById("chat-window-title");
  const participantsBtn = document.getElementById("chat-participants-btn");
  const participantsCloseBtn = document.getElementById("chat-participants-close");
  
  // Participants button click handler
  if (participantsBtn) {
    participantsBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering title click
      toggleParticipantsDropdown();
    });
  }
  
  // Participants close button click handler
  if (participantsCloseBtn) {
    participantsCloseBtn.addEventListener("click", () => {
      closeParticipantsDropdown();
    });
  }
  
  // Close participants dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("chat-participants-dropdown");
    const btn = document.getElementById("chat-participants-btn");
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      closeParticipantsDropdown();
    }
  });
  
  if (toggleBtn) {
    console.log("✅ Chat toggle button found, adding event listener");
    
    // Remove any existing listeners by cloning the button
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    // Add fresh event listener
    newToggleBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🖱️ Toggle button clicked! Current state - isOpen:", chatState.isOpen);
      
      const result = chatState.isOpen ? closeChat() : openChat();
      console.log("Toggle result:", result);
      
      // If opening failed, try again after a short delay
      if (!chatState.isOpen && !result) {
        console.log("⚠️ Opening failed, retrying...");
        setTimeout(() => {
          const chatWindow = document.getElementById("chat-window");
          if (chatWindow) {
            chatWindow.classList.add("open");
            document.getElementById("chat-toggle-btn").style.display = "none";
            chatState.isOpen = true;
            console.log("✅ Force opened chat window");
          }
        }, 100);
      }
    });
    
    // Also try to open chat on double-click for debugging
    newToggleBtn.addEventListener("dblclick", function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🖱️ Double-click detected, forcing chat open...");
      const chatWindow = document.getElementById("chat-window");
      if (chatWindow) {
        chatWindow.classList.add("open");
        document.getElementById("chat-toggle-btn").style.display = "none";
        chatState.isOpen = true;
        loadConversations();
      }
    });
  } else {
    console.error("❌ Chat toggle button NOT FOUND in initChat!");
  }
  
  if (closeBtn) {
    closeBtn.addEventListener("click", closeChat);
  }
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", minimizeChat);
  }
  
  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", toggleMaximize);
  }
  
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openChatFullscreen();
    });
  }
  
  // Title chat buttons (in shot/project pages)
  const shotChatBtn = document.getElementById("shot-chat-btn");
  const projectChatBtn = document.getElementById("project-chat-btn");
  
  if (shotChatBtn) {
    console.log("✅ Shot chat button found");
    shotChatBtn.addEventListener("click", async function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🖱️ Shot chat button clicked");
      
      if (!chatState.isOpen) {
        openChat();
      }
      
      // Load all chat rooms first
      await loadAllChatRooms();
      
      // Get currentShotId from multiple sources
      let shotId = null;
      
      // Try from URL first (most reliable)
      const urlParams = new URLSearchParams(window.location.search);
      const urlShotId = urlParams.get("id");
      if (urlShotId) {
        shotId = urlShotId;
        console.log("📎 Got shotId from URL:", shotId);
      }
      
      // Try from window/global scope
      if (!shotId) {
        if (typeof window.currentShotId !== 'undefined' && window.currentShotId) {
          shotId = window.currentShotId;
          console.log("🌐 Got shotId from window.currentShotId:", shotId);
        } else if (typeof currentShotId !== 'undefined' && currentShotId) {
          shotId = currentShotId;
          console.log("🔧 Got shotId from currentShotId:", shotId);
        } else if (chatState.currentShotId) {
          shotId = chatState.currentShotId;
          console.log("💬 Got shotId from chatState.currentShotId:", shotId);
        }
      }
      
      console.log("🔍 Looking for shot chat room, shotId:", shotId);
      console.log("Available chat rooms:", chatState.chatRooms.map(r => ({
        type: r.chat_type, 
        shot_id: r.shot_id, 
        project_id: r.project_id,
        display_name: r.display_name
      })));
      
      // Find and open the shot chat room
      if (shotId) {
        const shotChatRoom = chatState.chatRooms.find(room => {
          if (room.chat_type !== "shot") return false;
          const roomShotId = String(room.shot_id);
          const searchShotId = String(shotId);
          console.log(`  Comparing: "${roomShotId}" === "${searchShotId}"`, roomShotId === searchShotId);
          return roomShotId === searchShotId;
        });
        
        if (shotChatRoom) {
          console.log("✅ Found shot chat room:", shotChatRoom);
          await openChatRoom(shotChatRoom._id);
        } else {
          console.warn("⚠️ Shot chat room not found in list, trying to create/load it...");
          // Try to create or get the shot chat room
          try {
            const response = await apiFetch(`${getApiBaseUrl()}/api/shot/${shotId}/chat/room`);
            if (response.ok) {
              const result = await response.json();
              if (result.chat_room) {
                console.log("✅ Shot chat room created/loaded:", result.chat_room);
                
                // Add display_name if not present
                if (!result.chat_room.display_name) {
                  result.chat_room.display_name = result.chat_room.name ? `${result.chat_room.name} Chat` : "Shot Chat";
                }
                
                // Add the new chat room to the list immediately
                const existingIndex = chatState.chatRooms.findIndex(room => room._id === result.chat_room._id);
                if (existingIndex >= 0) {
                  // Update existing
                  chatState.chatRooms[existingIndex] = result.chat_room;
                } else {
                  // Add new to the beginning
                  chatState.chatRooms.unshift(result.chat_room);
                }
                
                // Update the list display
                renderChatRoomsList();
                
                // Open the chat room with the data from response
                await openChatRoom(result.chat_room._id, result.chat_room);
              } else {
                throw new Error("Failed to create shot chat room");
              }
            } else {
              throw new Error(`API error: ${response.statusText}`);
            }
          } catch (error) {
            console.error("❌ Error creating/loading shot chat room:", error);
            alert(`Failed to create shot chat room: ${error.message}`);
          }
        }
      } else {
        console.error("❌ No shotId available from any source");
        alert("Could not find shot ID. Please refresh the page.");
      }
    });
  }
  
  if (projectChatBtn) {
    console.log("✅ Project chat button found");
    projectChatBtn.addEventListener("click", async function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("🖱️ Project chat button clicked");
      
      if (!chatState.isOpen) {
        openChat();
      }
      
      // Load all chat rooms and find the project chat room
      await loadAllChatRooms();
      
      // Get currentProjectId from window or global scope
      const projectId = typeof currentProjectId !== 'undefined' ? currentProjectId : 
                        (typeof window.currentProjectId !== 'undefined' ? window.currentProjectId : null);
      
      console.log("🔍 Looking for project chat room, projectId:", projectId);
      
      // Find and open the project chat room
      if (projectId) {
        const projectChatRoom = chatState.chatRooms.find(room => 
          room.chat_type === "project" && String(room.project_id) === String(projectId)
        );
        if (projectChatRoom) {
          console.log("✅ Found project chat room:", projectChatRoom);
          await openChatRoom(projectChatRoom._id);
        } else {
          console.warn("⚠️ Project chat room not found in list, trying to create/load it...");
          // Try to create or get the project chat room
          try {
            const response = await apiFetch(`${getApiBaseUrl()}/api/project/${projectId}/chat/room`);
            if (response.ok) {
              const result = await response.json();
              if (result.chat_room) {
                console.log("✅ Project chat room created/loaded:", result.chat_room);
                
                // Add display_name if not present
                if (!result.chat_room.display_name) {
                  result.chat_room.display_name = result.chat_room.name ? `${result.chat_room.name} Chat` : "Project Chat";
                }
                
                // Add the new chat room to the list immediately
                const existingIndex = chatState.chatRooms.findIndex(room => room._id === result.chat_room._id);
                if (existingIndex >= 0) {
                  // Update existing
                  chatState.chatRooms[existingIndex] = result.chat_room;
                } else {
                  // Add new to the beginning
                  chatState.chatRooms.unshift(result.chat_room);
                }
                
                // Update the list display
                renderChatRoomsList();
                
                // Open the chat room with the data from response
                await openChatRoom(result.chat_room._id, result.chat_room);
              } else {
                throw new Error("Failed to create project chat room");
              }
            } else {
              throw new Error(`API error: ${response.statusText}`);
            }
          } catch (error) {
            console.error("❌ Error creating/loading project chat room:", error);
            alert(`Failed to create project chat room: ${error.message}`);
          }
        }
      } else {
        console.error("❌ No projectId available");
      }
    });
  }
  
  // Load all chat rooms on init
  loadAllChatRooms();
  
  // Resize functionality
  setupResize();
  
  // Drag functionality
  setupDrag();
  
  // Message input
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Auto-resize textarea
    chatInput.addEventListener("input", () => {
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
    });
  }
  
  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }
  
  // Load conversations
  loadConversations();
}

// Get chat room open history from localStorage
function getChatRoomHistory() {
  try {
    const historyStr = localStorage.getItem(`qepipeline_chat_history_${chatState.currentUser}`);
    if (historyStr) {
      return JSON.parse(historyStr);
    }
  } catch (error) {
    console.error("Error reading chat history:", error);
  }
  return {};
}

// Save chat room open time to localStorage
function saveChatRoomOpenTime(chatRoomId) {
  try {
    const history = getChatRoomHistory();
    history[chatRoomId] = Date.now();
    localStorage.setItem(`qepipeline_chat_history_${chatState.currentUser}`, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
}

// Load all chat rooms
async function loadAllChatRooms() {
  const conversationsEl = document.getElementById("chat-conversations");
  if (!conversationsEl) return;
  
  try {
    const currentUser = chatState.currentUser;
    if (!currentUser) {
      conversationsEl.innerHTML = `
        <div class="chat-empty-state">
          <p>Please log in</p>
        </div>
      `;
      return;
    }
    
    const response = await apiFetch(`${getApiBaseUrl()}/api/users/${currentUser}/chat-rooms`);
    
    if (!response.ok) {
      throw new Error(`Failed to load chat rooms: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.chat_rooms) {
      // Get chat room open history
      const history = getChatRoomHistory();
      
      let allChatRooms = [...result.chat_rooms];
      
      // Backend already provides display_name with partner's name only for personal chats
      // Log what we received from backend for debugging
      console.log("DEBUG: Received chat rooms from backend:", allChatRooms.map(r => ({
        id: r._id,
        type: r.chat_type,
        name: r.name,
        display_name: r.display_name,
        participants: r.participants
      })));
      
      // For personal chats, ensure display_name is set to partner's NAME (not username)
      // Backend should provide this, but if not, we'll fix it here
      const currentUser = chatState.currentUser || localStorage.getItem("qepipeline_username");
      const personalChatRoomsNeedingFix = allChatRooms.filter(room => {
        if (room.chat_type === "personal") {
          // Check if display_name is actually a username (in participants list)
          const participants = room.participants || [];
          const isDisplayNameAUsername = participants.some(p => {
            const pUsername = typeof p === 'string' ? p : (p.username || p);
            return pUsername === room.display_name;
          });
          
          // If display_name is missing, is username, or contains " & ", fix it
          const needsFix = !room.display_name || 
                          room.display_name === room.name || 
                          room.display_name.includes(" & ") ||
                          isDisplayNameAUsername;
          return needsFix;
        }
        return false;
      });
      
      if (personalChatRoomsNeedingFix.length > 0) {
        await Promise.all(personalChatRoomsNeedingFix.map(async (room) => {
          const participants = room.participants || [];
          const partnerUsername = participants.find(p => {
            const pUsername = typeof p === 'string' ? p : (p.username || p);
            return pUsername !== currentUser;
          });
          
          if (partnerUsername) {
            const partnerUsernameStr = typeof partnerUsername === 'string' 
              ? partnerUsername 
              : (partnerUsername.username || partnerUsername);
            
            // Fetch partner's name from API
            try {
              const userResponse = await apiFetch(`${getApiBaseUrl()}/api/users/${partnerUsernameStr}`);
              if (userResponse.ok) {
                const userResult = await userResponse.json();
                const partnerName = userResult.user?.name;
                // Use name if it exists and is not empty
                if (partnerName && partnerName.trim() && partnerName !== partnerUsernameStr) {
                  room.display_name = partnerName.trim();
                } else {
                  // If no name, use username as last resort
                  room.display_name = partnerUsernameStr;
                }
              } else {
                room.display_name = partnerUsernameStr;
              }
            } catch (error) {
              room.display_name = partnerUsernameStr;
            }
          }
        }));
      }
      
      // Load all shot chat rooms for projects where user is a worker
      // First check if we're on a specific project page
      const projectId = window.currentProjectId || chatState.currentProjectId;
      
      // Get all projects the user is part of
      let projectsToLoad = [];
      if (projectId) {
        // If on project page, only load shots for that project
        projectsToLoad = [projectId];
      } else {
        // If not on project page (e.g., fullscreen chat), load shots for all projects
        // Extract project IDs from existing chat rooms
        const projectChatRooms = allChatRooms.filter(room => room.chat_type === "project");
        projectsToLoad = projectChatRooms.map(room => room.project_id).filter(id => id);
        
        // Also try to get projects from API if we don't have any
        if (projectsToLoad.length === 0) {
          try {
            const projectsResponse = await apiFetch(`${getApiBaseUrl()}/api/projects`);
            if (projectsResponse.ok) {
              const projectsResult = await projectsResponse.json();
              if (projectsResult.projects && Array.isArray(projectsResult.projects)) {
                projectsToLoad = projectsResult.projects.map(p => p._id || p.id).filter(id => id);
              }
            }
          } catch (error) {
            console.warn("Failed to load projects for shot chat rooms:", error);
          }
        }
      }
      
      // Load shot chat rooms for all relevant projects
      for (const projId of projectsToLoad) {
        try {
          const shotsResponse = await apiFetch(`${getApiBaseUrl()}/api/project/${projId}/shots`);
          if (shotsResponse.ok) {
            const shotsResult = await shotsResponse.json();
            if (shotsResult.shots && Array.isArray(shotsResult.shots)) {
              // For each shot, try to get its chat room
              for (const shot of shotsResult.shots) {
                const shotId = shot._id || shot.id;
                if (shotId) {
                  try {
                    const shotChatRoomResponse = await apiFetch(`${getApiBaseUrl()}/api/shot/${shotId}/chat/room`);
                    if (shotChatRoomResponse.ok) {
                      const shotChatRoomResult = await shotChatRoomResponse.json();
                      if (shotChatRoomResult.chat_room) {
                        const shotChatRoom = shotChatRoomResult.chat_room;
                        // Add display_name if not present
                        if (!shotChatRoom.display_name) {
                          const shotName = shot.shot_name || shot.name || `Shot ${shotId}`;
                          shotChatRoom.display_name = `${shotName} Chat`;
                        }
                        // Only add if not already in list
                        if (!allChatRooms.find(room => room._id === shotChatRoom._id)) {
                          allChatRooms.push(shotChatRoom);
                        }
                      }
                    }
                  } catch (error) {
                    console.warn(`Failed to load chat room for shot ${shotId}:`, error);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to load shots for project ${projId}:`, error);
        }
      }
      
      // Use lastMessageTime from backend if available, otherwise use updated_at or created_at
      for (const room of allChatRooms) {
        // Backend should provide lastMessageTime, but fallback to updated_at if not available
        if (!room.lastMessageTime) {
          room.lastMessageTime = room.updated_at || room.created_at || null;
        }
      }
      
      // IMPORTANT: Save to chatState.chatRooms BEFORE sorting
      chatState.chatRooms = allChatRooms;
      
      // Sort by last message time (most recent first)
      sortChatRoomsByLastMessage();
      
      renderChatRoomsList();
    }
    
  } catch (error) {
    console.error("Error loading chat rooms:", error);
    if (conversationsEl) {
      conversationsEl.innerHTML = `
        <div class="chat-empty-state">
          <p>Error loading chat rooms</p>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
}

// Render chat rooms list
function renderChatRoomsList() {
  const conversationsEl = document.getElementById("chat-conversations");
  if (!conversationsEl) return;
  
  if (!chatState.chatRooms || chatState.chatRooms.length === 0) {
    conversationsEl.innerHTML = `
      <div class="chat-empty-state">
        <p>No chat rooms yet</p>
        <p>Create a project or shot to start chatting</p>
      </div>
    `;
    return;
  }
  
  // Helper function to escape HTML
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  conversationsEl.innerHTML = chatState.chatRooms.map(room => {
    const isActive = chatState.currentChatRoomId === room._id;
    // Use display_name if available, otherwise fallback to name
    const displayName = room.display_name || room.name || "Chat Room";
    // Debug log for personal chats
    if (room.chat_type === "personal") {
      console.log(`DEBUG: Rendering personal chat room - display_name: "${room.display_name}", name: "${room.name}", final displayName: "${displayName}"`);
    }
    const chatType = room.chat_type;
    
    // Add type badge for project and shot chats
    let typeBadge = "";
    if (chatType === "project") {
      typeBadge = '<span class="chat-type-badge chat-type-project">Project</span>';
    } else if (chatType === "shot") {
      typeBadge = '<span class="chat-type-badge chat-type-shot">Shot</span>';
    }
    
    // Get last message preview
    let lastMessagePreview = "";
    if (room.lastMessage) {
      const lastMessageAuthor = room.lastMessageAuthor || "";
      const isMyMessage = lastMessageAuthor === chatState.currentUser;
      const authorPrefix = isMyMessage ? "You: " : "";
      const messageText = room.lastMessage.length > 50 
        ? room.lastMessage.substring(0, 50) + "..." 
        : room.lastMessage;
      lastMessagePreview = `<div class="chat-room-preview">${authorPrefix}${escapeHtml(messageText)}</div>`;
    } else {
      lastMessagePreview = '<div class="chat-room-preview empty">No messages yet</div>';
    }
    
    // Get unread message count
    const unreadCount = room.unreadCount || 0;
    const unreadBadge = unreadCount > 0 
      ? `<span class="chat-room-unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`
      : '';
    
    return `
      <div class="chat-room-item ${isActive ? 'active' : ''}" data-chat-room-id="${room._id}" style="cursor: pointer;">
        <div class="chat-room-info">
          <div class="chat-room-name-row">
            <span class="chat-room-name">${displayName}</span>
            ${typeBadge}
            ${unreadBadge}
          </div>
          ${lastMessagePreview}
        </div>
      </div>
    `;
  }).join("");
  
  // Add click handlers
  document.querySelectorAll(".chat-room-item").forEach(item => {
    item.addEventListener("click", function() {
      const chatRoomId = this.getAttribute("data-chat-room-id");
      openChatRoom(chatRoomId);
    });
  });
}

// Open a specific chat room
async function openChatRoom(chatRoomId, chatRoomData = null) {
  try {
    // Find the chat room in the list or use provided data
    let chatRoom = chatRoomData || chatState.chatRooms.find(room => room._id === chatRoomId);
    
    // If not in list but we have it in currentChatRoom, use that
    if (!chatRoom && chatState.currentChatRoom && chatState.currentChatRoom._id === chatRoomId) {
      chatRoom = chatState.currentChatRoom;
    }
    
    // If still not found, try to load it from API
    if (!chatRoom) {
      console.warn("Chat room not in list, loading from API:", chatRoomId);
      try {
        // Try to get chat room info from API
        const response = await apiFetch(`${getApiBaseUrl()}/api/chat-room/${chatRoomId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.chat_room) {
            chatRoom = result.chat_room;
            console.log("✅ Loaded chat room from API:", chatRoom);
          }
        }
        
        // If still not found, create a minimal chat room object
        if (!chatRoom) {
          chatRoom = { _id: chatRoomId, name: "Chat", display_name: "Chat" };
        }
      } catch (error) {
        console.error("Error loading chat room:", error);
        chatRoom = { _id: chatRoomId, name: "Chat", display_name: "Chat" };
      }
    }
    
    chatState.currentChatRoomId = chatRoomId;
    chatState.currentChatRoom = chatRoom;
    
    // Save open time to history
    saveChatRoomOpenTime(chatRoomId);
    
    console.log("✅ Opening chat room:", chatRoom);
    
    // If chat room is not in the list, add it
    const existingIndex = chatState.chatRooms.findIndex(room => room._id === chatRoomId);
    if (existingIndex === -1 && chatRoom) {
      // Add to beginning of list
      chatState.chatRooms.unshift(chatRoom);
      console.log("➕ Added chat room to list:", chatRoom);
    } else if (existingIndex >= 0 && chatRoom) {
      // Update existing chat room data
      chatState.chatRooms[existingIndex] = chatRoom;
      console.log("🔄 Updated chat room in list:", chatRoom);
    }
    
    // Sort by last message time (most recent first)
    sortChatRoomsByLastMessage();
    
    // Update chat rooms list display
    renderChatRoomsList();
    
    // Update chat window title with type badge (in chat-messages-header)
    const chatTitle = document.querySelector(".chat-messages-header .chat-window-title span") || document.querySelector(".chat-window-title span");
    const participantsBtn = document.getElementById("chat-participants-btn");
    
    if (chatTitle) {
      const displayName = chatRoom.display_name || chatRoom.name || "Chat";
      const chatType = chatRoom.chat_type;
      
      // Build title with participants button in the middle
      let titleHTML = escapeHtml(displayName);
      
      // Add participants button before type badge (only for project/shot chats)
      if (chatType !== "personal" && participantsBtn) {
        // Get the button's HTML (with SVG)
        const btnHTML = participantsBtn.outerHTML;
        // Remove the id from the cloned button to avoid duplicates
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = btnHTML;
        const btnClone = tempDiv.firstElementChild;
        btnClone.removeAttribute('id');
        btnClone.setAttribute('class', btnClone.getAttribute('class') + ' cloned-participants-btn');
        btnClone.style.display = 'inline-flex';
        
        titleHTML += btnClone.outerHTML;
        
        // Re-attach event listener to the cloned button
        setTimeout(() => {
          const newBtn = chatTitle.parentElement.querySelector('.cloned-participants-btn');
          if (newBtn && !newBtn.hasAttribute('data-listener-attached')) {
            newBtn.setAttribute('data-listener-attached', 'true');
            newBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleParticipantsDropdown();
            });
          }
        }, 0);
      }
      
      // Add type badge for project and shot chats
      if (chatType === "project") {
        titleHTML += `<span class="chat-type-badge chat-type-project">Project</span>`;
      } else if (chatType === "shot") {
        titleHTML += `<span class="chat-type-badge chat-type-shot">Shot</span>`;
      }
      
      chatTitle.innerHTML = titleHTML;
      
      // Hide the original button (we cloned it into the title)
      if (participantsBtn && chatType !== "personal") {
        participantsBtn.style.display = "none";
      }
    }
    
    // Show messages container and input
    const messagesContainer = document.getElementById("chat-messages-container");
    const messagesEmpty = document.getElementById("chat-messages-empty");
    const chatInputContainer = document.querySelector(".chat-input-container");
    
    if (messagesContainer) {
      messagesContainer.style.display = "flex";
    }
    if (chatInputContainer) {
      chatInputContainer.style.display = "flex";
    }
    if (messagesEmpty) {
      messagesEmpty.style.display = "none";
    }
    
    // Load messages for this chat room
    await loadChatMessages();
    
  } catch (error) {
    console.error("Error opening chat room:", error);
  }
}

// Open chat window (also available globally)
function openChat(contextName = null) {
  console.log("=== OPENCHAT CALLED ===", contextName);
  const chatWindow = document.getElementById("chat-window");
  const toggleBtn = document.getElementById("chat-toggle-btn");
  
  console.log("Chat elements found:", {
    chatWindow: !!chatWindow,
    toggleBtn: !!toggleBtn,
    isOpen: chatState.isOpen,
    contextName: contextName
  });
  
  if (!chatWindow) {
    console.error("❌ Chat window element NOT FOUND in DOM!");
    console.log("Available elements with 'chat' in ID:", 
      Array.from(document.querySelectorAll('[id*="chat"]')).map(el => el.id)
    );
    return false;
  }
  
  if (!toggleBtn) {
    console.error("❌ Chat toggle button element NOT FOUND in DOM!");
    return false;
  }
  
  // Update chat window title (in chat-messages-header)
  const chatTitle = chatWindow.querySelector(".chat-messages-header .chat-window-title span") || chatWindow.querySelector(".chat-window-title span");
  if (chatTitle) {
    if (contextName) {
      chatTitle.innerHTML = contextName;
    } else {
      chatTitle.innerHTML = "Chat"; // Reset to default
    }
  }
  
  // Remove inline style attribute completely
  chatWindow.removeAttribute("style");
  
  // Add 'open' class to show the window
  chatWindow.classList.add("open");
  
  // Hide toggle button
  toggleBtn.style.display = "none";
  toggleBtn.style.visibility = "hidden";
  
  // Update state
  chatState.isOpen = true;
  
  console.log("✅ Chat window opened - class added");
  console.log("Window classes:", chatWindow.className);
  console.log("Window computed display:", window.getComputedStyle(chatWindow).display);
  
  // Load all chat rooms
  loadAllChatRooms();
  
  return true;
}

// Make openChat globally available
window.openChat = openChat;

// Close chat window
function closeChat() {
  console.log("=== CLOSECHAT CALLED ===");
  const chatWindow = document.getElementById("chat-window");
  const toggleBtn = document.getElementById("chat-toggle-btn");
  
  if (chatWindow && toggleBtn) {
    // Remove 'open' class to hide the window
    chatWindow.classList.remove("open");
    
    // Show toggle button
    toggleBtn.style.display = "flex";
    toggleBtn.style.visibility = "visible";
    
    // Update state
    chatState.isOpen = false;
    
    console.log("✅ Chat window closed - class removed");
  }
}

// Minimize chat
function minimizeChat() {
  // For now, just close
  closeChat();
}

// Toggle maximize
function toggleMaximize() {
  const chatWindow = document.getElementById("chat-window");
  
  if (chatWindow) {
    if (chatState.isMaximized) {
      chatWindow.classList.remove("maximized");
      chatWindow.style.width = "400px";
      chatWindow.style.height = "600px";
      chatState.isMaximized = false;
    } else {
      chatWindow.classList.add("maximized");
      chatWindow.style.width = "600px";
      chatWindow.style.height = "800px";
      chatState.isMaximized = true;
    }
  }
}

// Open chat in fullscreen (redirect to fullscreen page)
function openChatFullscreen() {
  try {
    // Get current page URL to determine the chat-fullscreen.html path
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const fullscreenUrl = basePath + 'chat-fullscreen.html';
    
    // Redirect to fullscreen page
    window.location.href = fullscreenUrl;
  } catch (error) {
    console.error('Error opening chat fullscreen:', error);
    alert('Failed to open chat in fullscreen mode.');
  }
}

// Setup resize
function setupResize() {
  const chatWindow = document.getElementById("chat-window");
  const resizeHandle = chatWindow?.querySelector(".chat-resize-handle");
  
  if (!resizeHandle) return;
  
  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    chatState.isResizing = true;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = chatWindow.offsetWidth;
    const startHeight = chatWindow.offsetHeight;
    
    function onMouseMove(e) {
      if (!chatState.isResizing) return;
      
      const newWidth = Math.max(300, Math.min(90 * window.innerWidth / 100, startWidth + (e.clientX - startX)));
      const newHeight = Math.max(400, Math.min(90 * window.innerHeight / 100, startHeight + (e.clientY - startY)));
      
      chatWindow.style.width = newWidth + "px";
      chatWindow.style.height = newHeight + "px";
    }
    
    function onMouseUp() {
      chatState.isResizing = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

// Setup drag
function setupDrag() {
  const chatWindow = document.getElementById("chat-window");
  const header = chatWindow?.querySelector(".chat-window-header");
  
  if (!header) return;
  
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  header.addEventListener("mousedown", (e) => {
    if (e.target.closest(".chat-window-controls")) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = chatWindow.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    chatWindow.style.position = "fixed";
    chatWindow.style.left = startLeft + "px";
    chatWindow.style.top = startTop + "px";
    chatWindow.style.right = "auto";
    chatWindow.style.bottom = "auto";
    
    function onMouseMove(e) {
      if (!isDragging) return;
      
      const newLeft = startLeft + (e.clientX - startX);
      const newTop = startTop + (e.clientY - startY);
      
      // Keep within viewport
      const maxLeft = window.innerWidth - chatWindow.offsetWidth;
      const maxTop = window.innerHeight - chatWindow.offsetHeight;
      
      chatWindow.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + "px";
      chatWindow.style.top = Math.max(0, Math.min(maxTop, newTop)) + "px";
    }
    
    function onMouseUp() {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

// Load or create chat room
async function loadChatRoom(chatType = null) {
  try {
    if (!chatType) {
      chatType = chatState.chatType;
    }
    
    let url = "";
    
    switch(chatType) {
      case "project":
        if (!chatState.currentProjectId) {
          console.error("No project ID available");
          return;
        }
        url = `${getApiBaseUrl()}/api/project/${chatState.currentProjectId}/chat/room`;
        break;
      case "shot":
        if (!chatState.currentShotId) {
          console.error("No shot ID available");
          return;
        }
        url = `${getApiBaseUrl()}/api/shot/${chatState.currentShotId}/chat/room`;
        break;
      case "personal":
        // Personal chat: show partner list
        await loadPersonalChatPartners();
        return;
      default:
        return;
    }
    
    const response = await apiFetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load chat room: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.chat_room) {
      chatState.currentChatRoomId = result.chat_room._id;
      chatState.currentChatRoom = result.chat_room;
      
      console.log("✅ Chat room loaded:", result.chat_room);
      
      // Display participants
      await displayParticipants(result.chat_room.participants || []);
      
      // Show messages container and input
      const messagesContainer = document.getElementById("chat-messages-container");
      const messagesEmpty = document.getElementById("chat-messages-empty");
      const chatInputContainer = document.querySelector(".chat-input-container");
      
      if (messagesContainer) {
        messagesContainer.style.display = "flex";
      }
      if (chatInputContainer) {
        chatInputContainer.style.display = "flex";
      }
      
      // Load messages for this chat room
      await loadChatMessages();
    }
    
  } catch (error) {
    console.error("Error loading chat room:", error);
    const conversationsEl = document.getElementById("chat-conversations");
    if (conversationsEl) {
      conversationsEl.innerHTML = `
        <div class="chat-empty-state">
          <p>Error loading chat room</p>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
}

// Load chat messages
async function loadChatMessages() {
  if (!chatState.currentChatRoomId) {
    return;
  }
  
  try {
    // First, ensure we have the chat room info with participants
    if (!chatState.currentChatRoom || !chatState.currentChatRoom.participants) {
      try {
        const chatRoomResponse = await apiFetch(`${getApiBaseUrl()}/api/chat-room/${chatState.currentChatRoomId}`);
        if (chatRoomResponse.ok) {
          const chatRoomResult = await chatRoomResponse.json();
          if (chatRoomResult.chat_room) {
            chatState.currentChatRoom = chatRoomResult.chat_room;
            console.log("✅ Loaded chat room info with participants:", chatState.currentChatRoom);
          }
        }
      } catch (error) {
        console.warn("Failed to load chat room info:", error);
      }
    }
    
    const url = `${getApiBaseUrl()}/api/chat-room/${chatState.currentChatRoomId}/messages`;
    const response = await apiFetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load messages: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.messages) {
      chatState.messages = result.messages;
      
      // Update last message time and content for this chat room
      if (chatState.messages.length > 0) {
        const lastMessage = chatState.messages[chatState.messages.length - 1];
        const lastMessageTime = lastMessage.created_at;
        const lastMessageContent = lastMessage.content || "";
        const lastMessageAuthor = lastMessage.author_username || "";
        
        // Update in chatState.chatRooms
        const chatRoomIndex = chatState.chatRooms.findIndex(room => room._id === chatState.currentChatRoomId);
        if (chatRoomIndex >= 0) {
          chatState.chatRooms[chatRoomIndex].lastMessageTime = lastMessageTime;
          chatState.chatRooms[chatRoomIndex].lastMessage = lastMessageContent.substring(0, 100);
          chatState.chatRooms[chatRoomIndex].lastMessageAuthor = lastMessageAuthor;
          // Clear unread count when opening chat room
          chatState.chatRooms[chatRoomIndex].unreadCount = 0;
          // Sort and re-render chat rooms list
          sortChatRoomsByLastMessage();
          renderChatRoomsList();
        }
      } else {
        // No messages, clear unread count
        const chatRoomIndex = chatState.chatRooms.findIndex(room => room._id === chatState.currentChatRoomId);
        if (chatRoomIndex >= 0) {
          chatState.chatRooms[chatRoomIndex].unreadCount = 0;
          renderChatRoomsList();
        }
      }
      
      renderMessages();
      
      // Mark messages as read in backend when opening chat room
      await markChatRoomAsRead(chatState.currentChatRoomId);
    }
    
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

// Mark chat room messages as read
async function markChatRoomAsRead(chatRoomId) {
  if (!chatRoomId) {
    return;
  }
  
  const currentUser = chatState.currentUser;
  if (!currentUser) {
    return;
  }
  
  try {
    const response = await apiFetch(`${getApiBaseUrl()}/api/chat-room/${chatRoomId}/messages/read`, {
      method: "PUT"
    });
    
    if (response.ok) {
      console.log("✅ Marked chat room as read:", chatRoomId);
      
      // Update unreadCount in chatState to ensure it stays at 0
      const chatRoomIndex = chatState.chatRooms.findIndex(room => room._id === chatRoomId);
      if (chatRoomIndex >= 0) {
        chatState.chatRooms[chatRoomIndex].unreadCount = 0;
        renderChatRoomsList();
      }
    } else {
      console.warn("Failed to mark chat room as read:", response.status);
    }
  } catch (error) {
    console.error("Error marking chat room as read:", error);
  }
}

// Sort chat rooms by last message time (most recent first)
function sortChatRoomsByLastMessage() {
  if (!chatState.chatRooms || chatState.chatRooms.length === 0) {
    return;
  }
  
  chatState.chatRooms.sort((a, b) => {
    // Get last message time (most recent message created_at)
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 
                  (new Date(a.updated_at || a.created_at || 0).getTime());
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 
                  (new Date(b.updated_at || b.created_at || 0).getTime());
    
    // Most recent first
    return timeB - timeA;
  });
}


// Render messages
function renderMessages() {
  const messagesList = document.getElementById("chat-messages-list");
  const messagesContainer = document.getElementById("chat-messages-container");
  const messagesEmpty = document.getElementById("chat-messages-empty");
  
  if (!messagesList || !messagesContainer) return;
  
  // Always show messages container when chat room is loaded
  messagesContainer.style.display = "flex";
  
  if (!chatState.messages || chatState.messages.length === 0) {
    // Show empty state but keep input visible
    if (messagesEmpty) {
      messagesEmpty.style.display = "flex";
    }
    if (messagesList) {
      messagesList.innerHTML = "";
    }
  } else {
    // Hide empty state and show messages
    if (messagesEmpty) {
      messagesEmpty.style.display = "none";
    }
  }
  
  // Show message input when chat room is loaded
  const chatInputContainer = document.querySelector(".chat-input-container");
  if (chatInputContainer && chatState.currentChatRoomId) {
    chatInputContainer.style.display = "flex";
  }
  
  // Render messages if there are any
  if (chatState.messages && chatState.messages.length > 0) {
    messagesList.innerHTML = chatState.messages.map((msg, index) => {
      const isCurrentUser = msg.author_username === chatState.currentUser;
      
      // Format time in KST - convert server UTC time to KST
      // Server sends UTC time, convert to KST (UTC+9) for display
      let messageDate;
      if (window.TimeSync && window.TimeSync.serverTimeToKST) {
        // Use time-sync function to convert server UTC time to KST
        messageDate = window.TimeSync.serverTimeToKST(msg.created_at);
      } else {
        // Fallback: server time is UTC, add 9 hours for KST
        const utcTime = new Date(msg.created_at).getTime();
        messageDate = new Date(utcTime + (9 * 60 * 60 * 1000));
      }
      
      // Check if this message is in the same minute as the previous/next message
      let showTime = false;
      let isSameMinute = false;
      
      // Check if previous message is in the same minute
      if (index > 0) {
        const prevMsg = chatState.messages[index - 1];
        let prevMessageDate;
        if (window.TimeSync && window.TimeSync.serverTimeToKST) {
          prevMessageDate = window.TimeSync.serverTimeToKST(prevMsg.created_at);
        } else {
          const prevUtcTime = new Date(prevMsg.created_at).getTime();
          prevMessageDate = new Date(prevUtcTime + (9 * 60 * 60 * 1000));
        }
        
        // Compare hour and minute to see if same minute
        const currentHour = messageDate.getHours();
        const currentMinute = messageDate.getMinutes();
        const prevHour = prevMessageDate.getHours();
        const prevMinute = prevMessageDate.getMinutes();
        
        // Same minute = reduce spacing
        if (currentHour === prevHour && currentMinute === prevMinute) {
          isSameMinute = true;
        }
      }
      
      // Show time if:
      // 1. This is the last message in the list, OR
      // 2. Next message is in a different minute (this is the last message in this minute group)
      const isLastMessage = index === chatState.messages.length - 1;
      let isLastInMinuteGroup = isLastMessage;
      
      if (!isLastMessage) {
        const nextMsg = chatState.messages[index + 1];
        let nextMessageDate;
        if (window.TimeSync && window.TimeSync.serverTimeToKST) {
          nextMessageDate = window.TimeSync.serverTimeToKST(nextMsg.created_at);
        } else {
          const nextUtcTime = new Date(nextMsg.created_at).getTime();
          nextMessageDate = new Date(nextUtcTime + (9 * 60 * 60 * 1000));
        }
        
        const currentHour = messageDate.getHours();
        const currentMinute = messageDate.getMinutes();
        const nextHour = nextMessageDate.getHours();
        const nextMinute = nextMessageDate.getMinutes();
        
        // If next message is in different minute, show time on this message
        if (currentHour !== nextHour || currentMinute !== nextMinute) {
          isLastInMinuteGroup = true;
        }
      }
      
      // Show time if this is the last message in the minute group
      showTime = isLastInMinuteGroup;
      
      // Format as KST time only (HH:MM format) - only if showTime is true
      let timeString = '';
      if (showTime) {
        timeString = messageDate.toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true, // Use AM/PM format
          timeZone: 'Asia/Seoul'
        });
      }
      
      // Read status indicator (only for messages sent by current user, and only on the last message in the minute group)
      let readStatus = '';
      if (isCurrentUser && isLastInMinuteGroup) {
        // Find the last message in this minute group sent by current user
        let lastMyMessageInGroup = msg;
        
        // Check if there are more messages from current user in the same minute group
        for (let i = index + 1; i < chatState.messages.length; i++) {
          const nextMsg = chatState.messages[i];
          const nextIsCurrentUser = nextMsg.author_username === chatState.currentUser;
          
          if (!nextIsCurrentUser) break;
          
          let nextMessageDate;
          if (window.TimeSync && window.TimeSync.serverTimeToKST) {
            nextMessageDate = window.TimeSync.serverTimeToKST(nextMsg.created_at);
          } else {
            const nextUtcTime = new Date(nextMsg.created_at).getTime();
            nextMessageDate = new Date(nextUtcTime + (9 * 60 * 60 * 1000));
          }
          
          const currentHour = messageDate.getHours();
          const currentMinute = messageDate.getMinutes();
          const nextHour = nextMessageDate.getHours();
          const nextMinute = nextMessageDate.getMinutes();
          
          // If still in same minute, use this message instead
          if (currentHour === nextHour && currentMinute === nextMinute) {
            lastMyMessageInGroup = nextMsg;
          } else {
            break;
          }
        }
        
        // Use the read status from the last message in the group
        const readBy = lastMyMessageInGroup.read_by || [];
        // Ensure readBy is an array of strings
        const readByArray = Array.isArray(readBy) ? readBy.map(r => String(r)) : [];
        
        const currentChatRoom = chatState.currentChatRoom;
        
        // Debug: Log current state
        if (chatState.debugReadStatus) {
          console.log(`[Read Status] Message: ${lastMyMessageInGroup._id}, ReadBy:`, readByArray);
          console.log(`[Read Status] Current Chat Room:`, currentChatRoom);
          console.log(`[Read Status] Current User:`, chatState.currentUser);
        }
        
        if (!currentChatRoom) {
          if (chatState.debugReadStatus) {
            console.warn(`[Read Status] No chat room data available`);
          }
          readStatus = `<span class="chat-message-read-status unread">✓</span>`;
        } else {
          const isPersonalChat = currentChatRoom.chat_type === 'personal';
          
          if (isPersonalChat) {
            // For personal chat, check if the other person has read it
            const participants = currentChatRoom.participants || [];
            let partnerUsernameStr = null;
            
            // Find partner username
            for (const p of participants) {
              const pUsername = typeof p === 'string' ? p : (p.username || p);
              if (pUsername && String(pUsername) !== String(chatState.currentUser)) {
                partnerUsernameStr = String(pUsername);
                break;
              }
            }
            
            if (partnerUsernameStr) {
              // Check if partner has read the message
              const isRead = readByArray.some(r => String(r) === partnerUsernameStr);
              if (chatState.debugReadStatus) {
                console.log(`[Read Status] Personal chat - Partner: ${partnerUsernameStr}, ReadBy: ${JSON.stringify(readByArray)}, IsRead: ${isRead}`);
              }
              readStatus = `<span class="chat-message-read-status ${isRead ? 'read' : 'unread'}">${isRead ? '✓✓' : '✓'}</span>`;
            } else {
              // If partner not found, show unread
              if (chatState.debugReadStatus) {
                console.warn(`[Read Status] Partner not found in participants:`, participants);
              }
              readStatus = `<span class="chat-message-read-status unread">✓</span>`;
            }
          } else {
            // For group chat, check if at least one other person has read it
            // Get all participants except current user
            const participants = currentChatRoom?.participants || [];
            const otherParticipants = participants
              .map(p => typeof p === 'string' ? p : (p.username || p))
              .filter(p => p && String(p) !== String(chatState.currentUser))
              .map(p => String(p));
            
            // Check if at least one other participant has read it
            const hasBeenRead = otherParticipants.length > 0 && 
              otherParticipants.some(participant => readByArray.some(r => String(r) === participant));
            
            if (chatState.debugReadStatus) {
              console.log(`[Read Status] Group chat - OtherParticipants: ${JSON.stringify(otherParticipants)}, ReadBy: ${JSON.stringify(readByArray)}, HasBeenRead: ${hasBeenRead}`);
            }
            readStatus = `<span class="chat-message-read-status ${hasBeenRead ? 'read' : 'unread'}">${hasBeenRead ? '✓✓' : '✓'}</span>`;
          }
        }
      }
      
      // Always show read status for sent messages if we have it (even without time)
      let timeAndReadStatus = '';
      if (showTime && readStatus) {
        // Show both time and read status
        timeAndReadStatus = `<div class="chat-message-time">${timeString}${readStatus}</div>`;
      } else if (showTime) {
        // Show only time
        timeAndReadStatus = `<div class="chat-message-time">${timeString}</div>`;
      } else if (readStatus) {
        // Show only read status (for messages in same minute group)
        timeAndReadStatus = `<div class="chat-message-time">${readStatus}</div>`;
      }
      
      return `
        <div class="chat-message ${isCurrentUser ? 'sent' : 'received'} ${isSameMinute ? 'same-minute' : ''}">
          <div class="chat-message-bubble">
            ${msg.content}
          </div>
          ${timeAndReadStatus}
        </div>
      `;
    }).join("");
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
  } else {
    // Clear messages list if no messages
    messagesList.innerHTML = "";
  }
}

// Load personal chat partners
async function loadPersonalChatPartners() {
  const conversationsEl = document.getElementById("chat-conversations");
  if (!conversationsEl) return;
  
  try {
    // Get user's partners from dashboard data or API
    const currentUser = chatState.currentUser;
    if (!currentUser) {
      conversationsEl.innerHTML = `
        <div class="chat-empty-state">
          <p>Please log in</p>
        </div>
      `;
      return;
    }
    
    // Get user info to get partners
    const response = await apiFetch(`${getApiBaseUrl()}/api/users/${currentUser}`);
    if (!response.ok) {
      throw new Error("Failed to load user info");
    }
    
    const user = await response.json();
    const partners = user.partners || [];
    
    if (partners.length === 0) {
      conversationsEl.innerHTML = `
        <div class="chat-empty-state">
          <p>No partners yet</p>
          <p>Add partners from dashboard to start chatting</p>
        </div>
      `;
      return;
    }
    
    // Get partner details
    const partnersList = await Promise.all(
      partners.map(async (username) => {
        try {
          const partnerResponse = await apiFetch(`${getApiBaseUrl()}/api/users/${username}`);
          if (partnerResponse.ok) {
            const partner = await partnerResponse.json();
            return {
              username: username,
              name: partner.name || username,
              role: partner.role || ""
            };
          }
        } catch (error) {
          console.error(`Error fetching partner ${username}:`, error);
        }
        return {
          username: username,
          name: username,
          role: ""
        };
      })
    );
    
    conversationsEl.innerHTML = `
      <div class="chat-participants-header">
        <h4>Partners (${partnersList.length})</h4>
      </div>
      <div class="chat-participants-list">
        ${partnersList.map(p => `
          <div class="chat-participant-item chat-partner-item" data-username="${p.username}" style="cursor: pointer;">
            <div class="chat-participant-info">
              <span class="chat-participant-name">${p.name}</span>
              ${p.role ? `<span class="chat-participant-role">${p.role}</span>` : ''}
            </div>
          </div>
        `).join("")}
      </div>
    `;
    
    // Add click handlers for partners
    document.querySelectorAll(".chat-partner-item").forEach(item => {
      item.addEventListener("click", async function() {
        const partnerUsername = this.getAttribute("data-username");
        await openPersonalChat(partnerUsername);
      });
    });
    
  } catch (error) {
    console.error("Error loading personal chat partners:", error);
    if (conversationsEl) {
      conversationsEl.innerHTML = `
        <div class="chat-empty-state">
          <p>Error loading partners</p>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
}

// Open personal chat with a partner
async function openPersonalChat(partnerUsername) {
  try {
    const currentUser = chatState.currentUser;
    if (!currentUser) {
      console.error("No current user");
      return;
    }
    
    const url = `${getApiBaseUrl()}/api/personal-chat/${currentUser}/${partnerUsername}`;
    const response = await apiFetch(url);
    
    if (!response.ok) {
      const errorResult = await response.json().catch(() => ({}));
      const errorMessage = errorResult.error || `Failed to load personal chat room: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    if (result.chat_room) {
      chatState.currentChatRoomId = result.chat_room._id;
      chatState.currentChatRoom = result.chat_room;
      
      console.log("✅ Personal chat room loaded:", result.chat_room);
      
      // Process chat room name - remove current user's name and get partner's display name for personal chats
      const currentUser = chatState.currentUser;
      const currentUserName = localStorage.getItem("qepipeline_username");
      
      if (result.chat_room.chat_type === "personal" && currentUser) {
        // Get current user's display name for comparison
        let currentUserDisplayName = currentUserName;
        try {
          const currentUserResponse = await apiFetch(`${getApiBaseUrl()}/api/users/${currentUserName}`);
          if (currentUserResponse.ok) {
            const currentUserResult = await currentUserResponse.json();
            currentUserDisplayName = currentUserResult.user?.name || currentUserName;
          }
        } catch (error) {
          console.warn(`Failed to fetch current user info:`, error);
        }
        
        // Use display_name from backend (which should contain "Name1 & Name2")
        // or fallback to name
        let displayName = result.chat_room.display_name || result.chat_room.name || "Personal Chat";
        const nameParts = displayName.split(" & ");
        
        if (nameParts.length === 2) {
          // Compare each name with current user's name and username
          const name1Trimmed = nameParts[0].trim();
          const name2Trimmed = nameParts[1].trim();
          const name1Lower = name1Trimmed.toLowerCase();
          const name2Lower = name2Trimmed.toLowerCase();
          const currentNameLower = currentUserDisplayName.toLowerCase().trim();
          const currentUsernameLower = currentUserName.toLowerCase();
          
          // Check which name is NOT the current user's name
          const isName1CurrentUser = name1Lower === currentNameLower || 
                                    name1Lower === currentUsernameLower ||
                                    name1Lower.includes(currentUsernameLower) ||
                                    currentNameLower.includes(name1Lower);
          
          const isName2CurrentUser = name2Lower === currentNameLower || 
                                    name2Lower === currentUsernameLower ||
                                    name2Lower.includes(currentUsernameLower) ||
                                    currentNameLower.includes(name2Lower);
          
          // Use the name that's NOT the current user
          if (!isName1CurrentUser && isName2CurrentUser) {
            displayName = name1Trimmed;
          } else if (isName1CurrentUser && !isName2CurrentUser) {
            displayName = name2Trimmed;
          } else {
            // Fallback: use the one that's not the current username (exact match)
            displayName = name1Lower !== currentUsernameLower ? name1Trimmed : name2Trimmed;
          }
        } else {
          // If display_name doesn't have " & " format, get partner username and fetch their name
          const participants = result.chat_room.participants || [];
          const partnerUsername = participants.find(p => {
            const pUsername = typeof p === 'string' ? p : (p.username || p);
            return pUsername !== currentUser && pUsername !== currentUserName;
          });
          
          if (partnerUsername) {
            const partnerUsernameStr = typeof partnerUsername === 'string' 
              ? partnerUsername 
              : (partnerUsername.username || partnerUsername);
            
            // Fetch partner's user info to get display name
            try {
              const userResponse = await apiFetch(`${getApiBaseUrl()}/api/users/${partnerUsernameStr}`);
              if (userResponse.ok) {
                const userResult = await userResponse.json();
                displayName = userResult.user?.name || partnerUsernameStr;
              } else {
                displayName = partnerUsernameStr;
              }
            } catch (error) {
              console.warn(`Failed to fetch user info for ${partnerUsernameStr}:`, error);
              displayName = partnerUsernameStr;
            }
          }
        }
        
        // Set display_name to partner's name only
        result.chat_room.display_name = displayName;
      }
      
      // Add chat room to list if not already present
      const existingIndex = chatState.chatRooms.findIndex(room => room._id === result.chat_room._id);
      if (existingIndex === -1) {
        // Add to beginning of list
        chatState.chatRooms.unshift(result.chat_room);
      } else {
        // Update existing chat room data
        chatState.chatRooms[existingIndex] = result.chat_room;
      }
      
      // Sort by history (most recent first)
      const history = getChatRoomHistory();
      chatState.chatRooms.sort((a, b) => {
        const timeA = history[a._id] || new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = history[b._id] || new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA; // Most recent first
      });
      
      // Update chat rooms list display
      renderChatRoomsList();
      
      // Save open time to history
      saveChatRoomOpenTime(result.chat_room._id);
      
      // Update chat window title
      const chatTitle = document.querySelector(".chat-window-title span");
      if (chatTitle) {
        chatTitle.innerHTML = displayName;
      }
      
      // Show messages container and input
      const messagesContainer = document.getElementById("chat-messages-container");
      const messagesEmpty = document.getElementById("chat-messages-empty");
      const chatInputContainer = document.querySelector(".chat-input-container");
      
      if (messagesContainer) {
        messagesContainer.style.display = "flex";
      }
      if (chatInputContainer) {
        chatInputContainer.style.display = "flex";
      }
      if (messagesEmpty) {
        messagesEmpty.style.display = "none";
      }
      
      // Load messages for this chat room
      await loadChatMessages();
    } else {
      throw new Error("Chat room not found in response");
    }
    
  } catch (error) {
    console.error("Error opening personal chat:", error);
    let errorMessage = error.message || "Failed to open chat. Please try again.";
    
    // Check if error is about partners
    if (errorMessage.includes("not partners") || errorMessage.includes("partner")) {
      errorMessage = "You need to be partners to send messages. Please add this user as a partner first.";
    }
    
    alert(errorMessage);
  }
};

// Make openPersonalChat globally available
window.openPersonalChat = openPersonalChat;

// Load conversations (legacy function, now loads chat room)
async function loadConversations() {
  // Load chat room if not loaded
  if (!chatState.currentChatRoomId) {
    if (chatState.chatType === "personal") {
      // For personal chat, show partner list
      await loadPersonalChatPartners();
    } else {
      await loadChatRoom();
    }
  } else {
    // Just reload messages
    await loadChatMessages();
  }
}

// Send message
async function sendMessage() {
  const chatInput = document.getElementById("chat-input");
  const message = chatInput?.value.trim();
  
  if (!message || !chatState.currentChatRoomId) {
    console.warn("Cannot send message: no message or chat room");
    return;
  }
  
  try {
    const url = `${getApiBaseUrl()}/api/chat-room/${chatState.currentChatRoomId}/messages`;
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify({
        content: message,
        username: chatState.currentUser
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.message) {
      // Update last message time and content for this chat room immediately
      const chatRoomIndex = chatState.chatRooms.findIndex(room => room._id === chatState.currentChatRoomId);
      if (chatRoomIndex >= 0 && result.message.created_at) {
        chatState.chatRooms[chatRoomIndex].lastMessageTime = result.message.created_at;
        chatState.chatRooms[chatRoomIndex].lastMessage = (result.message.content || "").substring(0, 100);
        chatState.chatRooms[chatRoomIndex].lastMessageAuthor = result.message.author_username || chatState.currentUser;
        // Move this chat room to the top by sorting
        sortChatRoomsByLastMessage();
        renderChatRoomsList();
      }
      
      // Reload all messages to ensure consistency
      await loadChatMessages();
    }
    
    // Clear input
    if (chatInput) {
      chatInput.value = "";
      chatInput.style.height = "auto";
    }
    
    console.log("✅ Message sent successfully");
    
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Start polling for real-time chat updates
function startChatPolling() {
  // Stop existing polling if any
  stopChatPolling();
  
  // Set flag to indicate polling is active
  chatState.isPolling = true;
  
  // Poll every 2 seconds for real-time updates
  chatState.pollingInterval = setInterval(async () => {
    try {
      // Only poll if chat is initialized and user is logged in
      if (!chatState.currentUser || chatState.currentUser === "guest") {
        return;
      }
      
      // Check for new messages in the currently open chat room
      if (chatState.currentChatRoomId) {
        await checkForNewMessages();
      }
      
      // Update chat rooms list (for unread counts and last messages)
      await checkForChatRoomUpdates();
      
    } catch (error) {
      console.error("Error during chat polling:", error);
    }
  }, 2000); // Poll every 2 seconds
  
  console.log("✅ Started chat polling for real-time updates");
}

// Stop polling for real-time updates
function stopChatPolling() {
  if (chatState.pollingInterval) {
    clearInterval(chatState.pollingInterval);
    chatState.pollingInterval = null;
  }
  chatState.isPolling = false;
  console.log("⏹️ Stopped chat polling");
}

// Check for new messages in the current chat room
async function checkForNewMessages() {
  if (!chatState.currentChatRoomId) {
    return;
  }
  
  try {
    const url = `${getApiBaseUrl()}/api/chat-room/${chatState.currentChatRoomId}/messages`;
    const response = await apiFetch(url);
    
    if (!response.ok) {
      return;
    }
    
    const result = await response.json();
    
    if (result.messages && Array.isArray(result.messages)) {
      // Compare message count to detect new messages
      const currentMessageCount = chatState.messages.length;
      const newMessageCount = result.messages.length;
      
      if (newMessageCount > currentMessageCount) {
        // New messages detected, reload messages
        chatState.messages = result.messages;
        renderMessages();
        
        // Scroll to bottom to show new messages
        const messagesList = document.getElementById("chat-messages-list");
        if (messagesList) {
          messagesList.scrollTop = messagesList.scrollHeight;
        }
        
        // Update last message time in chat rooms list
        if (chatState.messages.length > 0) {
          const lastMessage = chatState.messages[chatState.messages.length - 1];
          const chatRoomIndex = chatState.chatRooms.findIndex(room => room._id === chatState.currentChatRoomId);
          if (chatRoomIndex >= 0) {
            chatState.chatRooms[chatRoomIndex].lastMessageTime = lastMessage.created_at;
            chatState.chatRooms[chatRoomIndex].lastMessage = (lastMessage.content || "").substring(0, 100);
            chatState.chatRooms[chatRoomIndex].lastMessageAuthor = lastMessage.author_username || "";
            // Clear unread count since user is viewing the chat
            chatState.chatRooms[chatRoomIndex].unreadCount = 0;
            sortChatRoomsByLastMessage();
            renderChatRoomsList();
          }
        }
        
        chatState.lastMessageCheck = new Date();
      } else if (newMessageCount < currentMessageCount || 
                 JSON.stringify(chatState.messages) !== JSON.stringify(result.messages)) {
        // Messages might have been updated (e.g., read receipts), reload them
        chatState.messages = result.messages;
        renderMessages();
      }
    }
  } catch (error) {
    // Silently handle errors during polling (don't spam console)
    // console.error("Error checking for new messages:", error);
  }
}

// Check for chat room updates (unread counts, last messages)
async function checkForChatRoomUpdates() {
  try {
    const currentUser = chatState.currentUser;
    if (!currentUser) {
      return;
    }
    
    const response = await apiFetch(`${getApiBaseUrl()}/api/users/${currentUser}/chat-rooms`);
    
    if (!response.ok) {
      return;
    }
    
    const result = await response.json();
    
    if (result.chat_rooms && Array.isArray(result.chat_rooms)) {
      let hasUpdates = false;
      
      // Update existing chat rooms with new data (lastMessage, unreadCount, etc.)
      for (const updatedRoom of result.chat_rooms) {
        const existingIndex = chatState.chatRooms.findIndex(room => room._id === updatedRoom._id);
        
        if (existingIndex >= 0) {
          const existingRoom = chatState.chatRooms[existingIndex];
          
          // Check if there are updates
          const lastMessageChanged = existingRoom.lastMessageTime !== updatedRoom.lastMessageTime;
          const unreadCountChanged = (existingRoom.unreadCount || 0) !== (updatedRoom.unreadCount || 0);
          
          // Don't update unreadCount if this is the currently open chat room
          // (user has already read the messages and backend should have marked them as read)
          const isCurrentlyOpen = chatState.currentChatRoomId === existingRoom._id;
          
          if (lastMessageChanged || (unreadCountChanged && !isCurrentlyOpen)) {
            // Update room data (preserve all existing fields, only update changed ones)
            chatState.chatRooms[existingIndex] = {
              ...existingRoom,
              lastMessageTime: updatedRoom.lastMessageTime || existingRoom.lastMessageTime,
              lastMessage: updatedRoom.lastMessage || existingRoom.lastMessage,
              lastMessageAuthor: updatedRoom.lastMessageAuthor || existingRoom.lastMessageAuthor,
              // If this is the currently open room, keep unreadCount at 0 (user is reading it)
              // Otherwise, update from backend (backend should have 0 if messages were marked as read)
              unreadCount: isCurrentlyOpen ? 0 : (updatedRoom.unreadCount || 0)
            };
            hasUpdates = true;
          } else if (isCurrentlyOpen && updatedRoom.unreadCount > 0) {
            // If this is currently open but backend still shows unread, force it to 0
            // (This shouldn't happen if markChatRoomAsRead worked, but just in case)
            chatState.chatRooms[existingIndex].unreadCount = 0;
            hasUpdates = true;
          }
        } else {
          // New chat room, add it
          chatState.chatRooms.push(updatedRoom);
          hasUpdates = true;
        }
      }
      
      // For shot chat rooms that exist in chatState but not in backend response,
      // keep them but update their unread count and last message if possible
      // (This handles cases where backend filters them out due to participants check)
      const backendRoomIds = new Set(result.chat_rooms.map(room => room._id));
      const existingShotRooms = chatState.chatRooms.filter(room => 
        room.chat_type === "shot" && !backendRoomIds.has(room._id)
      );
      
      // Keep existing shot chat rooms even if not in backend response
      // They will be updated when user opens them or when they appear in backend again
      
      // Remove chat rooms that no longer exist (e.g., user removed from shot)
      // BUT: Be careful with shot chat rooms - they might be filtered by participants
      // So we only remove rooms that we're sure should be removed
      const updatedRoomIds = new Set(result.chat_rooms.map(room => room._id));
      const roomsToRemove = chatState.chatRooms.filter(room => {
        // If room is in updated list, don't remove it
        if (updatedRoomIds.has(room._id)) {
          return false;
        }
        
        // For shot chat rooms, be extra careful - don't remove unless we're certain
        // The backend might filter them out if user is not in participants
        // But we should keep them if they were recently loaded
        if (room.chat_type === "shot") {
          // Don't automatically remove shot chat rooms - they might reappear
          // Only remove if explicitly confirmed by backend
          return false;
        }
        
        // For project and personal chats, safe to remove if not in updated list
        return true;
      });
      
      if (roomsToRemove.length > 0) {
        chatState.chatRooms = chatState.chatRooms.filter(room => !roomsToRemove.some(r => r._id === room._id));
        hasUpdates = true;
        
        // If current chat room was removed, clear it
        if (roomsToRemove.some(room => room._id === chatState.currentChatRoomId)) {
          chatState.currentChatRoomId = null;
          chatState.currentChatRoom = null;
          chatState.messages = [];
          const messagesContainer = document.getElementById("chat-messages-container");
          const messagesEmpty = document.getElementById("chat-messages-empty");
          if (messagesContainer) messagesContainer.style.display = "none";
          if (messagesEmpty) messagesEmpty.style.display = "block";
        }
      }
      
      // Re-render if there were updates
      if (hasUpdates) {
        sortChatRoomsByLastMessage();
        renderChatRoomsList();
        
        // Update chat toggle button badge
        const totalUnread = chatState.chatRooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0);
        updateChatToggleButton(totalUnread);
      }
    }
  } catch (error) {
    // Silently handle errors during polling
    // console.error("Error checking for chat room updates:", error);
  }
}

// Toggle participants dropdown
async function toggleParticipantsDropdown() {
  console.log("🔄 Toggle participants dropdown called");
  const dropdown = document.getElementById("chat-participants-dropdown");
  if (!dropdown) {
    console.error("❌ Participants dropdown element not found");
    return;
  }
  
  console.log("📋 Current dropdown display:", dropdown.style.display);
  console.log("💬 Current chat room:", chatState.currentChatRoom);
  
  if (dropdown.style.display === "none" || !dropdown.style.display) {
    // Open dropdown and load participants
    console.log("📂 Opening dropdown and loading participants...");
    await loadChatParticipants();
    dropdown.style.display = "block";
    console.log("✅ Dropdown opened");
  } else {
    // Close dropdown
    console.log("📂 Closing dropdown");
    closeParticipantsDropdown();
  }
}

// Close participants dropdown
function closeParticipantsDropdown() {
  const dropdown = document.getElementById("chat-participants-dropdown");
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

// Load and display chat participants
async function loadChatParticipants() {
  console.log("👥 Loading chat participants...");
  console.log("💬 Current chat room:", chatState.currentChatRoom);
  
  if (!chatState.currentChatRoom) {
    console.error("❌ No current chat room to load participants for");
    const participantsList = document.getElementById("chat-participants-list");
    if (participantsList) {
      participantsList.innerHTML = '<p class="chat-participants-error">No chat room selected</p>';
    }
    return;
  }
  
  const participantsList = document.getElementById("chat-participants-list");
  if (!participantsList) {
    console.error("❌ Participants list element not found");
    return;
  }
  
  participantsList.innerHTML = '<p class="chat-participants-loading">Loading...</p>';
  
  try {
    const chatRoom = chatState.currentChatRoom;
    console.log("📋 Chat room ID:", chatRoom._id);
    console.log("👥 Initial participants:", chatRoom.participants);
    
    // Ensure we have participants - try to fetch from API if missing
    let participants = chatRoom.participants || [];
    
    // Always try to fetch fresh data from API to ensure we have the latest participants
    console.log("🌐 Fetching chat room details from API...");
    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/chat-room/${chatRoom._id}`);
      if (response.ok) {
        const result = await response.json();
        console.log("✅ API response:", result);
        if (result.chat_room && result.chat_room.participants) {
          participants = result.chat_room.participants;
          console.log("👥 Participants from API:", participants);
          // Update the chat room in state
          chatState.currentChatRoom.participants = participants;
        } else {
          console.warn("⚠️ API response missing participants field");
        }
      } else {
        console.error("❌ API error:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
      }
    } catch (error) {
      console.error("❌ Error fetching chat room details:", error);
    }
    
    console.log("👥 Final participants list:", participants);
    
    if (!participants || participants.length === 0) {
      console.warn("⚠️ No participants found");
      participantsList.innerHTML = '<p class="chat-participants-empty">No participants</p>';
      return;
    }
    
    // Fetch user info for each participant
    const participantsData = await Promise.all(
      participants.map(async (username) => {
        try {
          const response = await apiFetch(`${getApiBaseUrl()}/api/user/${username}`);
          if (response.ok) {
            const userData = await response.json();
            return {
              username: username,
              name: userData.name || username,
              email: userData.email || "",
              role: userData.role || "worker"
            };
          }
        } catch (error) {
          console.error(`Error fetching user ${username}:`, error);
        }
        return {
          username: username,
          name: username,
          email: "",
          role: "worker"
        };
      })
    );
    
    // Get online status for participants (if available)
    const currentUser = chatState.currentUser;
    
    // Escape HTML helper function
    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Render participants list
    console.log("📝 Rendering participants list with", participantsData.length, "participants");
    participantsList.innerHTML = participantsData.map((participant) => {
      const isCurrentUser = participant.username === currentUser;
      const displayName = isCurrentUser ? `${participant.name} (Me)` : participant.name;
      const userClass = isCurrentUser ? "chat-participant current-user" : "chat-participant";
      
      return `
        <div class="${userClass}">
          <div class="chat-participant-info">
            <div class="chat-participant-name">${escapeHtml(displayName)}</div>
            <div class="chat-participant-username">@${escapeHtml(participant.username)}</div>
          </div>
        </div>
      `;
    }).join("");
    
    console.log("✅ Participants list rendered successfully");
    
  } catch (error) {
    console.error("❌ Error loading chat participants:", error);
    console.error("❌ Error stack:", error.stack);
    participantsList.innerHTML = '<p class="chat-participants-error">Failed to load participants</p>';
  }
}

// Update chat toggle button badge and avatars
function updateChatToggleButton(unreadCount = 0, avatars = []) {
  const badge = document.getElementById("chat-toggle-badge");
  const avatarsContainer = document.getElementById("chat-toggle-avatars");
  
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
  
  if (avatarsContainer) {
    if (avatars.length === 0) {
      avatarsContainer.innerHTML = "";
    } else {
      avatarsContainer.innerHTML = avatars.slice(0, 3).map((avatar, index) => {
        if (avatar.image) {
          return `<div class="chat-toggle-btn-avatar" style="z-index: ${10 - index};"><img src="${avatar.image}" alt="${avatar.name || ''}" /></div>`;
        } else {
          const initials = (avatar.name || avatar.username || "U").substring(0, 2).toUpperCase();
          return `<div class="chat-toggle-btn-avatar" style="z-index: ${10 - index}; background: ${avatar.color || '#1e5cb3'};">${initials}</div>`;
        }
      }).join("");
    }
  }
}

// Initialize when DOM is ready
function initializeChatWhenReady() {
  const toggleBtn = document.getElementById("chat-toggle-btn");
  const chatWindow = document.getElementById("chat-window");
  
  console.log("🔍 Looking for chat elements...", {
    toggleBtn: !!toggleBtn,
    chatWindow: !!chatWindow,
    documentReady: document.readyState
  });
  
  if (toggleBtn && chatWindow) {
    console.log("✅ All chat elements found! Initializing chat...");
    initChat();
    
    // Add a global function for debugging
    window.debugOpenChat = function() {
      console.log("🐛 DEBUG: Forcing chat open via debug function");
      openChat();
    };
    console.log("💡 Tip: You can call window.debugOpenChat() in console to force open chat");
  } else {
    console.log("⏳ Chat elements not found yet, retrying in 100ms...", {
      toggleBtn: !!toggleBtn,
      chatWindow: !!chatWindow
    });
    setTimeout(initializeChatWhenReady, 100);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded, initializing chat...");
    initializeChatWhenReady();
  });
} else {
  console.log("DOM already loaded, initializing chat...");
  initializeChatWhenReady();
}

