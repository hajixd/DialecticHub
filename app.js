(() => {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyCX_g7RxQsIatEhAnZgeXHedFsxhi8M2m8",
    authDomain: "codenames-tournament.firebaseapp.com",
    projectId: "codenames-tournament",
    storageBucket: "codenames-tournament.firebasestorage.app",
    messagingSenderId: "199881649305",
    appId: "1:199881649305:web:b907e2832cf7d9d4151c08"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  try {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    console.warn("Auth persistence not set (best-effort)", error);
  }

  const LS_LAST_USERNAME = "dialectichub_last_username_v1";
  const LS_THEME_MODE = "dialectichub_theme_mode_v1";
  const PW_PEPPER = "::codenames_pw_v1";
  const MAX_PROFILE_AVATAR_DATA_URL_LEN = 220000;
  const PLACEHOLDER_UID_PREFIX = "invite:";
  const VALID_PAGES = new Set(["dashboard", "search", "schedule", "archive", "rankings", "settings", "admin", "debate"]);
  const ELO_BASELINE = 1200;
  const ELO_K = 32;
  const MIN_RANKED_DEBATES = 4;
  const AUTH_LOADING_MIN_MS = 240;
  const DEBATE_CATEGORIES = [
    { id: "philosophy", label: "Philosophy" },
    { id: "politics", label: "Politics" },
    { id: "misc", label: "Misc" }
  ];

  const state = {
    bootResolved: false,
    user: null,
    username: "",
    selfProfile: null,
    currentPage: getPageFromUrl(),
    profileUid: getProfileUidFromUrl(),
    debateId: getDebateIdFromUrl(),
    settingsSection: "root",
    scheduleSection: "new",
    searchTerm: "",
    searchDraft: "",
    searchSuggestions: [],
    searchMenuOpen: false,
    searchHighlightIndex: -1,
    directory: [],
    debates: [],
    userProfiles: [],
    userMenuOpen: false,
    authTab: "login",
    scheduleSaving: false,
    profilePictureBusy: false,
    profilePictureTargetUid: "",
    profilePictureTargetName: "",
    actionBusyKey: "",
    openSelectKey: "",
    accountModalOpen: false,
    accountModalType: "",
    accountModalBusy: false,
    accountModalTargetUid: "",
    accountModalTargetName: "",
    isMobileViewport: false,
    themeMode: getStoredThemeMode(),
    rankingsCategory: "",
    adminUserSearchDraft: "",
    adminLogSaving: false,
    scheduleDraft: makeDefaultScheduleDraft(""),
    lazyDebateDraft: makeDefaultLazyDebateDraft(),
    unsubDirectory: null,
    unsubDebates: null,
    unsubSelfProfile: null,
    unsubAdminProfiles: null
  };

  const el = {
    authLoadingScreen: document.getElementById("auth-loading-screen"),
    authLoadingMessage: document.getElementById("auth-loading-message"),
    authScreen: document.getElementById("auth-screen"),
    hubShell: document.getElementById("hub-shell"),
    authTabLogin: document.getElementById("auth-tab-login"),
    authTabCreate: document.getElementById("auth-tab-create"),
    loginForm: document.getElementById("login-form"),
    createForm: document.getElementById("create-form"),
    loginUsername: document.getElementById("login-username"),
    loginPassword: document.getElementById("login-password"),
    createUsername: document.getElementById("create-username"),
    createPassword: document.getElementById("create-password"),
    loginHint: document.getElementById("login-hint"),
    createHint: document.getElementById("create-hint"),
    mainContent: document.getElementById("main-content"),
    sideContent: document.getElementById("side-content"),
    searchShell: document.getElementById("search-shell"),
    topSearchInput: document.getElementById("top-search-input"),
    searchPopover: document.getElementById("search-popover"),
    clearSearchBtn: document.getElementById("clear-search-btn"),
    userMenu: document.getElementById("user-menu"),
    userPill: document.getElementById("user-pill"),
    userMenuPopover: document.getElementById("user-menu-popover"),
    menuProfileBtn: document.getElementById("menu-profile-btn"),
    menuThemeBtn: document.getElementById("menu-theme-btn"),
    menuChangeUsernameBtn: document.getElementById("menu-change-username-btn"),
    menuChangeProfilePictureBtn: document.getElementById("menu-change-profile-picture-btn"),
    menuChangePasswordBtn: document.getElementById("menu-change-password-btn"),
    menuLogOutBtn: document.getElementById("menu-log-out-btn"),
    primaryNavLink: document.getElementById("primary-nav-link"),
    profilePictureInput: document.getElementById("profile-picture-input"),
    userName: document.getElementById("user-name"),
    userSubtitle: document.getElementById("user-subtitle"),
    userAvatar: document.getElementById("user-avatar"),
    accountModalShell: document.getElementById("account-modal-shell"),
    accountModal: document.getElementById("account-modal"),
    accountModalTitle: document.getElementById("account-modal-title"),
    accountModalCopy: document.getElementById("account-modal-copy"),
    accountModalForm: document.getElementById("account-modal-form"),
    accountModalFields: document.getElementById("account-modal-fields"),
    accountModalHint: document.getElementById("account-modal-hint"),
    accountModalSubmitBtn: document.getElementById("account-modal-submit-btn"),
    accountModalCancelBtn: document.getElementById("account-modal-cancel-btn"),
    accountModalCloseBtn: document.getElementById("account-modal-close-btn"),
    adminNavLink: document.getElementById("admin-nav-link"),
    headerRankedCount: document.getElementById("header-ranked-count"),
    headerUpcomingCount: document.getElementById("header-upcoming-count"),
    themeColorMeta: document.querySelector('meta[name="theme-color"]'),
    toastStack: document.getElementById("toast-stack")
  };

  let authLoadingVisibleSince = 0;
  let authLoadingHideTimer = 0;

  function safeLsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeLsSet(key, value) {
    try {
      window.localStorage.setItem(key, String(value ?? ""));
    } catch (_) {}
  }

  function normalizeThemeMode(value) {
    return String(value || "").trim().toLowerCase() === "light" ? "light" : "dark";
  }

  function getStoredThemeMode() {
    return normalizeThemeMode(safeLsGet(LS_THEME_MODE) || "dark");
  }

  function syncThemeUi() {
    const mode = normalizeThemeMode(state.themeMode);
    state.themeMode = mode;
    document.documentElement.setAttribute("data-theme", mode);
    if (el.themeColorMeta) {
      el.themeColorMeta.setAttribute("content", mode === "light" ? "#f4efe5" : "#0b0e12");
    }
    if (el.menuThemeBtn) {
      el.menuThemeBtn.textContent = mode === "dark" ? "Light mode" : "Dark mode";
    }
  }

  function setThemeMode(mode) {
    state.themeMode = normalizeThemeMode(mode);
    safeLsSet(LS_THEME_MODE, state.themeMode);
    syncThemeUi();
  }

  function toggleThemeMode() {
    closeUserMenu();
    setThemeMode(state.themeMode === "dark" ? "light" : "dark");
  }

  function normalizeAvatarDataUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (value.length > MAX_PROFILE_AVATAR_DATA_URL_LEN) return "";
    if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return "";
    return value;
  }

  function avatarColorFromSeed(seed) {
    const palette = ["#3b82f6", "#ef4444", "#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#14b8a6", "#eab308"];
    const value = String(seed || "").trim() || "debater";
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }

    return palette[Math.abs(hash) % palette.length];
  }

  function getAvatarInitials(name, maxChars = 2) {
    const capped = Math.max(1, Math.min(3, Number(maxChars) || 2));
    const raw = String(name || "").trim();
    if (!raw) return "?";

    const parts = raw.split(/[\s_.-]+/g).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).slice(0, capped).toUpperCase();
    }

    const cleaned = raw.replace(/[^a-z0-9]/gi, "");
    return (cleaned || raw).slice(0, capped).toUpperCase();
  }

  function normalizeUsername(value) {
    return String(value || "").trim().replace(/\s+/g, "_").toLowerCase();
  }

  function normalizeUsernameInputValue(value) {
    return String(value || "").replace(/^\s+/, "").replace(/\s+/g, "_").toLowerCase();
  }

  function syncUsernameInputValue(input) {
    if (!(input instanceof HTMLInputElement)) return "";
    const nextValue = normalizeUsernameInputValue(input.value);
    if (input.value !== nextValue) {
      const caret =
        typeof input.selectionStart === "number" ? Math.min(nextValue.length, input.selectionStart) : nextValue.length;
      input.value = nextValue;
      try {
        input.setSelectionRange(caret, caret);
      } catch (_) {}
    }
    return input.value;
  }

  function isValidUsername(value) {
    return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(value));
  }

  function getDebateCategoryIds() {
    return DEBATE_CATEGORIES.map((category) => category.id);
  }

  function isValidDebateCategory(value) {
    return getDebateCategoryIds().includes(String(value || "").trim().toLowerCase());
  }

  function normalizeDebateCategory(value, fallback = "misc") {
    const safeValue = String(value || "").trim().toLowerCase();
    if (isValidDebateCategory(safeValue)) {
      return safeValue;
    }
    return fallback === "" ? "" : normalizeDebateCategory(fallback, "misc");
  }

  function getDebateCategoryLabel(value) {
    const safeCategory = normalizeDebateCategory(value);
    const match = DEBATE_CATEGORIES.find((category) => category.id === safeCategory);
    return match ? match.label : "Misc";
  }

  function normalizeRankingsCategory(value) {
    return normalizeDebateCategory(value, DEBATE_CATEGORIES[0].id);
  }

  function normalizeUserRole(value, fallback = "") {
    const safeValue = String(value || "").trim().toLowerCase();
    if (safeValue === "admin" || safeValue === "user") {
      return safeValue;
    }
    const safeFallback = String(fallback || "").trim().toLowerCase();
    return safeFallback === "admin" || safeFallback === "user" ? safeFallback : "";
  }

  function normalizeScheduleSection(value) {
    const safeValue = String(value || "").trim().toLowerCase();
    return safeValue === "upcoming" ? "upcoming" : "new";
  }

  function getStableCategoryFromSeed(seed) {
    const value = String(seed || new Date().toISOString().slice(0, 10));
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }

    return DEBATE_CATEGORIES[Math.abs(hash) % DEBATE_CATEGORIES.length].id;
  }

  function makePlaceholderUid(username) {
    const safeName = normalizeUsername(username);
    return safeName ? `${PLACEHOLDER_UID_PREFIX}${safeName}` : "";
  }

  function getPlaceholderUsername(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid.startsWith(PLACEHOLDER_UID_PREFIX)) return "";
    return normalizeUsername(safeUid.slice(PLACEHOLDER_UID_PREFIX.length));
  }

  function isPlaceholderUid(uid) {
    return Boolean(getPlaceholderUsername(uid));
  }

  function passwordForAuth(password) {
    const raw = String(password || "");
    if (!raw) return raw;
    let padded = raw;
    while (padded.length < 6) {
      padded += "_";
    }
    return padded + PW_PEPPER;
  }

  function makeAuthHandle(username) {
    const name = normalizeUsername(username);
    const rand = Math.random().toString(36).slice(2, 10);
    return `${name}.${rand}@u.local`;
  }

  async function lookupAuthHandleForUsername(username) {
    try {
      const doc = await db.collection("usernames").doc(normalizeUsername(username)).get();
      if (!doc.exists) return null;
      const data = doc.data() || {};
      return String(data.authHandle || "").trim() || null;
    } catch (error) {
      console.warn("Failed reading username registry", error);
      return null;
    }
  }

  async function resolveUsernameForUid(uid) {
    try {
      const snap = await db
        .collection("usernames")
        .where("uid", "==", String(uid || "").trim())
        .limit(1)
        .get();

      if (snap.empty) return null;
      return normalizeUsername(String(snap.docs[0].id || "").trim()) || null;
    } catch (error) {
      console.warn("Failed resolving username for uid", error);
      return null;
    }
  }

  async function ensureUserDisplayName(user) {
    const uid = String(user?.uid || "").trim();
    if (!uid) return null;

    let username = normalizeUsername(user?.displayName || "");
    if (!username) {
      username = normalizeUsername(safeLsGet(LS_LAST_USERNAME));
    }

    try {
      const registryName = normalizeUsername((await resolveUsernameForUid(uid)) || "");
      if (registryName) {
        username = registryName;
      }
    } catch (_) {}

    if (username && normalizeUsername(user?.displayName || "") !== username) {
      try {
        await user.updateProfile({ displayName: username });
      } catch (_) {}
    }

    if (username) {
      safeLsSet(LS_LAST_USERNAME, username);
    }

    return username || null;
  }

  async function ensureUserDocs(user, username) {
    const uid = String(user?.uid || "").trim();
    const name = normalizeUsername(username || user?.displayName || "");
    if (!uid || !name) return;

    const createdAt = user?.metadata?.creationTime
      ? firebase.firestore.Timestamp.fromDate(new Date(user.metadata.creationTime))
      : firebase.firestore.FieldValue.serverTimestamp();

    try {
      await db.collection("users").doc(uid).set(
        {
          username: name,
          name,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt
        },
        { merge: true }
      );
    } catch (error) {
      console.warn("Could not ensure user document", error);
    }
  }

  async function syncPublicDirectoryProfile(user, username, avatarDataUrl) {
    const uid = String(user?.uid || "").trim();
    const safeName = normalizeUsername(username || user?.displayName || "");
    const safeAvatarDataUrl = normalizeAvatarDataUrl(avatarDataUrl || user?.photoURL || "");
    if (!uid || !safeName || !safeAvatarDataUrl || isPreviewMode()) return;

    await db.collection("usernames").doc(safeName).set(
      {
        avatarDataUrl: safeAvatarDataUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  function showAuthLoadingScreen(message) {
    if (el.authLoadingMessage) {
      el.authLoadingMessage.textContent = message || "Loading the arena";
    }
    authLoadingVisibleSince = Date.now();
    if (authLoadingHideTimer) {
      window.clearTimeout(authLoadingHideTimer);
      authLoadingHideTimer = 0;
    }
    el.authLoadingScreen?.classList.remove("hidden");
  }

  function hideAuthLoadingScreen(options = {}) {
    const immediate = Boolean(options.immediate);
    const finish = () => {
      authLoadingHideTimer = 0;
      el.authLoadingScreen?.classList.add("hidden");
    };

    if (authLoadingHideTimer) {
      window.clearTimeout(authLoadingHideTimer);
      authLoadingHideTimer = 0;
    }

    if (immediate) {
      finish();
      return;
    }

    const elapsed = Date.now() - authLoadingVisibleSince;
    const remaining = Math.max(0, AUTH_LOADING_MIN_MS - elapsed);
    if (!remaining) {
      finish();
      return;
    }

    authLoadingHideTimer = window.setTimeout(finish, remaining);
  }

  function showAuthScreen() {
    document.body.classList.toggle("is-mobile-app", isMobileViewport());
    document.body.classList.remove("booting");
    el.hubShell?.classList.add("hidden");
    el.authScreen?.classList.remove("hidden");
    setAuthTab(state.authTab || "login");
    const lastUsername = normalizeUsername(safeLsGet(LS_LAST_USERNAME));
    if (lastUsername && el.loginUsername && !el.loginUsername.value) {
      el.loginUsername.value = lastUsername;
    }
  }

  function showHubShell() {
    document.body.classList.toggle("is-mobile-app", isMobileViewport());
    document.body.classList.remove("booting");
    el.authScreen?.classList.add("hidden");
    el.hubShell?.classList.remove("hidden");
  }

  function setAuthTab(tab) {
    state.authTab = tab === "create" ? "create" : "login";
    const loginOn = state.authTab === "login";
    el.authTabLogin?.classList.toggle("is-active", loginOn);
    el.authTabCreate?.classList.toggle("is-active", !loginOn);
    el.authTabLogin?.setAttribute("aria-selected", loginOn ? "true" : "false");
    el.authTabCreate?.setAttribute("aria-selected", loginOn ? "false" : "true");
    el.loginForm?.classList.toggle("hidden", !loginOn);
    el.createForm?.classList.toggle("hidden", loginOn);
    const target = loginOn ? el.loginUsername : el.createUsername;
    const shouldAutoFocus = !(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
    if (shouldAutoFocus) {
      window.setTimeout(() => target?.focus(), 0);
    }
  }

  function setHint(target, message, tone) {
    if (!target) return;
    target.textContent = message || "";
    target.classList.remove("error", "success");
    if (tone) target.classList.add(tone);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAvatarMarkup(options = {}) {
    const name = String(options.name || state.username || "debater").trim() || "debater";
    const avatarDataUrl = Object.prototype.hasOwnProperty.call(options, "avatarDataUrl")
      ? normalizeAvatarDataUrl(options.avatarDataUrl || "")
      : normalizeAvatarDataUrl(state.selfProfile?.avatarDataUrl || "");
    const color = avatarColorFromSeed(String(options.seed || state.user?.uid || name));

    if (avatarDataUrl) {
      return {
        html: `<img class="avatar-chip-img" src="${escapeHtml(avatarDataUrl)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" />`,
        color,
        hasImage: true
      };
    }

    return {
      html: `<span class="avatar-chip-initials">${escapeHtml(getAvatarInitials(name))}</span>`,
      color,
      hasImage: false
    };
  }

  function renderAvatarChipHtml(options = {}) {
    const avatar = getAvatarMarkup(options);
    const classes = ["avatar-chip"];
    if (options.className) {
      classes.push(String(options.className).trim());
    }
    classes.push(avatar.hasImage ? "has-image" : "is-initials");

    return `
      <span class="${classes.join(" ")}" style="--avatar-bg:${avatar.color};">
        ${avatar.html}
      </span>
    `;
  }

  function syncUserAvatarUi() {
    if (!el.userAvatar) return;

    const avatar = getAvatarMarkup({
      name: state.username || "debater",
      avatarDataUrl: state.selfProfile?.avatarDataUrl || state.user?.photoURL || "",
      seed: String(state.user?.uid || state.username || "debater")
    });

    el.userAvatar.innerHTML = avatar.html;
    el.userAvatar.style.setProperty("--avatar-bg", avatar.color);
    el.userAvatar.classList.toggle("has-image", avatar.hasImage);
    el.userAvatar.classList.toggle("is-initials", !avatar.hasImage);
    el.userAvatar.setAttribute("aria-label", `${state.username || "debater"} avatar`);
  }

  function loadImageElementFromFile(file) {
    return new Promise((resolve, reject) => {
      const blobUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Could not load image."));
      };

      image.src = blobUrl;
    });
  }

  async function encodeProfileAvatarFromFile(file) {
    if (!file || !String(file.type || "").toLowerCase().startsWith("image/")) {
      throw new Error("Choose an image file.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image is too large. Max 10MB.");
    }

    const image = await loadImageElementFromFile(file);
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Could not read image size.");
    }

    const crop = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.max(0, Math.floor((sourceWidth - crop) / 2));
    const sourceY = Math.max(0, Math.floor((sourceHeight - crop) / 2));
    const outputSize = 160;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas unavailable.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, crop, crop, 0, 0, outputSize, outputSize);

    let quality = 0.86;
    let encoded = canvas.toDataURL("image/webp", quality);

    while (encoded.length > MAX_PROFILE_AVATAR_DATA_URL_LEN && quality > 0.42) {
      quality -= 0.08;
      encoded = canvas.toDataURL("image/webp", quality);
    }

    if (encoded.length > MAX_PROFILE_AVATAR_DATA_URL_LEN) {
      quality = 0.8;
      encoded = canvas.toDataURL("image/jpeg", quality);
      while (encoded.length > MAX_PROFILE_AVATAR_DATA_URL_LEN && quality > 0.4) {
        quality -= 0.08;
        encoded = canvas.toDataURL("image/jpeg", quality);
      }
    }

    if (encoded.length > MAX_PROFILE_AVATAR_DATA_URL_LEN) {
      throw new Error("Image is still too large after compression.");
    }

    return encoded;
  }

  function currentIsAdmin() {
    const explicitRole = normalizeUserRole(state.selfProfile?.role, "");
    if (explicitRole) {
      return explicitRole === "admin";
    }
    return normalizeUsername(state.username) === "admin";
  }

  function isPreviewMode() {
    try {
      return new URL(window.location.href).searchParams.get("preview") === "demo";
    } catch (_) {
      return false;
    }
  }

  function isMobileViewport() {
    try {
      return Boolean(window.matchMedia && window.matchMedia("(max-width: 860px)").matches);
    } catch (_) {
      return window.innerWidth <= 860;
    }
  }

  function getPageFromUrl() {
    const page = new URL(window.location.href).searchParams.get("page") || "dashboard";
    return VALID_PAGES.has(page) ? page : "dashboard";
  }

  function getProfileUidFromUrl() {
    return String(new URL(window.location.href).searchParams.get("profile") || "").trim();
  }

  function getDebateIdFromUrl() {
    return String(new URL(window.location.href).searchParams.get("debate") || "").trim();
  }

  function resetSearchState() {
    state.searchTerm = "";
    state.searchDraft = "";
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;
  }

  function normalizeSettingsSection(value) {
    const safeValue = String(value || "").trim().toLowerCase();
    if (["profile", "awaiting", "lazy", "users"].includes(safeValue)) {
      return safeValue;
    }
    return "root";
  }

  function setPage(page, options = {}) {
    const nextPage = VALID_PAGES.has(page) ? page : "dashboard";
    const currentUid = String(state.user?.uid || "").trim();
    const requestedProfileUid = String(options.profileUid || "").trim();
    const requestedDebateId = String(options.debateId || "").trim();
    state.currentPage = nextPage;
    state.profileUid = nextPage === "dashboard" && requestedProfileUid && requestedProfileUid !== currentUid ? requestedProfileUid : "";
    state.debateId = nextPage === "debate" && requestedDebateId ? requestedDebateId : "";
    state.settingsSection = nextPage === "settings" ? normalizeSettingsSection(options.settingsSection || "root") : "root";
    state.openSelectKey = "";
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;
    const nextUrl = new URL(window.location.href);
    if (nextPage === "dashboard") {
      nextUrl.searchParams.delete("page");
    } else {
      nextUrl.searchParams.set("page", nextPage);
    }
    if (state.profileUid) {
      nextUrl.searchParams.set("profile", state.profileUid);
    } else {
      nextUrl.searchParams.delete("profile");
    }
    if (state.debateId) {
      nextUrl.searchParams.set("debate", state.debateId);
    } else {
      nextUrl.searchParams.delete("debate");
    }
    if (isPreviewMode()) {
      nextUrl.searchParams.set("preview", "demo");
    }
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method]({}, "", nextPath);
    renderApp();
  }

  function setSettingsSection(section) {
    const nextSection = normalizeSettingsSection(section);
    const requiresAdmin = ["awaiting", "lazy", "users"].includes(nextSection);
    if (requiresAdmin && !currentIsAdmin()) {
      return;
    }

    state.settingsSection = nextSection;
    renderApp();
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  function setScheduleSection(section) {
    state.scheduleSection = normalizeScheduleSection(section);
    state.openSelectKey = "";
    renderApp({ preserveScroll: true });
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  function syncPrimaryNavLink(mobileViewport) {
    if (!el.primaryNavLink) return;

    const nextPage = mobileViewport ? "search" : "dashboard";
    const nextHref = mobileViewport ? "./?page=search" : "./";
    const nextLabel = mobileViewport ? "Search" : "Profile";

    if (el.primaryNavLink.getAttribute("data-page-link") !== nextPage) {
      el.primaryNavLink.setAttribute("data-page-link", nextPage);
    }
    if (el.primaryNavLink.getAttribute("href") !== nextHref) {
      el.primaryNavLink.setAttribute("href", nextHref);
    }
    if (el.primaryNavLink.textContent !== nextLabel) {
      el.primaryNavLink.textContent = nextLabel;
    }
  }

  function syncSettingsNavLink(mobileViewport) {
    if (!el.adminNavLink) return;

    if (mobileViewport) {
      if (el.adminNavLink.getAttribute("data-page-link") !== "settings") {
        el.adminNavLink.setAttribute("data-page-link", "settings");
      }
      if (el.adminNavLink.getAttribute("href") !== "./?page=settings") {
        el.adminNavLink.setAttribute("href", "./?page=settings");
      }
      if (el.adminNavLink.textContent !== "Settings") {
        el.adminNavLink.textContent = "Settings";
      }
      el.adminNavLink.classList.remove("hidden");
      return;
    }

    if (el.adminNavLink.getAttribute("data-page-link") !== "admin") {
      el.adminNavLink.setAttribute("data-page-link", "admin");
    }
    if (el.adminNavLink.getAttribute("href") !== "./?page=admin") {
      el.adminNavLink.setAttribute("href", "./?page=admin");
    }
    if (el.adminNavLink.textContent !== "Admin") {
      el.adminNavLink.textContent = "Admin";
    }
    el.adminNavLink.classList.toggle("hidden", !currentIsAdmin());
  }

  function openProfile(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return;

    if (safeUid === String(state.user?.uid || "").trim()) {
      setPage("dashboard");
      return;
    }

    setPage("dashboard", { profileUid: safeUid });
  }

  function openDebate(debateId) {
    const safeDebateId = String(debateId || "").trim();
    if (!safeDebateId) return;
    setPage("debate", { debateId: safeDebateId });
  }

  function closeUserMenu() {
    state.userMenuOpen = false;
    el.userMenuPopover?.classList.add("hidden");
    el.userPill?.setAttribute("aria-expanded", "false");
  }

  function toggleUserMenu() {
    state.userMenuOpen = !state.userMenuOpen;
    el.userMenuPopover?.classList.toggle("hidden", !state.userMenuOpen);
    el.userPill?.setAttribute("aria-expanded", state.userMenuOpen ? "true" : "false");
  }

  function syncAccountModalUi() {
    const isOpen = state.accountModalOpen && Boolean(state.accountModalType);
    el.accountModalShell?.classList.toggle("hidden", !isOpen);
    el.accountModalShell?.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.classList.toggle("modal-open", isOpen);

    if (!isOpen) return;

    const isUsername = state.accountModalType === "username";
    const submitLabel = state.accountModalBusy
      ? isUsername
        ? "Saving..."
        : "Updating..."
      : isUsername
        ? "Save Username"
        : "Update Password";

    if (el.accountModalSubmitBtn) {
      el.accountModalSubmitBtn.textContent = submitLabel;
      el.accountModalSubmitBtn.disabled = state.accountModalBusy;
    }

    el.accountModalCancelBtn && (el.accountModalCancelBtn.disabled = state.accountModalBusy);
    el.accountModalCloseBtn && (el.accountModalCloseBtn.disabled = state.accountModalBusy);

    if (el.accountModalForm) {
      el.accountModalForm.querySelectorAll("input, button").forEach((node) => {
        if (!(node instanceof HTMLInputElement || node instanceof HTMLButtonElement)) return;
        if (node === el.accountModalCancelBtn || node === el.accountModalCloseBtn || node === el.accountModalSubmitBtn) {
          return;
        }
        node.disabled = state.accountModalBusy;
      });
    }
  }

  function closeAccountModal(force = false) {
    if (state.accountModalBusy && !force) return;
    state.accountModalOpen = false;
    state.accountModalType = "";
    state.accountModalBusy = false;
    state.accountModalTargetUid = "";
    state.accountModalTargetName = "";
    if (el.accountModalForm) {
      el.accountModalForm.reset();
    }
    if (el.accountModalFields) {
      el.accountModalFields.innerHTML = "";
    }
    setHint(el.accountModalHint, "", "");
    syncAccountModalUi();
  }

  function openAccountModal(type, options = {}) {
    const modalType = type === "password" ? "password" : "username";
    const targetUid = String(options.targetUid || "").trim();
    const targetName = normalizeUsername(options.targetName || getNameForUid(targetUid, "debater"));
    closeUserMenu();

    if (modalType === "password" && isPreviewMode()) {
      showToast("Password changes are unavailable in preview.", "error");
      return;
    }

    if (modalType === "password" && isAdminManagingTargetUser(targetUid)) {
      showToast("Changing another user's password needs a secure backend.", "error");
      return;
    }

    state.accountModalOpen = true;
    state.accountModalType = modalType;
    state.accountModalBusy = false;
    state.accountModalTargetUid = targetUid;
    state.accountModalTargetName = targetName;
    setHint(el.accountModalHint, "", "");

    if (modalType === "username") {
      const current = isAdminManagingTargetUser(targetUid)
        ? normalizeUsername(targetName || getNameForUid(targetUid, "debater"))
        : normalizeUsername(state.username || state.user?.displayName || auth.currentUser?.displayName || "");
      if (el.accountModalTitle) el.accountModalTitle.textContent = "Change Username";
      if (el.accountModalFields) {
        el.accountModalFields.innerHTML = `
          <label class="field">
            <span>Username</span>
            <input
              id="account-modal-primary-input"
              type="text"
              name="nextUsername"
              value="${escapeHtml(current)}"
              autocomplete="username"
              spellcheck="false"
              maxlength="20"
            />
          </label>
        `;
      }
    } else {
      if (el.accountModalTitle) el.accountModalTitle.textContent = "Change Password";
      if (el.accountModalFields) {
        el.accountModalFields.innerHTML = `
          <label class="field">
            <span>New password</span>
            <input id="account-modal-primary-input" type="password" name="nextPassword" autocomplete="new-password" />
          </label>
          <label class="field">
            <span>Confirm password</span>
            <input type="password" name="confirmPassword" autocomplete="new-password" />
          </label>
        `;
      }
    }

    syncAccountModalUi();

    window.requestAnimationFrame(() => {
      const primaryInput = document.getElementById("account-modal-primary-input");
      primaryInput?.focus();
      if (modalType === "username" && primaryInput instanceof HTMLInputElement) {
        primaryInput.select();
      }
    });
  }

  function showToast(message, tone = "info") {
    if (!el.toastStack || !message) return;
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`.trim();
    toast.textContent = message;
    el.toastStack.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  function formatDateTime(value) {
    const millis = toMillis(value);
    if (!millis) return "Date TBD";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(millis));
  }

  function formatShortDate(value) {
    const millis = toMillis(value);
    if (!millis) return "TBD";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric"
    }).format(new Date(millis));
  }

  function formatRelativeStamp(value) {
    const millis = toMillis(value);
    if (!millis) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(millis));
  }

  function getYouTubeEmbedUrl(rawUrl) {
    const safeUrl = String(rawUrl || "").trim();
    if (!safeUrl) return "";

    try {
      const url = new URL(safeUrl);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      let videoId = "";

      if (host === "youtu.be") {
        videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      } else if (host === "youtube.com" || host === "m.youtube.com") {
        if (url.pathname === "/watch") {
          videoId = url.searchParams.get("v") || "";
        } else if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
          videoId = url.pathname.split("/").filter(Boolean)[1] || "";
        }
      }

      if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
        return "";
      }

      return `https://www.youtube.com/embed/${videoId}`;
    } catch (_) {
      return "";
    }
  }

  function canEditDebateVideo(debate) {
    if (!debate || debate.status !== "resolved" || !state.user) return false;
    const resolverUid = String(debate.claimedByUid || "").trim();
    const currentUid = String(state.user.uid || "").trim();
    return Boolean(currentUid) && (currentIsAdmin() || resolverUid === currentUid);
  }

  function getDebateComments(debate) {
    return [...(Array.isArray(debate?.comments) ? debate.comments : [])].sort(
      (left, right) => toMillis(left?.createdAt) - toMillis(right?.createdAt)
    );
  }

  function getSearchPages() {
    const pages = [
      { page: "dashboard", title: "My Profile", note: "Open your profile" },
      { page: "schedule", title: "Schedule Debate", note: "Open the upcoming board" },
      { page: "archive", title: "Past Debates", note: "Open the resolved archive" },
      { page: "rankings", title: "Rankings", note: "Open rankings" }
    ];

    if (state.isMobileViewport) {
      pages.push({ page: "settings", title: "Settings", note: "Open settings" });
    } else if (currentIsAdmin()) {
      pages.push({ page: "admin", title: "Admin", note: "Resolve debates" });
    }

    return pages;
  }

  function buildSearchSuggestions(query) {
    const trimmedQuery = String(query || "").trim();
    if (!trimmedQuery) return [];

    const needle = trimmedQuery.toLowerCase();
    const currentUid = String(state.user?.uid || "").trim();
    const suggestions = [];
    const seen = new Set();

    function addSuggestion(suggestion) {
      if (!suggestion || suggestions.length >= 8 || seen.has(suggestion.key)) return;
      seen.add(suggestion.key);
      suggestions.push(suggestion);
    }

    getSearchPages().forEach((item) => {
      if (!item.title.toLowerCase().includes(needle)) return;
      addSuggestion({
        key: `page:${item.page}`,
        kind: "Page",
        title: item.title,
        meta: item.note,
        note: "",
        page: item.page,
        term: ""
      });
    });

    const leaderboardsByCategory = Object.fromEntries(
      DEBATE_CATEGORIES.map((category) => [category.id, sortLeaderboardRows(computeLeaderboard(state.debates, { category: category.id }))])
    );
    const profileDirectory = [...state.directory];

    if (currentUid && !profileDirectory.some((entry) => String(entry.uid || "").trim() === currentUid)) {
      profileDirectory.push({
        uid: currentUid,
        username: state.username || "debater"
      });
    }

    profileDirectory
      .map((entry) => {
        return {
          uid: String(entry.uid || "").trim(),
          name: normalizeUsername(entry.username || entry.name || "")
        };
      })
      .filter((entry) => entry.uid && entry.name && entry.name.includes(needle))
      .sort((left, right) => {
        const leftStarts = left.name.startsWith(needle);
        const rightStarts = right.name.startsWith(needle);
        if (leftStarts !== rightStarts) {
          return Number(rightStarts) - Number(leftStarts);
        }
        return left.name.localeCompare(right.name);
      })
      .forEach((entry) => {
        const bestCategory = getPreferredCategoryRating(
          buildCategoryRatingsForUser(entry.uid, entry.name, leaderboardsByCategory),
          entry.uid || entry.name
        );
        addSuggestion({
          key: `profile:${entry.uid}`,
          kind: "Profile",
          title: entry.name,
          meta: bestCategory ? `${bestCategory.label} - ${bestCategory.ratingRounded} ELO` : "User page",
          note: entry.uid === currentUid ? "Open your profile" : "Open profile page",
          page: "dashboard",
          profileUid: entry.uid,
          term: ""
        });
      });

    [...state.debates]
      .sort((left, right) => {
        const leftScheduled = left.status === "scheduled";
        const rightScheduled = right.status === "scheduled";
        if (leftScheduled !== rightScheduled) return Number(rightScheduled) - Number(leftScheduled);
        return compareDebatesDescending(left, right);
      })
      .forEach((debate) => {
        const haystack = [
          debate.topic,
          getDebateCategoryLabel(debate.category),
          debate.description,
          debate.moderator,
          debate.debaterAName,
          debate.debaterBName
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) return;

        const people = [normalizeUsername(debate.debaterAName || ""), normalizeUsername(debate.debaterBName || "")]
          .filter(Boolean)
          .join(" vs ");

        addSuggestion({
          key: `debate:${debate.id}`,
          kind: debate.status === "resolved" ? "Result" : "Upcoming",
          title: debate.topic || "Untitled debate",
          meta: [getDebateCategoryLabel(debate.category), people].filter(Boolean).join(" • ") || "Debate",
          note: `${debate.status === "resolved" ? "Open archive" : "Open schedule board"} • ${formatShortDate(debate.scheduledFor)}`,
          page: debate.status === "resolved" ? "archive" : "schedule",
          term: debate.topic || trimmedQuery
        });
      });

    Object.values(leaderboardsByCategory)
      .flat()
      .sort((left, right) => right.ratingRounded - left.ratingRounded || left.name.localeCompare(right.name))
      .forEach((player) => {
        if (!player.name.includes(needle)) return;
        const bestCategory = getPreferredCategoryRating(
          buildCategoryRatingsForUser(player.uid, player.name, leaderboardsByCategory),
          player.uid || player.name
        );
        addSuggestion({
          key: `profile:${player.uid}`,
          kind: "Profile",
          title: player.name,
          meta: bestCategory ? `${bestCategory.label} - ${bestCategory.ratingRounded} ELO` : `${player.ratingRounded} ELO`,
          note: String(player.uid || "").trim() === currentUid ? "Open your profile" : "Open profile page",
          page: "dashboard",
          profileUid: player.uid,
          term: ""
        });
      });

    const moderatorCounts = new Map();
    state.debates.forEach((debate) => {
      const moderator = normalizeUsername(debate.moderator || "");
      if (!moderator) return;
      if (!moderatorCounts.has(moderator)) {
        moderatorCounts.set(moderator, { upcoming: 0, resolved: 0 });
      }
      const counts = moderatorCounts.get(moderator);
      if (debate.status === "scheduled") {
        counts.upcoming += 1;
      } else if (debate.status === "resolved") {
        counts.resolved += 1;
      }
    });

    moderatorCounts.forEach((counts, moderator) => {
      if (!moderator.includes(needle)) return;
      const hasUpcoming = counts.upcoming > 0;
      addSuggestion({
        key: `moderator:${moderator}`,
        kind: "Moderator",
        title: moderator,
        meta: hasUpcoming ? `${counts.upcoming} upcoming` : `${counts.resolved} resolved`,
        note: `Search moderator on ${hasUpcoming ? "schedule" : "archive"}`,
        page: hasUpcoming ? "schedule" : "archive",
        term: moderator
      });
    });

    if (state.currentPage !== "search") {
      addSuggestion({
        key: `search:${needle}`,
        kind: "Search",
        title: trimmedQuery,
        meta: "Search current page",
        note: "Apply this filter",
        page: state.currentPage,
        term: trimmedQuery
      });
    }

    return suggestions;
  }

  function renderSearchSuggestions() {
    return state.searchSuggestions
      .map((suggestion, index) => {
        const activeClass = index === state.searchHighlightIndex ? " is-active" : "";

        return `
          <button
            class="search-suggestion${activeClass}"
            id="search-option-${index}"
            type="button"
            role="option"
            aria-selected="${index === state.searchHighlightIndex ? "true" : "false"}"
            data-action="apply-search-suggestion"
            data-search-index="${index}"
          >
            <span class="search-suggestion-kind">${escapeHtml(suggestion.kind)}</span>
            <span class="search-suggestion-copy">
              <strong>${escapeHtml(suggestion.title)}</strong>
              <span class="search-suggestion-meta">${escapeHtml(suggestion.meta || suggestion.note || "")}</span>
            </span>
            <span class="search-suggestion-note">${escapeHtml(suggestion.note || "")}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderSearchResultsList(className = "") {
    const query = String(state.searchDraft || "").trim();
    state.searchSuggestions = buildSearchSuggestions(query);

    if (!query) {
      state.searchHighlightIndex = -1;
      return renderEmptyState("Start typing", "Search for a debater, topic, moderator, or page.");
    }

    if (!state.searchSuggestions.length) {
      state.searchHighlightIndex = -1;
      return renderEmptyState("No matches", "Try another search.");
    }

    if (state.searchHighlightIndex >= state.searchSuggestions.length) {
      state.searchHighlightIndex = 0;
    }

    const classes = ["search-popover"];
    if (className) {
      classes.push(String(className).trim());
    }

    return `
      <div class="${classes.join(" ")}" role="listbox" aria-label="Search results">
        ${renderSearchSuggestions()}
      </div>
    `;
  }

  function renderMobileSearchResults() {
    return renderSearchResultsList("mobile-search-results");
  }

  function syncMobileSearchPageUi() {
    const input = el.mainContent?.querySelector("#mobile-search-input");
    const results = el.mainContent?.querySelector("#mobile-search-results");
    if (!(input instanceof HTMLInputElement) || !results) return false;

    if (input.value !== state.searchDraft) {
      input.value = state.searchDraft;
    }

    results.innerHTML = renderMobileSearchResults();
    input.setAttribute("aria-expanded", state.searchSuggestions.length > 0 ? "true" : "false");

    const clearButton = el.mainContent?.querySelector('[data-action="clear-mobile-search"]');
    clearButton?.classList.toggle("hidden", !String(state.searchDraft || "").trim());
    return true;
  }

  function syncSearchUi() {
    if (el.topSearchInput && el.topSearchInput.value !== state.searchDraft) {
      el.topSearchInput.value = state.searchDraft;
    }

    const shouldShowPopover = state.searchMenuOpen && state.searchSuggestions.length > 0;
    const hasVisibleValue = Boolean(String(state.searchDraft || "").trim() || state.searchTerm);

    el.clearSearchBtn?.classList.toggle("hidden", !hasVisibleValue);
    el.searchShell?.classList.toggle("is-open", shouldShowPopover);
    el.topSearchInput?.setAttribute("aria-expanded", shouldShowPopover ? "true" : "false");
    el.topSearchInput?.setAttribute(
      "aria-activedescendant",
      shouldShowPopover && state.searchHighlightIndex >= 0 ? `search-option-${state.searchHighlightIndex}` : ""
    );

    if (el.searchPopover) {
      el.searchPopover.classList.toggle("hidden", !shouldShowPopover);
      el.searchPopover.innerHTML = shouldShowPopover ? renderSearchSuggestions() : "";
    }
  }

  function closeSearchMenu() {
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;
    syncSearchUi();
  }

  function refreshSearchSuggestions() {
    state.searchSuggestions = buildSearchSuggestions(state.searchDraft);
    state.searchMenuOpen = Boolean(String(state.searchDraft || "").trim()) && state.searchSuggestions.length > 0;
    state.searchHighlightIndex = state.searchSuggestions.length ? 0 : -1;
    syncSearchUi();
  }

  function moveSearchHighlight(direction) {
    if (!state.searchSuggestions.length) return;

    if (!state.searchMenuOpen) {
      state.searchMenuOpen = true;
    }

    const total = state.searchSuggestions.length;
    const currentIndex = state.searchHighlightIndex >= 0 ? state.searchHighlightIndex : 0;
    state.searchHighlightIndex = (currentIndex + direction + total) % total;
    syncSearchUi();
    el.searchPopover
      ?.querySelector(`[data-search-index="${state.searchHighlightIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function commitSearch(query, page = state.currentPage) {
    const nextTerm = String(query || "").trim();
    state.searchDraft = nextTerm;
    state.searchTerm = nextTerm;
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;

    if (page && page !== state.currentPage) {
      setPage(page);
      return;
    }

    renderApp({ preserveScroll: true });
  }

  function openSearchResultsPage(query = state.searchDraft) {
    state.searchDraft = String(query || "").trim();
    state.searchTerm = "";
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;

    if (state.currentPage === "search") {
      renderApp({ preserveScroll: true });
      return;
    }

    setPage("search");
  }

  function applySearchSuggestionByIndex(index) {
    const suggestion = state.searchSuggestions[index];
    if (!suggestion) {
      commitSearch(state.searchDraft, state.currentPage);
      return;
    }

    if (suggestion.profileUid) {
      resetSearchState();
      syncSearchUi();
      openProfile(suggestion.profileUid);
      return;
    }

    commitSearch(suggestion.term, suggestion.page || state.currentPage);
  }

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function makeDefaultScheduleDraft(currentUid) {
    return {
      topic: "",
      category: "",
      scheduledFor: "",
      moderator: "",
      description: "",
      debaterAUid: currentUid || "",
      debaterBUid: ""
    };
  }

  function makeDefaultLazyDebateDraft() {
    return {
      topic: "",
      category: "",
      scheduledFor: "",
      moderator: "",
      description: "",
      videoUrl: "",
      debaterAUid: "",
      debaterBUid: "",
      result: "a"
    };
  }

  function getDraftState(owner = "schedule") {
    return owner === "lazy" ? state.lazyDebateDraft : state.scheduleDraft;
  }

  function setDraftField(owner, field, value) {
    const draft = getDraftState(owner);
    if (!draft) return;
    if (field === "category") {
      draft[field] = normalizeDebateCategory(value, "");
      return;
    }

    draft[field] = value;

    if (field === "debaterAUid" && draft.debaterAUid === draft.debaterBUid) {
      draft.debaterBUid = "";
    }
    if (field === "debaterBUid" && draft.debaterBUid === draft.debaterAUid) {
      draft.debaterBUid = "";
    }
  }

  function getDirectoryMap() {
    const map = new Map();
    state.directory.forEach((entry) => {
      const uid = String(entry.uid || "").trim();
      if (uid) {
        map.set(uid, normalizeUsername(entry.username || entry.name || uid) || "debater");
      }
    });
    if (state.user?.uid && state.username) {
      map.set(String(state.user.uid), normalizeUsername(state.username));
    }
    return map;
  }

  function getDirectoryEntryByUid(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return null;
    return state.directory.find((entry) => String(entry.uid || "").trim() === safeUid) || null;
  }

  function getNameForUid(uid, fallback = "debater") {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return fallback;
    const direct = getDirectoryMap().get(safeUid);
    const placeholderName = getPlaceholderUsername(safeUid);
    return normalizeUsername(direct || placeholderName || fallback) || fallback;
  }

  function getAvatarDataUrlForUid(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return "";
    if (safeUid === String(state.user?.uid || "").trim()) {
      return normalizeAvatarDataUrl(state.selfProfile?.avatarDataUrl || state.user?.photoURL || "");
    }
    return normalizeAvatarDataUrl(getDirectoryEntryByUid(safeUid)?.avatarDataUrl || "");
  }

  function applyDirectoryAvatarLocally(uid, avatarDataUrl) {
    const safeUid = String(uid || "").trim();
    const safeAvatarDataUrl = normalizeAvatarDataUrl(avatarDataUrl || "");
    if (!safeUid) return;

    state.directory = state.directory.map((entry) => {
      if (String(entry.uid || "").trim() !== safeUid) {
        return entry;
      }
      return {
        ...entry,
        avatarDataUrl: safeAvatarDataUrl
      };
    });
  }

  function getDirectoryEntryByUsername(username) {
    const safeName = normalizeUsername(username);
    if (!safeName) return null;
    return (
      state.directory.find((entry) => normalizeUsername(entry.username || "") === safeName) || null
    );
  }

  function getStoredUserProfileByUid(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return null;
    if (safeUid === String(state.user?.uid || "").trim() && state.selfProfile) {
      return state.selfProfile;
    }
    return state.userProfiles.find((entry) => String(entry.uid || "").trim() === safeUid) || null;
  }

  function getUserRoleForUid(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return "user";
    const profile = getStoredUserProfileByUid(safeUid);
    const explicitRole = normalizeUserRole(profile?.role, "");
    if (explicitRole) {
      return explicitRole;
    }
    return normalizeUsername(getNameForUid(safeUid, "")) === "admin" ? "admin" : "user";
  }

  function getAdminManagedUsers() {
    return [...state.directory]
      .filter((entry) => {
        const uid = String(entry.uid || "").trim();
        return uid && !isPlaceholderUid(uid);
      })
      .map((entry) => ({
        ...entry,
        uid: String(entry.uid || "").trim(),
        username: normalizeUsername(entry.username || entry.name || "") || "debater",
        role: getUserRoleForUid(entry.uid)
      }))
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  function normalizeAdminUserSearchQuery(query) {
    return String(query || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function getFilteredAdminManagedUsers(query = state.adminUserSearchDraft) {
    const users = getAdminManagedUsers();
    const needle = normalizeAdminUserSearchQuery(query);
    if (!needle) return users;

    return users.filter((entry) => {
      const username = normalizeUsername(entry.username || entry.name || "");
      const uid = String(entry.uid || "").trim().toLowerCase();
      return username.includes(needle) || uid.includes(needle);
    });
  }

  function isAdminManagingTargetUser(uid) {
    const safeUid = String(uid || "").trim();
    return currentIsAdmin() && safeUid && safeUid !== String(state.user?.uid || auth.currentUser?.uid || "").trim();
  }

  function createPreviewDirectory() {
    return [
      { uid: "demo-haji", username: "haji" },
      { uid: "demo-efrat", username: "efrat" },
      { uid: "demo-dilara", username: "dilara" },
      { uid: "demo-echo", username: "echo" },
      { uid: "demo-apple", username: "apple" },
      { uid: "demo-aygali", username: "aygali" },
      { uid: "demo-bousa", username: "bousa" },
      { uid: "demo-amani", username: "amani" }
    ];
  }

  function createPreviewDate(daysOffset, hour = 19, minute = 0) {
    const value = new Date();
    value.setDate(value.getDate() + daysOffset);
    value.setHours(hour, minute, 0, 0);
    return value;
  }

  function makePreviewComment(id, authorUid, authorName, text, daysOffset, hour, minute) {
    return {
      id,
      authorUid,
      authorName,
      text,
      createdAt: createPreviewDate(daysOffset, hour, minute)
    };
  }

  function createPreviewDebates() {
    const previewDebates = [
      {
        id: "preview-1",
        topic: "Should school uniforms be optional?",
        debaterAUid: "demo-haji",
        debaterAName: "haji",
        debaterBUid: "demo-efrat",
        debaterBName: "efrat",
        scheduledFor: createPreviewDate(-18, 18, 30),
        moderator: "amani",
        description: "Opening round.",
        durationMinutes: 40,
        status: "resolved",
        result: "a",
        winnerUid: "demo-haji",
        winnerName: "haji",
        createdByUid: "demo-amani",
        createdByName: "amani",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-2",
        topic: "Should phones be banned in class?",
        debaterAUid: "demo-haji",
        debaterAName: "haji",
        debaterBUid: "demo-dilara",
        debaterBName: "dilara",
        scheduledFor: createPreviewDate(-15, 17, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 45,
        status: "resolved",
        result: "b",
        winnerUid: "demo-dilara",
        winnerName: "dilara",
        createdByUid: "demo-haji",
        createdByName: "haji",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-3",
        topic: "Should cities fund more bike lanes?",
        debaterAUid: "demo-efrat",
        debaterAName: "efrat",
        debaterBUid: "demo-echo",
        debaterBName: "echo",
        scheduledFor: createPreviewDate(-13, 20, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 50,
        status: "resolved",
        result: "draw",
        winnerUid: "",
        winnerName: "",
        createdByUid: "demo-amani",
        createdByName: "amani",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-4",
        topic: "Should final exams count less?",
        debaterAUid: "demo-haji",
        debaterAName: "haji",
        debaterBUid: "demo-apple",
        debaterBName: "apple",
        scheduledFor: createPreviewDate(-11, 18, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 35,
        status: "resolved",
        result: "a",
        winnerUid: "demo-haji",
        winnerName: "haji",
        createdByUid: "demo-apple",
        createdByName: "apple",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-5",
        topic: "Should homework be limited on weekends?",
        debaterAUid: "demo-dilara",
        debaterAName: "dilara",
        debaterBUid: "demo-bousa",
        debaterBName: "bousa",
        scheduledFor: createPreviewDate(-9, 19, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 45,
        status: "resolved",
        result: "a",
        winnerUid: "demo-dilara",
        winnerName: "dilara",
        createdByUid: "demo-dilara",
        createdByName: "dilara",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-6",
        topic: "Should AI tools be allowed in essays?",
        debaterAUid: "demo-echo",
        debaterAName: "echo",
        debaterBUid: "demo-haji",
        debaterBName: "haji",
        scheduledFor: createPreviewDate(-7, 18, 30),
        moderator: "amani",
        description: "",
        durationMinutes: 55,
        status: "resolved",
        result: "b",
        winnerUid: "demo-haji",
        winnerName: "haji",
        createdByUid: "demo-echo",
        createdByName: "echo",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-7",
        topic: "Should attendance affect grades?",
        debaterAUid: "demo-efrat",
        debaterAName: "efrat",
        debaterBUid: "demo-dilara",
        debaterBName: "dilara",
        scheduledFor: createPreviewDate(-6, 17, 30),
        moderator: "amani",
        description: "",
        durationMinutes: 45,
        status: "resolved",
        result: "a",
        winnerUid: "demo-efrat",
        winnerName: "efrat",
        createdByUid: "demo-amani",
        createdByName: "amani",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-8",
        topic: "Should public transit be free for students?",
        debaterAUid: "demo-haji",
        debaterAName: "haji",
        debaterBUid: "demo-aygali",
        debaterBName: "aygali",
        scheduledFor: createPreviewDate(-5, 19, 30),
        moderator: "amani",
        description: "",
        durationMinutes: 45,
        status: "resolved",
        result: "a",
        winnerUid: "demo-haji",
        winnerName: "haji",
        createdByUid: "demo-haji",
        createdByName: "haji",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-9",
        topic: "Should students get longer lunches?",
        debaterAUid: "demo-apple",
        debaterAName: "apple",
        debaterBUid: "demo-bousa",
        debaterBName: "bousa",
        scheduledFor: createPreviewDate(-4, 18, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 40,
        status: "resolved",
        result: "b",
        winnerUid: "demo-bousa",
        winnerName: "bousa",
        createdByUid: "demo-apple",
        createdByName: "apple",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-10",
        topic: "Should group projects count less?",
        debaterAUid: "demo-dilara",
        debaterAName: "dilara",
        debaterBUid: "demo-haji",
        debaterBName: "haji",
        scheduledFor: createPreviewDate(-3, 20, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 50,
        status: "resolved",
        result: "b",
        winnerUid: "demo-haji",
        winnerName: "haji",
        createdByUid: "demo-dilara",
        createdByName: "dilara",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-11",
        topic: "Should uniforms return for all grades?",
        debaterAUid: "demo-efrat",
        debaterAName: "efrat",
        debaterBUid: "demo-aygali",
        debaterBName: "aygali",
        scheduledFor: createPreviewDate(-2, 17, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 45,
        status: "resolved",
        result: "a",
        winnerUid: "demo-efrat",
        winnerName: "efrat",
        createdByUid: "demo-efrat",
        createdByName: "efrat",
        claimedByUid: "demo-admin",
        claimedByName: "admin"
      },
      {
        id: "preview-12",
        topic: "Should students choose their own reading lists?",
        debaterAUid: "demo-haji",
        debaterAName: "haji",
        debaterBUid: "demo-echo",
        debaterBName: "echo",
        scheduledFor: createPreviewDate(2, 18, 30),
        moderator: "amani",
        description: "Feature matchup.",
        durationMinutes: 45,
        status: "scheduled",
        result: "pending",
        winnerUid: "",
        winnerName: "",
        createdByUid: "demo-haji",
        createdByName: "haji",
        claimedByUid: "",
        claimedByName: ""
      },
      {
        id: "preview-13",
        topic: "Should school start later in the morning?",
        debaterAUid: "demo-haji",
        debaterAName: "haji",
        debaterBUid: "demo-efrat",
        debaterBName: "efrat",
        scheduledFor: createPreviewDate(5, 19, 0),
        moderator: "amani",
        description: "",
        durationMinutes: 45,
        status: "scheduled",
        result: "pending",
        winnerUid: "",
        winnerName: "",
        createdByUid: "demo-amani",
        createdByName: "amani",
        claimedByUid: "",
        claimedByName: ""
      },
      {
        id: "preview-14",
        topic: "Should student councils control more budget?",
        debaterAUid: "demo-apple",
        debaterAName: "apple",
        debaterBUid: "demo-dilara",
        debaterBName: "dilara",
        scheduledFor: createPreviewDate(7, 17, 30),
        moderator: "amani",
        description: "",
        durationMinutes: 35,
        status: "scheduled",
        result: "pending",
        winnerUid: "",
        winnerName: "",
        createdByUid: "demo-apple",
        createdByName: "apple",
        claimedByUid: "",
        claimedByName: ""
      },
      {
        id: "preview-15",
        topic: "Should clubs receive mandatory funding?",
        debaterAUid: "demo-amani",
        debaterAName: "amani",
        debaterBUid: "demo-bousa",
        debaterBName: "bousa",
        scheduledFor: createPreviewDate(-1, 18, 0),
        moderator: "haji",
        description: "",
        durationMinutes: 45,
        status: "scheduled",
        result: "pending",
        winnerUid: "",
        winnerName: "",
        createdByUid: "demo-amani",
        createdByName: "amani",
        claimedByUid: "",
        claimedByName: ""
      }
    ];

    const previewCommentsById = {
      "preview-10": [
        makePreviewComment("comment-1", "demo-amani", "amani", "Good clash in the middle speeches.", -3, 21, 10),
        makePreviewComment("comment-2", "demo-haji", "haji", "Need to tighten weighing in the last rebuttal.", -3, 21, 18)
      ],
      "preview-12": [
        makePreviewComment("comment-3", "demo-echo", "echo", "I want first negative on this one.", 1, 14, 5)
      ]
    };

    const previewVideoById = {
      "preview-10": "https://www.youtube.com/watch?v=M7lc1UVf-VE"
    };

    return previewDebates.map((debate, index) => {
      const videoUrl = previewVideoById[debate.id] || "";
      const claimedByUid =
        debate.id === "preview-10" ? "demo-haji" : debate.claimedByUid || "";
      const claimedByName =
        debate.id === "preview-10" ? "haji" : debate.claimedByName || "";

      return {
        claimedAt: claimedByUid ? createPreviewDate(-1, 12, 0) : null,
        comments: previewCommentsById[debate.id] || [],
        createdAt: createPreviewDate(-20, 12, 0),
        updatedAt: createPreviewDate(-1, 12, 0),
        videoUrl,
        videoEmbedUrl: getYouTubeEmbedUrl(videoUrl),
        videoAddedByUid: videoUrl ? claimedByUid : "",
        videoAddedByName: videoUrl ? claimedByName : "",
        videoAddedAt: videoUrl ? createPreviewDate(-2, 22, 0) : null,
        ...debate,
        category: normalizeDebateCategory(debate.category || DEBATE_CATEGORIES[index % DEBATE_CATEGORIES.length].id),
        claimedByUid,
        claimedByName
      };
    });
  }

  function activatePreviewMode() {
    unsubscribeFromDirectory();
    unsubscribeFromDebates();
    unsubscribeFromSelfProfile();
    unsubscribeFromAdminProfiles();
    state.user = { uid: "demo-haji", displayName: "haji" };
    state.username = "haji";
    state.profilePictureBusy = false;
    state.selfProfile = { username: "haji", name: "haji", avatarDataUrl: "" };
    state.userProfiles = [];
    state.directory = createPreviewDirectory();
    state.debates = createPreviewDebates();
    resetSearchState();
    state.scheduleDraft = makeDefaultScheduleDraft("demo-haji");
    state.lazyDebateDraft = makeDefaultLazyDebateDraft();
    ensureScheduleDraftParticipants();
    closeUserMenu();
    showHubShell();
    renderApp();
    hideAuthLoadingScreen();
    state.bootResolved = true;
  }

  function subscribeToSelfProfile(uid) {
    const safeUid = String(uid || "").trim();
    unsubscribeFromSelfProfile();
    if (!safeUid || isPreviewMode()) return;

    state.unsubSelfProfile = db.collection("users").doc(safeUid).onSnapshot(
      (snapshot) => {
        state.selfProfile = snapshot.exists ? snapshot.data() || {} : null;
        renderApp({ preserveScroll: true });
      },
      (error) => {
        console.warn("Could not subscribe to your profile", error);
      }
    );
  }

  function subscribeToAdminProfiles() {
    unsubscribeFromAdminProfiles();
    if (!state.user || !currentIsAdmin() || isPreviewMode()) return;

    state.unsubAdminProfiles = db.collection("users").onSnapshot(
      (snapshot) => {
        state.userProfiles = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...(doc.data() || {})
        }));
        renderApp({ preserveScroll: true });
      },
      (error) => {
        console.warn("Could not subscribe to user profiles", error);
      }
    );
  }

  function subscribeToDirectory() {
    unsubscribeFromDirectory();
    state.unsubDirectory = db
      .collection("usernames")
      .orderBy(firebase.firestore.FieldPath.documentId())
      .onSnapshot(
        (snapshot) => {
          state.directory = snapshot.docs.map((doc) => {
            const data = doc.data() || {};
            const actualUid = String(data.uid || "").trim();
            const username = normalizeUsername(String(doc.id || "").trim());
            return {
              uid: actualUid || makePlaceholderUid(username),
              actualUid,
              username,
              avatarDataUrl: normalizeAvatarDataUrl(data.avatarDataUrl || ""),
              isPlaceholder: !actualUid
            };
          });
          ensureScheduleDraftParticipants();
          renderApp();
        },
        (error) => {
          console.warn("Could not subscribe to username directory", error);
          showToast("Could not load the debater directory right now.", "error");
        }
      );
  }

  function subscribeToDebates() {
    unsubscribeFromDebates();
    state.unsubDebates = db.collection("debates").orderBy("scheduledFor", "asc").onSnapshot(
      (snapshot) => {
        state.debates = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        renderApp();
      },
      (error) => {
        console.warn("Could not subscribe to debates", error);
        showToast("Could not load debates right now.", "error");
      }
    );
  }

  function unsubscribeFromDirectory() {
    if (typeof state.unsubDirectory === "function") {
      state.unsubDirectory();
    }
    state.unsubDirectory = null;
  }

  function unsubscribeFromDebates() {
    if (typeof state.unsubDebates === "function") {
      state.unsubDebates();
    }
    state.unsubDebates = null;
  }

  function unsubscribeFromSelfProfile() {
    if (typeof state.unsubSelfProfile === "function") {
      state.unsubSelfProfile();
    }
    state.unsubSelfProfile = null;
  }

  function unsubscribeFromAdminProfiles() {
    if (typeof state.unsubAdminProfiles === "function") {
      state.unsubAdminProfiles();
    }
    state.unsubAdminProfiles = null;
    state.userProfiles = [];
  }

  function syncAdminProfilesSubscription() {
    if (!state.user || isPreviewMode() || !currentIsAdmin()) {
      unsubscribeFromAdminProfiles();
      return;
    }

    if (!state.unsubAdminProfiles) {
      subscribeToAdminProfiles();
    }
  }

  function ensureScheduleDraftParticipants() {
    const currentUid = String(state.user?.uid || "").trim();
    if (currentUid && !state.scheduleDraft.debaterAUid) {
      state.scheduleDraft.debaterAUid = currentUid;
    }

    const userIds = state.directory.map((entry) => String(entry.uid || "").trim()).filter(Boolean);
    if (!state.scheduleDraft.debaterAUid && userIds[0]) {
      state.scheduleDraft.debaterAUid = userIds[0];
    }

    if (
      state.scheduleDraft.debaterBUid &&
      state.scheduleDraft.debaterBUid === state.scheduleDraft.debaterAUid
    ) {
      state.scheduleDraft.debaterBUid = "";
    }
  }

  function getDebateStatus(debate) {
    const scheduledMillis = toMillis(debate.scheduledFor);
    if (debate.status === "resolved") {
      return { label: "Resolved", className: "status-resolved" };
    }
    if (scheduledMillis && scheduledMillis < Date.now()) {
      return { label: "Overdue", className: "status-overdue" };
    }
    return { label: "Scheduled", className: "status-scheduled" };
  }

  function debateMatchesSearch(debate, searchTerm) {
    if (!searchTerm) return true;
    const haystack = [
      debate.topic,
      getDebateCategoryLabel(debate.category),
      debate.description,
      debate.moderator,
      debate.debaterAName,
      debate.debaterBName,
      debate.winnerName,
      debate.createdByName
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm.toLowerCase());
  }

  function compareDebatesAscending(left, right) {
    return toMillis(left.scheduledFor) - toMillis(right.scheduledFor);
  }

  function compareDebatesDescending(left, right) {
    return toMillis(right.scheduledFor) - toMillis(left.scheduledFor);
  }

  function debateIncludesUser(debate, uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return false;
    return safeUid === String(debate.debaterAUid || "").trim() || safeUid === String(debate.debaterBUid || "").trim();
  }

  function sortLeaderboardRows(rows) {
    return [...rows].sort((left, right) => {
      if (left.isRanked !== right.isRanked) return Number(right.isRanked) - Number(left.isRanked);
      if (right.ratingRounded !== left.ratingRounded) return right.ratingRounded - left.ratingRounded;
      if (right.debates !== left.debates) return right.debates - left.debates;
      return left.name.localeCompare(right.name);
    });
  }

  function computeLeaderboard(debates, options = {}) {
    const directoryMap = getDirectoryMap();
    const players = new Map();
    const selectedCategory = options.category ? normalizeDebateCategory(options.category) : "";

    function ensurePlayer(uid, fallbackName) {
      const safeUid = String(uid || "").trim();
      if (!safeUid) return null;

      if (!players.has(safeUid)) {
        players.set(safeUid, {
          uid: safeUid,
          name: directoryMap.get(safeUid) || normalizeUsername(fallbackName || "") || "debater",
          rating: ELO_BASELINE,
          wins: 0,
          losses: 0,
          draws: 0,
          debates: 0,
          lastDebateAt: 0
        });
      }

      const player = players.get(safeUid);
      const nextName = directoryMap.get(safeUid) || normalizeUsername(fallbackName || "");
      if (nextName) {
        player.name = nextName;
      }
      return player;
    }

    debates
      .filter((debate) => {
        return (
          debate.status === "resolved" &&
          ["a", "b", "draw"].includes(String(debate.result || "")) &&
          String(debate.debaterAUid || "").trim() &&
          String(debate.debaterBUid || "").trim() &&
          (!selectedCategory || normalizeDebateCategory(debate.category) === selectedCategory)
        );
      })
      .sort(compareDebatesAscending)
      .forEach((debate) => {
        const playerA = ensurePlayer(debate.debaterAUid, debate.debaterAName);
        const playerB = ensurePlayer(debate.debaterBUid, debate.debaterBName);
        if (!playerA || !playerB) return;

        const expectedA = 1 / (1 + 10 ** ((playerB.rating - playerA.rating) / 400));
        const expectedB = 1 - expectedA;
        const scoreA = debate.result === "a" ? 1 : debate.result === "b" ? 0 : 0.5;
        const scoreB = 1 - scoreA;

        playerA.rating += ELO_K * (scoreA - expectedA);
        playerB.rating += ELO_K * (scoreB - expectedB);
        playerA.debates += 1;
        playerB.debates += 1;
        playerA.lastDebateAt = Math.max(playerA.lastDebateAt, toMillis(debate.scheduledFor));
        playerB.lastDebateAt = Math.max(playerB.lastDebateAt, toMillis(debate.scheduledFor));

        if (debate.result === "a") {
          playerA.wins += 1;
          playerB.losses += 1;
        } else if (debate.result === "b") {
          playerB.wins += 1;
          playerA.losses += 1;
        } else {
          playerA.draws += 1;
          playerB.draws += 1;
        }
      });

    return [...players.values()].map((player) => {
      const ratingRounded = Math.round(player.rating);
      return {
        ...player,
        ratingRounded,
        isRanked: player.debates >= MIN_RANKED_DEBATES,
        recordLabel: `${player.wins}-${player.losses}${player.draws ? `-${player.draws}` : ""}`
      };
    });
  }

  function getFallbackPlayerSnapshot(uid, name) {
    return {
      uid: String(uid || "").trim(),
      name: normalizeUsername(name || "") || "debater",
      rating: ELO_BASELINE,
      ratingRounded: ELO_BASELINE,
      wins: 0,
      losses: 0,
      draws: 0,
      debates: 0,
      isRanked: false,
      recordLabel: "0-0"
    };
  }

  function buildCategoryRatingsForUser(uid, name, leaderboardsByCategory) {
    return DEBATE_CATEGORIES.map((category) => {
      const leaderboard = Array.isArray(leaderboardsByCategory?.[category.id]) ? leaderboardsByCategory[category.id] : [];
      const snapshot = leaderboard.find((player) => player.uid === uid) || getFallbackPlayerSnapshot(uid, name);
      const rank = leaderboard.filter((player) => player.isRanked).findIndex((player) => player.uid === uid) + 1;

      return {
        ...snapshot,
        id: category.id,
        label: category.label,
        rank
      };
    });
  }

  function getPreferredCategoryRating(categoryRatings, seed = "") {
    const ratings = Array.isArray(categoryRatings) ? categoryRatings : [];
    const ranked = ratings.filter((rating) => rating.isRanked && rating.rank > 0);
    if (ranked.length) {
      return [...ranked].sort((left, right) => left.rank - right.rank || right.ratingRounded - left.ratingRounded)[0];
    }

    const active = ratings.filter((rating) => Number(rating.debates || 0) > 0);
    if (active.length) {
      return [...active].sort((left, right) => right.ratingRounded - left.ratingRounded || right.debates - left.debates)[0];
    }

    const fallbackId = getStableCategoryFromSeed(seed);
    return ratings.find((rating) => rating.id === fallbackId) || ratings[0] || null;
  }

  function getCategoryRatingById(categoryRatings, categoryId, fallbackSeed = "") {
    const safeCategory = normalizeRankingsCategory(categoryId || getStableCategoryFromSeed(fallbackSeed));
    return (Array.isArray(categoryRatings) ? categoryRatings : []).find((rating) => rating.id === safeCategory) || null;
  }

  function buildViewModel() {
    const allDebates = [...state.debates].sort(compareDebatesAscending);
    const filteredDebates = allDebates.filter((debate) => debateMatchesSearch(debate, state.searchTerm));
    const upcoming = filteredDebates.filter((debate) => debate.status === "scheduled" && toMillis(debate.scheduledFor) >= Date.now());
    const overdue = filteredDebates.filter((debate) => debate.status === "scheduled" && toMillis(debate.scheduledFor) < Date.now());
    const past = filteredDebates.filter((debate) => debate.status === "resolved").sort(compareDebatesDescending);
    const viewerUid = String(state.user?.uid || "").trim();
    const activeProfileUid = String(state.profileUid || viewerUid).trim() || viewerUid;
    const viewerName = state.username || getNameForUid(viewerUid, "debater");
    const activeProfileName = getNameForUid(activeProfileUid, activeProfileUid === viewerUid ? viewerName : "debater");
    const overallLeaderboard = sortLeaderboardRows(computeLeaderboard(allDebates));
    const leaderboardsByCategory = Object.fromEntries(
      DEBATE_CATEGORIES.map((category) => [category.id, sortLeaderboardRows(computeLeaderboard(allDebates, { category: category.id }))])
    );
    const viewerCategoryRatings = buildCategoryRatingsForUser(viewerUid, viewerName, leaderboardsByCategory);
    const profileCategoryRatings = buildCategoryRatingsForUser(activeProfileUid, activeProfileName, leaderboardsByCategory);
    const preferredViewerCategory = getPreferredCategoryRating(viewerCategoryRatings, viewerUid || viewerName);
    const preferredProfileCategory = getPreferredCategoryRating(profileCategoryRatings, activeProfileUid || activeProfileName);
    const rankingsCategory = normalizeRankingsCategory(state.rankingsCategory || preferredViewerCategory?.id || DEBATE_CATEGORIES[0].id);
    const sideLeaderboardCategory = normalizeRankingsCategory(preferredViewerCategory?.id || getStableCategoryFromSeed(viewerUid || viewerName));
    const leaderboardSearch = state.searchTerm.toLowerCase();
    const visibleLeaderboard = (leaderboardsByCategory[rankingsCategory] || []).filter((player) => {
      if (!leaderboardSearch) return true;
      return player.name.includes(leaderboardSearch);
    });
    const ranked = visibleLeaderboard.filter((player) => player.isRanked);
    const topRanked = (leaderboardsByCategory[sideLeaderboardCategory] || []).filter((player) => player.isRanked).slice(0, 5);
    const myDebatesUpcoming = upcoming.filter((debate) => debateIncludesUser(debate, viewerUid));
    const myDebatesPast = past.filter((debate) => debateIncludesUser(debate, viewerUid));
    const mySnapshot = getCategoryRatingById(viewerCategoryRatings, sideLeaderboardCategory, viewerUid || viewerName) || getFallbackPlayerSnapshot(viewerUid, viewerName);
    const myRank = Number(mySnapshot?.rank || 0);
    const profileSnapshot =
      overallLeaderboard.find((player) => player.uid === activeProfileUid) ||
      getFallbackPlayerSnapshot(activeProfileUid, activeProfileName);
    const profileDebatesUpcoming = upcoming.filter((debate) => debateIncludesUser(debate, activeProfileUid));
    const profileDebatesPast = past.filter((debate) => debateIncludesUser(debate, activeProfileUid));
    const profileIsCurrentUser = activeProfileUid === viewerUid;
    const selectedDebate = allDebates.find((debate) => debate.id === String(state.debateId || "").trim()) || null;
    const selectedDebateComments = getDebateComments(selectedDebate);
    const selectedDebateVideoEmbedUrl = getYouTubeEmbedUrl(selectedDebate?.videoUrl || selectedDebate?.videoEmbedUrl || "");
    const selectedDebateSourcePage = selectedDebate?.status === "resolved" ? "archive" : "schedule";
    const selectedDebateCanEditVideo = canEditDebateVideo(selectedDebate);

    return {
      totalDebaters: state.directory.length,
      upcoming,
      overdue,
      past,
      leaderboard: visibleLeaderboard,
      ranked,
      topRanked,
      nextDebate: upcoming[0] || overdue[0] || null,
      mySnapshot,
      myRank,
      myDebatesUpcoming,
      myDebatesPast,
      viewerCategoryRatings,
      preferredViewerCategory,
      sideLeaderboardCategory,
      profileUid: activeProfileUid,
      profileSnapshot,
      profileCategoryRatings,
      preferredProfileCategory,
      profileDebatesUpcoming,
      profileDebatesPast,
      profileIsCurrentUser,
      rankingsCategory,
      rankingsCategoryLabel: getDebateCategoryLabel(rankingsCategory),
      selectedDebate,
      selectedDebateComments,
      selectedDebateVideoEmbedUrl,
      selectedDebateSourcePage,
      selectedDebateCanEditVideo,
      unresolvedQueue: allDebates
        .filter((debate) => debate.status === "scheduled")
        .sort(compareDebatesAscending)
    };
  }

  function renderApp(options = {}) {
    const preserveScroll = Boolean(options.preserveScroll);
    const scrollX = preserveScroll ? window.scrollX : 0;
    const scrollY = preserveScroll ? window.scrollY : 0;
    const mobileViewport = isMobileViewport();
    state.isMobileViewport = mobileViewport;
    document.body.classList.toggle("is-mobile-app", mobileViewport);
    syncThemeUi();

    if (!state.user) {
      showAuthScreen();
      return;
    }

    syncAdminProfilesSubscription();

    if (!currentIsAdmin() && state.currentPage === "admin") {
      setPage("dashboard", { replace: true });
      return;
    }

    if (mobileViewport && state.currentPage === "admin") {
      setPage("settings", { replace: true });
      return;
    }

    if (!mobileViewport && state.currentPage === "settings") {
      setPage(currentIsAdmin() ? "admin" : "dashboard", { replace: true });
      return;
    }

    showHubShell();
    const model = buildViewModel();
    syncSearchUi();
    syncPrimaryNavLink(mobileViewport);
    syncSettingsNavLink(mobileViewport);

    syncUserAvatarUi();
    if (el.userName) el.userName.textContent = state.username || "debater";
    if (el.menuChangeProfilePictureBtn) {
      el.menuChangeProfilePictureBtn.disabled = state.profilePictureBusy;
      el.menuChangeProfilePictureBtn.textContent = state.profilePictureBusy
        ? "Uploading..."
        : "Change Profile Picture";
    }
    if (el.headerRankedCount) el.headerRankedCount.textContent = model.myRank > 0 ? String(model.myRank) : "—";
    if (el.headerUpcomingCount) el.headerUpcomingCount.textContent = String(model.upcoming.length);
    const activeNavPage =
      state.currentPage === "debate"
        ? model.selectedDebateSourcePage || (mobileViewport ? "search" : "dashboard")
        : state.currentPage;

    document.querySelectorAll("[data-page-link]").forEach((node) => {
      const matches = node.getAttribute("data-page-link") === activeNavPage;
      node.classList.toggle("is-active", matches);
    });

    const nextMainContent = renderCurrentPage(model);
    if (el.mainContent && el.mainContent.innerHTML !== nextMainContent) {
      el.mainContent.innerHTML = nextMainContent;
    }
    if (el.sideContent) {
      el.sideContent.classList.toggle("hidden", mobileViewport);
      const nextSideContent = mobileViewport ? "" : renderSideRail(model);
      if (el.sideContent.innerHTML !== nextSideContent) {
        el.sideContent.innerHTML = nextSideContent;
      }
    }
    syncQueuePanelHeight();

    if (preserveScroll) {
      window.requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });
    }
  }

  function renderCurrentPage(model) {
    if (state.isMobileViewport) {
      return renderMobileCurrentPage(model);
    }

    switch (state.currentPage) {
      case "debate":
        return renderDebatePage(model);
      case "search":
        return renderSearchPage();
      case "schedule":
        return renderSchedulePage(model);
      case "archive":
        return renderArchivePage(model);
      case "rankings":
        return renderRankingsPage(model);
      case "admin":
        return renderAdminPage(model);
      case "dashboard":
      default:
        return renderDashboardPage(model);
    }
  }

  function renderSearchPage() {
    const query = String(state.searchDraft || "").trim();
    return `
      <section class="page-shell">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Search</span>
            <h2 class="page-title">${escapeHtml(query ? `Results for "${query}"` : "Search results")}</h2>
          </div>
        </section>

        <section class="section-panel search-results-shell">
          ${renderSearchResultsList("search-results-panel")}
        </section>
      </section>
    `;
  }

  function renderMobileCurrentPage(model) {
    switch (state.currentPage) {
      case "debate":
        return renderMobileDebatePage(model);
      case "search":
        return renderMobileSearchPage();
      case "schedule":
        return renderMobileSchedulePage(model);
      case "archive":
        return renderMobileArchivePage(model);
      case "rankings":
        return renderMobileRankingsPage(model);
      case "settings":
        return renderMobileSettingsPage(model);
      case "admin":
        return renderMobileAdminPage(model);
      case "dashboard":
      default:
        return renderMobileDashboardPage(model);
    }
  }

  function renderMobileSearchPage() {
    const hasQuery = Boolean(String(state.searchDraft || "").trim());

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <span class="page-kicker">Search</span>
          <h2 class="mobile-page-title">Find debates and debaters</h2>
          <label class="search-field mobile-search-field" for="mobile-search-input">
            <span class="search-label">Search</span>
            <input
              id="mobile-search-input"
              type="search"
              data-mobile-search-input="true"
              value="${escapeHtml(state.searchDraft)}"
              placeholder="Topic, debater, moderator..."
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              aria-controls="mobile-search-results"
              aria-expanded="${hasQuery ? "true" : "false"}"
            />
            <button
              class="search-clear${hasQuery ? "" : " hidden"}"
              type="button"
              data-action="clear-mobile-search"
              aria-label="Clear search"
            >
              &times;
            </button>
          </label>
          <div id="mobile-search-results">
            ${renderMobileSearchResults()}
          </div>
        </section>
      </section>
    `;
  }

  function renderCompactRecordLine(player) {
    return `${Number(player?.wins || 0)}W • ${Number(player?.losses || 0)}L • ${Number(player?.draws || 0)}D`;
  }

  function renderMobileDebateRow(debate, options = {}) {
    const isBusy = state.actionBusyKey.startsWith(`${debate.id}:`);
    const winnerName = getDebateWinnerName(debate);
    const matchup = `${normalizeUsername(debate.debaterAName || "debater")} vs ${normalizeUsername(
      debate.debaterBName || "debater"
    )}`;
    const resultLabel =
      debate.status === "resolved"
        ? debate.result === "draw"
          ? "Draw"
          : `${winnerName || "Winner"} won`
        : "Pending";
    const resultTone =
      debate.status !== "resolved" ? "" : debate.result === "draw" ? " draw" : " positive";

    return `
      <article class="mobile-entry">
        <button
          class="mobile-list-row debate-card-link"
          type="button"
          data-action="open-debate"
          data-debate-id="${escapeHtml(debate.id)}"
        >
          <strong class="mobile-row-title">${escapeHtml(debate.topic || "Untitled debate")}</strong>
          <div class="mobile-row-meta">${escapeHtml(formatDateTime(debate.scheduledFor))}</div>
          <div class="mobile-row-matchup">${escapeHtml(matchup)}</div>
          <div class="mobile-row-foot">
            ${renderCategoryBadge(debate.category)}
            <span class="result-pill${resultTone}">${escapeHtml(resultLabel)}</span>
          </div>
        </button>
        ${
          options.showAdminControls && currentIsAdmin()
            ? `
              <div class="mobile-admin-stack" data-action="hold-admin-controls">
                ${renderResolveVideoField(debate, { mobile: true })}
                <div class="mobile-admin-actions">
                  <button
                    class="result-btn win"
                    type="button"
                    data-action="claim-result"
                    data-debate-id="${escapeHtml(debate.id)}"
                    data-outcome="a"
                    ${isBusy ? "disabled" : ""}
                  >
                    ${escapeHtml(normalizeUsername(debate.debaterAName || "A"))} wins
                  </button>
                  <button
                    class="result-btn win"
                    type="button"
                    data-action="claim-result"
                    data-debate-id="${escapeHtml(debate.id)}"
                    data-outcome="b"
                    ${isBusy ? "disabled" : ""}
                  >
                    ${escapeHtml(normalizeUsername(debate.debaterBName || "B"))} wins
                  </button>
                  <button
                    class="result-btn draw"
                    type="button"
                    data-action="claim-result"
                    data-debate-id="${escapeHtml(debate.id)}"
                    data-outcome="draw"
                    ${isBusy ? "disabled" : ""}
                  >
                    Draw
                  </button>
                </div>
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function renderMobileDebateList(debates, options = {}) {
    const list = Array.isArray(debates) ? debates : [];
    if (!list.length) {
      return renderEmptyState(options.emptyTitle || "Nothing here yet", "");
    }

    return `
      <div class="mobile-list">
        ${list
          .slice(0, Number(options.limit) > 0 ? Number(options.limit) : list.length)
          .map((debate) => renderMobileDebateRow(debate, options))
          .join("")}
      </div>
    `;
  }

  function renderMobileRankingList(rows, emptyLabel) {
    if (!rows.length) {
      return renderEmptyState(emptyLabel, "");
    }

    let rankedPosition = 0;

    return `
      <div class="mobile-list mobile-ranking-list">
        ${rows
          .map((player) => {
            const safeUid = String(player.uid || "").trim();
            const rankLabel = player.isRanked ? String(++rankedPosition) : "—";
            return `
              <button
                class="mobile-ranking-row"
                type="button"
                ${safeUid ? `data-action="open-profile" data-profile-uid="${escapeHtml(safeUid)}"` : "disabled"}
              >
                <span class="rank-badge">${rankLabel}</span>
                <span class="mobile-ranking-copy">
                  ${renderProfileIdentityContent(player.name, player.uid, {
                    showAvatar: true,
                    avatarClassName: "profile-avatar profile-avatar-lg",
                    labelClassName: "profile-link-strong"
                  })}
                  <span class="mobile-row-meta">${escapeHtml(renderCompactRecordLine(player))}</span>
                </span>
                <span class="mobile-ranking-side">${player.ratingRounded}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderMobileDashboardPage(model) {
    const nextDebate = model.profileDebatesUpcoming[0] || null;
    const avatarDataUrl = getAvatarDataUrlForUid(model.profileUid || model.profileSnapshot.uid);
    const bestCategory = model.preferredProfileCategory || model.profileCategoryRatings[0] || null;
    const bestRankLabel = getCategoryRankLabel(bestCategory);

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block mobile-profile-block">
          <span class="page-kicker">${model.profileIsCurrentUser ? "My Profile" : "Profile"}</span>
          <div class="mobile-identity">
            ${renderAvatarChipHtml({
              name: model.profileSnapshot.name,
              avatarDataUrl,
              seed: model.profileUid || model.profileSnapshot.name,
              className: "page-avatar"
            })}
            <div class="mobile-identity-copy">
              <h2 class="mobile-page-title">${escapeHtml(model.profileSnapshot.name)}</h2>
            </div>
          </div>
          ${renderCategoryRatingGrid(model.profileCategoryRatings, {
            mobile: true,
            preferredCategoryId: model.preferredProfileCategory?.id
          })}
          <div class="mobile-inline-stats">
            <article class="mobile-stat">
              <span class="summary-label">Debates</span>
              <strong>${model.profileSnapshot.debates}</strong>
            </article>
            <article class="mobile-stat">
              <span class="summary-label">Best Rank</span>
              <strong>${escapeHtml(bestRankLabel)}</strong>
              <span class="mobile-row-meta">${escapeHtml(bestCategory?.label || "Category")}</span>
            </article>
          </div>
          <div class="mobile-record-line">
            ${renderRecordChips(model.profileSnapshot, { compact: true })}
          </div>
        </section>

        <section class="mobile-block">
          <div class="mobile-section-head">
            <h3>Upcoming</h3>
          </div>
          ${
            nextDebate
              ? renderMobileDebateList([nextDebate])
              : renderEmptyState("No upcoming debates", "")
          }
        </section>

        <section class="mobile-block">
          <div class="mobile-section-head">
            <h3>Results</h3>
          </div>
          ${renderMobileDebateList(model.profileDebatesPast, {
            emptyTitle: "No results yet",
            limit: 4
          })}
        </section>
      </section>
    `;
  }

  function renderMobileDebatePage(model) {
    const debate = model.selectedDebate;
    if (!debate) {
      return `
        <section class="page-shell mobile-page">
          <section class="mobile-block">
            ${renderEmptyState("Debate not found", "")}
          </section>
        </section>
      `;
    }

    const aWinner = debate.status === "resolved" && debate.result === "a";
    const bWinner = debate.status === "resolved" && debate.result === "b";
    const aLoser = debate.status === "resolved" && debate.result === "b";
    const bLoser = debate.status === "resolved" && debate.result === "a";
    const winnerName = getDebateWinnerName(debate);
    const commentBusy = state.actionBusyKey === `${debate.id}:comment`;
    const videoBusy = state.actionBusyKey === `${debate.id}:video`;

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <span class="page-kicker">Debate</span>
          <h2 class="mobile-page-title">${escapeHtml(debate.topic || "Untitled debate")}</h2>
          <div class="badge-row">
            ${renderCategoryBadge(debate.category)}
          </div>
          <div class="people-row mobile-debate-people">
            ${renderPersonBadge(debate.debaterAName, debate.debaterAUid, { isWinner: aWinner, isLoser: aLoser })}
            <span class="mini-tag">vs</span>
            ${renderPersonBadge(debate.debaterBName, debate.debaterBUid, { isWinner: bWinner, isLoser: bLoser })}
          </div>
          <div class="mobile-inline-stats">
            <article class="mobile-stat">
              <span class="summary-label">Scheduled</span>
              <strong>${escapeHtml(formatDateTime(debate.scheduledFor))}</strong>
            </article>
            <article class="mobile-stat">
              <span class="summary-label">Category</span>
              <strong>${escapeHtml(getDebateCategoryLabel(debate.category))}</strong>
            </article>
            <article class="mobile-stat${winnerName ? " is-winner" : ""}">
              <span class="summary-label">Winner</span>
              <strong>${escapeHtml(winnerName || "N/A")}</strong>
            </article>
          </div>
        </section>

        <section class="mobile-block">
          <div class="mobile-section-head">
            <h3>Video</h3>
          </div>
          ${
            model.selectedDebateVideoEmbedUrl
              ? `
                <div class="video-frame-shell">
                  <iframe
                    src="${escapeHtml(model.selectedDebateVideoEmbedUrl)}"
                    title="${escapeHtml(debate.topic || "Debate video")}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                  ></iframe>
                </div>
              `
              : renderEmptyState(debate.status === "resolved" ? "No video yet" : "Video after resolution", "")
          }
          ${
            model.selectedDebateCanEditVideo
              ? `
                <form class="stack-form" id="debate-video-form">
                  <input type="hidden" name="debateId" value="${escapeHtml(debate.id)}" />
                  <label class="field">
                    <span>YouTube link</span>
                    <input
                      type="url"
                      name="videoUrl"
                      value="${escapeHtml(debate.videoUrl || "")}"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </label>
                  <div class="form-actions">
                    <button class="primary-btn" type="submit" ${videoBusy ? "disabled" : ""}>
                      ${videoBusy ? "Saving..." : debate.videoUrl ? "Update video" : "Add video"}
                    </button>
                  </div>
                </form>
              `
              : ""
          }
        </section>

        <section class="mobile-block">
          <div class="mobile-section-head">
            <h3>Comments</h3>
          </div>
          ${renderCommentList(model.selectedDebateComments)}
          <form class="stack-form" id="debate-comment-form">
            <input type="hidden" name="debateId" value="${escapeHtml(debate.id)}" />
            <label class="field">
              <span>Add comment</span>
              <textarea name="commentText" placeholder="Add a quick note or takeaway."></textarea>
            </label>
            <div class="form-actions">
              <button class="primary-btn" type="submit" ${commentBusy ? "disabled" : ""}>
                ${commentBusy ? "Posting..." : "Post comment"}
              </button>
            </div>
          </form>
        </section>
      </section>
    `;
  }

  function renderScheduleTabs(selectedSection) {
    const safeSection = normalizeScheduleSection(selectedSection);
    const tabs = [
      { id: "new", label: "New Debate" },
      { id: "upcoming", label: "Upcoming Debates" }
    ];

    return `
      <div class="leaderboard-tabs schedule-tabs" role="tablist" aria-label="Schedule sections">
        ${tabs
          .map((tab) => {
            const isActive = tab.id === safeSection;
            return `
              <button
                class="tab-btn${isActive ? " is-active" : ""}"
                type="button"
                role="tab"
                aria-selected="${isActive ? "true" : "false"}"
                data-action="set-schedule-section"
                data-value="${escapeHtml(tab.id)}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderMobileScheduleFormBlock() {
    return `
      <section class="mobile-block">
        <form class="schedule-form" id="schedule-form">
          <label class="field">
            <span>Topic</span>
            <input
              type="text"
              name="topic"
              data-draft-owner="schedule"
              data-draft-field="topic"
              value="${escapeHtml(state.scheduleDraft.topic)}"
              placeholder="Should cities replace cars with public transit corridors?"
              required
            />
          </label>
          ${renderDebateCategorySelect("schedule", state.scheduleDraft.category)}
          <div class="field-row">
            ${renderDebaterSelect({
              label: "Debater A",
              field: "debaterAUid",
              selectedUid: state.scheduleDraft.debaterAUid,
              otherUid: state.scheduleDraft.debaterBUid
            })}
            ${renderDebaterSelect({
              label: "Debater B",
              field: "debaterBUid",
              selectedUid: state.scheduleDraft.debaterBUid,
              otherUid: state.scheduleDraft.debaterAUid
            })}
          </div>
          <label class="field">
            <span>Date and time</span>
            <input
              type="datetime-local"
              name="scheduledFor"
              data-draft-owner="schedule"
              data-draft-field="scheduledFor"
              value="${escapeHtml(state.scheduleDraft.scheduledFor)}"
              required
            />
          </label>
          <label class="field">
            <span>Moderator</span>
            <input
              type="text"
              name="moderator"
              data-draft-owner="schedule"
              data-draft-field="moderator"
              value="${escapeHtml(state.scheduleDraft.moderator)}"
              placeholder="Optional moderator"
            />
          </label>
          <div class="form-actions">
            <button class="primary-btn" type="submit" ${state.scheduleSaving ? "disabled" : ""}>
              ${state.scheduleSaving ? "Scheduling..." : "Schedule"}
            </button>
            <button class="ghost-btn" type="button" data-action="reset-schedule-form">Reset</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderMobileUpcomingDebatesBlock(model) {
    return `
      <section class="mobile-block">
        <div class="mobile-section-head">
          <h3>Upcoming Debates</h3>
        </div>
        ${renderMobileDebateList([...model.upcoming, ...model.overdue], {
          emptyTitle: "No scheduled debates"
        })}
      </section>
    `;
  }

  function renderMobileSchedulePage(model) {
    const scheduleSection = normalizeScheduleSection(state.scheduleSection);

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <span class="page-kicker">Schedule</span>
          <h2 class="mobile-page-title">Schedule</h2>
          ${renderScheduleTabs(scheduleSection)}
        </section>
        ${scheduleSection === "upcoming" ? renderMobileUpcomingDebatesBlock(model) : renderMobileScheduleFormBlock()}
      </section>
    `;
  }

  function renderMobileArchivePage(model) {
    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <span class="page-kicker">Past Debates</span>
          <h2 class="mobile-page-title">Archive</h2>
          ${renderMobileDebateList(model.past, {
            emptyTitle: state.searchTerm ? "No past debates match that search" : "No past debates yet"
          })}
        </section>
      </section>
    `;
  }

  function renderMobileRankingsPage(model) {
    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <span class="page-kicker">Rankings</span>
          <h2 class="mobile-page-title">Rankings</h2>
          ${renderLeaderboardTabs(model.rankingsCategory)}
          ${renderMobileRankingList(model.leaderboard, `No ${model.rankingsCategoryLabel.toLowerCase()} debaters yet`)}
        </section>
      </section>
    `;
  }

  function renderMobileSettingsRoot(model) {
    const items = [
      {
        section: "profile",
        title: "Profile Settings",
        copy: "Light mode, username, password, avatar, and logout."
      }
    ];

    if (currentIsAdmin()) {
      items.push(
        {
          section: "awaiting",
          title: "Awaiting Results",
          copy: model.unresolvedQueue.length
            ? `${model.unresolvedQueue.length} debate${model.unresolvedQueue.length === 1 ? "" : "s"} waiting.`
            : "Nothing is waiting on admin."
        },
        {
          section: "lazy",
          title: "Too Lazy Debates",
          copy: "Log a finished debate directly."
        },
        {
          section: "users",
          title: "Users",
          copy: "Search and manage user accounts."
        }
      );
    }

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <span class="page-kicker">Settings</span>
          <h2 class="mobile-page-title">Settings</h2>
          <div class="mobile-settings-stack">
            ${items
              .map((item) => {
                return `
                  <button
                    class="mobile-settings-tab"
                    type="button"
                    data-action="open-settings-section"
                    data-settings-section="${escapeHtml(item.section)}"
                  >
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.copy)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </section>
      </section>
    `;
  }

  function renderMobileSettingsSectionShell(title, content) {
    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block">
          <div class="mobile-settings-head">
            <button
              class="ghost-btn mobile-settings-back"
              type="button"
              data-action="open-settings-section"
              data-settings-section="root"
            >
              Back
            </button>
            <div class="mobile-settings-title">
              <span class="page-kicker">Settings</span>
              <h2 class="mobile-page-title">${escapeHtml(title)}</h2>
            </div>
          </div>
          ${content}
        </section>
      </section>
    `;
  }

  function renderMobileProfileSettingsPage() {
    const themeLabel = state.themeMode === "dark" ? "Light Mode" : "Dark Mode";

    return renderMobileSettingsSectionShell(
      "Profile Settings",
      `
        <div class="mobile-settings-stack">
          <button class="mobile-settings-tab" type="button" data-action="mobile-open-own-profile">
            <strong>Open Profile</strong>
            <span>View your profile page.</span>
          </button>
          <button class="mobile-settings-tab" type="button" data-action="mobile-toggle-theme">
            <strong>${escapeHtml(themeLabel)}</strong>
            <span>Switch the app appearance.</span>
          </button>
          <button class="mobile-settings-tab" type="button" data-action="mobile-change-username">
            <strong>Change Username</strong>
            <span>Update the name shown across debates and rankings.</span>
          </button>
          <button class="mobile-settings-tab" type="button" data-action="mobile-change-avatar">
            <strong>Change Profile Picture</strong>
            <span>Upload a new avatar.</span>
          </button>
          <button class="mobile-settings-tab" type="button" data-action="mobile-change-password">
            <strong>Change Password</strong>
            <span>Set a new password for this account.</span>
          </button>
          <button class="mobile-settings-tab is-danger" type="button" data-action="mobile-log-out">
            <strong>Log Out</strong>
            <span>Sign out of DialecticHub.</span>
          </button>
        </div>
      `
    );
  }

  function renderMobileAwaitingResultsPage(model) {
    return renderMobileSettingsSectionShell(
      "Awaiting Results",
      renderMobileDebateList(model.unresolvedQueue, {
        emptyTitle: "Nothing is waiting on admin",
        showAdminControls: true
      })
    );
  }

  function renderMobileTooLazyDebatesPage() {
    const lazyDraft = state.lazyDebateDraft;

    return renderMobileSettingsSectionShell(
      "Too Lazy Debates",
      `
        <form class="schedule-form" id="lazy-debate-form">
          <label class="field">
            <span>Topic</span>
            <input
              type="text"
              name="topic"
              data-draft-owner="lazy"
              data-draft-field="topic"
              value="${escapeHtml(lazyDraft.topic)}"
              placeholder="Should group projects count less?"
              required
            />
          </label>
          ${renderDebateCategorySelect("lazy", lazyDraft.category)}
          <div class="field-row">
            ${renderDebaterSelect({
              label: "Debater A",
              field: "debaterAUid",
              selectedUid: lazyDraft.debaterAUid,
              otherUid: lazyDraft.debaterBUid,
              owner: "lazy"
            })}
            ${renderDebaterSelect({
              label: "Debater B",
              field: "debaterBUid",
              selectedUid: lazyDraft.debaterBUid,
              otherUid: lazyDraft.debaterAUid,
              owner: "lazy"
            })}
          </div>
          <label class="field">
            <span>Date and time</span>
            <input
              type="datetime-local"
              name="scheduledFor"
              data-draft-owner="lazy"
              data-draft-field="scheduledFor"
              value="${escapeHtml(lazyDraft.scheduledFor)}"
              required
            />
          </label>
          <label class="field">
            <span>Moderator</span>
            <input
              type="text"
              name="moderator"
              data-draft-owner="lazy"
              data-draft-field="moderator"
              value="${escapeHtml(lazyDraft.moderator)}"
              placeholder="Optional moderator"
            />
          </label>
          <label class="field">
            <span>YouTube link</span>
            <input
              type="url"
              name="videoUrl"
              data-draft-owner="lazy"
              data-draft-field="videoUrl"
              value="${escapeHtml(lazyDraft.videoUrl)}"
              placeholder="Optional YouTube link"
            />
          </label>
          <div class="field">
            <span>Winner</span>
            <input type="hidden" name="result" value="${escapeHtml(lazyDraft.result === "b" || lazyDraft.result === "draw" ? lazyDraft.result : "a")}" />
            <div class="winner-picker">
              ${renderLazyWinnerButtons()}
            </div>
          </div>
          <div class="form-actions">
            <button class="primary-btn" type="submit" ${state.adminLogSaving ? "disabled" : ""}>
              ${state.adminLogSaving ? "Logging..." : "Log debate"}
            </button>
            <button class="ghost-btn" type="button" data-action="reset-lazy-form">Reset</button>
          </div>
        </form>
      `
    );
  }

  function renderMobileUsersSettingsPage() {
    return renderMobileSettingsSectionShell("Users", renderAdminUserList());
  }

  function renderMobileSettingsPage(model) {
    const section = normalizeSettingsSection(state.settingsSection);

    if (section === "profile") {
      return renderMobileProfileSettingsPage();
    }

    if (currentIsAdmin()) {
      if (section === "awaiting") {
        return renderMobileAwaitingResultsPage(model);
      }
      if (section === "lazy") {
        return renderMobileTooLazyDebatesPage();
      }
      if (section === "users") {
        return renderMobileUsersSettingsPage();
      }
    }

    return renderMobileSettingsRoot(model);
  }

  function renderMobileAdminPage(model) {
    return renderMobileSettingsPage(model);
  }

  function renderDashboardPage(model) {
    const nextForProfile = model.profileDebatesUpcoming[0] || null;
    const drawLabel = model.profileSnapshot.draws ? String(model.profileSnapshot.draws) : "0";
    const avatarDataUrl = getAvatarDataUrlForUid(model.profileUid || model.profileSnapshot.uid);
    const bestCategory = model.preferredProfileCategory || model.profileCategoryRatings[0] || null;
    const bestRankLabel = getCategoryRankLabel(bestCategory);

    return `
      <section class="page-shell">
        <section class="page-hero profile-hero">
          <div class="page-hero-identity">
            ${renderAvatarChipHtml({
              name: model.profileSnapshot.name,
              avatarDataUrl,
              seed: model.profileUid || model.profileSnapshot.name,
              className: "page-avatar"
            })}
            <div class="page-hero-copy">
              <span class="page-kicker">${model.profileIsCurrentUser ? "My Profile" : "Profile"}</span>
              <h2 class="page-title">${escapeHtml(model.profileSnapshot.name)}</h2>
            </div>
          </div>
          <div class="hero-actions">
            ${
              model.profileIsCurrentUser
                ? `
                  <button class="primary-btn" type="button" data-page-link="schedule">Schedule a Debate</button>
                  <button class="secondary-btn" type="button" data-page-link="archive">View Archive</button>
                `
                : `
                  <button class="primary-btn" type="button" data-page-link="rankings">Open Rankings</button>
                  <button class="secondary-btn" type="button" data-page-link="dashboard">My Profile</button>
                `
            }
          </div>
          ${renderCategoryRatingGrid(model.profileCategoryRatings, {
            preferredCategoryId: model.preferredProfileCategory?.id
          })}
          <div class="summary-grid">
            <article class="summary-tile">
              <span class="summary-label">Record</span>
              ${renderRecordChips(model.profileSnapshot)}
            </article>
            <article class="summary-tile">
              <span class="summary-label">Debates</span>
              <strong class="summary-value">${model.profileSnapshot.debates}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Upcoming</span>
              <strong class="summary-value">${model.profileDebatesUpcoming.length}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Best Rank</span>
              <strong class="summary-value summary-value-compact">${escapeHtml(bestRankLabel)}</strong>
              <span class="category-rating-meta">${escapeHtml(bestCategory?.label || "Category")}</span>
            </article>
          </div>
        </section>

        <section class="section-grid">
          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Upcoming</h3>
              </div>
            </div>
            ${
              nextForProfile
                ? renderDebateCard(nextForProfile, { showAdminControls: currentIsAdmin() })
                : renderEmptyState("No upcoming debates", "")
            }
          </section>

          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Results</h3>
              </div>
            </div>
            ${renderScrollablePanel(
              renderDebateList(model.profileDebatesPast, {
                emptyTitle: "No results yet",
                emptyCopy: "",
                showAdminControls: currentIsAdmin()
              }),
              "is-results"
            )}
          </section>
        </section>

        <section class="section-panel">
          <div class="section-header">
            <div>
              <h3 class="section-title">Activity</h3>
            </div>
            <div class="section-actions">
              <button class="secondary-btn" type="button" data-page-link="rankings">Open Rankings</button>
            </div>
          </div>
          <div class="summary-grid">
            <article class="summary-tile">
              <span class="summary-label">Wins</span>
              <strong class="summary-value record-total win">${model.profileSnapshot.wins}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Losses</span>
              <strong class="summary-value record-total loss">${model.profileSnapshot.losses}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Draws</span>
              <strong class="summary-value record-total draw">${drawLabel}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Upcoming</span>
              <strong class="summary-value">${model.profileDebatesUpcoming.length}</strong>
            </article>
          </div>
        </section>
      </section>
    `;
  }

  function renderDebatePage(model) {
    const debate = model.selectedDebate;
    if (!debate) {
      return `
        <section class="page-shell">
          <section class="section-panel">
            ${renderEmptyState("Debate not found", "")}
            <div class="form-actions">
              <button class="secondary-btn" type="button" data-page-link="archive">Back to archive</button>
            </div>
          </section>
        </section>
      `;
    }

    const aWinner = debate.status === "resolved" && debate.result === "a";
    const bWinner = debate.status === "resolved" && debate.result === "b";
    const aLoser = debate.status === "resolved" && debate.result === "b";
    const bLoser = debate.status === "resolved" && debate.result === "a";
    const winnerName = getDebateWinnerName(debate);
    const commentBusy = state.actionBusyKey === `${debate.id}:comment`;
    const videoBusy = state.actionBusyKey === `${debate.id}:video`;

    return `
      <section class="page-shell schedule-page">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Debate</span>
            <h2 class="page-title">${escapeHtml(debate.topic || "Untitled debate")}</h2>
            <div class="badge-row">
              ${renderCategoryBadge(debate.category)}
            </div>
          </div>

          <div class="people-row">
            ${renderPersonBadge(debate.debaterAName, debate.debaterAUid, { isWinner: aWinner, isLoser: aLoser })}
            <span class="mini-tag">vs</span>
            ${renderPersonBadge(debate.debaterBName, debate.debaterBUid, { isWinner: bWinner, isLoser: bLoser })}
          </div>

          <div class="detail-grid debate-detail-grid">
            <div class="detail-row">
              <span class="detail-label">Scheduled</span>
              <strong>${escapeHtml(formatDateTime(debate.scheduledFor))}</strong>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category</span>
              <strong>${escapeHtml(getDebateCategoryLabel(debate.category))}</strong>
            </div>
            <div class="detail-row${winnerName ? " is-winner" : ""}">
              <span class="detail-label">Winner</span>
              <strong>${escapeHtml(winnerName || "N/A")}</strong>
            </div>
          </div>

        </section>

        <section class="section-grid debate-page-grid">
          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Video</h3>
              </div>
            </div>

            ${
              model.selectedDebateVideoEmbedUrl
                ? `
                  <div class="video-frame-shell">
                    <iframe
                      src="${escapeHtml(model.selectedDebateVideoEmbedUrl)}"
                      title="${escapeHtml(debate.topic || "Debate video")}"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                    ></iframe>
                  </div>
                `
                : renderEmptyState(
                    debate.status === "resolved" ? "No video yet" : "Video after resolution",
                    ""
                  )
            }

            ${
              model.selectedDebateCanEditVideo
                ? `
                  <form class="stack-form" id="debate-video-form">
                    <input type="hidden" name="debateId" value="${escapeHtml(debate.id)}" />
                    <label class="field">
                      <span>YouTube link</span>
                      <input
                        type="url"
                        name="videoUrl"
                        value="${escapeHtml(debate.videoUrl || "")}"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </label>
                    <div class="form-actions">
                      <button class="primary-btn" type="submit" ${videoBusy ? "disabled" : ""}>
                        ${videoBusy ? "Saving..." : debate.videoUrl ? "Update video" : "Add video"}
                      </button>
                    </div>
                  </form>
                `
                : ""
            }
          </section>

          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Comments</h3>
              </div>
            </div>

            ${renderScrollablePanel(renderCommentList(model.selectedDebateComments), "is-comments")}

            <form class="stack-form" id="debate-comment-form">
              <input type="hidden" name="debateId" value="${escapeHtml(debate.id)}" />
              <label class="field">
                <span>Add comment</span>
                <textarea name="commentText" placeholder="Add a quick note, challenge, or takeaway."></textarea>
              </label>
              <div class="form-actions">
                <button class="primary-btn" type="submit" ${commentBusy ? "disabled" : ""}>
                  ${commentBusy ? "Posting..." : "Post comment"}
                </button>
              </div>
            </form>
          </section>
        </section>

      </section>
    `;
  }

  function renderScheduleFormPanel() {
    return `
      <section class="section-panel">
        <div class="section-header">
          <div>
            <h3 class="section-title">New Debate</h3>
          </div>
        </div>
        <form class="schedule-form" id="schedule-form">
          <label class="field">
            <span>Topic or resolution</span>
            <input
              type="text"
              name="topic"
              data-draft-owner="schedule"
              data-draft-field="topic"
              value="${escapeHtml(state.scheduleDraft.topic)}"
              placeholder="Should cities replace cars with public transit corridors?"
              required
            />
          </label>
          <div class="field-row">
            ${renderDebateCategorySelect("schedule", state.scheduleDraft.category)}
            <label class="field">
              <span>Date and time</span>
              <input
                type="datetime-local"
                name="scheduledFor"
                data-draft-owner="schedule"
                data-draft-field="scheduledFor"
                value="${escapeHtml(state.scheduleDraft.scheduledFor)}"
                required
              />
            </label>
          </div>
          <div class="field-row">
            ${renderDebaterSelect({
              label: "Debater A",
              field: "debaterAUid",
              selectedUid: state.scheduleDraft.debaterAUid,
              otherUid: state.scheduleDraft.debaterBUid
            })}
            ${renderDebaterSelect({
              label: "Debater B",
              field: "debaterBUid",
              selectedUid: state.scheduleDraft.debaterBUid,
              otherUid: state.scheduleDraft.debaterAUid
            })}
          </div>
          <label class="field">
            <span>Moderator</span>
            <input
              type="text"
              name="moderator"
              data-draft-owner="schedule"
              data-draft-field="moderator"
              value="${escapeHtml(state.scheduleDraft.moderator)}"
              placeholder="Optional moderator or judge name"
            />
          </label>
          <label class="field">
            <span>Description</span>
            <textarea
              name="description"
              data-draft-owner="schedule"
              data-draft-field="description"
              placeholder="Short framing note, context, or judging criteria."
            >${escapeHtml(state.scheduleDraft.description)}</textarea>
          </label>
          <div class="form-actions">
            <button class="primary-btn" type="submit" ${state.scheduleSaving ? "disabled" : ""}>
              ${state.scheduleSaving ? "Scheduling..." : "Schedule debate"}
            </button>
            <button class="ghost-btn" type="button" data-action="reset-schedule-form">Reset</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderUpcomingDebatesPanel(model) {
    return `
      <section class="section-panel">
        <div class="section-header">
          <div>
            <h3 class="section-title">Upcoming Debates</h3>
          </div>
        </div>
        ${renderScrollablePanel(
          renderDebateList([...model.upcoming, ...model.overdue], {
            emptyTitle: "No scheduled debates",
            emptyCopy: "",
            showAdminControls: currentIsAdmin()
          }),
          "is-feed"
        )}
      </section>
    `;
  }

  function renderSchedulePage(model) {
    const scheduleSection = normalizeScheduleSection(state.scheduleSection);

    return `
      <section class="page-shell">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Schedule Debate</span>
            <h2 class="page-title">Schedule</h2>
          </div>
          ${renderScheduleTabs(scheduleSection)}
        </section>

        ${scheduleSection === "upcoming" ? renderUpcomingDebatesPanel(model) : renderScheduleFormPanel()}
      </section>
    `;
  }

  function renderArchivePage(model) {
    return `
      <section class="page-shell archive-page">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Past Debates</span>
            <h2 class="page-title">Archive</h2>
          </div>
        </section>

        <section class="section-panel archive-feed-panel">
          <div class="section-header">
            <div>
              <h3 class="section-title">Resolved archive</h3>
            </div>
          </div>
          ${renderScrollablePanel(
            renderDebateList(model.past, {
              emptyTitle: state.searchTerm ? "No past debates match that search" : "No past debates yet",
              emptyCopy: "",
              showAdminControls: currentIsAdmin()
            }),
            "is-feed"
          )}
        </section>
      </section>
    `;
  }

  function renderRankingsPage(model) {
    return `
      <section class="page-shell rankings-page">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Rankings</span>
            <h2 class="page-title">Rankings</h2>
          </div>
          ${renderLeaderboardTabs(model.rankingsCategory)}
        </section>

        <section class="section-panel rankings-table-panel">
          <div class="section-header">
            <div>
              <h3 class="section-title">${escapeHtml(model.rankingsCategoryLabel)} leaderboard</h3>
            </div>
          </div>
          ${renderScrollablePanel(
            renderRankingTable(model.leaderboard, `No ${model.rankingsCategoryLabel.toLowerCase()} debaters yet`),
            "is-table"
          )}
        </section>
      </section>
    `;
  }

  function renderAdminPage(model) {
    if (!currentIsAdmin()) {
      return `
        <section class="page-shell">
          <section class="unauthorized-panel">
            <span class="page-kicker">Admin</span>
            <h3><code>admin</code> only.</h3>
          </section>
        </section>
      `;
    }

    const lazyDraft = state.lazyDebateDraft;

    return `
      <section class="page-shell">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Admin</span>
            <h2 class="page-title">Resolve debates</h2>
          </div>
        </section>

        <section class="section-grid">
          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Awaiting result</h3>
              </div>
            </div>
            ${renderScrollablePanel(
              renderDebateList(model.unresolvedQueue, {
                emptyTitle: "Nothing is waiting on admin",
                emptyCopy: "",
                showAdminControls: true
              }),
              "is-feed"
            )}
          </section>

          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Too Lazy debates</h3>
              </div>
            </div>
            <form class="schedule-form lazy-debate-form" id="lazy-debate-form">
              <label class="field">
                <span>Topic or resolution</span>
                <input
                  type="text"
                  name="topic"
                  data-draft-owner="lazy"
                  data-draft-field="topic"
                  value="${escapeHtml(lazyDraft.topic)}"
                  placeholder="Should group projects count less?"
                  required
                />
              </label>
              <div class="field-row">
                ${renderDebateCategorySelect("lazy", lazyDraft.category)}
                <label class="field">
                  <span>Date and time</span>
                  <input
                    type="datetime-local"
                    name="scheduledFor"
                    data-draft-owner="lazy"
                    data-draft-field="scheduledFor"
                    value="${escapeHtml(lazyDraft.scheduledFor)}"
                    required
                  />
                </label>
              </div>
              <div class="field-row">
                ${renderDebaterSelect({
                  label: "Debater A",
                  field: "debaterAUid",
                  selectedUid: lazyDraft.debaterAUid,
                  otherUid: lazyDraft.debaterBUid,
                  owner: "lazy"
                })}
                ${renderDebaterSelect({
                  label: "Debater B",
                  field: "debaterBUid",
                  selectedUid: lazyDraft.debaterBUid,
                  otherUid: lazyDraft.debaterAUid,
                  owner: "lazy"
                })}
              </div>
              <label class="field">
                <span>Moderator</span>
                <input
                  type="text"
                  name="moderator"
                  data-draft-owner="lazy"
                  data-draft-field="moderator"
                  value="${escapeHtml(lazyDraft.moderator)}"
                  placeholder="Optional moderator or judge name"
                />
              </label>
              <label class="field">
                <span>YouTube link</span>
                <input
                  type="url"
                  name="videoUrl"
                  data-draft-owner="lazy"
                  data-draft-field="videoUrl"
                  value="${escapeHtml(lazyDraft.videoUrl)}"
                  placeholder="Optional YouTube link"
                />
              </label>
              <label class="field">
                <span>Description</span>
                <textarea
                  name="description"
                  data-draft-owner="lazy"
                  data-draft-field="description"
                  placeholder="Optional note about the debate."
                >${escapeHtml(lazyDraft.description)}</textarea>
              </label>
              <div class="field">
                <span>Winner</span>
                <input
                  type="hidden"
                  name="result"
                  value="${escapeHtml(lazyDraft.result === "b" || lazyDraft.result === "draw" ? lazyDraft.result : "a")}"
                />
                <div class="winner-picker">
                  ${renderLazyWinnerButtons()}
                </div>
              </div>
              <div class="form-actions">
                <button class="primary-btn" type="submit" ${state.adminLogSaving ? "disabled" : ""}>
                  ${state.adminLogSaving ? "Logging..." : "Log debate"}
                </button>
                <button class="ghost-btn" type="button" data-action="reset-lazy-form">Reset</button>
              </div>
            </form>
          </section>
        </section>

        <section class="section-panel">
          <div class="section-header">
            <div>
              <h3 class="section-title">Users</h3>
            </div>
          </div>
          ${renderScrollablePanel(renderAdminUserList(), "is-feed")}
        </section>
      </section>
    `;
  }

  function renderSideRail(model) {
    if (state.currentPage === "debate") {
      return renderDebateSideRail(model);
    }

    const upcomingQueue = model.myDebatesUpcoming;
    const pastQueue = model.myDebatesPast;
    const sideCategoryLabel = getDebateCategoryLabel(model.sideLeaderboardCategory);
    const snapshotSection =
      state.currentPage === "dashboard" && model.profileIsCurrentUser
        ? ""
        : `
      <section class="side-section snapshot-section">
        <span class="panel-label">Your Snapshot</span>
        <div class="snapshot-head">
          ${renderAvatarChipHtml({
            name: state.username || model.mySnapshot.name || "debater",
            avatarDataUrl: state.selfProfile?.avatarDataUrl || state.user?.photoURL || "",
            seed: String(state.user?.uid || state.username || model.mySnapshot.name || "debater"),
            className: "snapshot-avatar"
          })}
          <div class="snapshot-identity">
            <h3>${renderProfileLink(model.mySnapshot.name, state.user?.uid, "profile-link-strong")}</h3>
          </div>
        </div>
        <div class="snapshot-stats">
          <article class="snapshot-stat">
            <span class="summary-label">${escapeHtml(sideCategoryLabel)} ELO</span>
            <strong>${model.mySnapshot.ratingRounded}</strong>
          </article>
          <article class="snapshot-stat">
            <span class="summary-label">Debates</span>
            <strong>${model.mySnapshot.debates}</strong>
          </article>
        </div>
        <div class="snapshot-record">
          <div class="snapshot-record-head">
            <span class="summary-label">Record</span>
          </div>
          ${renderRecordChips(model.mySnapshot)}
        </div>
      </section>
    `;

    return `
      ${snapshotSection}

      <section class="side-section">
        <span class="panel-label">Top Rankings</span>
        <h3>${escapeHtml(sideCategoryLabel)} leaderboard</h3>
        ${
          model.topRanked.length
            ? renderScrollablePanel(
                `
                  <div class="ranking-list">
                    ${model.topRanked
                      .map((player, index) => {
                        return `
                          <div class="rail-ranking-item">
                            <div class="meta-row">
                              <span class="rank-badge">${index + 1}</span>
                              <div class="rail-ranking-copy">
                                ${renderProfileLink(player.name, player.uid, "profile-link-strong", {
                                  showAvatar: true,
                                  avatarClassName: "profile-avatar"
                                })}
                                <div class="record-meta-row">
                                  ${renderRecordChips(player, { compact: true })}
                                </div>
                              </div>
                            </div>
                            <div class="mini-stat">${player.ratingRounded}</div>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                `,
                "is-side"
              )
            : `<p class="sidebar-copy">No ranked debaters yet.</p>`
        }
      </section>

      <section class="side-section side-section-queue">
        <span class="panel-label">Your Queue</span>
        ${renderScrollablePanel(
          `
            <div class="queue-groups">
              <div class="queue-group">
                <h3>Upcoming</h3>
                ${
                  upcomingQueue.length
                    ? `
                      <div class="mini-list">
                        ${upcomingQueue
                          .map((debate) => {
                            return `
                              <div class="mini-row">
                                <div>
                                  <strong>${escapeHtml(debate.topic || "Untitled debate")}</strong>
                                  <div class="mini-copy">${formatShortDate(debate.scheduledFor)}</div>
                                </div>
                                <span class="mini-tag">You</span>
                              </div>
                            `;
                          })
                          .join("")}
                      </div>
                    `
                    : `<p class="sidebar-copy">No upcoming debates.</p>`
                }
              </div>
              <div class="queue-group">
                <h3>${currentIsAdmin() ? "Admin queue" : "Recent results"}</h3>
                ${
                  currentIsAdmin()
                    ? `<p class="sidebar-copy">${model.unresolvedQueue.length} waiting</p>`
                    : pastQueue.length
                      ? `
                        <div class="mini-list">
                          ${pastQueue
                            .map((debate) => {
                              return `
                                <div class="mini-row">
                                  <div>
                                    <strong>${escapeHtml(debate.topic || "Untitled debate")}</strong>
                                    <div class="mini-copy">${renderResultCopy(debate)}</div>
                                  </div>
                                  <div class="mini-copy">${formatShortDate(debate.scheduledFor)}</div>
                                </div>
                              `;
                            })
                            .join("")}
                        </div>
                      `
                      : `<p class="sidebar-copy">No results yet.</p>`
                }
              </div>
            </div>
          `,
          "is-side is-queue"
        )}
      </section>
    `;
  }

  function renderDebateSideRail(model) {
    const debate = model.selectedDebate;
    if (!debate) {
      return `
        <section class="side-section">
          ${renderEmptyState("Debate missing", "")}
        </section>
      `;
    }

    const status = getDebateStatus(debate);

    return `
      <section class="side-section">
        <span class="panel-label">Debate</span>
        <h3>${escapeHtml(debate.topic || "Untitled debate")}</h3>
        <div class="profile-record">
          <div>
            <span class="summary-label">Status</span>
            <strong>${escapeHtml(status.label)}</strong>
          </div>
        </div>
      </section>

      <section class="side-section">
        <span class="panel-label">People</span>
        ${renderScrollablePanel(
          `
            <div class="mini-list">
              <div class="mini-row">
                <div class="mini-row-copy">${renderProfileLink(debate.debaterAName, debate.debaterAUid, "profile-link-strong", {
                  showAvatar: true,
                  avatarClassName: "profile-avatar"
                })}</div>
                <span class="mini-tag">A</span>
              </div>
              <div class="mini-row">
                <div class="mini-row-copy">${renderProfileLink(debate.debaterBName, debate.debaterBUid, "profile-link-strong", {
                  showAvatar: true,
                  avatarClassName: "profile-avatar"
                })}</div>
                <span class="mini-tag">B</span>
              </div>
              <div class="mini-row">
                <div><strong>${escapeHtml(debate.moderator || "No moderator")}</strong></div>
                <span class="mini-tag">Mod</span>
              </div>
            </div>
          `,
          "is-side"
        )}
      </section>
    `;
  }

  function renderScrollablePanel(content, className = "") {
    const classes = ["panel-scroll", className].filter(Boolean).join(" ");
    return `
      <div class="${classes}">
        ${content}
      </div>
    `;
  }

  function renderAdminUserCards(users, query = state.adminUserSearchDraft) {
    const list = Array.isArray(users) ? users : [];
    if (!list.length) {
      return renderEmptyState(
        String(query || "").trim() ? "No matching users" : "No users yet",
        String(query || "").trim() ? "Try another username or uid." : ""
      );
    }

    return `
      <div class="admin-user-list">
        ${list
          .map((entry) => {
            const safeUid = String(entry.uid || "").trim();
            const role = normalizeUserRole(entry.role, "user");
            const isAdminRole = role === "admin";
            const busy = state.actionBusyKey === `${safeUid}:role`;
            return `
              <article class="admin-user-card">
                <div class="admin-user-head">
                  <div class="admin-user-identity">
                    ${renderProfileIdentityContent(entry.username, safeUid, {
                      showAvatar: true,
                      avatarClassName: "profile-avatar profile-avatar-lg",
                      labelClassName: "profile-link-strong"
                    })}
                    <span class="admin-user-meta">${escapeHtml(safeUid)}</span>
                  </div>
                  <span class="admin-user-status${isAdminRole ? " is-admin" : ""}">
                    ${isAdminRole ? "Admin" : "User"}
                  </span>
                </div>
                <div class="admin-user-actions">
                  <button
                    class="secondary-btn"
                    type="button"
                    data-action="admin-change-status"
                    data-profile-uid="${escapeHtml(safeUid)}"
                    ${busy ? "disabled" : ""}
                  >
                    ${busy ? "Saving..." : "Change Status"}
                  </button>
                  <button
                    class="secondary-btn"
                    type="button"
                    data-action="admin-change-username"
                    data-profile-uid="${escapeHtml(safeUid)}"
                  >
                    Change Username
                  </button>
                  <button
                    class="secondary-btn"
                    type="button"
                    data-action="admin-change-avatar"
                    data-profile-uid="${escapeHtml(safeUid)}"
                  >
                    Change Profile Picture
                  </button>
                  <button
                    class="ghost-btn"
                    type="button"
                    data-action="admin-change-password"
                    data-profile-uid="${escapeHtml(safeUid)}"
                  >
                    Change Password
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAdminUserList() {
    const query = String(state.adminUserSearchDraft || "");
    const users = getFilteredAdminManagedUsers(query);

    return `
      <div class="admin-user-manager">
        <label class="search-field admin-user-search-field" for="admin-user-search-input">
          <span class="search-label">Search</span>
          <input
            id="admin-user-search-input"
            type="search"
            data-admin-user-search="true"
            value="${escapeHtml(query)}"
            placeholder="Username or uid..."
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button
            class="search-clear${query ? "" : " hidden"}"
            type="button"
            data-action="clear-admin-user-search"
            aria-label="Clear admin user search"
          >
            &times;
          </button>
        </label>
        <div class="admin-user-search-results" id="admin-user-search-results">
          ${renderAdminUserCards(users, query)}
        </div>
      </div>
    `;
  }

  function syncAdminUserSearchUi() {
    const input = el.mainContent?.querySelector("#admin-user-search-input");
    const results = el.mainContent?.querySelector("#admin-user-search-results");
    if (!(input instanceof HTMLInputElement) || !results) return false;

    if (input.value !== state.adminUserSearchDraft) {
      input.value = state.adminUserSearchDraft;
    }

    results.innerHTML = renderAdminUserCards(getFilteredAdminManagedUsers(), state.adminUserSearchDraft);
    const clearButton = input.closest(".admin-user-search-field")?.querySelector('[data-action="clear-admin-user-search"]');
    clearButton?.classList.toggle("hidden", !String(state.adminUserSearchDraft || "").trim());
    return true;
  }

  let queueHeightFrame = 0;

  function syncQueuePanelHeight() {
    if (queueHeightFrame) {
      window.cancelAnimationFrame(queueHeightFrame);
    }

    queueHeightFrame = window.requestAnimationFrame(() => {
      queueHeightFrame = 0;

      const queueSection = document.querySelector(".side-section-queue");
      const queueScroll = queueSection?.querySelector(".panel-scroll.is-queue");
      if (!queueSection || !queueScroll) return;

      queueScroll.style.removeProperty("height");
      queueScroll.style.removeProperty("max-height");

      if (window.innerWidth <= 1180) return;

      const mainRect = el.mainContent?.getBoundingClientRect();
      const queueRect = queueScroll.getBoundingClientRect();
      if (!mainRect || !queueRect) return;

      const queueSectionStyles = window.getComputedStyle(queueSection);
      const bottomPadding = parseFloat(queueSectionStyles.paddingBottom || "0") || 0;
      const availableHeight = Math.floor(mainRect.bottom - queueRect.top - bottomPadding);
      if (availableHeight < 160) return;

      queueScroll.style.height = `${availableHeight}px`;
      queueScroll.style.maxHeight = `${availableHeight}px`;
    });
  }

  function renderDebateList(debates, options = {}) {
    if (!debates.length) {
      return renderEmptyState(options.emptyTitle || "Nothing here yet", options.emptyCopy || "");
    }

    return `
      <div class="debate-list">
        ${debates
          .map((debate) => renderDebateCard(debate, { showAdminControls: options.showAdminControls }))
          .join("")}
      </div>
    `;
  }

  function renderDebateCard(debate, options = {}) {
    const busyPrefix = `${debate.id}:`;
    const isBusy = state.actionBusyKey.startsWith(busyPrefix);
    const aWinner = debate.status === "resolved" && debate.result === "a";
    const bWinner = debate.status === "resolved" && debate.result === "b";
    const aLoser = debate.status === "resolved" && debate.result === "b";
    const bLoser = debate.status === "resolved" && debate.result === "a";
    const winnerName = getDebateWinnerName(debate);

    return `
      <article
        class="debate-card debate-card-link"
        data-action="open-debate"
        data-debate-id="${escapeHtml(debate.id)}"
        role="button"
        tabindex="0"
      >
        <div class="debate-card-head">
          <div>
            <h3 class="debate-topic">${escapeHtml(debate.topic || "Untitled debate")}</h3>
            <div class="debate-subline">
              ${formatDateTime(debate.scheduledFor)}
            </div>
            <div class="badge-row">
              ${renderCategoryBadge(debate.category)}
            </div>
          </div>
        </div>

        <div class="people-row">
          ${renderPersonBadge(debate.debaterAName, debate.debaterAUid, { isWinner: aWinner, isLoser: aLoser })}
          <span class="mini-tag">vs</span>
          ${renderPersonBadge(debate.debaterBName, debate.debaterBUid, { isWinner: bWinner, isLoser: bLoser })}
        </div>

        <div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Category</span>
            <strong>${escapeHtml(getDebateCategoryLabel(debate.category))}</strong>
          </div>
          <div class="detail-row${winnerName ? " is-winner" : ""}">
            <span class="detail-label">Winner</span>
            <strong>${escapeHtml(winnerName || "N/A")}</strong>
          </div>
        </div>

        ${
          options.showAdminControls && currentIsAdmin()
            ? `
              <div class="admin-control-stack" data-action="hold-admin-controls">
                ${renderResolveVideoField(debate)}
                <div class="admin-actions">
                  <button
                    class="result-btn win"
                    type="button"
                    data-action="claim-result"
                    data-debate-id="${escapeHtml(debate.id)}"
                    data-outcome="a"
                    ${isBusy ? "disabled" : ""}
                  >
                    ${escapeHtml(normalizeUsername(debate.debaterAName || "A"))} wins
                  </button>
                  <button
                    class="result-btn win"
                    type="button"
                    data-action="claim-result"
                    data-debate-id="${escapeHtml(debate.id)}"
                    data-outcome="b"
                    ${isBusy ? "disabled" : ""}
                  >
                    ${escapeHtml(normalizeUsername(debate.debaterBName || "B"))} wins
                  </button>
                  <button
                    class="result-btn draw"
                    type="button"
                    data-action="claim-result"
                    data-debate-id="${escapeHtml(debate.id)}"
                    data-outcome="draw"
                    ${isBusy ? "disabled" : ""}
                  >
                    Mark draw
                  </button>
                  ${
                    debate.status === "resolved"
                      ? `
                        <button
                          class="result-btn reopen"
                          type="button"
                          data-action="claim-result"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="reopen"
                          ${isBusy ? "disabled" : ""}
                        >
                          Reopen
                        </button>
                      `
                      : ""
                  }
                </div>
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function renderProfileIdentityContent(name, uid, options = {}) {
    const safeUid = String(uid || "").trim();
    const label = normalizeUsername(name || getNameForUid(safeUid)) || "debater";
    const showAvatar = Boolean(options.showAvatar);
    const innerClasses = ["profile-link-inner"];
    const labelClasses = ["profile-link-label"];

    if (options.innerClassName) {
      innerClasses.push(String(options.innerClassName).trim());
    }
    if (options.labelClassName) {
      labelClasses.push(String(options.labelClassName).trim());
    }

    if (!showAvatar) {
      return `<span class="${labelClasses.join(" ")}">${escapeHtml(label)}</span>`;
    }

    return `
      <span class="${innerClasses.join(" ")}">
        ${renderAvatarChipHtml({
          name: label,
          avatarDataUrl: getAvatarDataUrlForUid(safeUid),
          seed: safeUid || label,
          className: String(options.avatarClassName || "profile-avatar").trim()
        })}
        <span class="${labelClasses.join(" ")}">${escapeHtml(label)}</span>
      </span>
    `;
  }

  function renderProfileLink(name, uid, className = "", options = {}) {
    const safeUid = String(uid || "").trim();
    const label = normalizeUsername(name || getNameForUid(safeUid)) || "debater";
    const classes = ["profile-link"];
    const activeProfileUid = String(state.profileUid || state.user?.uid || "").trim();
    const content = options.showAvatar
      ? renderProfileIdentityContent(label, safeUid, options)
      : escapeHtml(label);

    if (className) {
      classes.push(className);
    }
    if (options.showAvatar) {
      classes.push("has-avatar");
    }
    if (safeUid && safeUid === activeProfileUid) {
      classes.push("is-active");
    }
    if (!safeUid) {
      return `<span class="${classes.join(" ")}">${content}</span>`;
    }

    return `
      <button
        class="${classes.join(" ")}"
        type="button"
        data-action="open-profile"
        data-profile-uid="${escapeHtml(safeUid)}"
      >
        ${content}
      </button>
    `;
  }

  function renderPersonBadge(name, uid, options = {}) {
    const classes = ["person-badge"];
    const isWinner = Boolean(options?.isWinner);
    const isLoser = Boolean(options?.isLoser);
    if (String(uid || "").trim() === String(state.user?.uid || "").trim()) {
      classes.push("me");
    }
    if (isWinner) {
      classes.push("winner");
    }
    if (isLoser) {
      classes.push("loser");
    }
    return renderProfileLink(name, uid, classes.join(" "));
  }

  function getDraftFormSelector(owner = "schedule") {
    return owner === "lazy" ? "#lazy-debate-form" : "#schedule-form";
  }

  function getDraftFormElement(owner = "schedule") {
    return el.mainContent?.querySelector(getDraftFormSelector(owner)) || null;
  }

  function getDebaterSelectLabel(field) {
    return field === "debaterBUid" ? "Debater B" : "Debater A";
  }

  function getCategoryRankLabel(rating) {
    const safeRank = Number(rating?.rank || 0);
    return rating?.isRanked && safeRank > 0 ? `#${safeRank}` : "Unranked";
  }

  function buildDebateVideoPayload(videoUrl, options = {}) {
    const safeVideoUrl = String(videoUrl || "").trim();
    const embedUrl = safeVideoUrl ? getYouTubeEmbedUrl(safeVideoUrl) : "";
    if (safeVideoUrl && !embedUrl) {
      return null;
    }

    return {
      videoUrl: safeVideoUrl,
      videoEmbedUrl: embedUrl,
      videoAddedAt: safeVideoUrl ? options.addedAt ?? Date.now() : null,
      videoAddedByUid: safeVideoUrl ? String(options.addedByUid || "").trim() : "",
      videoAddedByName: safeVideoUrl ? String(options.addedByName || "").trim() : ""
    };
  }

  function renderCategoryBadge(categoryId, className = "") {
    const classes = ["mini-tag", "category-tag"];
    if (className) {
      classes.push(String(className).trim());
    }
    return `<span class="${classes.join(" ")}">${escapeHtml(getDebateCategoryLabel(categoryId))}</span>`;
  }

  function getCategorySelectKey(owner = "schedule") {
    return `${owner === "lazy" ? "lazy" : "schedule"}-category`;
  }

  function renderDebateCategorySelect(owner = "schedule", selectedCategory = "") {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const safeSelected = isValidDebateCategory(selectedCategory) ? normalizeDebateCategory(selectedCategory) : "";
    const selectedLabel = safeSelected ? getDebateCategoryLabel(safeSelected) : "";
    const selectKey = getCategorySelectKey(safeOwner);

    return `
      <label class="field" data-category-select-owner="${escapeHtml(safeOwner)}">
        <span>Category</span>
        <div class="custom-select${state.openSelectKey === selectKey ? " is-open" : ""}" data-select-root="${escapeHtml(selectKey)}">
          <input
            type="hidden"
            name="category"
            data-draft-owner="${escapeHtml(safeOwner)}"
            data-draft-field="category"
            value="${escapeHtml(safeSelected)}"
          />
          <button
            class="custom-select-trigger"
            type="button"
            data-action="toggle-category-select"
            data-select-key="${escapeHtml(selectKey)}"
            aria-haspopup="listbox"
            aria-expanded="${state.openSelectKey === selectKey ? "true" : "false"}"
          >
            <span class="custom-select-value${selectedLabel ? "" : " is-placeholder"}">
              ${escapeHtml(selectedLabel || "Select category")}
            </span>
            <span class="custom-select-caret" aria-hidden="true"></span>
          </button>
          <div class="custom-select-menu${state.openSelectKey === selectKey ? "" : " hidden"}" role="listbox" aria-label="Category">
            <div class="custom-select-options">
              <button
                class="custom-select-option${safeSelected ? "" : " is-selected"}"
                type="button"
                data-action="choose-category"
                data-select-owner="${escapeHtml(safeOwner)}"
                data-value=""
              >
                Select category
              </button>
              ${DEBATE_CATEGORIES.map((category) => {
                const isSelected = safeSelected === category.id;
                return `
                  <button
                    class="custom-select-option${isSelected ? " is-selected" : ""}"
                    type="button"
                    data-action="choose-category"
                    data-select-owner="${escapeHtml(safeOwner)}"
                    data-value="${escapeHtml(category.id)}"
                  >
                    ${escapeHtml(category.label)}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </label>
    `;
  }

  function shouldShowResolveVideoField(debate) {
    return currentIsAdmin() && state.currentPage === "admin" && debate?.status !== "resolved";
  }

  function renderResolveVideoField(debate, options = {}) {
    if (!shouldShowResolveVideoField(debate)) return "";

    const safeDebateId = String(debate?.id || "").trim();

    return `
      <label class="field admin-video-field${options.mobile ? " is-mobile" : ""}" data-action="hold-admin-controls">
        <span>YouTube link</span>
        <input
          type="url"
          data-resolve-video-input="${escapeHtml(safeDebateId)}"
          placeholder="Optional YouTube link"
          value="${escapeHtml(String(debate?.videoUrl || "").trim())}"
        />
      </label>
    `;
  }

  function renderCategoryRatingGrid(categoryRatings, options = {}) {
    const ratings = Array.isArray(categoryRatings) ? categoryRatings : [];
    const preferredCategoryId = String(options.preferredCategoryId || "").trim();
    const mobile = Boolean(options.mobile);
    const gridClassName = mobile ? "mobile-category-grid" : "category-rating-grid";
    const cardClassName = mobile ? "mobile-category-card" : "category-rating-card";

    return `
      <div class="${gridClassName}">
        ${ratings
          .map((rating) => {
            const debateCount = Number(rating?.debates || 0);
            const metaLabel = `${getCategoryRankLabel(rating)} - ${debateCount} ${debateCount === 1 ? "debate" : "debates"}`;
            return `
              <article class="${cardClassName}${rating.id === preferredCategoryId ? " is-featured" : ""}">
                <span class="summary-label">${escapeHtml(rating.label)}</span>
                <strong class="category-rating-value">${rating.ratingRounded}</strong>
                <span class="category-rating-meta">${escapeHtml(metaLabel)}</span>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderLeaderboardTabs(selectedCategory) {
    const safeCategory = normalizeRankingsCategory(selectedCategory);

    return `
      <div class="leaderboard-tabs" role="tablist" aria-label="Ranking categories">
        ${DEBATE_CATEGORIES.map((category) => {
          const isActive = category.id === safeCategory;
          return `
            <button
              class="tab-btn${isActive ? " is-active" : ""}"
              type="button"
              role="tab"
              aria-selected="${isActive ? "true" : "false"}"
              data-action="set-rankings-category"
              data-value="${escapeHtml(category.id)}"
            >
              ${escapeHtml(category.label)}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderLazyWinnerButtons() {
    const lazyDraft = state.lazyDebateDraft;
    const debaterALabel = normalizeUsername(getNameForUid(lazyDraft.debaterAUid, "debater a")) || "debater a";
    const debaterBLabel = normalizeUsername(getNameForUid(lazyDraft.debaterBUid, "debater b")) || "debater b";
    const activeResult = lazyDraft.result === "b" || lazyDraft.result === "draw" ? lazyDraft.result : "a";

    return `
      <button
        class="result-btn win${activeResult === "a" ? " is-active" : ""}"
        type="button"
        data-action="set-lazy-result"
        data-value="a"
      >
        ${escapeHtml(debaterALabel)} won
      </button>
      <button
        class="result-btn win${activeResult === "b" ? " is-active" : ""}"
        type="button"
        data-action="set-lazy-result"
        data-value="b"
      >
        ${escapeHtml(debaterBLabel)} won
      </button>
      <button
        class="result-btn draw${activeResult === "draw" ? " is-active" : ""}"
        type="button"
        data-action="set-lazy-result"
        data-value="draw"
      >
        Draw
      </button>
    `;
  }

  function syncLazyResultUi() {
    const form = getDraftFormElement("lazy");
    if (!form) return false;

    const activeResult = state.lazyDebateDraft.result === "b" || state.lazyDebateDraft.result === "draw"
      ? state.lazyDebateDraft.result
      : "a";
    const hiddenInput = form.querySelector('input[name="result"]');
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = activeResult;
    }

    const picker = form.querySelector(".winner-picker");
    if (picker) {
      picker.innerHTML = renderLazyWinnerButtons();
    }

    return true;
  }

  function syncCategorySelectUi(owner = "schedule") {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const form = getDraftFormElement(safeOwner);
    const draft = getDraftState(safeOwner);
    const wrapper = form?.querySelector(`[data-category-select-owner="${safeOwner}"]`);
    if (!wrapper || !draft) return false;

    wrapper.outerHTML = renderDebateCategorySelect(safeOwner, draft.category);
    return true;
  }

  function syncDraftFormUi(owner = "schedule") {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const form = getDraftFormElement(safeOwner);
    const draft = getDraftState(safeOwner);
    if (!form || !draft) return false;

    form.querySelectorAll(`[data-draft-owner="${safeOwner}"][data-draft-field]`).forEach((node) => {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) return;
      const field = String(node.getAttribute("data-draft-field") || "").trim();
      if (!field || field === "debaterAUid" || field === "debaterBUid" || field === "category") return;
      const nextValue = String(draft[field] ?? "");
      if (node.value !== nextValue) {
        node.value = nextValue;
      }
    });

    ["debaterAUid", "debaterBUid"].forEach((field) => {
      const root = form.querySelector(`[data-select-root="${field}"]`);
      const wrapper = root?.closest("label.field");
      if (!wrapper) return;
      const otherField = field === "debaterAUid" ? "debaterBUid" : "debaterAUid";
      wrapper.outerHTML = renderDebaterSelect({
        label: getDebaterSelectLabel(field),
        field,
        selectedUid: draft[field],
        otherUid: draft[otherField],
        owner: safeOwner
      });
    });

    syncCategorySelectUi(safeOwner);

    if (safeOwner === "lazy") {
      syncLazyResultUi();
    }

    return true;
  }

  function renderResultCopy(debate) {
    if (debate.status !== "resolved") return "Pending";
    if (debate.result === "draw") return "Draw";
    if (debate.result === "a") return `${normalizeUsername(debate.debaterAName || "debater")} won`;
    if (debate.result === "b") return `${normalizeUsername(debate.debaterBName || "debater")} won`;
    return "Resolved";
  }

  function getDebateWinnerName(debate) {
    if (!debate || debate.status !== "resolved" || debate.result === "draw") {
      return "";
    }

    if (debate.result === "a") {
      return normalizeUsername(debate.winnerName || debate.debaterAName || "");
    }

    if (debate.result === "b") {
      return normalizeUsername(debate.winnerName || debate.debaterBName || "");
    }

    return normalizeUsername(debate.winnerName || "");
  }

  function renderRecordChips(player, options = {}) {
    const compact = Boolean(options.compact);
    const showDraws = options.showDraws !== false;
    const items = [
      { tone: "win", label: "W", value: Number(player?.wins || 0) },
      { tone: "loss", label: "L", value: Number(player?.losses || 0) }
    ];

    if (showDraws) {
      items.push({ tone: "draw", label: "D", value: Number(player?.draws || 0) });
    }

    return `
      <div class="record-strip${compact ? " is-compact" : ""}">
        ${items
          .map((item) => {
            return `
              <span class="record-chip ${item.tone}">
                <span class="record-chip-label">${item.label}</span>
                <strong>${item.value}</strong>
              </span>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderCommentList(comments) {
    if (!comments.length) {
      return renderEmptyState("No comments yet", "");
    }

    return `
      <div class="comment-list">
        ${comments
          .map((comment) => {
            return `
              <article class="comment-card">
                <div class="comment-head">
                  ${renderProfileLink(comment.authorName || "member", comment.authorUid, "profile-link-strong", {
                    showAvatar: true,
                    avatarClassName: "profile-avatar profile-avatar-sm"
                  })}
                  <span class="mini-copy">${escapeHtml(formatRelativeStamp(comment.createdAt) || "Just now")}</span>
                </div>
                <p>${escapeHtml(comment.text || "")}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderRankingTable(rows, emptyLabel) {
    if (!rows.length) {
      return renderEmptyState(emptyLabel, "");
    }

    let rankedPosition = 0;

    return `
      <table class="ranking-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Debater</th>
            <th>ELO</th>
            <th>Record</th>
            <th>Debates</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((player, index) => {
              const rankLabel = player.isRanked ? String(++rankedPosition) : "—";
              return `
                <tr
                  class="${String(player.uid || "").trim() ? "ranking-row-link" : ""}"
                  ${String(player.uid || "").trim()
                    ? 'data-action="open-profile" data-profile-uid="' +
                      escapeHtml(String(player.uid || "").trim()) +
                      '" role="button" tabindex="0"'
                    : ""}
                >
                  <td><span class="rank-badge">${rankLabel}</span></td>
                  <td class="ranking-player-cell">
                    ${renderProfileLink(player.name, player.uid, "profile-link-strong", {
                      showAvatar: true,
                      avatarClassName: "profile-avatar profile-avatar-lg"
                    })}
                  </td>
                  <td class="rating-cell">${player.ratingRounded}</td>
                  <td>${renderRecordChips(player, { compact: true })}</td>
                  <td>${player.debates}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderEmptyState(title, copy) {
    return `
      <div class="empty-state">
        <h3>${escapeHtml(title || "Nothing here yet")}</h3>
        ${copy ? `<p>${escapeHtml(copy)}</p>` : ""}
      </div>
    `;
  }

  function syncDebaterSelectFilter(field) {
    const safeField = String(field || "").trim();
    const root = el.mainContent?.querySelector(`[data-select-root="${safeField}"]`);
    if (!root) return;

    const searchInput = root.querySelector(".custom-select-search");
    const createButton = root.querySelector(".custom-select-create");
    const emptyState = root.querySelector(".custom-select-empty");
    const filterValue = normalizeUsername(searchInput?.value || "");
    let visibleCount = 0;
    let exactMatch = false;

    root.querySelectorAll('.custom-select-option[data-action="choose-debater"]').forEach((node) => {
      const label = normalizeUsername(node.getAttribute("data-label") || node.textContent || "");
      const isClearOption = node.getAttribute("data-empty-option") === "true";
      const isVisible = isClearOption ? !filterValue : !filterValue || label.includes(filterValue);
      node.classList.toggle("hidden", !isVisible);
      if (isVisible) {
        visibleCount += 1;
      }
      if (!isClearOption && filterValue && label === filterValue) {
        exactMatch = true;
      }
    });

    const canCreate = Boolean(filterValue) && isValidUsername(filterValue) && !exactMatch;
    if (createButton) {
      createButton.classList.toggle("hidden", !canCreate);
      createButton.setAttribute("data-value", canCreate ? filterValue : "");
      if (canCreate) {
        visibleCount += 1;
      }
    }

    if (emptyState) {
      emptyState.classList.toggle("hidden", visibleCount > 0);
    }
  }

  function renderDebaterSelect({ label, field, selectedUid, otherUid, owner = "schedule" }) {
    const safeField = String(field || "").trim();
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const selected = String(selectedUid || "").trim();
    const blocked = String(otherUid || "").trim();
    const isOpen = state.openSelectKey === safeField;
    const selectedName = selected ? getNameForUid(selected, "debater") : "";
    const options = [
      '<button class="custom-select-option" type="button" data-action="choose-debater" data-empty-option="true" data-label="" data-select-field="' +
        escapeHtml(safeField) +
        '" data-select-owner="' +
        escapeHtml(safeOwner) +
        '" data-value="">Select debater</button>'
    ];

    state.directory.forEach((entry) => {
      const uid = String(entry.uid || "").trim();
      if (!uid || uid === blocked) return;
      const isSelected = uid === selected;
      options.push(`
        <button
          class="custom-select-option${isSelected ? " is-selected" : ""}"
          type="button"
          data-action="choose-debater"
          data-label="${escapeHtml(normalizeUsername(entry.username || "debater"))}"
          data-select-field="${escapeHtml(safeField)}"
          data-select-owner="${escapeHtml(safeOwner)}"
          data-value="${escapeHtml(uid)}"
        >
          ${escapeHtml(normalizeUsername(entry.username || "debater"))}
        </button>
      `);
    });

    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <div class="custom-select${isOpen ? " is-open" : ""}" data-select-root="${escapeHtml(safeField)}">
          <input type="hidden" name="${escapeHtml(safeField)}" value="${escapeHtml(selected)}" />
          <button
            class="custom-select-trigger"
            type="button"
            data-action="toggle-debater-select"
            data-select-field="${escapeHtml(safeField)}"
            aria-haspopup="listbox"
            aria-expanded="${isOpen ? "true" : "false"}"
          >
            <span class="custom-select-value${selectedName ? "" : " is-placeholder"}">
              ${escapeHtml(selectedName || "Select debater")}
            </span>
            <span class="custom-select-caret" aria-hidden="true"></span>
          </button>
          <div class="custom-select-menu${isOpen ? "" : " hidden"}" role="listbox" aria-label="${escapeHtml(label)}">
            <div class="custom-select-search-shell">
              <input
                class="custom-select-search"
                id="custom-select-search-${escapeHtml(safeField)}"
                type="text"
                data-select-owner="${escapeHtml(safeOwner)}"
                data-select-filter="${escapeHtml(safeField)}"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="Type username"
              />
            </div>
            <div class="custom-select-options">
              ${options.join("")}
              <button
                class="custom-select-option custom-select-create hidden"
                type="button"
                data-action="create-placeholder-debater"
                data-select-field="${escapeHtml(safeField)}"
                data-select-owner="${escapeHtml(safeOwner)}"
                data-value=""
              >
                Create
              </button>
              <div class="custom-select-empty hidden">No debaters found.</div>
            </div>
          </div>
        </div>
      </label>
    `;
  }

  function setCustomSelectOpenState(field, open) {
    const root = el.mainContent?.querySelector(`[data-select-root="${field}"]`);
    if (!root) return;

    root.classList.toggle("is-open", open);
    root.querySelector(".custom-select-menu")?.classList.toggle("hidden", !open);
    root.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", open ? "true" : "false");

    const searchInput = root.querySelector(".custom-select-search");
    if (searchInput instanceof HTMLInputElement) {
      searchInput.value = "";
      syncDebaterSelectFilter(field);
      if (open) {
        window.requestAnimationFrame(() => searchInput.focus());
      }
    }
  }

  function closeOpenSelect() {
    if (!state.openSelectKey) return;
    setCustomSelectOpenState(state.openSelectKey, false);
    state.openSelectKey = "";
  }

  function toggleOpenSelect(field) {
    const safeField = String(field || "").trim();
    if (!safeField) return;

    if (state.openSelectKey === safeField) {
      closeOpenSelect();
      return;
    }

    closeOpenSelect();
    state.openSelectKey = safeField;
    setCustomSelectOpenState(safeField, true);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const username = normalizeUsername(el.loginUsername?.value);
    const pass = String(el.loginPassword?.value || "");

    if (!username || !pass) {
      setHint(el.loginHint, "Enter username + password.", "error");
      return;
    }
    if (!isValidUsername(username)) {
      setHint(el.loginHint, "Invalid username.", "error");
      return;
    }

    setHint(el.loginHint, "");
    showAuthLoadingScreen("Logging in");
    let loginSucceeded = false;

    try {
      const handle = await lookupAuthHandleForUsername(username);
      if (!handle) {
        setHint(el.loginHint, "No account found. Try creating one.", "error");
        return;
      }

      await auth.signInWithEmailAndPassword(handle, passwordForAuth(pass));
      loginSucceeded = true;
      safeLsSet(LS_LAST_USERNAME, username);
      if (el.loginPassword) {
        el.loginPassword.value = "";
      }
    } catch (error) {
      console.warn("Login failed", error);
      const code = String(error?.code || "");
      if (code === "auth/network-request-failed") {
        setHint(el.loginHint, "Network error. Check your connection and try again.", "error");
      } else if (code === "auth/configuration-not-found") {
        setHint(el.loginHint, "Turn on Email/Password sign-in in Firebase Auth first.", "error");
      } else {
        setHint(el.loginHint, "Login failed. Check your username and password.", "error");
      }
    } finally {
      if (!loginSucceeded) {
        hideAuthLoadingScreen();
      }
    }
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    const username = normalizeUsername(el.createUsername?.value);
    const pass = String(el.createPassword?.value || "");

    if (!username || !pass) {
      setHint(el.createHint, "Enter username + password.", "error");
      return;
    }
    if (!isValidUsername(username)) {
      setHint(el.createHint, "Username must be 3-20 chars using a-z, 0-9, and _. Spaces become _ automatically.", "error");
      return;
    }

    setHint(el.createHint, "");
    showAuthLoadingScreen("Creating account");
    let createSucceeded = false;

    try {
      const existsSnap = await db.collection("usernames").doc(username).get();
      const existingData = existsSnap.exists ? existsSnap.data() || {} : {};
      if (existsSnap.exists && String(existingData.uid || "").trim()) {
        throw new Error("USERNAME_TAKEN");
      }

      const authHandle = makeAuthHandle(username);
      await auth.createUserWithEmailAndPassword(authHandle, passwordForAuth(pass));
      const user = auth.currentUser;
      if (!user) throw new Error("Missing auth user after signup");
      const publicAvatarDataUrl = normalizeAvatarDataUrl(user.photoURL || "");

      await db.runTransaction(async (tx) => {
        const registryRef = db.collection("usernames").doc(username);
        const registrySnap = await tx.get(registryRef);
        const registryData = registrySnap.exists ? registrySnap.data() || {} : {};
        const existingUid = String(registryData.uid || "").trim();
        if (existingUid && existingUid !== user.uid) throw new Error("USERNAME_TAKEN");
        tx.set(
          registryRef,
          {
            ...registryData,
            uid: user.uid,
            authHandle,
            avatarDataUrl: publicAvatarDataUrl || normalizeAvatarDataUrl(registryData.avatarDataUrl || ""),
            createdAt: registryData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });

      try {
        await user.updateProfile({ displayName: username });
      } catch (_) {}

      await ensureUserDocs(user, username);
      try {
        await syncPlaceholderClaimAcrossDebates(user.uid, username);
      } catch (error) {
        console.warn("Could not claim invited debates during signup", error);
      }
      applyPlaceholderClaimLocally(user.uid, username);
      createSucceeded = true;
      safeLsSet(LS_LAST_USERNAME, username);
      if (el.createPassword) {
        el.createPassword.value = "";
      }
    } catch (error) {
      console.warn("Signup failed", error);
      const code = String(error?.code || "");
      const message = String(error?.message || "");

      if (message.includes("USERNAME_TAKEN") || code === "auth/email-already-in-use") {
        setHint(el.createHint, "That username already exists. Try logging in.", "error");
      } else if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") {
        setHint(el.createHint, "Enable Email/Password in Firebase Auth first.", "error");
      } else if (code === "auth/network-request-failed") {
        setHint(el.createHint, "Network error. Check your connection and try again.", "error");
      } else {
        setHint(el.createHint, "Could not create the account right now.", "error");
      }

      const current = auth.currentUser;
      if (current) {
        try {
          await current.delete();
        } catch (_) {
          try {
            await auth.signOut();
          } catch (_) {}
        }
      }
    } finally {
      if (!createSucceeded) {
        hideAuthLoadingScreen();
      }
    }
  }

  async function signOutCurrentUser() {
    closeUserMenu();
    if (isPreviewMode()) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("preview");
      window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
      return;
    }
    showAuthLoadingScreen("Logging out");
    let signOutSucceeded = false;
    try {
      await auth.signOut();
      signOutSucceeded = true;
    } catch (error) {
      console.warn("Log out failed", error);
      showToast("Could not log out right now.", "error");
    } finally {
      if (!signOutSucceeded) {
        hideAuthLoadingScreen();
      }
    }
  }

  function openOwnProfileFromMenu() {
    closeUserMenu();
    openProfile(String(state.user?.uid || "").trim());
  }

  function openAdminUsernameModal(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid || !currentIsAdmin()) return;
    openAccountModal("username", {
      targetUid: safeUid,
      targetName: getNameForUid(safeUid, "debater")
    });
  }

  function openAdminProfilePicturePicker(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid || !currentIsAdmin()) return;
    openProfilePicturePicker({
      targetUid: safeUid,
      targetName: getNameForUid(safeUid, "debater")
    });
  }

  async function toggleAdminManagedUserStatus(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid || !currentIsAdmin() || !state.user) return;

    const currentRole = getUserRoleForUid(safeUid);
    const nextRole = currentRole === "admin" ? "user" : "admin";
    const safeName = normalizeUsername(getNameForUid(safeUid, "debater")) || "that user";
    const confirmed = window.confirm(
      `Change ${safeName} from ${currentRole === "admin" ? "Admin" : "User"} to ${nextRole === "admin" ? "Admin" : "User"}?`
    );
    if (!confirmed) return;

    state.actionBusyKey = `${safeUid}:role`;
    renderApp({ preserveScroll: true });

    try {
      if (isPreviewMode()) {
        if (safeUid === String(state.user.uid || "").trim()) {
          state.selfProfile = {
            ...(state.selfProfile || {}),
            role: nextRole
          };
        }
        state.userProfiles = state.userProfiles.some((entry) => String(entry.uid || "").trim() === safeUid)
          ? state.userProfiles.map((entry) =>
              String(entry.uid || "").trim() === safeUid ? { ...entry, role: nextRole } : entry
            )
          : [...state.userProfiles, { uid: safeUid, role: nextRole }];
      } else {
        await db.collection("users").doc(safeUid).set(
          {
            role: nextRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        if (safeUid === String(state.user.uid || "").trim()) {
          state.selfProfile = {
            ...(state.selfProfile || {}),
            role: nextRole
          };
        }
        state.userProfiles = state.userProfiles.some((entry) => String(entry.uid || "").trim() === safeUid)
          ? state.userProfiles.map((entry) =>
              String(entry.uid || "").trim() === safeUid ? { ...entry, role: nextRole } : entry
            )
          : [...state.userProfiles, { uid: safeUid, role: nextRole }];
      }

      showToast(`${safeName} is now ${nextRole === "admin" ? "an admin" : "a user"}.`, "success");
    } catch (error) {
      console.warn("Could not change user role", error);
      showToast("Could not change that status right now.", "error");
    } finally {
      state.actionBusyKey = "";
      renderApp({ preserveScroll: true });
    }
  }

  function showAdminPasswordUnavailableMessage(uid) {
    const safeUid = String(uid || "").trim();
    if (safeUid && safeUid === String(state.user?.uid || "").trim()) {
      openAccountModal("password");
      return;
    }
    const safeName = normalizeUsername(getNameForUid(uid, "debater")) || "that user";
    showToast(
      `Changing ${safeName}'s password needs a secure Firebase Admin backend, so it is not available from this client-only app yet.`,
      "error"
    );
  }

  function openProfilePicturePicker(options = {}) {
    if (state.profilePictureBusy) return;
    closeUserMenu();

    if (!state.user) {
      showToast("Sign in to change your profile picture.", "error");
      return;
    }

    const targetUid = String(options.targetUid || state.user.uid || "").trim();
    const targetName = normalizeUsername(options.targetName || getNameForUid(targetUid, "debater")) || "debater";
    if (!targetUid) return;
    if (targetUid !== String(state.user.uid || "").trim() && !currentIsAdmin()) {
      showToast("Only admins can change another user's profile picture.", "error");
      return;
    }

    state.profilePictureTargetUid = targetUid;
    state.profilePictureTargetName = targetName;

    if (el.profilePictureInput) {
      el.profilePictureInput.value = "";
      el.profilePictureInput.click();
    }
  }

  async function handleProfilePictureInputChange(event) {
    const file = event.target?.files?.[0] || null;
    if (!file) return;

    if (!state.user) {
      showToast("Sign in to change your profile picture.", "error");
      event.target.value = "";
      return;
    }

    const viewerUid = String(state.user.uid || "").trim();
    const targetUid = String(state.profilePictureTargetUid || viewerUid).trim();
    const targetName =
      normalizeUsername(state.profilePictureTargetName || getNameForUid(targetUid, targetUid === viewerUid ? state.username || "debater" : "debater")) ||
      "debater";
    const isOwnTarget = targetUid === viewerUid;
    if (!isOwnTarget && !currentIsAdmin()) {
      showToast("Only admins can change another user's profile picture.", "error");
      event.target.value = "";
      state.profilePictureTargetUid = "";
      state.profilePictureTargetName = "";
      return;
    }

    state.profilePictureBusy = true;
    if (isOwnTarget && el.menuChangeProfilePictureBtn) {
      el.menuChangeProfilePictureBtn.disabled = true;
      el.menuChangeProfilePictureBtn.textContent = "Uploading...";
    }

    try {
      const dataUrl = await encodeProfileAvatarFromFile(file);

      if (isPreviewMode()) {
        if (isOwnTarget) {
          state.selfProfile = {
            ...(state.selfProfile || {}),
            avatarDataUrl: dataUrl
          };
        }
        applyDirectoryAvatarLocally(targetUid, dataUrl);
        renderApp({ preserveScroll: true });
        showToast(isOwnTarget ? "Profile picture updated." : `${targetName} profile picture updated.`, "success");
        return;
      }

      const username =
        normalizeUsername(
          isOwnTarget
            ? state.username || state.user?.displayName || ""
            : getNameForUid(targetUid, "")
        ) ||
        (await resolveUsernameForUid(targetUid)) ||
        "";
      const batch = db.batch();
      batch.set(
        db.collection("users").doc(targetUid),
        {
          avatarDataUrl: dataUrl,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      if (username) {
        batch.set(
          db.collection("usernames").doc(username),
          {
            avatarDataUrl: dataUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
      await batch.commit();

      if (isOwnTarget) {
        state.selfProfile = {
          ...(state.selfProfile || {}),
          avatarDataUrl: dataUrl
        };
        try {
          await auth.currentUser?.updateProfile({ photoURL: dataUrl });
        } catch (_) {}
      }

      applyDirectoryAvatarLocally(targetUid, dataUrl);

      renderApp({ preserveScroll: true });
      showToast(isOwnTarget ? "Profile picture updated." : `${targetName} profile picture updated.`, "success");
    } catch (error) {
      console.warn("Profile picture update failed", error);
      showToast(String(error?.message || `Could not update ${isOwnTarget ? "your" : `${targetName}'s`} profile picture.`), "error");
    } finally {
      state.profilePictureBusy = false;
      state.profilePictureTargetUid = "";
      state.profilePictureTargetName = "";
      if (el.profilePictureInput) {
        el.profilePictureInput.value = "";
      }
      if (isOwnTarget && el.menuChangeProfilePictureBtn) {
        el.menuChangeProfilePictureBtn.disabled = false;
        el.menuChangeProfilePictureBtn.textContent = "Change Profile Picture";
      }
    }
  }

  async function ensureReservedUsername(username) {
    const safeName = normalizeUsername(username);
    if (!isValidUsername(safeName)) {
      throw new Error("INVALID_USERNAME");
    }

    const existingEntry = getDirectoryEntryByUsername(safeName);
    if (existingEntry && !isPlaceholderUid(existingEntry.uid)) {
      return {
        uid: String(existingEntry.uid || "").trim(),
        username: safeName,
        isPlaceholder: false
      };
    }

    const placeholderUid = makePlaceholderUid(safeName);

    if (isPreviewMode()) {
      if (!existingEntry) {
        state.directory = [
          ...state.directory,
          {
            uid: placeholderUid,
            actualUid: "",
            username: safeName,
            isPlaceholder: true
          }
        ].sort((left, right) => normalizeUsername(left.username || "").localeCompare(normalizeUsername(right.username || "")));
      }

      return {
        uid: placeholderUid,
        username: safeName,
        isPlaceholder: true
      };
    }

    const registryRef = db.collection("usernames").doc(safeName);
    let resolvedUid = placeholderUid;

    await db.runTransaction(async (tx) => {
      const registrySnap = await tx.get(registryRef);
      if (registrySnap.exists) {
        const data = registrySnap.data() || {};
        const actualUid = String(data.uid || "").trim();
        if (actualUid) {
          resolvedUid = actualUid;
          return;
        }
        resolvedUid = placeholderUid;
        return;
      }

      tx.set(registryRef, {
        uid: "",
        authHandle: "",
        invitedByUid: String(state.user?.uid || "").trim(),
        invitedByName: state.username || "member",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    return {
      uid: resolvedUid,
      username: safeName,
      isPlaceholder: isPlaceholderUid(resolvedUid)
    };
  }

  async function resolveScheduledDebaterIdentity(selectedValue) {
    const safeValue = String(selectedValue || "").trim();
    if (!safeValue) return null;

    if (isPlaceholderUid(safeValue)) {
      const username = getPlaceholderUsername(safeValue);
      return ensureReservedUsername(username);
    }

    return {
      uid: safeValue,
      username: getNameForUid(safeValue, "debater"),
      isPlaceholder: false
    };
  }

  function buildPlaceholderClaimPatch(debate, username, realUid) {
    const safeName = normalizeUsername(username);
    const safeUid = String(realUid || "").trim();
    const placeholderUid = makePlaceholderUid(safeName);
    if (!debate || !safeName || !safeUid || !placeholderUid) return null;

    const patch = {};

    if (String(debate.debaterAUid || "").trim() === placeholderUid) {
      patch.debaterAUid = safeUid;
      patch.debaterAName = safeName;
    }
    if (String(debate.debaterBUid || "").trim() === placeholderUid) {
      patch.debaterBUid = safeUid;
      patch.debaterBName = safeName;
    }
    if (String(debate.winnerUid || "").trim() === placeholderUid) {
      patch.winnerUid = safeUid;
      patch.winnerName = safeName;
    }

    return Object.keys(patch).length ? patch : null;
  }

  function applyPlaceholderClaimLocally(uid, username) {
    const safeUid = String(uid || "").trim();
    const safeName = normalizeUsername(username);
    const placeholderUid = makePlaceholderUid(safeName);
    if (!safeUid || !safeName || !placeholderUid) return;

    let foundRealEntry = false;
    state.directory = state.directory
      .map((entry) => {
        if (normalizeUsername(entry.username || "") !== safeName) {
          return entry;
        }

        foundRealEntry = true;
        return {
          ...entry,
          uid: safeUid,
          actualUid: safeUid,
          username: safeName,
          isPlaceholder: false
        };
      })
      .filter((entry, index, array) => {
        return (
          array.findIndex(
            (candidate) =>
              normalizeUsername(candidate.username || "") === normalizeUsername(entry.username || "")
          ) === index
        );
      });

    if (!foundRealEntry) {
      state.directory = [
        ...state.directory,
        {
          uid: safeUid,
          actualUid: safeUid,
          username: safeName,
          isPlaceholder: false
        }
      ];
    }

    state.debates = state.debates.map((debate) => {
      const patch = buildPlaceholderClaimPatch(debate, safeName, safeUid);
      return patch ? { ...debate, ...patch } : debate;
    });
  }

  async function syncPlaceholderClaimAcrossDebates(uid, username) {
    const safeUid = String(uid || "").trim();
    const safeName = normalizeUsername(username);
    if (!safeUid || !safeName || isPreviewMode()) return;

    const snapshot = await db.collection("debates").get();
    const updates = snapshot.docs
      .map((doc) => {
        const debate = { id: doc.id, ...(doc.data() || {}) };
        const patch = buildPlaceholderClaimPatch(debate, safeName, safeUid);
        return patch ? { id: doc.id, patch } : null;
      })
      .filter(Boolean);

    if (!updates.length) return;

    for (let index = 0; index < updates.length; index += 350) {
      const batch = db.batch();
      updates.slice(index, index + 350).forEach((entry) => {
        batch.set(
          db.collection("debates").doc(entry.id),
          {
            ...entry.patch,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });
      await batch.commit();
    }
  }

  function buildDebateUsernamePatch(debate, uid, nextName) {
    const safeUid = String(uid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    if (!debate || !safeUid || !safeName) return null;

    const patch = {};

    if (String(debate.debaterAUid || "").trim() === safeUid && normalizeUsername(debate.debaterAName || "") !== safeName) {
      patch.debaterAName = safeName;
    }
    if (String(debate.debaterBUid || "").trim() === safeUid && normalizeUsername(debate.debaterBName || "") !== safeName) {
      patch.debaterBName = safeName;
    }
    if (String(debate.winnerUid || "").trim() === safeUid && normalizeUsername(debate.winnerName || "") !== safeName) {
      patch.winnerName = safeName;
    }
    if (String(debate.createdByUid || "").trim() === safeUid && normalizeUsername(debate.createdByName || "") !== safeName) {
      patch.createdByName = safeName;
    }
    if (String(debate.claimedByUid || "").trim() === safeUid && normalizeUsername(debate.claimedByName || "") !== safeName) {
      patch.claimedByName = safeName;
    }
    if (String(debate.videoAddedByUid || "").trim() === safeUid && normalizeUsername(debate.videoAddedByName || "") !== safeName) {
      patch.videoAddedByName = safeName;
    }

    const currentComments = Array.isArray(debate?.comments) ? debate.comments : [];
    let commentsChanged = false;
    const nextComments = currentComments.map((comment) => {
      if (String(comment?.authorUid || "").trim() !== safeUid || normalizeUsername(comment?.authorName || "") === safeName) {
        return comment;
      }
      commentsChanged = true;
      return {
        ...comment,
        authorName: safeName
      };
    });

    if (commentsChanged) {
      patch.comments = nextComments;
    }

    return Object.keys(patch).length ? patch : null;
  }

  function applyUsernameLocally(uid, nextName) {
    const safeUid = String(uid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    if (!safeUid || !safeName) return;

    if (String(state.user?.uid || "").trim() === safeUid) {
      state.username = safeName;
      safeLsSet(LS_LAST_USERNAME, safeName);
      if (state.user) {
        state.user.displayName = safeName;
      }
      state.selfProfile = {
        ...(state.selfProfile || {}),
        username: safeName,
        name: safeName
      };
    }

    state.directory = state.directory.map((entry) => {
      if (String(entry.uid || "").trim() !== safeUid) {
        return entry;
      }
      return {
        ...entry,
        username: safeName
      };
    });

    state.debates = state.debates.map((debate) => {
      const patch = buildDebateUsernamePatch(debate, safeUid, safeName);
      return patch ? { ...debate, ...patch } : debate;
    });
  }

  async function syncUsernameAcrossDebates(uid, nextName) {
    const safeUid = String(uid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    if (!safeUid || !safeName || isPreviewMode()) return;

    const updates = state.debates
      .map((debate) => {
        const patch = buildDebateUsernamePatch(debate, safeUid, safeName);
        return patch ? { id: debate.id, patch } : null;
      })
      .filter(Boolean);

    if (!updates.length) return;

    for (let index = 0; index < updates.length; index += 350) {
      const batch = db.batch();
      updates.slice(index, index + 350).forEach((entry) => {
        batch.set(
          db.collection("debates").doc(entry.id),
          {
            ...entry.patch,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });
      await batch.commit();
    }
  }

  function changeUsername() {
    openAccountModal("username");
  }

  async function submitAdminUsernameChange(targetUid, nextInput) {
    const safeUid = String(targetUid || "").trim();
    if (!currentIsAdmin() || !safeUid) return;

    const currentUserUid = String(state.user?.uid || auth.currentUser?.uid || "").trim();
    if (safeUid === currentUserUid) {
      await submitUsernameChange(nextInput);
      return;
    }

    const current =
      normalizeUsername(getNameForUid(safeUid, "")) ||
      normalizeUsername((await resolveUsernameForUid(safeUid)) || "");
    if (!current) {
      setHint(el.accountModalHint, "Could not find that user.", "error");
      return;
    }

    const next = normalizeUsername(nextInput || "");
    if (!next || next === current) {
      closeAccountModal();
      return;
    }
    if (!isValidUsername(next)) {
      setHint(el.accountModalHint, "Username must be 3-20 chars using a-z, 0-9, and _. Spaces become _ automatically.", "error");
      return;
    }

    if (state.directory.some((entry) => normalizeUsername(entry.username || "") === next && String(entry.uid || "").trim() !== safeUid)) {
      setHint(el.accountModalHint, "That username is already taken.", "error");
      return;
    }

    state.accountModalBusy = true;
    syncAccountModalUi();

    if (isPreviewMode()) {
      applyUsernameLocally(safeUid, next);
      closeAccountModal(true);
      renderApp({ preserveScroll: true });
      showToast("Username updated.", "success");
      return;
    }

    showAuthLoadingScreen("Changing username");
    let syncedDebateNames = true;

    try {
      const currentRegistry = await db.collection("usernames").doc(current).get();
      const currentData = currentRegistry.exists ? currentRegistry.data() || {} : {};
      const authHandle = String(currentData.authHandle || "").trim() || (await lookupAuthHandleForUsername(current));
      if (!authHandle) {
        throw new Error("MISSING_AUTH_HANDLE");
      }

      await db.runTransaction(async (tx) => {
        const currentRef = db.collection("usernames").doc(current);
        const nextRef = db.collection("usernames").doc(next);
        const currentSnap = await tx.get(currentRef);
        const nextSnap = await tx.get(nextRef);
        const nextData = nextSnap.exists ? nextSnap.data() || {} : {};
        const nextUid = String(nextData.uid || "").trim();

        if (nextSnap.exists && nextUid && nextUid !== safeUid) {
          throw new Error("USERNAME_TAKEN");
        }

        const currentTxData = currentSnap.exists ? currentSnap.data() || {} : {};
        const createdAt =
          currentTxData.createdAt ||
          nextData.createdAt ||
          firebase.firestore.FieldValue.serverTimestamp();
        const claimedAt =
          currentTxData.claimedAt ||
          nextData.claimedAt ||
          firebase.firestore.FieldValue.serverTimestamp();
        const avatarDataUrl = normalizeAvatarDataUrl(
          currentTxData.avatarDataUrl || nextData.avatarDataUrl || getAvatarDataUrlForUid(safeUid) || ""
        );

        if (current !== next && currentSnap.exists) {
          tx.delete(currentRef);
        }

        tx.set(
          nextRef,
          {
            ...nextData,
            uid: safeUid,
            authHandle,
            avatarDataUrl,
            createdAt,
            claimedAt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        tx.set(
          db.collection("users").doc(safeUid),
          {
            username: next,
            name: next,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });

      try {
        await syncUsernameAcrossDebates(safeUid, next);
      } catch (error) {
        syncedDebateNames = false;
        console.warn("Failed syncing debate names after admin username change", error);
      }

      applyUsernameLocally(safeUid, next);
      closeAccountModal(true);
      renderApp({ preserveScroll: true });
      showToast(
        syncedDebateNames ? "Username updated." : "Username updated. Some debate labels may refresh shortly.",
        "success"
      );
    } catch (error) {
      console.warn("Admin username change failed", error);
      const message = String(error?.message || "");
      setHint(
        el.accountModalHint,
        message.includes("USERNAME_TAKEN") ? "That username is already taken." : "Could not change that username.",
        "error"
      );
    } finally {
      state.accountModalBusy = false;
      syncAccountModalUi();
      hideAuthLoadingScreen();
    }
  }

  async function submitUsernameChange(nextInput) {
    const activeUid = String(state.user?.uid || auth.currentUser?.uid || "").trim();
    const current = normalizeUsername(state.username || state.user?.displayName || auth.currentUser?.displayName || "");
    if (!activeUid || !current) return;

    const next = normalizeUsername(nextInput || "");
    if (!next || next === current) {
      closeAccountModal();
      return;
    }
    if (!isValidUsername(next)) {
      setHint(el.accountModalHint, "Username must be 3-20 chars using a-z, 0-9, and _. Spaces become _ automatically.", "error");
      return;
    }

    if (state.directory.some((entry) => normalizeUsername(entry.username || "") === next && String(entry.uid || "").trim() !== activeUid)) {
      setHint(el.accountModalHint, "That username is already taken.", "error");
      return;
    }

    state.accountModalBusy = true;
    syncAccountModalUi();

    if (isPreviewMode()) {
      applyUsernameLocally(activeUid, next);
      closeAccountModal(true);
      renderApp({ preserveScroll: true });
      showToast("Username updated.", "success");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    showAuthLoadingScreen("Changing username");
    let syncedDebateNames = true;

    try {
      const currentRegistry = await db.collection("usernames").doc(current).get();
      const currentData = currentRegistry.exists ? currentRegistry.data() || {} : {};
      const authHandle = String(currentData.authHandle || "").trim() || (await lookupAuthHandleForUsername(current));
      if (!authHandle) {
        throw new Error("MISSING_AUTH_HANDLE");
      }

      await db.runTransaction(async (tx) => {
        const currentRef = db.collection("usernames").doc(current);
        const nextRef = db.collection("usernames").doc(next);
        const currentSnap = await tx.get(currentRef);
        const nextSnap = await tx.get(nextRef);

        if (nextSnap.exists) {
          throw new Error("USERNAME_TAKEN");
        }

      const createdAt =
          (currentSnap.exists ? currentSnap.data()?.createdAt : null) || firebase.firestore.FieldValue.serverTimestamp();
        const avatarDataUrl = normalizeAvatarDataUrl(
          (currentSnap.exists ? currentSnap.data()?.avatarDataUrl : "") || user.photoURL || state.selfProfile?.avatarDataUrl || ""
        );

        if (currentSnap.exists) {
          tx.delete(currentRef);
        }

        tx.set(nextRef, {
          uid: user.uid,
          authHandle,
          avatarDataUrl,
          createdAt,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        tx.set(
          db.collection("users").doc(user.uid),
          {
            username: next,
            name: next,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      });

      try {
        await user.updateProfile({ displayName: next });
      } catch (_) {}

      try {
        await syncUsernameAcrossDebates(user.uid, next);
      } catch (error) {
        syncedDebateNames = false;
        console.warn("Failed syncing debate names after username change", error);
      }

      applyUsernameLocally(user.uid, next);
      closeAccountModal(true);
      renderApp({ preserveScroll: true });
      showToast(
        syncedDebateNames ? "Username updated." : "Username updated. Some debate labels may refresh shortly.",
        "success"
      );
    } catch (error) {
      console.warn("Username change failed", error);
      const message = String(error?.message || "");
      setHint(
        el.accountModalHint,
        message.includes("USERNAME_TAKEN") ? "That username is already taken." : "Could not change your username.",
        "error"
      );
    } finally {
      state.accountModalBusy = false;
      syncAccountModalUi();
      hideAuthLoadingScreen();
    }
  }

  function changePassword() {
    openAccountModal("password");
  }

  async function submitPasswordChange(nextPassword, confirmPassword) {
    const user = auth.currentUser;
    if (!user) return;

    if (!nextPassword) {
      setHint(el.accountModalHint, "Enter a new password.", "error");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setHint(el.accountModalHint, "Passwords did not match.", "error");
      return;
    }

    state.accountModalBusy = true;
    syncAccountModalUi();

    showAuthLoadingScreen("Changing password");

    try {
      await user.updatePassword(passwordForAuth(nextPassword));
      closeAccountModal(true);
      showToast("Password updated.", "success");
    } catch (error) {
      console.warn("Password change failed", error);
      const code = String(error?.code || "");
      if (code === "auth/requires-recent-login") {
        setHint(el.accountModalHint, "Log out and back in, then try again.", "error");
      } else {
        setHint(el.accountModalHint, "Could not change your password.", "error");
      }
    } finally {
      state.accountModalBusy = false;
      syncAccountModalUi();
      hideAuthLoadingScreen();
    }
  }

  async function handleAccountModalSubmit(event) {
    event.preventDefault();
    if (!state.accountModalOpen || state.accountModalBusy) return;

    setHint(el.accountModalHint, "", "");
    const formData = new FormData(event.target);

    if (state.accountModalType === "username") {
      if (isAdminManagingTargetUser(state.accountModalTargetUid)) {
        await submitAdminUsernameChange(state.accountModalTargetUid, String(formData.get("nextUsername") || ""));
      } else {
        await submitUsernameChange(String(formData.get("nextUsername") || ""));
      }
      return;
    }

    if (state.accountModalType === "password") {
      await submitPasswordChange(
        String(formData.get("nextPassword") || ""),
        String(formData.get("confirmPassword") || "")
      );
    }
  }

  async function handleAuthStateChanged(user) {
    state.user = user || null;
    state.currentPage = getPageFromUrl();
    state.profileUid = getProfileUidFromUrl();
    state.debateId = getDebateIdFromUrl();

    if (!user) {
      unsubscribeFromDirectory();
      unsubscribeFromDebates();
      unsubscribeFromSelfProfile();
      unsubscribeFromAdminProfiles();
      state.username = "";
      state.profilePictureBusy = false;
      state.profilePictureTargetUid = "";
      state.profilePictureTargetName = "";
      state.selfProfile = null;
      state.userProfiles = [];
      state.profileUid = "";
      state.settingsSection = "root";
      state.scheduleSection = "new";
      state.directory = [];
      state.debates = [];
      resetSearchState();
      state.rankingsCategory = "";
      state.scheduleDraft = makeDefaultScheduleDraft("");
      state.lazyDebateDraft = makeDefaultLazyDebateDraft();
      closeUserMenu();
      closeAccountModal(true);
      showAuthScreen();
      hideAuthLoadingScreen();
      state.bootResolved = true;
      return;
    }

    showAuthLoadingScreen("Loading the arena");

    try {
      const username = (await ensureUserDisplayName(user)) || normalizeUsername(user.displayName || "");
      state.username = username || "debater";
      safeLsSet(LS_LAST_USERNAME, state.username);
      state.profilePictureTargetUid = "";
      state.profilePictureTargetName = "";
      state.rankingsCategory = "";
      state.settingsSection = "root";
      state.scheduleSection = "new";
      state.scheduleDraft = makeDefaultScheduleDraft(String(user.uid || ""));
      state.lazyDebateDraft = makeDefaultLazyDebateDraft();
      await ensureUserDocs(user, state.username);
      try {
        const selfSnap = await db.collection("users").doc(String(user.uid || "")).get();
        state.selfProfile = selfSnap.exists ? selfSnap.data() || {} : { username: state.username, name: state.username };
      } catch (_) {
        state.selfProfile = {
          ...(state.selfProfile || {}),
          username: state.username,
          name: state.username
        };
      }
      try {
        await syncPublicDirectoryProfile(user, state.username, user.photoURL || "");
      } catch (error) {
        console.warn("Could not sync public avatar directory", error);
      }
      subscribeToSelfProfile(String(user.uid || ""));
      subscribeToDirectory();
      subscribeToDebates();
      showHubShell();
      renderApp();
    } catch (error) {
      console.warn("Failed during signed-in boot", error);
      showToast("Signed in, but some debate data could not be restored.", "error");
      subscribeToSelfProfile(String(user.uid || ""));
      subscribeToDirectory();
      subscribeToDebates();
      showHubShell();
      renderApp();
    } finally {
      hideAuthLoadingScreen();
      state.bootResolved = true;
    }
  }

  async function handleScheduleSubmit(event) {
    event.preventDefault();
    if (!state.user || state.scheduleSaving) return;

    const formData = new FormData(event.target);
    const topic = String(formData.get("topic") || "").trim();
    const debaterASelection = String(formData.get("debaterAUid") || "").trim();
    const debaterBUSelection = String(formData.get("debaterBUid") || "").trim();
    const category = normalizeDebateCategory(formData.get("category"), "");
    const scheduledForRaw = String(formData.get("scheduledFor") || "").trim();
    const moderator = String(formData.get("moderator") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!topic) {
      showToast("Add a topic or resolution before scheduling.", "error");
      return;
    }
    if (!debaterASelection || !debaterBUSelection) {
      showToast("Pick both debaters before scheduling.", "error");
      return;
    }
    if (debaterASelection === debaterBUSelection) {
      showToast("Debaters need to be different people.", "error");
      return;
    }
    if (!isValidDebateCategory(category)) {
      showToast("Choose a category before scheduling.", "error");
      return;
    }

    const scheduledDate = new Date(scheduledForRaw);
    if (!scheduledForRaw || Number.isNaN(scheduledDate.getTime())) {
      showToast("Choose a valid debate date and time.", "error");
      return;
    }

    state.scheduleSaving = true;
    state.openSelectKey = "";
    renderApp();

    try {
      const debaterAIdentity = await resolveScheduledDebaterIdentity(debaterASelection);
      const debaterBIdentity = await resolveScheduledDebaterIdentity(debaterBUSelection);
      if (!debaterAIdentity || !debaterBIdentity) {
        throw new Error("INVALID_DEBATERS");
      }

      const debaterAUid = String(debaterAIdentity.uid || "").trim();
      const debaterBUid = String(debaterBIdentity.uid || "").trim();
      const debaterAName = normalizeUsername(debaterAIdentity.username || "debater") || "debater";
      const debaterBName = normalizeUsername(debaterBIdentity.username || "debater") || "debater";

      if (!debaterAUid || !debaterBUid) {
        throw new Error("INVALID_DEBATERS");
      }
      if (debaterAUid === debaterBUid) {
        showToast("Debaters need to be different people.", "error");
        return;
      }

      if (isPreviewMode()) {
        state.debates = [
          ...state.debates,
          {
            id: `preview-${Date.now().toString(36)}`,
            topic,
            category,
            debaterAUid,
            debaterAName,
            debaterBUid,
            debaterBName,
            scheduledFor: scheduledDate,
            moderator,
            description,
            status: "scheduled",
            result: "pending",
            winnerUid: "",
            winnerName: "",
            createdByUid: String(state.user.uid || "").trim(),
            createdByName: state.username || "member",
            claimedByUid: "",
            claimedByName: "",
            claimedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        state.scheduleDraft = makeDefaultScheduleDraft(String(state.user.uid || ""));
        ensureScheduleDraftParticipants();
        showToast("Debate scheduled.", "success");
        setPage("dashboard");
        return;
      }

      await db.collection("debates").add({
        topic,
        category,
        debaterAUid,
        debaterAName,
        debaterBUid,
        debaterBName,
        scheduledFor: firebase.firestore.Timestamp.fromDate(scheduledDate),
        moderator,
        description,
        status: "scheduled",
        result: "pending",
        winnerUid: "",
        winnerName: "",
        createdByUid: String(state.user.uid || "").trim(),
        createdByName: state.username || "member",
        claimedByUid: "",
        claimedByName: "",
        claimedAt: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      state.scheduleDraft = makeDefaultScheduleDraft(String(state.user.uid || ""));
      ensureScheduleDraftParticipants();
      showToast("Debate scheduled.", "success");
      setPage("dashboard");
    } catch (error) {
      console.warn("Could not schedule debate", error);
      showToast("Could not schedule that debate right now.", "error");
    } finally {
      state.scheduleSaving = false;
      renderApp();
    }
  }

  async function handleLazyDebateSubmit(event) {
    event.preventDefault();
    if (!currentIsAdmin() || !state.user || state.adminLogSaving) return;

    const formData = new FormData(event.target);
    const topic = String(formData.get("topic") || "").trim();
    const debaterASelection = String(formData.get("debaterAUid") || "").trim();
    const debaterBUSelection = String(formData.get("debaterBUid") || "").trim();
    const category = normalizeDebateCategory(formData.get("category"), "");
    const scheduledForRaw = String(formData.get("scheduledFor") || "").trim();
    const moderator = String(formData.get("moderator") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const videoUrl = String(formData.get("videoUrl") || "").trim();
    const result = String(formData.get("result") || state.lazyDebateDraft.result || "a").trim();

    if (!topic) {
      showToast("Add a topic or resolution before logging.", "error");
      return;
    }
    if (!debaterASelection || !debaterBUSelection) {
      showToast("Pick both debaters before logging.", "error");
      return;
    }
    if (debaterASelection === debaterBUSelection) {
      showToast("Debaters need to be different people.", "error");
      return;
    }
    if (!isValidDebateCategory(category)) {
      showToast("Choose a category before logging.", "error");
      return;
    }
    if (!["a", "b", "draw"].includes(result)) {
      showToast("Pick a winner before logging.", "error");
      return;
    }

    const scheduledDate = new Date(scheduledForRaw);
    if (!scheduledForRaw || Number.isNaN(scheduledDate.getTime())) {
      showToast("Choose a valid debate date and time.", "error");
      return;
    }

    state.adminLogSaving = true;
    state.openSelectKey = "";
    renderApp({ preserveScroll: true });

    try {
      const debaterAIdentity = await resolveScheduledDebaterIdentity(debaterASelection);
      const debaterBIdentity = await resolveScheduledDebaterIdentity(debaterBUSelection);
      if (!debaterAIdentity || !debaterBIdentity) {
        throw new Error("INVALID_DEBATERS");
      }

      const debaterAUid = String(debaterAIdentity.uid || "").trim();
      const debaterBUid = String(debaterBIdentity.uid || "").trim();
      const debaterAName = normalizeUsername(debaterAIdentity.username || "debater") || "debater";
      const debaterBName = normalizeUsername(debaterBIdentity.username || "debater") || "debater";
      const now = new Date();
      const videoPayload = buildDebateVideoPayload(videoUrl, {
        addedAt: now,
        addedByUid: String(state.user.uid || "").trim(),
        addedByName: state.username || "admin"
      });

      if (!debaterAUid || !debaterBUid || debaterAUid === debaterBUid) {
        throw new Error("INVALID_DEBATERS");
      }
      if (!videoPayload) {
        showToast("Use a valid YouTube link.", "error");
        return;
      }

      const winnerUid = result === "a" ? debaterAUid : result === "b" ? debaterBUid : "";
      const winnerName = result === "a" ? debaterAName : result === "b" ? debaterBName : "";

      if (isPreviewMode()) {
        state.debates = [
          ...state.debates,
          {
            id: `preview-${Date.now().toString(36)}`,
            topic,
            category,
            debaterAUid,
            debaterAName,
            debaterBUid,
            debaterBName,
            scheduledFor: scheduledDate,
            moderator,
            description,
            status: "resolved",
            result,
            winnerUid,
            winnerName,
            createdByUid: String(state.user.uid || "").trim(),
            createdByName: state.username || "admin",
            claimedByUid: String(state.user.uid || "").trim(),
            claimedByName: state.username || "admin",
            claimedAt: now,
            createdAt: now,
            updatedAt: now,
            comments: [],
            ...videoPayload
          }
        ];

        state.lazyDebateDraft = makeDefaultLazyDebateDraft();
        showToast("Debate logged.", "success");
        renderApp({ preserveScroll: true });
        return;
      }

      await db.collection("debates").add({
        topic,
        category,
        debaterAUid,
        debaterAName,
        debaterBUid,
        debaterBName,
        scheduledFor: firebase.firestore.Timestamp.fromDate(scheduledDate),
        moderator,
        description,
        status: "resolved",
        result,
        winnerUid,
        winnerName,
        createdByUid: String(state.user.uid || "").trim(),
        createdByName: state.username || "admin",
        claimedByUid: String(state.user.uid || "").trim(),
        claimedByName: state.username || "admin",
        claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...buildDebateVideoPayload(videoUrl, {
          addedAt: firebase.firestore.FieldValue.serverTimestamp(),
          addedByUid: String(state.user.uid || "").trim(),
          addedByName: state.username || "admin"
        })
      });

      state.lazyDebateDraft = makeDefaultLazyDebateDraft();
      showToast("Debate logged.", "success");
    } catch (error) {
      console.warn("Could not log debate", error);
      showToast("Could not log that debate right now.", "error");
    } finally {
      state.adminLogSaving = false;
      renderApp({ preserveScroll: true });
    }
  }

  async function handleDebateCommentSubmit(event) {
    event.preventDefault();
    if (!state.user) return;

    const formData = new FormData(event.target);
    const debateId = String(formData.get("debateId") || "").trim();
    const commentText = String(formData.get("commentText") || "").trim();
    const debate = state.debates.find((entry) => entry.id === debateId);

    if (!debate || !commentText) {
      showToast("Write a comment before posting.", "error");
      return;
    }

    const comment = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      authorUid: String(state.user.uid || "").trim(),
      authorName: state.username || "member",
      text: commentText,
      createdAt: Date.now()
    };

    state.actionBusyKey = `${debateId}:comment`;
    renderApp({ preserveScroll: true });

    try {
      if (isPreviewMode()) {
        state.debates = state.debates.map((entry) => {
          if (entry.id !== debateId) return entry;
          return {
            ...entry,
            comments: [...getDebateComments(entry), comment],
            updatedAt: new Date()
          };
        });
      } else {
        await db.collection("debates").doc(debateId).update({
          comments: firebase.firestore.FieldValue.arrayUnion(comment),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Comment posted.", "success");
    } catch (error) {
      console.warn("Could not post comment", error);
      showToast("Could not post that comment right now.", "error");
    } finally {
      state.actionBusyKey = "";
      renderApp({ preserveScroll: true });
    }
  }

  async function handleDebateVideoSubmit(event) {
    event.preventDefault();
    if (!state.user) return;

    const formData = new FormData(event.target);
    const debateId = String(formData.get("debateId") || "").trim();
    const videoUrl = String(formData.get("videoUrl") || "").trim();
    const debate = state.debates.find((entry) => entry.id === debateId);

    if (!debate || !canEditDebateVideo(debate)) {
      showToast("You cannot edit that video link.", "error");
      return;
    }

    const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : "";
    if (videoUrl && !embedUrl) {
      showToast("Use a valid YouTube link.", "error");
      return;
    }

    state.actionBusyKey = `${debateId}:video`;
    renderApp({ preserveScroll: true });

    try {
      const payload = {
        videoUrl,
        videoEmbedUrl: embedUrl,
        videoAddedAt: videoUrl ? Date.now() : null,
        videoAddedByUid: videoUrl ? String(state.user.uid || "").trim() : "",
        videoAddedByName: videoUrl ? state.username || "member" : ""
      };

      if (isPreviewMode()) {
        state.debates = state.debates.map((entry) => {
          if (entry.id !== debateId) return entry;
          return {
            ...entry,
            ...payload,
            updatedAt: new Date()
          };
        });
      } else {
        await db.collection("debates").doc(debateId).update({
          ...payload,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast(videoUrl ? "Video updated." : "Video removed.", "success");
    } catch (error) {
      console.warn("Could not save video link", error);
      showToast("Could not save that video right now.", "error");
    } finally {
      state.actionBusyKey = "";
      renderApp({ preserveScroll: true });
    }
  }

  function getResolveVideoInputValue(debateId) {
    const safeDebateId = String(debateId || "").trim();
    if (!safeDebateId) return "";

    const input = el.mainContent?.querySelector(
      `[data-resolve-video-input="${safeDebateId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`
    );
    return input instanceof HTMLInputElement ? String(input.value || "").trim() : "";
  }

  async function claimDebateResult(debateId, outcome, videoUrl = "") {
    if (!currentIsAdmin() || !state.user || !debateId || !outcome) return;
    const debate = state.debates.find((entry) => entry.id === debateId);
    if (!debate) return;

    const safeVideoUrl = String(videoUrl || "").trim();
    const videoPayload =
      outcome === "reopen"
        ? null
        : buildDebateVideoPayload(safeVideoUrl, {
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedByUid: String(state.user.uid || "").trim(),
            addedByName: state.username || "admin"
          });
    if (outcome !== "reopen" && !videoPayload) {
      showToast("Use a valid YouTube link.", "error");
      return;
    }

    state.actionBusyKey = `${debateId}:${outcome}`;
    renderApp();

    try {
      const payload = {
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (outcome === "reopen") {
        payload.status = "scheduled";
        payload.result = "pending";
        payload.winnerUid = "";
        payload.winnerName = "";
        payload.claimedByUid = "";
        payload.claimedByName = "";
        payload.claimedAt = null;
      } else if (outcome === "draw") {
        payload.status = "resolved";
        payload.result = "draw";
        payload.winnerUid = "";
        payload.winnerName = "";
        payload.claimedByUid = String(state.user.uid || "").trim();
        payload.claimedByName = state.username || "admin";
        payload.claimedAt = firebase.firestore.FieldValue.serverTimestamp();
      } else if (outcome === "a" || outcome === "b") {
        payload.status = "resolved";
        payload.result = outcome;
        payload.winnerUid = outcome === "a" ? debate.debaterAUid || "" : debate.debaterBUid || "";
        payload.winnerName = outcome === "a" ? debate.debaterAName || "" : debate.debaterBName || "";
        payload.claimedByUid = String(state.user.uid || "").trim();
        payload.claimedByName = state.username || "admin";
        payload.claimedAt = firebase.firestore.FieldValue.serverTimestamp();
      } else {
        throw new Error("Unsupported outcome");
      }

      if (videoPayload) {
        Object.assign(payload, videoPayload);
      }

      await db.collection("debates").doc(debateId).update(payload);
      showToast(outcome === "reopen" ? "Debate reopened." : "Result claimed.", "success");
    } catch (error) {
      console.warn("Could not claim result", error);
      showToast("Could not update that result right now.", "error");
    } finally {
      state.actionBusyKey = "";
      renderApp();
    }
  }

  function handleDocumentClick(event) {
    const target = event.target;
    const clickedInsideSelect = target.closest("[data-select-root]");
    const clickedInsideSearch = target.closest("#search-shell");

    if (state.userMenuOpen && !target.closest("#user-menu")) {
      closeUserMenu();
    }

    if (state.searchMenuOpen && !clickedInsideSearch) {
      closeSearchMenu();
    }

    if (state.openSelectKey && !clickedInsideSelect) {
      closeOpenSelect();
    }

    const pageLink = target.closest("[data-page-link]");
    if (pageLink) {
      event.preventDefault();
      const page = pageLink.getAttribute("data-page-link");
      if (page) {
        setPage(page);
      }
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.getAttribute("data-action");
    if (action === "open-debate") {
      event.preventDefault();
      openDebate(actionButton.getAttribute("data-debate-id"));
      return;
    }

    if (action === "open-profile") {
      event.preventDefault();
      openProfile(actionButton.getAttribute("data-profile-uid"));
      return;
    }

    if (action === "admin-change-username") {
      event.preventDefault();
      openAdminUsernameModal(actionButton.getAttribute("data-profile-uid"));
      return;
    }

    if (action === "admin-change-avatar") {
      event.preventDefault();
      openAdminProfilePicturePicker(actionButton.getAttribute("data-profile-uid"));
      return;
    }

    if (action === "admin-change-status") {
      event.preventDefault();
      toggleAdminManagedUserStatus(actionButton.getAttribute("data-profile-uid"));
      return;
    }

    if (action === "admin-change-password") {
      event.preventDefault();
      showAdminPasswordUnavailableMessage(actionButton.getAttribute("data-profile-uid"));
      return;
    }

    if (action === "clear-admin-user-search") {
      event.preventDefault();
      state.adminUserSearchDraft = "";
      if (!syncAdminUserSearchUi()) {
        renderApp({ preserveScroll: true });
      }
      const input = el.mainContent?.querySelector("#admin-user-search-input");
      window.setTimeout(() => input?.focus(), 0);
      return;
    }

    if (action === "open-settings-section") {
      event.preventDefault();
      setSettingsSection(actionButton.getAttribute("data-settings-section"));
      return;
    }

    if (action === "mobile-open-own-profile") {
      event.preventDefault();
      openProfile(String(state.user?.uid || "").trim());
      return;
    }

    if (action === "mobile-toggle-theme") {
      event.preventDefault();
      toggleThemeMode();
      return;
    }

    if (action === "mobile-change-username") {
      event.preventDefault();
      changeUsername();
      return;
    }

    if (action === "mobile-change-avatar") {
      event.preventDefault();
      openProfilePicturePicker();
      return;
    }

    if (action === "mobile-change-password") {
      event.preventDefault();
      changePassword();
      return;
    }

    if (action === "mobile-log-out") {
      event.preventDefault();
      signOutCurrentUser();
      return;
    }

    if (action === "apply-search-suggestion") {
      event.preventDefault();
      applySearchSuggestionByIndex(Number(actionButton.getAttribute("data-search-index")));
      return;
    }

    if (action === "clear-mobile-search") {
      event.preventDefault();
      resetSearchState();
      syncSearchUi();
      if (!syncMobileSearchPageUi()) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "claim-result") {
      event.preventDefault();
      const debateId = actionButton.getAttribute("data-debate-id");
      claimDebateResult(debateId, actionButton.getAttribute("data-outcome"), getResolveVideoInputValue(debateId));
      return;
    }

    if (action === "toggle-debater-select") {
      event.preventDefault();
      const field = String(actionButton.getAttribute("data-select-field") || "").trim();
      toggleOpenSelect(field);
      return;
    }

    if (action === "toggle-category-select") {
      event.preventDefault();
      const selectKey = String(actionButton.getAttribute("data-select-key") || "").trim();
      toggleOpenSelect(selectKey);
      return;
    }

    if (action === "choose-debater") {
      event.preventDefault();
      const field = String(actionButton.getAttribute("data-select-field") || "").trim();
      const owner = String(actionButton.getAttribute("data-select-owner") || "schedule").trim();
      const value = String(actionButton.getAttribute("data-value") || "").trim();
      if (!field) return;
      setDraftField(owner, field, value);
      state.openSelectKey = "";
      if (!syncDraftFormUi(owner)) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "choose-category") {
      event.preventDefault();
      const owner = String(actionButton.getAttribute("data-select-owner") || "schedule").trim();
      const value = String(actionButton.getAttribute("data-value") || "").trim();
      setDraftField(owner, "category", value);
      state.openSelectKey = "";
      if (!syncDraftFormUi(owner)) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "create-placeholder-debater") {
      event.preventDefault();
      const field = String(actionButton.getAttribute("data-select-field") || "").trim();
      const owner = String(actionButton.getAttribute("data-select-owner") || "schedule").trim();
      const username = normalizeUsername(actionButton.getAttribute("data-value") || "");
      if (!field || !isValidUsername(username)) return;
      setDraftField(owner, field, makePlaceholderUid(username));
      state.openSelectKey = "";
      if (!syncDraftFormUi(owner)) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "set-schedule-section") {
      event.preventDefault();
      setScheduleSection(actionButton.getAttribute("data-value"));
      return;
    }

    if (action === "set-rankings-category") {
      event.preventDefault();
      state.rankingsCategory = normalizeRankingsCategory(actionButton.getAttribute("data-value"));
      renderApp({ preserveScroll: true });
      return;
    }

    if (action === "reset-schedule-form") {
      event.preventDefault();
      state.scheduleDraft = makeDefaultScheduleDraft(String(state.user?.uid || ""));
      ensureScheduleDraftParticipants();
      state.openSelectKey = "";
      if (!syncDraftFormUi("schedule")) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "set-lazy-result") {
      event.preventDefault();
      const value = String(actionButton.getAttribute("data-value") || "").trim();
      if (!["a", "b", "draw"].includes(value)) return;
      state.lazyDebateDraft.result = value;
      if (!syncLazyResultUi()) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "reset-lazy-form") {
      event.preventDefault();
      state.lazyDebateDraft = makeDefaultLazyDebateDraft();
      state.openSelectKey = "";
      if (!syncDraftFormUi("lazy")) {
        renderApp({ preserveScroll: true });
      }
      return;
    }
  }

  function handleDocumentKeydown(event) {
    if (event.key === "Escape" && state.accountModalOpen) {
      event.preventDefault();
      closeAccountModal();
    }
  }

  function handleMainInput(event) {
    if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-admin-user-search")) {
      state.adminUserSearchDraft = String(event.target.value || "");
      if (!syncAdminUserSearchUi()) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-mobile-search-input")) {
      state.searchDraft = String(event.target.value || "");
      state.searchTerm = "";
      state.searchMenuOpen = false;
      state.searchHighlightIndex = -1;
      syncSearchUi();
      if (!syncMobileSearchPageUi()) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    const selectFilterField = event.target.getAttribute("data-select-filter");
    if (selectFilterField) {
      syncUsernameInputValue(event.target);
      syncDebaterSelectFilter(selectFilterField);
      return;
    }

    const field = event.target.getAttribute("data-draft-field");
    if (!field) return;

    const owner = String(event.target.getAttribute("data-draft-owner") || "schedule").trim();
    const draft = getDraftState(owner);
    if (!draft) return;

    setDraftField(owner, field, String(event.target.value || ""));

  }

  function handleMainKeydown(event) {
    if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-mobile-search-input")) {
      if (event.key === "Enter") {
        event.preventDefault();
        openSearchResultsPage(event.target.value || "");
      }
      return;
    }

    const selectFilterField = event.target.getAttribute("data-select-filter");
    if (selectFilterField) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOpenSelect();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const root = event.target.closest("[data-select-root]");
        const createButton = root?.querySelector(".custom-select-create:not(.hidden)");
        const firstVisibleOption = root?.querySelector(
          '.custom-select-option[data-action="choose-debater"]:not(.hidden):not([data-empty-option="true"])'
        );
        const targetButton = createButton || firstVisibleOption;
        if (targetButton instanceof HTMLButtonElement) {
          targetButton.click();
        }
        return;
      }
    }

    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;

    const action = trigger.getAttribute("data-action");
    if (action === "open-debate" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDebate(trigger.getAttribute("data-debate-id"));
      return;
    }

    if (
      action === "open-profile" &&
      trigger.tagName !== "BUTTON" &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      openProfile(trigger.getAttribute("data-profile-uid"));
    }
  }

  function handlePopState() {
    state.currentPage = getPageFromUrl();
    state.profileUid = getProfileUidFromUrl();
    state.debateId = getDebateIdFromUrl();
    state.settingsSection = "root";
    state.openSelectKey = "";
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;
    renderApp();
  }

  function handleWindowResize() {
    const nextMobile = isMobileViewport();
    if (nextMobile !== state.isMobileViewport) {
      state.isMobileViewport = nextMobile;
      if (nextMobile) {
        resetSearchState();
        closeOpenSelect();
      }
      renderApp({ preserveScroll: true });
      return;
    }

    syncQueuePanelHeight();
  }

  function initEvents() {
    el.authTabLogin?.addEventListener("click", () => setAuthTab("login"));
    el.authTabCreate?.addEventListener("click", () => setAuthTab("create"));
    el.loginForm?.addEventListener("submit", handleLoginSubmit);
    el.createForm?.addEventListener("submit", handleCreateSubmit);
    el.loginUsername?.addEventListener("input", (event) => {
      syncUsernameInputValue(event.target);
    });
    el.createUsername?.addEventListener("input", (event) => {
      syncUsernameInputValue(event.target);
    });
    el.userPill?.addEventListener("click", toggleUserMenu);
    el.menuProfileBtn?.addEventListener("click", openOwnProfileFromMenu);
    el.menuThemeBtn?.addEventListener("click", toggleThemeMode);
    el.menuChangeUsernameBtn?.addEventListener("click", changeUsername);
    el.menuChangeProfilePictureBtn?.addEventListener("click", openProfilePicturePicker);
    el.menuChangePasswordBtn?.addEventListener("click", changePassword);
    el.menuLogOutBtn?.addEventListener("click", signOutCurrentUser);
    el.profilePictureInput?.addEventListener("change", handleProfilePictureInputChange);
    el.accountModalForm?.addEventListener("submit", handleAccountModalSubmit);
    el.accountModalForm?.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "nextUsername") {
        syncUsernameInputValue(event.target);
      }
    });
    el.accountModalCancelBtn?.addEventListener("click", () => closeAccountModal());
    el.accountModalCloseBtn?.addEventListener("click", () => closeAccountModal());
    el.accountModalShell?.addEventListener("click", (event) => {
      if (event.target === el.accountModalShell) {
        closeAccountModal();
      }
    });
    el.topSearchInput?.addEventListener("focus", () => {
      if (String(state.searchDraft || "").trim()) {
        refreshSearchSuggestions();
      }
    });
    el.topSearchInput?.addEventListener("input", (event) => {
      state.searchDraft = String(event.target.value || "");
      if (!String(state.searchDraft || "").trim()) {
        const hadAppliedSearch = Boolean(state.searchTerm);
        state.searchTerm = "";
        closeSearchMenu();
        if (hadAppliedSearch || state.currentPage === "search") {
          renderApp({ preserveScroll: true });
        }
        return;
      }

      refreshSearchSuggestions();
    });
    el.topSearchInput?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!state.searchMenuOpen) {
          refreshSearchSuggestions();
        } else {
          moveSearchHighlight(1);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!state.searchMenuOpen) {
          refreshSearchSuggestions();
          if (state.searchSuggestions.length) {
            state.searchHighlightIndex = state.searchSuggestions.length - 1;
            syncSearchUi();
          }
        } else {
          moveSearchHighlight(-1);
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        openSearchResultsPage(state.searchDraft);
        return;
      }

      if (event.key === "Escape" && state.searchMenuOpen) {
        event.preventDefault();
        closeSearchMenu();
      }
    });
    el.clearSearchBtn?.addEventListener("click", () => {
      const hadAppliedSearch = Boolean(state.searchTerm);
      resetSearchState();
      if (hadAppliedSearch || state.currentPage === "search") {
        renderApp({ preserveScroll: true });
      } else {
        syncSearchUi();
      }
      window.setTimeout(() => el.topSearchInput?.focus(), 0);
    });
    el.mainContent?.addEventListener("submit", (event) => {
      if (event.target && event.target.id === "schedule-form") {
        handleScheduleSubmit(event);
      } else if (event.target && event.target.id === "lazy-debate-form") {
        handleLazyDebateSubmit(event);
      } else if (event.target && event.target.id === "debate-comment-form") {
        handleDebateCommentSubmit(event);
      } else if (event.target && event.target.id === "debate-video-form") {
        handleDebateVideoSubmit(event);
      }
    });
    el.mainContent?.addEventListener("input", handleMainInput);
    el.mainContent?.addEventListener("change", handleMainInput);
    el.mainContent?.addEventListener("keydown", handleMainKeydown);
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("resize", handleWindowResize);
  }

  initEvents();
  syncThemeUi();
  setAuthTab("login");
  showAuthLoadingScreen(isPreviewMode() ? "Loading preview" : "Loading the arena");
  if (isPreviewMode()) {
    activatePreviewMode();
  } else {
    auth.onAuthStateChanged(handleAuthStateChanged);
  }
})();
