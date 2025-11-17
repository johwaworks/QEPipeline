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

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.classList.remove("error", "success");
  if (type) {
    element.classList.add(type);
  }
}

function rememberIdToggleHandler(event) {
  const checkbox = event.target;
  const usernameInput = document.getElementById("login-username");
  if (checkbox.checked) {
    localStorage.setItem("qepipeline_saved_username", usernameInput.value.trim());
  } else {
    localStorage.removeItem("qepipeline_saved_username");
  }
}

function restoreRememberedId() {
  const savedId = localStorage.getItem("qepipeline_saved_username");
  if (!savedId) return;

  const usernameInput = document.getElementById("login-username");
  const rememberToggle = document.getElementById("remember-id");
  if (usernameInput && rememberToggle) {
    usernameInput.value = savedId;
    rememberToggle.checked = true;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const statusEl = document.getElementById("login-status");
  const rememberToggle = document.getElementById("remember-id");

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    setStatus(statusEl, "Please provide both username and password.", "error");
    return;
  }

  setStatus(statusEl, "Authenticating...");

  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok && response.status === 0) {
      throw new Error("Cannot connect to server. Please check if the backend is running.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Login failed");
    }

    setStatus(statusEl, result.message || "Login successful.", "success");

    // Save login session
    localStorage.setItem("qepipeline_username", username);
    localStorage.setItem("qepipeline_logged_in", "true");

    if (rememberToggle && rememberToggle.checked) {
      localStorage.setItem("qepipeline_saved_username", username);
    } else {
      localStorage.removeItem("qepipeline_saved_username");
    }

    // Redirect to dashboard after short delay
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);
  } catch (error) {
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      setStatus(statusEl, "Cannot connect to server. Please check if the backend is running.", "error");
    } else {
      setStatus(statusEl, error.message, "error");
    }
    console.error("Login error:", error);
  }
}

async function handleRegistration(event) {
  event.preventDefault();
  console.log("Registration form submitted");
  
  const statusEl = document.getElementById("register-status");
  if (!statusEl) {
    console.error("Status element not found");
    return;
  }

  const nameEl = document.getElementById("register-name");
  const usernameEl = document.getElementById("register-username");
  const passwordEl = document.getElementById("register-password");
  const roleEl = document.getElementById("register-role");
  const birthdateEl = document.getElementById("register-birthdate");

  if (!nameEl || !usernameEl || !passwordEl || !roleEl || !birthdateEl) {
    setStatus(statusEl, "Form elements not found. Please refresh the page.", "error");
    console.error("Form elements missing:", { nameEl, usernameEl, passwordEl, roleEl, birthdateEl });
    return;
  }

  const name = nameEl.value.trim();
  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  
  // Get multiple selected roles
  const selectedRoles = Array.from(roleEl.selectedOptions).map(option => option.value);
  const role = selectedRoles.join(", "); // Join multiple roles with comma
  
  const birthdate = birthdateEl.value;
  
  console.log("Form values:", { name, username, roles: selectedRoles, birthdate, passwordLength: password.length });

  if (!name || !username || !password || selectedRoles.length === 0 || !birthdate) {
    setStatus(statusEl, "All fields are required.", "error");
    return;
  }

  if (username.toLowerCase() === "admin") {
    setStatus(statusEl, "'admin' user is reserved.", "error");
    return;
  }

  setStatus(statusEl, "Submitting registration...");

  try {
    const API_BASE_URL = getApiBaseUrl();
    const response = await apiFetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, role, birthdate }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Registration failed");
    }

    setStatus(statusEl, result.message || "Registration submitted.", "success");
    
    // Redirect to success page after short delay
    setTimeout(() => {
      window.location.href = "registration-success.html";
    }, 1000);
  } catch (error) {
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      setStatus(statusEl, "Cannot connect to server. Please check if the backend is running.", "error");
    } else {
      setStatus(statusEl, error.message, "error");
    }
    console.error("Registration error:", error);
  }
}

function bootstrap() {
  // Only register handlers for elements that exist on the current page
  const rememberIdEl = document.getElementById("remember-id");
  const loginFormEl = document.getElementById("login-form");
  const registerFormEl = document.getElementById("register-form");

  if (rememberIdEl) {
    restoreRememberedId();
    rememberIdEl.addEventListener("change", rememberIdToggleHandler);
  }

  if (loginFormEl) {
    loginFormEl.addEventListener("submit", handleLogin);
  }

  if (registerFormEl) {
    registerFormEl.addEventListener("submit", handleRegistration);
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);

