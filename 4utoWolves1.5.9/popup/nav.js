/** Bottom navigation, profile shortcut, and the About page's manifest info. */
(() => {
  "use strict";

  const navItems = document.querySelectorAll(".nav-item");
  const navCards = document.querySelectorAll(".nav-card");
  const pages = document.querySelectorAll(".page");

  /**
   * Navigate to a specific page
   * @param {string} pageName - Page name
   */
  function navigateToPage(pageName) {
    if (!document.getElementById("page-" + pageName)) return;

    navItems.forEach((item) => {
      const settingsPage = pageName === "support" || pageName === "about";
      const current = item.dataset.page === (settingsPage ? "options" : pageName);
      item.classList.toggle("active", current);
      if (current) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    pages.forEach((page) => {
      page.classList.toggle("active", page.id === "page-" + pageName);
    });

    const mainContent = document.getElementById("mainContent");
    mainContent.dataset.page = pageName;
    mainContent.scrollTop = 0;
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => navigateToPage(item.dataset.page));
  });

  navCards.forEach((card) => {
    card.addEventListener("click", () => navigateToPage(card.dataset.page));
  });

  document.getElementById("profileButton")?.addEventListener("click", () => navigateToPage("profile"));
  document.getElementById("profileBack")?.addEventListener("click", () => navigateToPage("overview"));

  // Keep the About page's name/version in sync with the manifest.
  const manifestInfo = chrome.runtime.getManifest();
  const aboutName = document.getElementById("aboutName");
  const aboutVersion = document.getElementById("aboutVersion");
  if (aboutName) aboutName.textContent = manifestInfo.name;
  if (aboutVersion) aboutVersion.textContent = manifestInfo.version;
})();
