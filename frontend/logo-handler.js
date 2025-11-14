// Common logo link handler
// Sets logo link based on login status
function setupLogoLink() {
  const logoLink = document.getElementById("logo-link");
  if (!logoLink) return;
  
  const loggedIn = localStorage.getItem("qepipeline_logged_in");
  const username = localStorage.getItem("qepipeline_username");
  
  if (loggedIn && username) {
    // User is logged in, go to dashboard
    logoLink.href = "dashboard.html";
  } else {
    // User is not logged in, go to login page
    logoLink.href = "index.html";
  }
}

// Run on page load
document.addEventListener("DOMContentLoaded", setupLogoLink);

