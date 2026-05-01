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
  const PROFILE_AVATAR_OUTPUT_SIZE = 256;
  const PROFILE_AVATAR_MAX_FILE_BYTES = 10 * 1024 * 1024;
  const AVATAR_CROP_MAX_ZOOM = 3.2;
  const AVATAR_CROP_FRAME_INSET = 18;
  const VIDEO_CLIP_SLIDER_MAX_SECONDS = 4 * 60 * 60;
  const VIDEO_CLIP_SLIDER_STEP_SECONDS = 15;
  const VIDEO_CLIP_DEFAULT_END_SECONDS = 10 * 60;
  const PLACEHOLDER_UID_PREFIX = "invite:";
  const VALID_PAGES = new Set(["dashboard", "search", "schedule", "archive", "rankings", "settings", "admin", "debate"]);
  const ELO_BASELINE = 1100;
  const MIN_RANKED_DEBATES = 3;
  const PLACEMENT_GAME_WEIGHT = 3;
  const DEBATE_ELO_CHANGE_MULTIPLIER = 3;
  const DEBATE_ELO_EXPECTED_SCORE_SCALE = 250;
  const DEBATE_ELO_EXPECTED_SCORE_CAP = 1000;
  const FIDE_NEW_PLAYER_K = 40;
  const FIDE_STANDARD_K = 20;
  const FIDE_MASTER_K = 10;
  const FIDE_NEW_PLAYER_GAME_LIMIT = 30;
  const FIDE_JUNIOR_K_AGE_LIMIT = 18;
  const FIDE_JUNIOR_K_RATING_LIMIT = 2300;
  const FIDE_HIGH_RATING_THRESHOLD = 2400;
  const FIDE_UNCAPPED_DIFF_MIN_RATING = 2650;
  const FIDE_PERIOD_K_LIMIT = 700;
  const FIDE_UNCAPPED_DIFF_START_MS = Date.UTC(2025, 9, 1);
  const AUTH_LOADING_MIN_MS = 240;
  const DEBATE_CATEGORIES = [
    { id: "philosophy", label: "Philosophy" },
    { id: "politics", label: "Politics" },
    { id: "misc", label: "Misc" }
  ];
  const DEBATE_TEAM_OPTIONS = [
    { id: 1, label: "1v1" },
    { id: 3, label: "2v1" },
    { id: 2, label: "2v2" }
  ];
  const DEBATE_PARTICIPANT_FIELD_META = [
    { field: "debaterAUid", queryField: "debaterAQuery", nameField: "debaterAName", team: "a", slot: 1, label: "Team A" },
    { field: "debaterA2Uid", queryField: "debaterA2Query", nameField: "debaterA2Name", team: "a", slot: 2, label: "Team A Teammate" },
    { field: "debaterBUid", queryField: "debaterBQuery", nameField: "debaterBName", team: "b", slot: 1, label: "Team B" },
    { field: "debaterB2Uid", queryField: "debaterB2Query", nameField: "debaterB2Name", team: "b", slot: 2, label: "Team B Teammate" }
  ];
  const PRIMARY_DEBATE_PARTICIPANT_FIELDS = DEBATE_PARTICIPANT_FIELD_META
    .filter((entry) => entry.slot === 1)
    .map((entry) => entry.field);
  const EXTENDED_DEBATE_PARTICIPANT_FIELDS = DEBATE_PARTICIPANT_FIELD_META.map((entry) => entry.field);

  const state = {
    bootResolved: false,
    user: null,
    username: "",
    selfProfile: null,
    currentPage: getPageFromUrl(),
    profileUid: getProfileUidFromUrl(),
    profileCategory: "",
    debateId: getDebateIdFromUrl(),
    settingsSection: "root",
    scheduleSection: "future",
    archiveEditMode: false,
    debateEditMode: false,
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
    accountModalRoleCurrent: "",
    accountModalRoleNext: "",
    avatarCropOpen: false,
    avatarCropBusy: false,
    avatarCropObjectUrl: "",
    avatarCropFile: null,
    avatarCropSourceWidth: 0,
    avatarCropSourceHeight: 0,
    avatarCropZoom: 1,
    avatarCropOffsetX: 0,
    avatarCropOffsetY: 0,
    avatarCropDragPointerId: null,
    avatarCropDragStartX: 0,
    avatarCropDragStartY: 0,
    avatarCropDragOriginX: 0,
    avatarCropDragOriginY: 0,
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
    avatarCropShell: document.getElementById("avatar-crop-shell"),
    avatarCropViewport: document.getElementById("avatar-crop-viewport"),
    avatarCropImage: document.getElementById("avatar-crop-image"),
    avatarCropZoomInput: document.getElementById("avatar-crop-zoom-input"),
    avatarCropZoomValue: document.getElementById("avatar-crop-zoom-value"),
    avatarCropCancelBtn: document.getElementById("avatar-crop-cancel-btn"),
    avatarCropCloseBtn: document.getElementById("avatar-crop-close-btn"),
    avatarCropSaveBtn: document.getElementById("avatar-crop-save-btn"),
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

  function formatDisplayName(value, fallback = "Debater") {
    const explicitFallback = arguments.length > 1 ? String(fallback ?? "").trim() : "Debater";
    const raw = String(value || "").trim();
    const normalized = normalizeUsername(raw);
    const source = normalized || explicitFallback;
    const words = String(source || "")
      .replace(/[_\s]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) {
      return explicitFallback;
    }

    return words
      .map((word) => {
        const safeWord = String(word || "").trim().toLowerCase();
        if (!safeWord) return "";
        return safeWord.charAt(0).toUpperCase() + safeWord.slice(1);
      })
      .join(" ");
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
    if (safeValue === "past" || safeValue === "log") {
      return "past";
    }
    return "future";
  }

  function isDebateAwaitingReview(debate) {
    return String(debate?.status || "").trim() === "awaiting_review";
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
      const registrySnap = await db.collection("usernames").doc(name).get();
      const registryAvatarDataUrl = normalizeAvatarDataUrl((registrySnap.exists ? registrySnap.data()?.avatarDataUrl : "") || "");
      await db.collection("users").doc(uid).set(
        {
          username: name,
          name,
          ...(registryAvatarDataUrl ? { avatarDataUrl: registryAvatarDataUrl } : {}),
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

  function isFirestorePermissionDenied(error) {
    const code = String(error?.code || "").trim().toLowerCase();
    const message = String(error?.message || "").trim().toLowerCase();
    return (
      code.includes("permission-denied") ||
      message.includes("missing or insufficient permissions") ||
      (message.includes("permission") && message.includes("denied"))
    );
  }

  function getAdminRulesDeployMessage(action) {
    const safeAction = String(action || "editing other users").trim() || "editing other users";
    return `Firestore is still blocking admins from ${safeAction}. Deploy the latest Firestore rules, then try again.`;
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
    const name = formatDisplayName(options.name || state.username || "debater", "Debater");
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
    el.userAvatar.setAttribute("aria-label", `${formatDisplayName(state.username || "debater", "Debater")} avatar`);
  }

  function getYouTubeVideoId(rawUrl) {
    const safeUrl = String(rawUrl || "").trim();
    if (!safeUrl) return "";

    try {
      const url = new URL(safeUrl);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();

      if (host === "youtu.be") {
        const shortId = url.pathname.split("/").filter(Boolean)[0] || "";
        return /^[A-Za-z0-9_-]{6,}$/.test(shortId) ? shortId : "";
      }

      if (host === "youtube.com" || host === "m.youtube.com") {
        let videoId = "";

        if (url.pathname === "/watch") {
          videoId = url.searchParams.get("v") || "";
        } else if (
          url.pathname.startsWith("/embed/")
          || url.pathname.startsWith("/shorts/")
          || url.pathname.startsWith("/live/")
        ) {
          videoId = url.pathname.split("/").filter(Boolean)[1] || "";
        }

        return /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? videoId : "";
      }
    } catch (_) {
      return "";
    }

    return "";
  }

  function getYouTubeThumbnailUrl(rawUrl) {
    const videoId = getYouTubeVideoId(rawUrl);
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
  }

  function makeLocalDateFromDateText(dateText) {
    const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  async function fetchYouTubePublishedDate(rawUrl) {
    const videoId = getYouTubeVideoId(rawUrl);
    if (!videoId || typeof fetch !== "function") return null;

    try {
      const response = await fetch(`/api/youtube-published-date?videoId=${encodeURIComponent(videoId)}`, {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) return null;

      const payload = await response.json();
      return makeLocalDateFromDateText(payload?.publishedDate);
    } catch (error) {
      console.warn("Could not read YouTube published date", error);
      return null;
    }
  }

  async function resolveLoggedDebateDate(scheduledForRaw, videoUrl, fallbackDate = new Date()) {
    const safeScheduledFor = String(scheduledForRaw || "").trim();
    if (safeScheduledFor) {
      return new Date(safeScheduledFor);
    }

    const publishedDate = await fetchYouTubePublishedDate(videoUrl);
    return publishedDate || fallbackDate;
  }

  function syncBodyModalState() {
    document.body.classList.toggle("modal-open", Boolean(state.accountModalOpen || state.avatarCropOpen));
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

  function validateProfilePictureFile(file) {
    if (!file || !String(file.type || "").toLowerCase().startsWith("image/")) {
      throw new Error("Choose an image file.");
    }
    if (file.size > PROFILE_AVATAR_MAX_FILE_BYTES) {
      throw new Error("Image is too large. Max 10MB.");
    }
  }

  function getAvatarCropViewportSize() {
    return Math.max(200, Number(el.avatarCropViewport?.clientWidth || 0) || 280);
  }

  function getAvatarCropFrameInset() {
    const cssInset = Number.parseFloat(
      window.getComputedStyle(el.avatarCropViewport || document.documentElement).getPropertyValue("--avatar-crop-inset")
    );
    return Number.isFinite(cssInset) && cssInset >= 0 ? cssInset : AVATAR_CROP_FRAME_INSET;
  }

  function getAvatarCropMetrics(zoomValue = state.avatarCropZoom) {
    const viewportSize = getAvatarCropViewportSize();
    const cropFrameInset = Math.max(0, getAvatarCropFrameInset());
    const cropFrameSize = Math.max(1, viewportSize - (cropFrameInset * 2));
    const sourceWidth = Math.max(1, Number(state.avatarCropSourceWidth || 0) || 1);
    const sourceHeight = Math.max(1, Number(state.avatarCropSourceHeight || 0) || 1);
    const zoom = Math.max(1, Math.min(AVATAR_CROP_MAX_ZOOM, Number(zoomValue) || 1));
    const baseScale = Math.max(cropFrameSize / sourceWidth, cropFrameSize / sourceHeight);
    const scale = baseScale * zoom;
    const renderWidth = sourceWidth * scale;
    const renderHeight = sourceHeight * scale;
    const maxOffsetX = Math.max(0, (renderWidth - cropFrameSize) / 2);
    const maxOffsetY = Math.max(0, (renderHeight - cropFrameSize) / 2);

    return {
      viewportSize,
      cropFrameInset,
      cropFrameSize,
      sourceWidth,
      sourceHeight,
      zoom,
      baseScale,
      scale,
      renderWidth,
      renderHeight,
      maxOffsetX,
      maxOffsetY
    };
  }

  function clampAvatarCropOffsets(offsetX, offsetY, zoomValue = state.avatarCropZoom) {
    const metrics = getAvatarCropMetrics(zoomValue);
    return {
      x: Math.max(-metrics.maxOffsetX, Math.min(metrics.maxOffsetX, Number(offsetX) || 0)),
      y: Math.max(-metrics.maxOffsetY, Math.min(metrics.maxOffsetY, Number(offsetY) || 0))
    };
  }

  function setAvatarCropOffsets(offsetX, offsetY, options = {}) {
    const clamped = clampAvatarCropOffsets(offsetX, offsetY, options.zoom);
    state.avatarCropOffsetX = clamped.x;
    state.avatarCropOffsetY = clamped.y;
    if (options.sync !== false) {
      syncAvatarCropModalUi();
    }
  }

  function setAvatarCropZoom(value) {
    const nextZoom = Math.max(1, Math.min(AVATAR_CROP_MAX_ZOOM, Number(value) || 1));
    state.avatarCropZoom = nextZoom;
    const clamped = clampAvatarCropOffsets(state.avatarCropOffsetX, state.avatarCropOffsetY, nextZoom);
    state.avatarCropOffsetX = clamped.x;
    state.avatarCropOffsetY = clamped.y;
    syncAvatarCropModalUi();
  }

  function getAvatarCropSourceRect() {
    const metrics = getAvatarCropMetrics();
    const imageLeft = (metrics.viewportSize - metrics.renderWidth) / 2 + state.avatarCropOffsetX;
    const imageTop = (metrics.viewportSize - metrics.renderHeight) / 2 + state.avatarCropOffsetY;
    const cropSize = metrics.cropFrameSize / metrics.scale;
    const sourceX = Math.max(
      0,
      Math.min(metrics.sourceWidth - cropSize, (metrics.cropFrameInset - imageLeft) / metrics.scale)
    );
    const sourceY = Math.max(
      0,
      Math.min(metrics.sourceHeight - cropSize, (metrics.cropFrameInset - imageTop) / metrics.scale)
    );

    return { sourceX, sourceY, cropSize };
  }

  function cleanupAvatarCropSession() {
    if (state.avatarCropObjectUrl) {
      try {
        URL.revokeObjectURL(state.avatarCropObjectUrl);
      } catch (_) {}
    }

    state.avatarCropOpen = false;
    state.avatarCropBusy = false;
    state.avatarCropObjectUrl = "";
    state.avatarCropFile = null;
    state.avatarCropSourceWidth = 0;
    state.avatarCropSourceHeight = 0;
    state.avatarCropZoom = 1;
    state.avatarCropOffsetX = 0;
    state.avatarCropOffsetY = 0;
    state.avatarCropDragPointerId = null;
    state.avatarCropDragStartX = 0;
    state.avatarCropDragStartY = 0;
    state.avatarCropDragOriginX = 0;
    state.avatarCropDragOriginY = 0;
  }

  function syncAvatarCropModalUi() {
    const isOpen = state.avatarCropOpen && Boolean(state.avatarCropObjectUrl);
    el.avatarCropShell?.classList.toggle("hidden", !isOpen);
    el.avatarCropShell?.setAttribute("aria-hidden", isOpen ? "false" : "true");
    syncBodyModalState();

    if (!isOpen) {
      if (el.avatarCropImage) {
        el.avatarCropImage.removeAttribute("src");
        el.avatarCropImage.style.width = "";
        el.avatarCropImage.style.height = "";
        el.avatarCropImage.style.transform = "";
      }
      return;
    }

    const metrics = getAvatarCropMetrics();
    const clamped = clampAvatarCropOffsets(state.avatarCropOffsetX, state.avatarCropOffsetY, state.avatarCropZoom);
    state.avatarCropOffsetX = clamped.x;
    state.avatarCropOffsetY = clamped.y;

    if (el.avatarCropImage) {
      el.avatarCropImage.src = state.avatarCropObjectUrl;
      el.avatarCropImage.style.width = `${metrics.renderWidth}px`;
      el.avatarCropImage.style.height = `${metrics.renderHeight}px`;
      el.avatarCropImage.style.transform = `translate(calc(-50% + ${state.avatarCropOffsetX}px), calc(-50% + ${state.avatarCropOffsetY}px))`;
    }

    if (el.avatarCropZoomInput) {
      el.avatarCropZoomInput.value = String(state.avatarCropZoom);
      el.avatarCropZoomInput.disabled = state.avatarCropBusy;
    }
    if (el.avatarCropZoomValue) {
      el.avatarCropZoomValue.textContent = `${Math.round(state.avatarCropZoom * 100)}%`;
    }
    if (el.avatarCropCancelBtn) {
      el.avatarCropCancelBtn.disabled = state.avatarCropBusy;
    }
    if (el.avatarCropCloseBtn) {
      el.avatarCropCloseBtn.disabled = state.avatarCropBusy;
    }
    if (el.avatarCropSaveBtn) {
      el.avatarCropSaveBtn.disabled = state.avatarCropBusy;
      el.avatarCropSaveBtn.textContent = state.avatarCropBusy ? "Saving..." : "Save Picture";
    }
  }

  function closeAvatarCropModal(force = false) {
    if (state.avatarCropBusy && !force) return;
    cleanupAvatarCropSession();
    syncAvatarCropModalUi();
    if (el.profilePictureInput) {
      el.profilePictureInput.value = "";
    }
    state.profilePictureTargetUid = "";
    state.profilePictureTargetName = "";
  }

  async function openAvatarCropModal(file) {
    validateProfilePictureFile(file);
    const previewUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const previewImage = new Image();
        previewImage.onload = () => resolve(previewImage);
        previewImage.onerror = () => reject(new Error("Could not load image."));
        previewImage.src = previewUrl;
      });

      cleanupAvatarCropSession();
      state.avatarCropOpen = true;
      state.avatarCropBusy = false;
      state.avatarCropObjectUrl = previewUrl;
      state.avatarCropFile = file;
      state.avatarCropSourceWidth = Number(image.naturalWidth || image.width || 0);
      state.avatarCropSourceHeight = Number(image.naturalHeight || image.height || 0);
      state.avatarCropZoom = 1;
      state.avatarCropOffsetX = 0;
      state.avatarCropOffsetY = 0;
      syncAvatarCropModalUi();

      window.requestAnimationFrame(() => {
        syncAvatarCropModalUi();
      });
    } catch (error) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch (_) {}
      throw error;
    }
  }

  function startAvatarCropDrag(event) {
    if (!state.avatarCropOpen || state.avatarCropBusy || !(event instanceof PointerEvent)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    state.avatarCropDragPointerId = event.pointerId;
    state.avatarCropDragStartX = event.clientX;
    state.avatarCropDragStartY = event.clientY;
    state.avatarCropDragOriginX = state.avatarCropOffsetX;
    state.avatarCropDragOriginY = state.avatarCropOffsetY;
    el.avatarCropViewport?.setPointerCapture?.(event.pointerId);
  }

  function handleAvatarCropPointerMove(event) {
    if (!state.avatarCropOpen || state.avatarCropBusy) return;
    if (!(event instanceof PointerEvent) || state.avatarCropDragPointerId !== event.pointerId) return;
    event.preventDefault();
    setAvatarCropOffsets(
      state.avatarCropDragOriginX + (event.clientX - state.avatarCropDragStartX),
      state.avatarCropDragOriginY + (event.clientY - state.avatarCropDragStartY)
    );
  }

  function finishAvatarCropDrag(event) {
    if (!(event instanceof PointerEvent) || state.avatarCropDragPointerId !== event.pointerId) return;
    el.avatarCropViewport?.releasePointerCapture?.(event.pointerId);
    state.avatarCropDragPointerId = null;
  }

  async function encodeProfileAvatarFromImageCrop(image, crop = {}) {
    const sourceWidth = Number(image?.naturalWidth || image?.width || 0);
    const sourceHeight = Number(image?.naturalHeight || image?.height || 0);
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Could not read image size.");
    }

    const requestedCropSize = Math.max(1, Number(crop.cropSize || Math.min(sourceWidth, sourceHeight)) || Math.min(sourceWidth, sourceHeight));
    const cropSize = Math.min(requestedCropSize, sourceWidth, sourceHeight);
    const sourceX = Math.max(0, Math.min(sourceWidth - cropSize, Number(crop.sourceX) || 0));
    const sourceY = Math.max(0, Math.min(sourceHeight - cropSize, Number(crop.sourceY) || 0));
    const canvas = document.createElement("canvas");
    canvas.width = PROFILE_AVATAR_OUTPUT_SIZE;
    canvas.height = PROFILE_AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas unavailable.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, PROFILE_AVATAR_OUTPUT_SIZE, PROFILE_AVATAR_OUTPUT_SIZE);

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

  async function encodeProfileAvatarFromFile(file, crop = null) {
    validateProfilePictureFile(file);
    const image = await loadImageElementFromFile(file);
    if (crop) {
      return encodeProfileAvatarFromImageCrop(image, crop);
    }
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    const cropSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.max(0, Math.floor((sourceWidth - cropSize) / 2));
    const sourceY = Math.max(0, Math.floor((sourceHeight - cropSize) / 2));
    return encodeProfileAvatarFromImageCrop(image, { sourceX, sourceY, cropSize });
  }

  function currentIsAdmin() {
    const explicitRole = normalizeUserRole(state.selfProfile?.role, "");
    if (explicitRole) {
      return explicitRole === "admin";
    }
    const normalized = normalizeUsername(state.username);
    return normalized === "admin" || normalized === "haji";
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
    if (page === "log") return "schedule";
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
    if (["profile", "awaiting", "users"].includes(safeValue)) {
      return safeValue;
    }
    return "root";
  }

  function setPage(page, options = {}) {
    const nextPage = VALID_PAGES.has(page) ? page : "dashboard";
    const currentUid = String(state.user?.uid || "").trim();
    const currentDebateId = String(state.debateId || "").trim();
    const requestedProfileUid = String(options.profileUid || "").trim();
    const requestedDebateId = String(options.debateId || "").trim();
    state.currentPage = nextPage;
    state.profileUid = nextPage === "dashboard" && requestedProfileUid && requestedProfileUid !== currentUid ? requestedProfileUid : "";
    state.debateId = nextPage === "debate" && requestedDebateId ? requestedDebateId : "";
    state.settingsSection = nextPage === "settings" ? normalizeSettingsSection(options.settingsSection || "root") : "root";
    state.archiveEditMode = nextPage === "archive" ? state.archiveEditMode : false;
    state.debateEditMode = nextPage === "debate" && requestedDebateId && requestedDebateId === currentDebateId ? state.debateEditMode : false;
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
    const requiresAdmin = ["awaiting", "users"].includes(nextSection);
    if (requiresAdmin && !currentIsAdmin()) {
      return;
    }

    state.settingsSection = nextSection;
    renderApp({ preserveScroll: true });
  }

  function setScheduleSection(section) {
    state.scheduleSection = normalizeScheduleSection(section);
    state.openSelectKey = "";
    renderApp({ preserveScroll: true });
  }

  function toggleArchiveEditMode() {
    if (!currentIsAdmin()) return;
    state.archiveEditMode = !state.archiveEditMode;
    renderApp({ preserveScroll: true });
  }

  function canToggleDebateEdit(debate) {
    return Boolean(debate && state.user && (currentIsAdmin() || canEditDebateVideo(debate)));
  }

  function toggleDebateEditMode() {
    const debate = state.debates.find((entry) => entry.id === String(state.debateId || "").trim()) || null;
    if (!canToggleDebateEdit(debate)) return;
    state.debateEditMode = !state.debateEditMode;
    renderApp({ preserveScroll: true });
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
      el.adminNavLink.classList.remove("is-disabled");
      el.adminNavLink.removeAttribute("aria-disabled");
      el.adminNavLink.removeAttribute("tabindex");
      return;
    }

    if (!currentIsAdmin()) {
      el.adminNavLink.classList.add("hidden");
      el.adminNavLink.classList.remove("is-active");
      el.adminNavLink.setAttribute("aria-disabled", "true");
      el.adminNavLink.setAttribute("tabindex", "-1");
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
    el.adminNavLink.classList.remove("hidden");
    el.adminNavLink.classList.remove("is-disabled");
    el.adminNavLink.setAttribute("aria-disabled", "false");
    el.adminNavLink.removeAttribute("tabindex");
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
    syncBodyModalState();

    if (!isOpen) return;

    const isUsername = state.accountModalType === "username";
    const isRole = state.accountModalType === "role";
    const roleSubmitLabel = normalizeUserRole(state.accountModalRoleNext, "user") === "admin" ? "Change to Admin" : "Change to User";
    const submitLabel = state.accountModalBusy
      ? isRole
        ? "Saving..."
        : isUsername
        ? "Saving..."
        : "Updating..."
      : isRole
        ? roleSubmitLabel
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
    state.accountModalRoleCurrent = "";
    state.accountModalRoleNext = "";
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
    const modalType = type === "password" ? "password" : type === "role" ? "role" : "username";
    const targetUid = String(options.targetUid || "").trim();
    const targetName = normalizeUsername(options.targetName || getNameForUid(targetUid, "debater"));
    const roleCurrent = normalizeUserRole(options.currentRole, getUserRoleForUid(targetUid) || "user");
    const roleNext = normalizeUserRole(options.nextRole, roleCurrent === "admin" ? "user" : "admin");
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
    state.accountModalRoleCurrent = roleCurrent;
    state.accountModalRoleNext = roleNext;
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
    } else if (modalType === "role") {
      const safeDisplayName = formatDisplayName(targetName || getNameForUid(targetUid, "debater"), "That User");
      const currentLabel = roleCurrent === "admin" ? "Admin" : "User";
      const nextLabel = roleNext === "admin" ? "Admin" : "User";
      if (el.accountModalTitle) el.accountModalTitle.textContent = "Change Status";
      if (el.accountModalFields) {
        el.accountModalFields.innerHTML = `
          <div class="account-modal-summary">
            <p class="account-modal-note">
              ${escapeHtml(safeDisplayName)} will switch from <strong>${escapeHtml(currentLabel)}</strong> to
              <strong>${escapeHtml(nextLabel)}</strong>.
            </p>
            <div class="account-modal-kv">
              <span>Current</span>
              <strong>${escapeHtml(currentLabel)}</strong>
            </div>
            <div class="account-modal-kv">
              <span>Change to</span>
              <strong>${escapeHtml(nextLabel)}</strong>
            </div>
          </div>
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
      if (modalType === "role") {
        el.accountModalSubmitBtn?.focus();
      } else {
        primaryInput?.focus();
      }
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

  function formatDateTimeLocalInputValue(value) {
    const millis = toMillis(value);
    if (!millis) return "";
    const date = new Date(millis);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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

  function normalizeVideoClipMode(value) {
    return String(value || "").trim().toLowerCase() === "clip" ? "clip" : "full";
  }

  function getVideoModeLabel(value) {
    return normalizeVideoClipMode(value) === "clip" ? "Part of Video" : "Full Video";
  }

  function parseVideoClipSeconds(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      const total = Number(raw);
      return Number.isFinite(total) && total >= 0 ? Math.floor(total) : null;
    }

    if (!/^\d{1,3}:\d{1,2}(?::\d{1,2})?$/.test(raw)) {
      return null;
    }

    const parts = raw.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
      return null;
    }

    while (parts.length < 3) {
      parts.unshift(0);
    }

    const [hours, minutes, seconds] = parts;
    if (minutes >= 60 || seconds >= 60) {
      return null;
    }

    return (hours * 3600) + (minutes * 60) + seconds;
  }

  function clampVideoClipSliderSeconds(value, fallback = 0) {
    const parsed = parseVideoClipSeconds(value);
    const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
    const resolved = Number.isFinite(parsed) ? parsed : safeFallback;
    return Math.max(0, Math.min(VIDEO_CLIP_SLIDER_MAX_SECONDS, Math.floor(resolved)));
  }

  function formatVideoClipInput(value) {
    const totalSeconds = Number(value);
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
      return "";
    }

    const safeSeconds = Math.floor(totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function getVideoClipRangeValues(startValue, endValue) {
    const startSeconds = clampVideoClipSliderSeconds(startValue, 0);
    const defaultEnd = Math.min(
      VIDEO_CLIP_SLIDER_MAX_SECONDS,
      Math.max(VIDEO_CLIP_DEFAULT_END_SECONDS, startSeconds + VIDEO_CLIP_SLIDER_STEP_SECONDS)
    );
    let endSeconds = clampVideoClipSliderSeconds(endValue, defaultEnd);

    if (endSeconds <= startSeconds) {
      endSeconds = Math.min(VIDEO_CLIP_SLIDER_MAX_SECONDS, startSeconds + VIDEO_CLIP_SLIDER_STEP_SECONDS);
    }

    return { startSeconds, endSeconds };
  }

  function syncVideoClipSliderGroup(group, options = {}) {
    if (!group) return false;

    const startInput = group.querySelector('[data-video-clip-role="start"]');
    const endInput = group.querySelector('[data-video-clip-role="end"]');
    const startDisplay = group.querySelector('[data-video-clip-display="start"]');
    const endDisplay = group.querySelector('[data-video-clip-display="end"]');
    if (!(startInput instanceof HTMLInputElement) || !(endInput instanceof HTMLInputElement)) return false;

    const activeRole = String(options.activeRole || "").trim();
    let startSeconds = clampVideoClipSliderSeconds(startInput.value, 0);
    let endSeconds = clampVideoClipSliderSeconds(
      endInput.value,
      Math.min(VIDEO_CLIP_SLIDER_MAX_SECONDS, startSeconds + VIDEO_CLIP_DEFAULT_END_SECONDS)
    );

    if (activeRole === "start" && startSeconds >= endSeconds) {
      startSeconds = Math.max(0, endSeconds - VIDEO_CLIP_SLIDER_STEP_SECONDS);
    } else if (activeRole === "end" && endSeconds <= startSeconds) {
      endSeconds = Math.min(VIDEO_CLIP_SLIDER_MAX_SECONDS, startSeconds + VIDEO_CLIP_SLIDER_STEP_SECONDS);
    } else if (endSeconds <= startSeconds) {
      endSeconds = Math.min(VIDEO_CLIP_SLIDER_MAX_SECONDS, startSeconds + VIDEO_CLIP_SLIDER_STEP_SECONDS);
    }

    if (startInput.value !== String(startSeconds)) {
      startInput.value = String(startSeconds);
    }
    if (endInput.value !== String(endSeconds)) {
      endInput.value = String(endSeconds);
    }
    if (startDisplay) {
      startDisplay.textContent = formatVideoClipInput(startSeconds) || "0:00";
    }
    if (endDisplay) {
      endDisplay.textContent = formatVideoClipInput(endSeconds) || "0:00";
    }

    const startPercent = Math.max(0, Math.min(100, (startSeconds / VIDEO_CLIP_SLIDER_MAX_SECONDS) * 100));
    const endPercent = Math.max(0, Math.min(100, (endSeconds / VIDEO_CLIP_SLIDER_MAX_SECONDS) * 100));
    group.style.setProperty("--video-clip-start", `${startPercent}%`);
    group.style.setProperty("--video-clip-end", `${endPercent}%`);
    group.classList.toggle("is-invalid", endSeconds <= startSeconds);
    return true;
  }

  function syncVideoLinkFieldsUi(scope, options = {}) {
    const root = scope?.closest ? scope.closest(".video-link-fields") : null;
    if (!root) return false;

    const modeInput = root.querySelector('input[name="videoMode"], input[data-draft-field="videoMode"], input[data-resolve-video-mode], select[name="videoMode"], select[data-draft-field="videoMode"], select[data-resolve-video-mode]');
    const sliderGroup = root.querySelector("[data-video-clip-group]");
    const isClipMode =
      (modeInput instanceof HTMLInputElement || modeInput instanceof HTMLSelectElement)
        ? normalizeVideoClipMode(modeInput.value) === "clip"
        : false;

    if (sliderGroup) {
      sliderGroup.classList.toggle("is-disabled", !isClipMode);
      sliderGroup.querySelectorAll('input[type="range"]').forEach((input) => {
        input.disabled = !isClipMode;
      });
      syncVideoClipSliderGroup(sliderGroup, { activeRole: options.activeRole });
    }

    return true;
  }

  function getYouTubeEmbedUrl(rawUrl, options = {}) {
    const videoId = getYouTubeVideoId(rawUrl);
    if (!videoId) return "";

    try {
      const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
      const startSeconds = parseVideoClipSeconds(options.startSeconds ?? options.start);
      const endSeconds = parseVideoClipSeconds(options.endSeconds ?? options.end);

      if (Number.isFinite(startSeconds) && startSeconds >= 0) {
        embedUrl.searchParams.set("start", String(startSeconds));
      }

      if (Number.isFinite(endSeconds) && endSeconds > 0) {
        embedUrl.searchParams.set("end", String(endSeconds));
      }

      return embedUrl.toString();
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
      { page: "schedule", title: "Log", note: "Log a past or future debate" },
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
          title: formatDisplayName(entry.name, "Debater"),
          meta: bestCategory ? `${bestCategory.label} - ${getRatingDisplayValue(bestCategory)}` : "User page",
          note: entry.uid === currentUid ? "Open your profile" : "Open profile page",
          avatarDataUrl: getAvatarDataUrlForUid(entry.uid),
          avatarSeed: entry.uid || entry.name,
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
          ...getDebateParticipantNames(debate)
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) return;

        const people = [getDebateTeamLabel(debate, "a", "Team A"), getDebateTeamLabel(debate, "b", "Team B")]
          .filter(Boolean)
          .join(" vs ");

        addSuggestion({
          key: `debate:${debate.id}`,
          kind: debate.status === "resolved" ? "Result" : "Upcoming",
          title: debate.topic || "Untitled debate",
          categoryLabel: getDebateCategoryLabel(debate.category),
          thumbnailUrl: getYouTubeThumbnailUrl(debate.videoUrl || debate.videoEmbedUrl || ""),
          meta: [getDebateCategoryLabel(debate.category), people].filter(Boolean).join(" • ") || "Debate",
          note: `${debate.status === "resolved" ? "Open archive" : "Open log"} • ${formatShortDate(debate.scheduledFor)}`,
          debateId: debate.id,
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
          title: formatDisplayName(player.name, "Debater"),
          meta: bestCategory ? `${bestCategory.label} - ${getRatingDisplayValue(bestCategory)}` : getRatingDisplayValue(player),
          note: String(player.uid || "").trim() === currentUid ? "Open your profile" : "Open profile page",
          avatarDataUrl: getAvatarDataUrlForUid(player.uid),
          avatarSeed: player.uid || player.name,
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
        title: formatDisplayName(moderator, "Moderator"),
        meta: hasUpcoming ? `${counts.upcoming} upcoming` : `${counts.resolved} resolved`,
        note: `Search moderator on ${hasUpcoming ? "log" : "archive"}`,
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

  function getRenderedSearchSuggestionMeta(suggestion) {
    if (suggestion?.debateId) {
      const debate = state.debates.find((entry) => String(entry?.id || "").trim() === String(suggestion.debateId || "").trim());
      const people = debate
        ? [getDebateTeamLabel(debate, "a", "Team A"), getDebateTeamLabel(debate, "b", "Team B")].filter(Boolean).join(" vs ")
        : "";
      return [suggestion.categoryLabel || getDebateCategoryLabel(debate?.category), people].filter(Boolean).join(" | ") || "Debate";
    }

    return suggestion?.meta || suggestion?.note || "";
  }

  function getRenderedSearchSuggestionNote(suggestion) {
    if (suggestion?.debateId) {
      return "";
    }

    return suggestion?.note || "";
  }

  function renderSearchSuggestionMedia(suggestion, options = {}) {
    const detailed = Boolean(options.detailed);

    if (suggestion?.profileUid) {
      return renderAvatarChipHtml({
        name: suggestion.title || "Debater",
        avatarDataUrl: suggestion.avatarDataUrl || "",
        seed: suggestion.avatarSeed || suggestion.profileUid || suggestion.title || "debater",
        className: detailed ? "search-result-avatar" : "search-suggestion-avatar"
      });
    }

    if (suggestion?.debateId) {
      if (suggestion.thumbnailUrl) {
        return `
          <span class="search-result-thumb">
            <img
              class="search-result-thumb-img"
              src="${escapeHtml(suggestion.thumbnailUrl)}"
              alt="${escapeHtml(suggestion.title || "Debate thumbnail")}"
              loading="lazy"
              decoding="async"
            />
          </span>
        `;
      }

      return `
        <span class="search-result-thumb is-fallback">
          <span class="search-result-thumb-kicker">${escapeHtml(suggestion.kind || "Debate")}</span>
          <strong>${escapeHtml(suggestion.categoryLabel || "Debate")}</strong>
        </span>
      `;
    }

    if (!detailed) {
      return "";
    }

    return `
      <span class="search-result-thumb is-generic">
        <span class="search-result-thumb-kicker">${escapeHtml(suggestion.kind || "Search")}</span>
        <strong>${escapeHtml(String(suggestion.kind || "S").slice(0, 1))}</strong>
      </span>
    `;
  }

  function renderSearchSuggestions(options = {}) {
    const detailed = Boolean(options.detailed);
    return state.searchSuggestions
      .map((suggestion, index) => {
        const activeClass = index === state.searchHighlightIndex ? " is-active" : "";
        const detailClass = detailed ? " is-detailed" : "";
        const mediaMarkup = renderSearchSuggestionMedia(suggestion, { detailed });
        const metaText = getRenderedSearchSuggestionMeta(suggestion);
        const noteText = getRenderedSearchSuggestionNote(suggestion);

        return `
          <button
            class="search-suggestion${activeClass}${detailClass}"
            id="search-option-${index}"
            type="button"
            role="option"
            aria-selected="${index === state.searchHighlightIndex ? "true" : "false"}"
            data-action="apply-search-suggestion"
            data-search-index="${index}"
          >
            ${
              detailed
                ? `<span class="search-suggestion-media">${mediaMarkup}</span>`
                : `<span class="search-suggestion-kind">${escapeHtml(suggestion.kind)}</span>`
            }
            <span class="search-suggestion-copy">
              ${detailed ? `<span class="search-suggestion-kind">${escapeHtml(suggestion.kind)}</span>` : ""}
              <strong>${escapeHtml(suggestion.title)}</strong>
              <span class="search-suggestion-meta">${escapeHtml(metaText)}</span>
            </span>
            <span class="search-suggestion-note">${escapeHtml(noteText)}</span>
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
    const detailed = classes.includes("search-results-panel") || classes.includes("mobile-search-results");

    return `
      <div class="${classes.join(" ")}" role="listbox" aria-label="Search results">
        ${renderSearchSuggestions({ detailed })}
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

    if (suggestion.debateId) {
      resetSearchState();
      syncSearchUi();
      openDebate(suggestion.debateId);
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

  function roundHalfAwayFromZero(value) {
    const numeric = Number(value) || 0;
    return numeric < 0 ? -Math.round(Math.abs(numeric)) : Math.round(numeric);
  }

  function getDebateChronologyMillis(debate) {
    return toMillis(debate?.scheduledFor) || toMillis(debate?.createdAt) || 0;
  }

  function getFideRatingPeriodKey(millis) {
    const safeMillis = Number(millis) || 0;
    const date = new Date(safeMillis);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function getBirthYearForUid(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return 0;

    const profile = getStoredUserProfileByUid(safeUid);
    const candidates = [profile?.birthYear, profile?.yearOfBirth, profile?.dobYear];

    for (const value of candidates) {
      const birthYear = Number(value);
      if (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= 2100) {
        return birthYear;
      }
    }

    return 0;
  }

  function isFideJuniorForDate(uid, millis) {
    const birthYear = getBirthYearForUid(uid);
    if (!birthYear) return false;
    const debateYear = new Date(Number(millis) || Date.now()).getUTCFullYear();
    return debateYear <= birthYear + FIDE_JUNIOR_K_AGE_LIMIT;
  }

  function getFideExpectedScore(playerRating, opponentRating, debateMillis) {
    const safePlayerRating = Number(playerRating) || ELO_BASELINE;
    const safeOpponentRating = Number(opponentRating) || ELO_BASELINE;
    const rawDifference = safeOpponentRating - safePlayerRating;
    const cappedDifference =
      debateMillis >= FIDE_UNCAPPED_DIFF_START_MS && safePlayerRating >= FIDE_UNCAPPED_DIFF_MIN_RATING
        ? rawDifference
        : Math.max(-DEBATE_ELO_EXPECTED_SCORE_CAP, Math.min(DEBATE_ELO_EXPECTED_SCORE_CAP, rawDifference));

    return 1 / (1 + 10 ** (cappedDifference / DEBATE_ELO_EXPECTED_SCORE_SCALE));
  }

  function getFideKFactor(playerSnapshot, periodGames, periodEndMillis) {
    const safeGames = Math.max(0, Number(periodGames) || 0);
    const safeRating = Number(playerSnapshot?.rating) || ELO_BASELINE;
    const safeDebates = Math.max(0, Number(playerSnapshot?.debates) || 0);
    const safeUid = String(playerSnapshot?.uid || "").trim();
    let kFactor = FIDE_STANDARD_K;

    if (safeDebates < FIDE_NEW_PLAYER_GAME_LIMIT) {
      kFactor = FIDE_NEW_PLAYER_K;
    } else if (playerSnapshot?.reached2400 || safeRating >= FIDE_HIGH_RATING_THRESHOLD) {
      kFactor = FIDE_MASTER_K;
    }

    if (isFideJuniorForDate(safeUid, periodEndMillis) && safeRating < FIDE_JUNIOR_K_RATING_LIMIT) {
      kFactor = Math.max(kFactor, FIDE_NEW_PLAYER_K);
    }

    if (safeGames > 0 && kFactor * safeGames > FIDE_PERIOD_K_LIMIT) {
      kFactor = Math.max(1, Math.floor(FIDE_PERIOD_K_LIMIT / safeGames));
    }

    return kFactor;
  }

  function getPlacementGameWeight(completedDebates) {
    const safeCompletedDebates = Math.max(0, Number(completedDebates) || 0);
    return safeCompletedDebates < MIN_RANKED_DEBATES ? PLACEMENT_GAME_WEIGHT : 1;
  }

  function makeDefaultScheduleDraft(currentUid) {
    return {
      topic: "",
      category: "",
      teamSize: 1,
      scheduledFor: "",
      moderator: "",
      description: "",
      debaterAUid: currentUid || "",
      debaterA2Uid: "",
      debaterBUid: "",
      debaterB2Uid: "",
      debaterAQuery: "",
      debaterA2Query: "",
      debaterBQuery: "",
      debaterB2Query: ""
    };
  }

  function makeDefaultLazyDebateDraft() {
    return {
      topic: "",
      category: "",
      teamSize: 1,
      scheduledFor: "",
      moderator: "",
      description: "",
      videoUrl: "",
      videoMode: "full",
      videoClipStart: "",
      videoClipEnd: "",
      debaterAUid: "",
      debaterA2Uid: "",
      debaterBUid: "",
      debaterB2Uid: "",
      debaterAQuery: "",
      debaterA2Query: "",
      debaterBQuery: "",
      debaterB2Query: "",
      result: "a"
    };
  }

  function getDraftState(owner = "schedule") {
    return owner === "lazy" ? state.lazyDebateDraft : state.scheduleDraft;
  }

  function normalizeDebateTeamSize(value, fallback = 1) {
    const numericValue = Number(value);
    if (numericValue === 3) return 3;
    if (numericValue === 2) return 2;
    if (numericValue === 1) return 1;
    return [2, 3].includes(Number(fallback)) ? Number(fallback) : 1;
  }

  function getDraftParticipantMeta(field) {
    const safeField = String(field || "").trim();
    return DEBATE_PARTICIPANT_FIELD_META.find((entry) => entry.field === safeField) || null;
  }

  function getActiveDraftParticipantFields(teamSize = 1) {
    const safeTeamSize = normalizeDebateTeamSize(teamSize, 1);
    if (safeTeamSize === 2) {
      return [...EXTENDED_DEBATE_PARTICIPANT_FIELDS];
    }
    if (safeTeamSize === 3) {
      return ["debaterAUid", "debaterA2Uid", "debaterBUid"];
    }
    return [...PRIMARY_DEBATE_PARTICIPANT_FIELDS];
  }

  function getDraftTeamParticipantFields(teamId, teamSize = 1) {
    const safeTeamId = String(teamId || "").trim().toLowerCase() === "b" ? "b" : "a";
    return getActiveDraftParticipantFields(teamSize).filter((field) => {
      return getDraftParticipantMeta(field)?.team === safeTeamId;
    });
  }

  function getDraftTeamSize(owner = "schedule") {
    return normalizeDebateTeamSize(getDraftState(owner)?.teamSize, 1);
  }

  function clearDraftParticipantField(draft, field) {
    if (!draft) return;
    const safeField = String(field || "").trim();
    const meta = getDraftParticipantMeta(safeField);
    if (!safeField) return;
    draft[safeField] = "";
    if (meta?.queryField) {
      draft[meta.queryField] = "";
    }
  }

  function clearInactiveDraftParticipants(draft) {
    if (!draft) return;
    const activeFields = new Set(getActiveDraftParticipantFields(draft.teamSize));
    DEBATE_PARTICIPANT_FIELD_META.forEach((entry) => {
      if (!activeFields.has(entry.field)) {
        draft[entry.field] = "";
        draft[entry.queryField] = "";
      }
    });
  }

  function getDraftBlockedParticipantUids(draft, field) {
    if (!draft) return [];
    const safeField = String(field || "").trim();
    return getActiveDraftParticipantFields(draft.teamSize)
      .filter((entryField) => entryField !== safeField)
      .map((entryField) => String(draft[entryField] || "").trim())
      .filter(Boolean);
  }

  function getDebaterQueryField(field) {
    return getDraftParticipantMeta(field)?.queryField || "";
  }

  function getDebaterSelectKey(owner, field) {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const safeField = String(field || "").trim();
    return safeField ? `${safeOwner}:${safeField}` : "";
  }

  function coerceDebaterDraftUniqueness(draft, field) {
    if (!draft) return;

    clearInactiveDraftParticipants(draft);

    const activeFields = getActiveDraftParticipantFields(draft.teamSize);
    const safeField = activeFields.includes(String(field || "").trim()) ? String(field || "").trim() : "";

    if (safeField) {
      const selectedUid = String(draft[safeField] || "").trim();
      if (!selectedUid) return;
      activeFields.forEach((entryField) => {
        if (entryField !== safeField && String(draft[entryField] || "").trim() === selectedUid) {
          clearDraftParticipantField(draft, entryField);
        }
      });
      return;
    }

    const seen = new Set();
    activeFields.forEach((entryField) => {
      const value = String(draft[entryField] || "").trim();
      if (!value) return;
      if (seen.has(value)) {
        clearDraftParticipantField(draft, entryField);
        return;
      }
      seen.add(value);
    });
  }

  function findDirectoryUserByNormalizedUsername(username, blockedUids = []) {
    const safeName = normalizeUsername(username);
    const blockedSet = new Set(
      (Array.isArray(blockedUids) ? blockedUids : [blockedUids])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    );
    if (!safeName) return null;

    return (
      state.directory.find((entry) => {
        const uid = String(entry.uid || "").trim();
        return uid && !blockedSet.has(uid) && normalizeUsername(entry.username || entry.name || "") === safeName;
      }) || null
    );
  }

  function directoryHasNormalizedUsername(username) {
    const safeName = normalizeUsername(username);
    if (!safeName) return false;
    return state.directory.some((entry) => normalizeUsername(entry.username || entry.name || "") === safeName);
  }

  function getDraftDebaterQueryValue(owner, field) {
    const draft = getDraftState(owner);
    if (!draft) return "";

    const queryField = getDebaterQueryField(field);
    const rawQuery = queryField ? String(draft[queryField] || "") : "";
    if (rawQuery) {
      return rawQuery;
    }

    const selectedUid = String(draft[field] || "").trim();
    if (!selectedUid) {
      return "";
    }

    return formatDisplayName(getNameForUid(selectedUid, "debater"), "Debater");
  }

  function getDraftDebaterLabel(owner, field, fallback) {
    const label = getDraftDebaterQueryValue(owner, field);
    return label ? formatDisplayName(label, fallback) : fallback;
  }

  function setDebaterDraftSelection(owner, field, value, displayValue = "") {
    const draft = getDraftState(owner);
    if (!draft) return;

    const queryField = getDebaterQueryField(field);
    draft[field] = String(value || "").trim();
    if (queryField) {
      draft[queryField] = draft[field] ? "" : String(displayValue || "").trim();
    }

    coerceDebaterDraftUniqueness(draft, field);
  }

  function setDebaterDraftQuery(owner, field, rawValue) {
    const draft = getDraftState(owner);
    if (!draft) return;

    const queryField = getDebaterQueryField(field);
    if (!queryField) return;

    const nextRawValue = String(rawValue || "");
    const normalizedQuery = normalizeUsername(nextRawValue);
    const blockedUids = getDraftBlockedParticipantUids(draft, field);
    const exactEntry = normalizedQuery ? findDirectoryUserByNormalizedUsername(normalizedQuery, blockedUids) : null;

    draft[queryField] = nextRawValue;
    draft[field] = exactEntry ? String(exactEntry.uid || "").trim() : "";

    coerceDebaterDraftUniqueness(draft, field);
  }

  function getDraftDebaterSelectionValue(owner, field) {
    const draft = getDraftState(owner);
    if (!draft) return "";

    const selectedUid = String(draft[field] || "").trim();
    if (selectedUid) {
      return selectedUid;
    }

    const queryField = getDebaterQueryField(field);
    const normalizedQuery = normalizeUsername(queryField ? draft[queryField] || "" : "");
    if (!normalizedQuery || !isValidUsername(normalizedQuery)) {
      return "";
    }

    const blockedUids = getDraftBlockedParticipantUids(draft, field);
    const exactEntry = findDirectoryUserByNormalizedUsername(normalizedQuery, blockedUids);
    return exactEntry ? String(exactEntry.uid || "").trim() : makePlaceholderUid(normalizedQuery);
  }

  function setDraftField(owner, field, value) {
    const draft = getDraftState(owner);
    if (!draft) return;
    if (field === "category") {
      draft[field] = normalizeDebateCategory(value, "");
      return;
    }
    if (field === "teamSize") {
      draft.teamSize = normalizeDebateTeamSize(value, 1);
      clearInactiveDraftParticipants(draft);
      coerceDebaterDraftUniqueness(draft);
      return;
    }

    draft[field] = value;

    coerceDebaterDraftUniqueness(draft, field);
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
    const normalized = normalizeUsername(getNameForUid(safeUid, ""));
    return normalized === "admin" || normalized === "haji" ? "admin" : "user";
  }

  function getAdminManagedUsers() {
    return [...state.directory]
      .filter((entry) => String(entry.uid || "").trim())
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
          renderApp({ preserveScroll: true });
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
        renderApp({ preserveScroll: true });
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

    clearInactiveDraftParticipants(state.scheduleDraft);
    coerceDebaterDraftUniqueness(state.scheduleDraft);
  }

  function getDebateStatus(debate) {
    const scheduledMillis = toMillis(debate.scheduledFor);
    if (isDebateAwaitingReview(debate)) {
      return { label: "Awaiting Admin", className: "status-review" };
    }
    if (debate.status === "resolved") {
      return { label: "Resolved", className: "status-resolved" };
    }
    if (scheduledMillis && scheduledMillis < Date.now()) {
      return { label: "Overdue", className: "status-overdue" };
    }
    return { label: "Scheduled", className: "status-scheduled" };
  }

  function getDebateTeamSize(debateOrValue, fallback = 1) {
    const rawValue =
      debateOrValue && typeof debateOrValue === "object"
        ? debateOrValue.teamSize
        : debateOrValue;
    return normalizeDebateTeamSize(rawValue, fallback);
  }

  function getDebateParticipantEntries(debate, options = {}) {
    const safeDebate = debate || {};
    const teamSize = getDebateTeamSize(safeDebate, 1);
    const includeEmpty = Boolean(options.includeEmpty);
    return getActiveDraftParticipantFields(teamSize)
      .map((field) => {
        const meta = getDraftParticipantMeta(field);
        if (!meta) return null;
        const uid = String(safeDebate[field] || "").trim();
        const name = normalizeUsername(safeDebate[meta.nameField] || "") || getPlaceholderUsername(uid) || "";
        if (!includeEmpty && !uid) {
          return null;
        }
        return {
          field,
          uid,
          name,
          team: meta.team,
          slot: meta.slot
        };
      })
      .filter(Boolean);
  }

  function getDebateParticipantNames(debate) {
    return getDebateParticipantEntries(debate)
      .map((entry) => formatDisplayName(entry.name || entry.uid || "", "Debater"))
      .filter(Boolean);
  }

  function getDebateTeamParticipants(debate, teamId) {
    const safeTeamId = String(teamId || "").trim().toLowerCase() === "b" ? "b" : "a";
    return getDebateParticipantEntries(debate).filter((entry) => entry.team === safeTeamId);
  }

  function formatDebateTeamLabel(entries, fallback = "Team") {
    const safeEntries = (Array.isArray(entries) ? entries : [])
      .map((entry) => formatDisplayName(entry?.name || entry?.uid || "", ""))
      .filter(Boolean);
    return safeEntries.join(" & ") || fallback;
  }

  function getDebateTeamLabel(debate, teamId, fallback = "") {
    const safeTeamId = String(teamId || "").trim().toLowerCase() === "b" ? "b" : "a";
    const defaultLabel = fallback || (safeTeamId === "a" ? "Team A" : "Team B");
    return formatDebateTeamLabel(getDebateTeamParticipants(debate, safeTeamId), defaultLabel);
  }

  function getDebateResultTeamLabel(debate, result, fallback = "") {
    if (result === "a" || result === "b") {
      return getDebateTeamLabel(debate, result, fallback || (result === "a" ? "Team A" : "Team B"));
    }
    return fallback || "";
  }

  function getDebateRatingTeams(debate) {
    const safeDebate = debate || {};
    const teamSize = getDebateTeamSize(safeDebate, 1);
    const teamA = getDebateTeamParticipants(safeDebate, "a");
    const teamB = getDebateTeamParticipants(safeDebate, "b");
    if (!teamA.length || !teamB.length) return null;
    if (teamSize === 2 && (teamA.length < 2 || teamB.length < 2)) return null;
    if (teamSize === 3 && (teamA.length < 2 || teamB.length < 1 || teamB.length > 1)) return null;
    const allUids = [...teamA, ...teamB].map((entry) => String(entry.uid || "").trim()).filter(Boolean);
    if (!allUids.length || new Set(allUids).size !== allUids.length) return null;
    return { teamSize, teamA, teamB };
  }

  function getDraftParticipantRequirementMessage(teamSize, context = "scheduling") {
    const safeContext = String(context || "").trim().toLowerCase() === "logging" ? "logging" : "scheduling";
    const verb = safeContext === "logging" ? "logging" : "scheduling";
    const safeTeamSize = normalizeDebateTeamSize(teamSize, 1);
    if (safeTeamSize === 2) {
      return `Pick all four debaters before ${verb}.`;
    }
    if (safeTeamSize === 3) {
      return `Pick all three debaters before ${verb}.`;
    }
    return `Pick both debaters before ${verb}.`;
  }

  function debateMatchesSearch(debate, searchTerm) {
    if (!searchTerm) return true;
    const haystack = [
      debate.topic,
      getDebateCategoryLabel(debate.category),
      debate.description,
      debate.moderator,
      ...getDebateParticipantNames(debate),
      debate.winnerName,
      debate.createdByName
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm.toLowerCase());
  }

  function compareDebatesAscending(left, right) {
    const chronologyDiff = getDebateChronologyMillis(left) - getDebateChronologyMillis(right);
    if (chronologyDiff) return chronologyDiff;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  }

  function compareDebatesDescending(left, right) {
    return compareDebatesAscending(right, left);
  }

  function debateIncludesUser(debate, uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return false;
    return getDebateParticipantEntries(debate).some((entry) => entry.uid === safeUid);
  }

  function filterDebatesByCategory(debates, categoryId) {
    const safeCategory = normalizeRankingsCategory(categoryId);
    return (Array.isArray(debates) ? debates : []).filter(
      (debate) => normalizeDebateCategory(debate?.category) === safeCategory
    );
  }

  function sortLeaderboardRows(rows) {
    return [...rows].sort((left, right) => {
      if (left.isRanked !== right.isRanked) return Number(right.isRanked) - Number(left.isRanked);
      if (right.ratingRounded !== left.ratingRounded) return right.ratingRounded - left.ratingRounded;
      if (right.debates !== left.debates) return right.debates - left.debates;
      return left.name.localeCompare(right.name);
    });
  }

  function runDebateRatings(debates, options = {}) {
    const directoryMap = getDirectoryMap();
    const players = new Map();
    const selectedCategory = options.category ? normalizeDebateCategory(options.category) : "";
    const targetUid = String(options.uid || "").trim();
    const history = [];

    function ensurePlayer(uid, fallbackName) {
      const safeUid = String(uid || "").trim();
      if (!safeUid) return null;

      if (!players.has(safeUid)) {
        players.set(safeUid, {
          uid: safeUid,
          name: directoryMap.get(safeUid) || normalizeUsername(fallbackName || "") || "debater",
          rating: ELO_BASELINE,
          reached2400: ELO_BASELINE >= FIDE_HIGH_RATING_THRESHOLD,
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

    const ratedDebates = (Array.isArray(debates) ? debates : [])
      .filter((debate) => {
        const teams = getDebateRatingTeams(debate);
        return (
          debate.status === "resolved" &&
          ["a", "b", "draw"].includes(String(debate.result || "")) &&
          Boolean(teams) &&
          (!selectedCategory || normalizeDebateCategory(debate.category) === selectedCategory)
        );
      })
      .sort(compareDebatesAscending);

    const ratingPeriods = [];
    let currentPeriod = null;

    ratedDebates.forEach((debate) => {
      const debateMillis = getDebateChronologyMillis(debate);
      const periodKey = getFideRatingPeriodKey(debateMillis);

      if (!currentPeriod || currentPeriod.key !== periodKey) {
        currentPeriod = { key: periodKey, debates: [] };
        ratingPeriods.push(currentPeriod);
      }

      currentPeriod.debates.push({ debate, debateMillis });
    });

    ratingPeriods.forEach((period) => {
      const periodSnapshots = new Map();
      const periodChanges = new Map();
      let periodEndMillis = 0;
      let targetPlayedThisPeriod = false;

      function getPeriodSnapshot(player) {
        if (!player) return null;
        if (!periodSnapshots.has(player.uid)) {
          periodSnapshots.set(player.uid, {
            uid: player.uid,
            rating: player.rating,
            debates: player.debates,
            reached2400: Boolean(player.reached2400)
          });
        }
        return periodSnapshots.get(player.uid);
      }

      function getPeriodChange(uid) {
        const safeUid = String(uid || "").trim();
        if (!periodChanges.has(safeUid)) {
          periodChanges.set(safeUid, {
            deltaSum: 0,
            games: 0
          });
        }
        return periodChanges.get(safeUid);
      }

      period.debates.forEach(({ debate, debateMillis }) => {
        const teams = getDebateRatingTeams(debate);
        if (!teams) return;

        const teamAPlayers = teams.teamA
          .map((entry) => ensurePlayer(entry.uid, entry.name))
          .filter(Boolean);
        const teamBPlayers = teams.teamB
          .map((entry) => ensurePlayer(entry.uid, entry.name))
          .filter(Boolean);
        if (!teamAPlayers.length || !teamBPlayers.length) return;

        const snapshotA = teamAPlayers.map((player) => getPeriodSnapshot(player)).filter(Boolean);
        const snapshotB = teamBPlayers.map((player) => getPeriodSnapshot(player)).filter(Boolean);
        const teamARating = snapshotA.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / snapshotA.length;
        const teamBRating = snapshotB.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / snapshotB.length;
        const expectedA = getFideExpectedScore(teamARating, teamBRating, debateMillis);
        const expectedB = getFideExpectedScore(teamBRating, teamARating, debateMillis);
        const scoreA = debate.result === "a" ? 1 : debate.result === "b" ? 0 : 0.5;
        const scoreB = 1 - scoreA;
        teamAPlayers.forEach((player) => {
          const playerChange = getPeriodChange(player.uid);
          playerChange.deltaSum += (scoreA - expectedA) * getPlacementGameWeight(player.debates);
          playerChange.games += 1;
          player.debates += 1;
          player.lastDebateAt = Math.max(player.lastDebateAt, debateMillis);
        });
        teamBPlayers.forEach((player) => {
          const playerChange = getPeriodChange(player.uid);
          playerChange.deltaSum += (scoreB - expectedB) * getPlacementGameWeight(player.debates);
          playerChange.games += 1;
          player.debates += 1;
          player.lastDebateAt = Math.max(player.lastDebateAt, debateMillis);
        });
        periodEndMillis = Math.max(periodEndMillis, debateMillis);

        if (debate.result === "a") {
          teamAPlayers.forEach((player) => {
            player.wins += 1;
          });
          teamBPlayers.forEach((player) => {
            player.losses += 1;
          });
        } else if (debate.result === "b") {
          teamBPlayers.forEach((player) => {
            player.wins += 1;
          });
          teamAPlayers.forEach((player) => {
            player.losses += 1;
          });
        } else {
          teamAPlayers.forEach((player) => {
            player.draws += 1;
          });
          teamBPlayers.forEach((player) => {
            player.draws += 1;
          });
        }

        if (
          targetUid &&
          [...teamAPlayers, ...teamBPlayers].some((player) => player.uid === targetUid)
        ) {
          targetPlayedThisPeriod = true;
        }
      });

      periodChanges.forEach((change, uid) => {
        const player = players.get(uid);
        const snapshot = periodSnapshots.get(uid);
        if (!player || !snapshot || !change.games) return;

        const kFactor = getFideKFactor(snapshot, change.games, periodEndMillis);
        const ratingChange = roundHalfAwayFromZero(change.deltaSum * kFactor * DEBATE_ELO_CHANGE_MULTIPLIER);

        player.rating += ratingChange;
        if (player.rating >= FIDE_HIGH_RATING_THRESHOLD) {
          player.reached2400 = true;
        }
      });

      if (targetUid && targetPlayedThisPeriod && players.has(targetUid)) {
        const targetPlayer = players.get(targetUid);
        history.push({
          at: periodEndMillis || Date.now(),
          rating: targetPlayer.rating,
          ratingRounded: roundHalfAwayFromZero(targetPlayer.rating),
          debates: targetPlayer.debates,
          wins: targetPlayer.wins,
          losses: targetPlayer.losses,
          draws: targetPlayer.draws,
          isPublishedRating: targetPlayer.debates >= MIN_RANKED_DEBATES
        });
      }
    });

    const rankedPlayers = [...players.values()].map((player) => {
      const ratingRounded = roundHalfAwayFromZero(player.rating);
      const isPublishedRating = player.debates >= MIN_RANKED_DEBATES;
      return {
        ...player,
        ratingRounded,
        isPublishedRating,
        isRanked: isPublishedRating,
        recordLabel: `${player.wins}-${player.losses}${player.draws ? `-${player.draws}` : ""}`
      };
    });

    return {
      players: rankedPlayers,
      history
    };
  }

  function computeLeaderboard(debates, options = {}) {
    return runDebateRatings(debates, options).players;
  }

  function buildRatingHistoryForUser(debates, options = {}) {
    const selectedCategory = options.category ? normalizeDebateCategory(options.category) : "";
    if (!selectedCategory) return [];
    return runDebateRatings(debates, options).history;
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
      isPublishedRating: false,
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
    const selectedProfileCategoryId = normalizeRankingsCategory(
      state.profileCategory || preferredProfileCategory?.id || DEBATE_CATEGORIES[0].id
    );
    const selectedProfileCategory =
      getCategoryRatingById(profileCategoryRatings, selectedProfileCategoryId, activeProfileUid || activeProfileName) ||
      preferredProfileCategory ||
      profileCategoryRatings[0] ||
      null;
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
    const profileDebatesUpcomingFiltered = filterDebatesByCategory(profileDebatesUpcoming, selectedProfileCategory?.id);
    const profileDebatesPastFiltered = filterDebatesByCategory(profileDebatesPast, selectedProfileCategory?.id);
    const profileCategorySnapshot = selectedProfileCategory || {
      ...getFallbackPlayerSnapshot(activeProfileUid, activeProfileName),
      id: selectedProfileCategoryId,
      label: getDebateCategoryLabel(selectedProfileCategoryId),
      rank: 0
    };
    const profileCategoryHistory = buildRatingHistoryForUser(allDebates, {
      uid: activeProfileUid,
      name: activeProfileName,
      category: profileCategorySnapshot.id
    });
    const profileIsCurrentUser = activeProfileUid === viewerUid;
    const selectedDebate = allDebates.find((debate) => debate.id === String(state.debateId || "").trim()) || null;
    const selectedDebateComments = getDebateComments(selectedDebate);
    const selectedDebateVideoEmbedUrl = getYouTubeEmbedUrl(selectedDebate?.videoUrl || selectedDebate?.videoEmbedUrl || "", {
      startSeconds: selectedDebate?.videoClipStart,
      endSeconds: selectedDebate?.videoClipEnd
    });
    const selectedDebateSourcePage =
      selectedDebate?.status === "resolved"
        ? "archive"
        : currentIsAdmin() && isDebateAwaitingReview(selectedDebate)
          ? "admin"
          : "schedule";
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
      selectedProfileCategory,
      profileCategorySnapshot,
      profileCategoryHistory,
      profileDebatesUpcoming,
      profileDebatesPast,
      profileDebatesUpcomingFiltered,
      profileDebatesPastFiltered,
      profileIsCurrentUser,
      rankingsCategory,
      rankingsCategoryLabel: getDebateCategoryLabel(rankingsCategory),
      selectedDebate,
      selectedDebateComments,
      selectedDebateVideoEmbedUrl,
      selectedDebateSourcePage,
      selectedDebateCanEditVideo,
      unresolvedQueue: allDebates
        .filter((debate) => debate.status === "scheduled" || isDebateAwaitingReview(debate))
        .sort((left, right) => {
          const leftReview = Number(isDebateAwaitingReview(left));
          const rightReview = Number(isDebateAwaitingReview(right));
          if (rightReview !== leftReview) return rightReview - leftReview;
          return compareDebatesAscending(left, right);
        })
    };
  }

  function capturePanelScrollState() {
    return [...document.querySelectorAll(".panel-scroll")].map((node, index) => ({
      index,
      classNames: String(node.className || "")
        .split(/\s+/)
        .filter(Boolean),
      scrollTop: Number(node.scrollTop || 0),
      scrollLeft: Number(node.scrollLeft || 0)
    }));
  }

  function restorePanelScrollState(savedState) {
    const states = Array.isArray(savedState) ? savedState : [];
    if (!states.length) return;

    const nodes = [...document.querySelectorAll(".panel-scroll")];
    states.forEach((entry) => {
      const node = nodes[Number(entry?.index)];
      if (!(node instanceof HTMLElement)) return;

      const requiredClasses = Array.isArray(entry?.classNames) ? entry.classNames.filter(Boolean) : [];
      if (requiredClasses.length && !requiredClasses.every((className) => node.classList.contains(className))) {
        return;
      }

      node.scrollTop = Math.max(0, Number(entry?.scrollTop || 0));
      node.scrollLeft = Math.max(0, Number(entry?.scrollLeft || 0));
    });
  }

  function renderApp(options = {}) {
    const preserveScroll = Boolean(options.preserveScroll);
    const scrollX = preserveScroll ? window.scrollX : 0;
    const scrollY = preserveScroll ? window.scrollY : 0;
    const panelScrollState = preserveScroll ? capturePanelScrollState() : [];
    const mobileViewport = isMobileViewport();
    state.isMobileViewport = mobileViewport;
    document.body.classList.toggle("is-mobile-app", mobileViewport);
    syncThemeUi();

    if (!state.user) {
      showAuthScreen();
      return;
    }

    syncAdminProfilesSubscription();

    if (mobileViewport && state.currentPage === "admin") {
      setPage("settings", { replace: true });
      return;
    }

    if (!mobileViewport && state.currentPage === "settings") {
      setPage(currentIsAdmin() ? "admin" : "dashboard", { replace: true });
      return;
    }

    if (!mobileViewport && state.currentPage === "admin" && !currentIsAdmin()) {
      setPage("schedule", { replace: true });
      return;
    }

    showHubShell();
    const model = buildViewModel();
    syncSearchUi();
    syncPrimaryNavLink(mobileViewport);
    syncSettingsNavLink(mobileViewport);

    syncUserAvatarUi();
    if (el.userName) el.userName.textContent = formatDisplayName(state.username || "debater", "Debater");
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
    let releaseMobileMainContentHeight = false;
    if (el.mainContent && el.mainContent.innerHTML !== nextMainContent) {
      if (mobileViewport) {
        const currentHeight = Math.ceil(el.mainContent.getBoundingClientRect().height);
        if (currentHeight > 0) {
          el.mainContent.style.minHeight = `${currentHeight}px`;
          releaseMobileMainContentHeight = true;
        }
      }
      el.mainContent.innerHTML = nextMainContent;
    }
    if (el.sideContent) {
      el.sideContent.classList.toggle("hidden", mobileViewport);
      const nextSideContent = mobileViewport ? "" : renderSideRail(model);
      if (el.sideContent.innerHTML !== nextSideContent) {
        el.sideContent.innerHTML = nextSideContent;
      }
    }
    el.mainContent?.querySelectorAll(".video-link-fields").forEach((node) => {
      syncVideoLinkFieldsUi(node);
    });
    syncProfileHistoryCharts();
    syncQueuePanelHeight();

    if (preserveScroll || releaseMobileMainContentHeight) {
      window.requestAnimationFrame(() => {
        if (releaseMobileMainContentHeight && el.mainContent) {
          el.mainContent.style.removeProperty("min-height");
        }
        if (preserveScroll) {
          restorePanelScrollState(panelScrollState);
          window.scrollTo(scrollX, scrollY);
        }
      });
    } else if (el.mainContent) {
      el.mainContent.style.removeProperty("min-height");
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
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
        <section class="mobile-block mobile-scroll-page-block">
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
          <div id="mobile-search-results" class="panel-scroll mobile-page-scroll">
            ${renderMobileSearchResults()}
          </div>
        </section>
      </section>
    `;
  }

  function renderCompactRecordLine(player) {
    return `${Number(player?.wins || 0)}W • ${Number(player?.losses || 0)}L • ${Number(player?.draws || 0)}D`;
  }

  function renderCompactRecordLineMarkup(player) {
    return `
      <span class="mobile-ranking-record-text win">${Number(player?.wins || 0)}W</span>
      <span class="mobile-ranking-record-text loss">${Number(player?.losses || 0)}L</span>
      <span class="mobile-ranking-record-text draw">${Number(player?.draws || 0)}D</span>
    `;
  }

  function renderMobileDebateRow(debate, options = {}) {
    const isBusy = state.actionBusyKey.startsWith(`${debate.id}:`);
    const winnerName = getDebateWinnerName(debate);
    const debateStatus = getDebateStatus(debate);
    const isAwaitingReview = isDebateAwaitingReview(debate);
    const resultLabel = isAwaitingReview
      ? `Submitted: ${getDebateSubmittedResultLabel(debate)}`
      : debate.status === "resolved"
        ? debate.result === "draw"
          ? "Draw"
          : (winnerName || "Winner")
        : "";
    const resultTone = isAwaitingReview ? " review" : debate.result === "draw" ? " draw" : " positive";
    const showStatusChip = !options.hideStatus;
    const showResultPill = !options.hideResultPill && Boolean(resultLabel);
    const categoryClassName = options.fullWidthCategory ? "category-tag-wide" : "";

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
          ${renderDebatePeopleRow(debate, { mobile: true, static: true })}
          <div class="mobile-row-foot">
            ${showStatusChip ? `<span class="mini-tag status-chip ${escapeHtml(debateStatus.className)}">${escapeHtml(debateStatus.label)}</span>` : ""}
            ${renderCategoryBadge(debate.category, categoryClassName)}
            ${showResultPill ? `<span class="result-pill${resultTone}">${escapeHtml(resultLabel)}</span>` : ""}
          </div>
        </button>
        ${
          options.showAdminControls && currentIsAdmin()
            ? `
              <div class="mobile-admin-stack" data-action="hold-admin-controls">
                ${
                  isAwaitingReview
                    ? `
                      <div class="mini-copy">Submitted by ${escapeHtml(formatDisplayName(debate.createdByName || "member", "Member"))}</div>
                      <div class="mobile-admin-actions">
                        <button
                          class="result-btn win"
                          type="button"
                          data-action="review-submitted-debate"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="accept"
                          ${isBusy ? "disabled" : ""}
                        >
                          Accept
                        </button>
                        <button
                          class="result-btn reopen"
                          type="button"
                          data-action="review-submitted-debate"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="decline"
                          ${isBusy ? "disabled" : ""}
                        >
                          Decline
                        </button>
                      </div>
                    `
                    : `
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
                          ${escapeHtml(getDebateTeamLabel(debate, "a", "Team A"))} wins
                        </button>
                        <button
                          class="result-btn win"
                          type="button"
                          data-action="claim-result"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="b"
                          ${isBusy ? "disabled" : ""}
                        >
                          ${escapeHtml(getDebateTeamLabel(debate, "b", "Team B"))} wins
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
                    `
                }
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
                  <div class="mobile-row-meta mobile-ranking-record-line">${renderCompactRecordLineMarkup(player)}</div>
                </span>
                <span class="mobile-ranking-side">${escapeHtml(getRatingDisplayValue(player))}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderMobileDashboardPage(model) {
    const avatarDataUrl = getAvatarDataUrlForUid(model.profileUid || model.profileSnapshot.uid);
    const selectedCategory = model.selectedProfileCategory || model.profileCategoryRatings[0] || null;
    const categoryRankLabel = getCategoryRankLabel(selectedCategory);

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block mobile-profile-block mobile-scroll-page-block">
          <span class="page-kicker">${model.profileIsCurrentUser ? "My Profile" : "Profile"}</span>
          <div class="mobile-identity">
            ${renderAvatarChipHtml({
              name: model.profileSnapshot.name,
              avatarDataUrl,
              seed: model.profileUid || model.profileSnapshot.name,
              className: "page-avatar"
            })}
            <div class="mobile-identity-copy">
              <h2 class="mobile-page-title">${escapeHtml(formatDisplayName(model.profileSnapshot.name, "Debater"))}</h2>
            </div>
          </div>
          ${renderScrollablePanel(
            `
              ${renderCategoryRatingGrid(model.profileCategoryRatings, {
                mobile: true,
                interactive: true,
                preferredCategoryId: model.preferredProfileCategory?.id,
                selectedCategoryId: model.selectedProfileCategory?.id
              })}
              ${renderProfileRatingHistoryPanel(model.selectedProfileCategory, model.profileCategoryHistory, { mobile: true })}
              <div class="mobile-inline-stats">
                <article class="mobile-stat">
                  <span class="summary-label">Debates</span>
                  <strong>${model.profileCategorySnapshot.debates}</strong>
                </article>
                <article class="mobile-stat">
                  <span class="summary-label">Rank</span>
                  <strong>${escapeHtml(categoryRankLabel)}</strong>
                  <span class="mobile-row-meta">${escapeHtml(selectedCategory?.label || "Category")}</span>
                </article>
              </div>
              <div class="mobile-record-line">
                ${renderRecordChips(model.profileCategorySnapshot, { compact: true, labelStyle: "full" })}
              </div>
              <section class="mobile-scroll-section">
                <div class="mobile-section-head">
                  <h3>Upcoming</h3>
                </div>
                ${renderMobileDebateList(model.profileDebatesUpcomingFiltered, {
                  emptyTitle: "No upcoming debates"
                })}
              </section>
              <section class="mobile-scroll-section">
                <div class="mobile-section-head">
                  <h3>Results</h3>
                </div>
                ${renderMobileDebateList(model.profileDebatesPastFiltered, {
                  emptyTitle: "No results yet",
                  hideStatus: true,
                  hideResultPill: true,
                  fullWidthCategory: true
                })}
              </section>
            `,
            "mobile-page-scroll"
          )}
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

    const winnerName = getDebateWinnerName(debate);
    const loserName = debate.status === "resolved"
      ? debate.result === "a"
        ? getDebateTeamLabel(debate, "b", "Team B")
        : debate.result === "b"
          ? getDebateTeamLabel(debate, "a", "Team A")
          : ""
      : "";
    const debateStatus = getDebateStatus(debate);
    const isAwaitingReview = isDebateAwaitingReview(debate);
    const resultDetailLabel = isAwaitingReview ? "Submitted" : "Winner";
    const resultDetailValue = isAwaitingReview ? getDebateSubmittedResultLabel(debate) : winnerName || "N/A";
    const resultToneClass = isAwaitingReview
      ? " is-review"
      : debate.status === "resolved" && debate.result === "draw"
        ? " is-draw"
        : debate.status === "resolved" && resultDetailValue && resultDetailValue !== "N/A"
          ? " is-winner"
          : "";
    const loserToneClass = debate.status === "resolved" && debate.result !== "draw" && loserName
      ? " is-loser"
      : "";
    const commentBusy = state.actionBusyKey === `${debate.id}:comment`;
    const videoBusy = state.actionBusyKey === `${debate.id}:video`;

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block mobile-scroll-page-block">
          <div class="mobile-section-head mobile-page-head">
            <div class="mobile-page-head-copy">
              <span class="page-kicker">Debate</span>
              <h2 class="mobile-page-title">${escapeHtml(debate.topic || "Untitled debate")}</h2>
            </div>
            ${renderDebateEditButton(debate, { mobile: true })}
          </div>
          ${renderScrollablePanel(
            `
              <div class="badge-row mobile-debate-category-row">
                ${renderCategoryBadge(debate.category, "category-tag-wide mobile-debate-category-tag")}
              </div>
              ${renderDebatePeopleRow(debate, { mobile: true, className: "mobile-debate-people" })}
              <div class="mobile-inline-stats">
                <article class="mobile-stat">
                  <span class="summary-label">Scheduled</span>
                  <strong>${escapeHtml(formatDateTime(debate.scheduledFor))}</strong>
                </article>
                <article class="mobile-stat">
                  <span class="summary-label">Category</span>
                  <strong>${escapeHtml(getDebateCategoryLabel(debate.category))}</strong>
                </article>
                <article class="mobile-stat${resultToneClass}">
                  <span class="summary-label">${escapeHtml(resultDetailLabel)}</span>
                  <strong>${
                    isAwaitingReview || debate.result === "draw"
                      ? escapeHtml(resultDetailValue)
                      : renderTeamIdentityInline(debate, debate.result)
                  }</strong>
                </article>
                <article class="mobile-stat${loserToneClass}">
                  <span class="summary-label">Loser</span>
                  <strong>${
                    loserName
                      ? renderTeamIdentityInline(debate, debate.result === "a" ? "b" : "a")
                      : "N/A"
                  }</strong>
                </article>
              </div>
              ${renderDebateAdminTools(debate, { mobile: true })}
              <section class="mobile-scroll-section">
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
                  model.selectedDebateCanEditVideo && state.debateEditMode
                    ? `
                        <form class="stack-form" id="debate-video-form">
                          <input type="hidden" name="debateId" value="${escapeHtml(debate.id)}" />
                          ${renderDebateVideoFormFields(debate, { inputNamePrefix: "mobile-debate-video" })}
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
              <section class="mobile-scroll-section">
                <div class="mobile-section-head">
                  <h3>Comments</h3>
                </div>
                ${renderScrollablePanel(renderCommentList(model.selectedDebateComments), "is-comments")}
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
            `,
            "mobile-page-scroll"
          )}
        </section>
      </section>
    `;
  }

  function renderDraftTeamSizeToggle(owner = "schedule") {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const activeTeamSize = getDraftTeamSize(safeOwner);
    return `
      <label class="field">
        <span>Format</span>
        <div class="leaderboard-tabs draft-format-tabs" role="tablist" aria-label="Debate format">
          ${DEBATE_TEAM_OPTIONS.map((option) => {
            const isActive = option.id === activeTeamSize;
            return `
              <button
                class="tab-btn${isActive ? " is-active" : ""}"
                type="button"
                role="tab"
                aria-selected="${isActive ? "true" : "false"}"
                data-action="set-draft-team-size"
                data-draft-owner="${escapeHtml(safeOwner)}"
                data-value="${escapeHtml(String(option.id))}"
              >
                ${escapeHtml(option.label)}
              </button>
            `;
          }).join("")}
        </div>
        <input type="hidden" name="teamSize" value="${escapeHtml(String(activeTeamSize))}" />
      </label>
    `;
  }

  function renderDraftParticipantFields(owner = "schedule") {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const draft = getDraftState(safeOwner);
    const teamSize = getDraftTeamSize(safeOwner);
    if (!draft) return "";

    function renderTeamShell(teamId) {
      const safeTeamId = String(teamId || "").trim().toLowerCase() === "b" ? "b" : "a";
      const teamLabel = safeTeamId === "b" ? "Team B" : "Team A";
      const fields = getDraftTeamParticipantFields(safeTeamId, teamSize);
      return `
        <section class="debate-team-card">
          <span class="summary-label">${escapeHtml(teamLabel)}</span>
          <div class="debate-team-fields">
            ${fields.map((field) => {
              const meta = getDraftParticipantMeta(field);
              const selectLabel = fields.length > 1
                ? meta?.slot === 1
                  ? "Debater 1"
                  : "Debater 2"
                : "Debater";
              return renderDebaterSelect({
                label: selectLabel,
                field,
                selectedUid: draft[field],
                blockedUids: getDraftBlockedParticipantUids(draft, field),
                owner: safeOwner
              });
            }).join("")}
          </div>
        </section>
      `;
    }

    return `
      <div class="draft-participant-shell" data-draft-participants-owner="${escapeHtml(safeOwner)}">
        ${renderDraftTeamSizeToggle(safeOwner)}
        <div class="debate-team-grid${teamSize !== 1 ? " is-expanded" : ""}${teamSize === 2 ? " is-2v2" : ""}${teamSize === 3 ? " is-2v1" : ""}">
          ${renderTeamShell("a")}
          ${renderTeamShell("b")}
        </div>
      </div>
    `;
  }

  function renderScheduleTabs(selectedSection) {
    const safeSection = normalizeScheduleSection(selectedSection);
    const tabs = [
      { id: "past", label: "Past Debate" },
      { id: "future", label: "Future Debate" }
    ];

    return `
      <div class="leaderboard-tabs schedule-tabs" role="tablist" aria-label="Log sections">
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

  function getLogDebateSubmitLabels() {
    return currentIsAdmin()
      ? { idle: "Log debate", busy: "Logging..." }
      : { idle: "Submit for review", busy: "Submitting..." };
  }

  function renderLogDebateFormMarkup(options = {}) {
    const lazyDraft = state.lazyDebateDraft;
    const submitLabels = getLogDebateSubmitLabels();
    const mobile = Boolean(options.mobile);
    const wrapperClassName = mobile ? "field mobile-datetime-field" : "field";

    return `
      <form class="schedule-form${mobile ? "" : " lazy-debate-form"}" id="lazy-debate-form">
        <label class="field">
          <span>Topic${mobile ? "" : " or resolution"}</span>
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
          <label class="${wrapperClassName}">
            <span>Date and time</span>
            <input
              type="datetime-local"
              name="scheduledFor"
              data-draft-owner="lazy"
              data-draft-field="scheduledFor"
              value="${escapeHtml(lazyDraft.scheduledFor)}"
            />
          </label>
        </div>
        ${renderDraftParticipantFields("lazy")}
        <label class="field">
          <span>Moderator</span>
          <input
            type="text"
            name="moderator"
            data-draft-owner="lazy"
            data-draft-field="moderator"
            value="${escapeHtml(lazyDraft.moderator)}"
            placeholder="${escapeHtml(mobile ? "Optional moderator" : "Optional moderator or judge name")}"
          />
        </label>
        ${renderDraftVideoFields("lazy", lazyDraft)}
        <label class="field">
          <span>Description</span>
          <textarea
            name="description"
            data-draft-owner="lazy"
            data-draft-field="description"
            placeholder="${escapeHtml(mobile ? "Optional note about the debate." : "Optional note about the debate.")}"
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
            ${state.adminLogSaving ? submitLabels.busy : submitLabels.idle}
          </button>
          <button class="ghost-btn" type="button" data-action="reset-lazy-form">Reset</button>
        </div>
      </form>
    `;
  }

  function renderMobileScheduleFormBlock() {
    return `
      ${renderScrollablePanel(
        `
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
            ${renderDraftParticipantFields("schedule")}
            <label class="field mobile-datetime-field">
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
                ${state.scheduleSaving ? "Logging..." : "Log future debate"}
              </button>
              <button class="ghost-btn" type="button" data-action="reset-schedule-form">Reset</button>
            </div>
          </form>
        `,
        "mobile-page-scroll"
      )}
    `;
  }

  function renderMobilePastDebateBlock() {
    return `
      ${renderScrollablePanel(
        renderLogDebateFormMarkup({ mobile: true }),
        "mobile-page-scroll"
      )}
    `;
  }

  function renderMobileSchedulePage(model) {
    const scheduleSection = normalizeScheduleSection(state.scheduleSection);

    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block mobile-scroll-page-block">
          <span class="page-kicker">Debate log</span>
          <h2 class="mobile-page-title">Log</h2>
          ${renderScheduleTabs(scheduleSection)}
          ${
            scheduleSection === "past"
              ? renderMobilePastDebateBlock()
              : renderMobileScheduleFormBlock()
          }
        </section>
      </section>
    `;
  }

  function renderMobileArchivePage(model) {
    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block mobile-scroll-page-block">
          <span class="page-kicker">Past Debates</span>
          <h2 class="mobile-page-title">Archive</h2>
          ${renderScrollablePanel(
            renderMobileDebateList(model.past, {
              emptyTitle: state.searchTerm ? "No past debates match that search" : "No past debates yet",
              hideStatus: true,
              hideResultPill: true,
              fullWidthCategory: true,
              showAdminControls: currentIsAdmin() && state.archiveEditMode
            }),
            "mobile-page-scroll"
          )}
        </section>
      </section>
    `;
  }

  function renderMobileRankingsPage(model) {
    return `
      <section class="page-shell mobile-page">
        <section class="mobile-block mobile-scroll-page-block">
          <span class="page-kicker">Rankings</span>
          <h2 class="mobile-page-title">Rankings</h2>
          ${renderLeaderboardTabs(model.rankingsCategory)}
          ${renderScrollablePanel(
            renderMobileRankingList(model.leaderboard, `No ${model.rankingsCategoryLabel.toLowerCase()} debaters yet`),
            "mobile-page-scroll"
          )}
        </section>
      </section>
    `;
  }

  function renderMobileSettingsRoot(model) {
    const items = [
      {
        section: "profile",
        title: "Profile Settings",
        copy: "Light mode, username, password, avatar, and logout.",
        disabled: false
      },
      {
        section: "awaiting",
        title: "Awaiting Results",
        copy: currentIsAdmin()
          ? model.unresolvedQueue.length
            ? `${model.unresolvedQueue.length} debate${model.unresolvedQueue.length === 1 ? "" : "s"} waiting.`
            : "Nothing is waiting on admin."
          : "Admin only",
        disabled: !currentIsAdmin()
      },
      {
        section: "users",
        title: "Users",
        copy: currentIsAdmin() ? "Search and manage user accounts." : "Admin only",
        disabled: !currentIsAdmin()
      }
    ];

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
                    class="mobile-settings-tab${item.disabled ? " is-disabled" : ""}"
                    type="button"
                    data-action="open-settings-section"
                    data-settings-section="${escapeHtml(item.section)}"
                    ${item.disabled ? "disabled" : ""}
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
          <div class="mobile-settings-title">
            <span class="page-kicker">Settings</span>
            <h2 class="mobile-page-title">${escapeHtml(title)}</h2>
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
          <button class="mobile-settings-tab compact-mobile-change" type="button" data-action="mobile-change-username">
            <strong>Change Username</strong>
            <span>Update the name shown across debates and rankings.</span>
          </button>
          <button class="mobile-settings-tab compact-mobile-change" type="button" data-action="mobile-change-avatar">
            <strong>Change Profile Picture</strong>
            <span>Upload a new avatar.</span>
          </button>
          <button class="mobile-settings-tab compact-mobile-change" type="button" data-action="mobile-change-password">
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
    const drawLabel = model.profileCategorySnapshot.draws ? String(model.profileCategorySnapshot.draws) : "0";
    const avatarDataUrl = getAvatarDataUrlForUid(model.profileUid || model.profileSnapshot.uid);
    const selectedCategory = model.selectedProfileCategory || model.profileCategoryRatings[0] || null;
    const categoryRankLabel = getCategoryRankLabel(selectedCategory);

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
              <h2 class="page-title">${escapeHtml(formatDisplayName(model.profileSnapshot.name, "Debater"))}</h2>
            </div>
          </div>
          <div class="hero-actions">
            ${
              model.profileIsCurrentUser
                ? `
                  <button class="primary-btn" type="button" data-page-link="schedule">Log a Debate</button>
                  <button class="secondary-btn" type="button" data-page-link="archive">View Archive</button>
                `
                : `
                  <button class="primary-btn" type="button" data-page-link="rankings">Open Rankings</button>
                  <button class="secondary-btn" type="button" data-page-link="dashboard">My Profile</button>
                `
            }
          </div>
          ${renderCategoryRatingGrid(model.profileCategoryRatings, {
            interactive: true,
            preferredCategoryId: model.preferredProfileCategory?.id,
            selectedCategoryId: model.selectedProfileCategory?.id
          })}
          ${renderProfileRatingHistoryPanel(model.selectedProfileCategory, model.profileCategoryHistory)}
          <div class="summary-grid">
            <article class="summary-tile">
              <span class="summary-label">Record</span>
              ${renderRecordChips(model.profileCategorySnapshot)}
            </article>
            <article class="summary-tile">
              <span class="summary-label">Debates</span>
              <strong class="summary-value">${model.profileCategorySnapshot.debates}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Upcoming</span>
              <strong class="summary-value">${model.profileDebatesUpcomingFiltered.length}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Rank</span>
              <strong class="summary-value summary-value-compact">${escapeHtml(categoryRankLabel)}</strong>
              <span class="category-rating-meta">${escapeHtml(selectedCategory?.label || "Category")}</span>
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
            ${renderScrollablePanel(
              renderDebateList(model.profileDebatesUpcomingFiltered, {
                emptyTitle: "No upcoming debates",
                emptyCopy: "",
                showAdminControls: currentIsAdmin()
              }),
              "is-results"
            )}
          </section>

          <section class="section-panel">
            <div class="section-header">
              <div>
                <h3 class="section-title">Results</h3>
              </div>
            </div>
            ${renderScrollablePanel(
              renderDebateList(model.profileDebatesPastFiltered, {
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
              <strong class="summary-value record-total win">${model.profileCategorySnapshot.wins}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Losses</span>
              <strong class="summary-value record-total loss">${model.profileCategorySnapshot.losses}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Draws</span>
              <strong class="summary-value record-total draw">${drawLabel}</strong>
            </article>
            <article class="summary-tile">
              <span class="summary-label">Upcoming</span>
              <strong class="summary-value">${model.profileDebatesUpcomingFiltered.length}</strong>
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

    const winnerName = getDebateWinnerName(debate);
    const loserName = debate.status === "resolved"
      ? debate.result === "a"
        ? getDebateTeamLabel(debate, "b", "Team B")
        : debate.result === "b"
          ? getDebateTeamLabel(debate, "a", "Team A")
          : ""
      : "";
    const isAwaitingReview = isDebateAwaitingReview(debate);
    const resultDetailLabel = isAwaitingReview ? "Submitted" : "Winner";
    const resultDetailValue = isAwaitingReview ? getDebateSubmittedResultLabel(debate) : winnerName || "N/A";
    const resultToneClass = isAwaitingReview
      ? " is-review"
      : debate.status === "resolved" && debate.result === "draw"
        ? " is-draw"
        : debate.status === "resolved" && resultDetailValue && resultDetailValue !== "N/A"
          ? " is-winner"
          : "";
    const loserToneClass = debate.status === "resolved" && debate.result !== "draw" && loserName
      ? " is-loser"
      : "";
    const commentBusy = state.actionBusyKey === `${debate.id}:comment`;
    const videoBusy = state.actionBusyKey === `${debate.id}:video`;

    return `
      <section class="page-shell schedule-page">
        <section class="page-hero">
          <div class="page-hero-toolbar">
            <div>
              <span class="page-kicker">Debate</span>
              <h2 class="page-title">${escapeHtml(debate.topic || "Untitled debate")}</h2>
            </div>
            ${renderDebateEditButton(debate)}
          </div>

          ${renderDebatePeopleRow(debate)}

          <div class="detail-grid debate-detail-grid">
            <div class="detail-row">
              <span class="detail-label">Scheduled</span>
              <strong>${escapeHtml(formatDateTime(debate.scheduledFor))}</strong>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category</span>
              <strong>${escapeHtml(getDebateCategoryLabel(debate.category))}</strong>
            </div>
            <div class="detail-row${resultToneClass}">
              <span class="detail-label">${escapeHtml(resultDetailLabel)}</span>
              <strong>${
                isAwaitingReview || debate.result === "draw"
                  ? escapeHtml(resultDetailValue)
                  : renderTeamIdentityInline(debate, debate.result)
              }</strong>
            </div>
            <div class="detail-row${loserToneClass}">
              <span class="detail-label">Loser</span>
              <strong>${
                loserName
                  ? renderTeamIdentityInline(debate, debate.result === "a" ? "b" : "a")
                  : "N/A"
              }</strong>
            </div>
          </div>

        </section>

        ${renderDebateAdminTools(debate)}

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
              model.selectedDebateCanEditVideo && state.debateEditMode
                ? `
                  <form class="stack-form" id="debate-video-form">
                    <input type="hidden" name="debateId" value="${escapeHtml(debate.id)}" />
                  ${renderDebateVideoFormFields(debate, { inputNamePrefix: "desktop-debate-video" })}
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
            <h3 class="section-title">Future Debate</h3>
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
          ${renderDraftParticipantFields("schedule")}
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
              ${state.scheduleSaving ? "Logging..." : "Log future debate"}
            </button>
            <button class="ghost-btn" type="button" data-action="reset-schedule-form">Reset</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderLogDebatesPanel() {
    return `
      <section class="section-panel">
        <div class="section-header">
          <div>
            <h3 class="section-title">Past Debate</h3>
            <p class="section-copy">${currentIsAdmin() ? "Completed debates are added directly to results." : "Completed debates are sent to admin review."}</p>
          </div>
        </div>
        ${renderLogDebateFormMarkup()}
      </section>
    `;
  }

  function renderSchedulePage(model) {
    const scheduleSection = normalizeScheduleSection(state.scheduleSection);

    return `
      <section class="page-shell schedule-page">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Debate log</span>
            <h2 class="page-title">Log</h2>
          </div>
          ${renderScheduleTabs(scheduleSection)}
        </section>

        ${
          scheduleSection === "past"
            ? renderLogDebatesPanel()
            : renderScheduleFormPanel()
        }
      </section>
    `;
  }

  function renderArchivePage(model) {
    return `
      <section class="page-shell archive-page">
        <section class="page-hero">
          <div class="page-hero-toolbar">
            <div>
              <span class="page-kicker">Past Debates</span>
              <h2 class="page-title">Archive</h2>
            </div>
          </div>
        </section>

        <section class="section-panel archive-feed-panel">
          <div class="section-header">
            <div>
              <h3 class="section-title">Archive</h3>
            </div>
          </div>
          ${renderScrollablePanel(
            renderDebateList(model.past, {
              emptyTitle: state.searchTerm ? "No past debates match that search" : "No past debates yet",
              emptyCopy: "",
              hideStatus: true,
              showAdminControls: currentIsAdmin() && state.archiveEditMode
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
          <section class="page-hero">
            <div>
              <span class="page-kicker">Admin</span>
              <h2 class="page-title">Admin</h2>
            </div>
          </section>

          <section class="section-panel is-disabled-panel" aria-disabled="true">
            <div class="section-header">
              <div>
                <h3 class="section-title">Awaiting Results</h3>
                <p class="section-copy">Admin only</p>
              </div>
              <div class="section-actions">
                <button class="secondary-btn" type="button" data-page-link="schedule">Log</button>
              </div>
            </div>
            <div class="disabled-panel-copy">
              Submitted debates appear here for admins to accept or reject.
            </div>
          </section>
        </section>
      `;
    }
    return `
      <section class="page-shell">
        <section class="page-hero">
          <div>
            <span class="page-kicker">Admin</span>
            <h2 class="page-title">Resolve debates</h2>
          </div>
        </section>

        <section class="section-panel">
          <div class="section-header">
            <div>
              <h3 class="section-title">Awaiting Results</h3>
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
            <strong>${escapeHtml(getRatingDisplayValue(model.mySnapshot))}</strong>
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
                            <div class="mini-stat">${escapeHtml(getRatingDisplayValue(player))}</div>
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
        <div class="profile-record profile-record-single">
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
              ${getDebateTeamParticipants(debate, "a").map((entry, index) => {
                return `
                  <div class="mini-row">
                    <div class="mini-row-copy">${renderProfileLink(entry.name, entry.uid, "profile-link-strong", {
                      showAvatar: true,
                      avatarClassName: "profile-avatar"
                    })}</div>
                    <span class="mini-tag">${escapeHtml(index === 0 ? "A" : "A2")}</span>
                  </div>
                `;
              }).join("")}
              ${getDebateTeamParticipants(debate, "b").map((entry, index) => {
                return `
                  <div class="mini-row">
                    <div class="mini-row-copy">${renderProfileLink(entry.name, entry.uid, "profile-link-strong", {
                      showAvatar: true,
                      avatarClassName: "profile-avatar"
                    })}</div>
                    <span class="mini-tag">${escapeHtml(index === 0 ? "B" : "B2")}</span>
                  </div>
                `;
              }).join("")}
              <div class="mini-row">
                <div><strong>${escapeHtml(formatDisplayName(debate.moderator || "No moderator", "No Moderator"))}</strong></div>
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
            const nextRoleLabel = isAdminRole ? "Change to User" : "Change to Admin";
            const busy = state.actionBusyKey === `${safeUid}:role`;
            const canManageAccount = !entry.isPlaceholder;
            return `
              <article class="admin-user-card">
                <div class="admin-user-head">
                  <div class="admin-user-identity">
                    ${renderProfileIdentityContent(entry.username, safeUid, {
                      showAvatar: true,
                      avatarClassName: "profile-avatar profile-avatar-lg",
                      labelClassName: "profile-link-strong"
                    })}
                    <span class="admin-user-meta">${escapeHtml(safeUid)}${entry.isPlaceholder ? " • not signed up yet" : ""}</span>
                  </div>
                </div>
                <div class="admin-user-actions">
                  ${
                    canManageAccount
                      ? `
                        <button
                          class="secondary-btn admin-user-action-btn"
                          type="button"
                          data-action="admin-change-status"
                          data-profile-uid="${escapeHtml(safeUid)}"
                          ${busy ? "disabled" : ""}
                        >
                          ${busy ? "Saving..." : nextRoleLabel}
                        </button>
                      `
                      : ""
                  }
                  <button
                    class="secondary-btn admin-user-action-btn"
                    type="button"
                    data-action="admin-change-username"
                    data-profile-uid="${escapeHtml(safeUid)}"
                  >
                    Change Username
                  </button>
                  <button
                    class="secondary-btn admin-user-action-btn"
                    type="button"
                    data-action="admin-change-avatar"
                    data-profile-uid="${escapeHtml(safeUid)}"
                  >
                    Change Profile Picture
                  </button>
                  ${
                    canManageAccount
                      ? `
                        <button
                          class="ghost-btn admin-user-action-btn"
                          type="button"
                          data-action="admin-change-password"
                          data-profile-uid="${escapeHtml(safeUid)}"
                        >
                          Change Password
                        </button>
                      `
                      : ""
                  }
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
          .map((debate) =>
            renderDebateCard(debate, {
              showAdminControls: options.showAdminControls,
              hideStatus: options.hideStatus
            })
          )
          .join("")}
      </div>
    `;
  }

  function renderDebateCard(debate, options = {}) {
    const busyPrefix = `${debate.id}:`;
    const isBusy = state.actionBusyKey.startsWith(busyPrefix);
    const winnerName = getDebateWinnerName(debate);
    const debateStatus = getDebateStatus(debate);
    const isAwaitingReview = isDebateAwaitingReview(debate);
    const resultDetailLabel = isAwaitingReview ? "Submitted" : "Winner";
    const resultDetailValue = isAwaitingReview ? getDebateSubmittedResultLabel(debate) : winnerName || "N/A";
    const resultToneClass = isAwaitingReview
      ? " is-review"
      : debate.status === "resolved" && debate.result === "draw"
        ? " is-draw"
        : debate.status === "resolved" && resultDetailValue && resultDetailValue !== "N/A"
          ? " is-winner"
          : "";

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
            ${
              isAwaitingReview
                ? `<div class="debate-subline">Submitted by ${escapeHtml(formatDisplayName(debate.createdByName || "member", "Member"))}</div>`
                : ""
            }
          </div>
        </div>

        ${renderDebatePeopleRow(debate)}

        <div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Category</span>
            <strong>${escapeHtml(getDebateCategoryLabel(debate.category))}</strong>
          </div>
          <div class="detail-row${resultToneClass}">
            <span class="detail-label">${escapeHtml(resultDetailLabel)}</span>
            <strong>${
              isAwaitingReview || debate.result === "draw"
                ? escapeHtml(resultDetailValue)
                : renderTeamIdentityInline(debate, debate.result)
            }</strong>
          </div>
        </div>

        ${
          options.showAdminControls && currentIsAdmin() && (isAwaitingReview || debate.status === "scheduled")
            ? `
              <div class="admin-control-stack" data-action="hold-admin-controls">
                ${
                  isAwaitingReview
                    ? `
                      <div class="admin-actions">
                        <button
                          class="result-btn win"
                          type="button"
                          data-action="review-submitted-debate"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="accept"
                          ${isBusy ? "disabled" : ""}
                        >
                          Accept
                        </button>
                        <button
                          class="result-btn reopen"
                          type="button"
                          data-action="review-submitted-debate"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="decline"
                          ${isBusy ? "disabled" : ""}
                        >
                          Decline
                        </button>
                      </div>
                    `
                    : `
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
                          ${escapeHtml(getDebateTeamLabel(debate, "a", "Team A"))} wins
                        </button>
                        <button
                          class="result-btn win"
                          type="button"
                          data-action="claim-result"
                          data-debate-id="${escapeHtml(debate.id)}"
                          data-outcome="b"
                          ${isBusy ? "disabled" : ""}
                        >
                          ${escapeHtml(getDebateTeamLabel(debate, "b", "Team B"))} wins
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
                    `
                }
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function renderProfileIdentityContent(name, uid, options = {}) {
    const safeUid = String(uid || "").trim();
    const label = formatDisplayName(name || getNameForUid(safeUid), "Debater");
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
    const label = formatDisplayName(name || getNameForUid(safeUid), "Debater");
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

  function renderInlineProfileIdentity(name, uid, options = {}) {
    return renderProfileIdentityContent(name, uid, {
      showAvatar: true,
      avatarClassName: String(options.avatarClassName || "profile-avatar profile-avatar-inline").trim(),
      innerClassName: ["profile-identity-inline", options.innerClassName || ""].filter(Boolean).join(" "),
      labelClassName: ["profile-link-strong", options.labelClassName || ""].filter(Boolean).join(" ")
    });
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
    return renderProfileLink(name, uid, classes.join(" "), {
      showAvatar: true,
      avatarClassName: "profile-avatar profile-avatar-inline",
      innerClassName: "profile-identity-inline",
      labelClassName: "profile-link-strong"
    });
  }

  function renderStaticPersonBadge(name, uid = "", options = {}) {
    const classes = ["person-badge"];
    if (options?.isWinner) {
      classes.push("winner");
    }
    if (options?.isLoser) {
      classes.push("loser");
    }
    return `<span class="${classes.join(" ")}">${renderInlineProfileIdentity(name, uid)}</span>`;
  }

  function renderTeamIdentityInline(debate, teamId, options = {}) {
    const entries = getDebateTeamParticipants(debate, teamId);
    const fallback = options.fallback || (String(teamId || "").trim().toLowerCase() === "b" ? "Team B" : "Team A");
    if (!entries.length) {
      return escapeHtml(fallback);
    }
    return `
      <span class="team-inline-identity">
        ${entries
          .map((entry) => renderInlineProfileIdentity(entry.name, entry.uid, options))
          .join('<span class="team-joiner" aria-hidden="true">&amp;</span>')}
      </span>
    `;
  }

  function renderTeamParticipantGroup(debate, teamId, options = {}) {
    const entries = getDebateTeamParticipants(debate, teamId);
    const safeTeamId = String(teamId || "").trim().toLowerCase() === "b" ? "b" : "a";
    const badgeRenderer = options.static ? renderStaticPersonBadge : renderPersonBadge;
    const isWinner = debate?.status === "resolved" && debate?.result === safeTeamId;
    const isLoser = debate?.status === "resolved" && ["a", "b"].includes(String(debate?.result || "")) && debate?.result !== safeTeamId;
    const fallbackLabel = safeTeamId === "a" ? "Team A" : "Team B";
    if (!entries.length) {
      return `<span class="team-badge-group is-empty">${escapeHtml(fallbackLabel)}</span>`;
    }
    return `
      <span class="team-badge-group${entries.length > 1 ? " is-team" : ""}">
        ${entries
          .map((entry) => badgeRenderer(entry.name, entry.uid, { isWinner, isLoser }))
          .join('<span class="team-joiner" aria-hidden="true">&amp;</span>')}
      </span>
    `;
  }

  function renderDebatePeopleRow(debate, options = {}) {
    const rowClasses = ["people-row"];
    if (options.mobile) {
      rowClasses.push("mobile-row-people");
    }
    if (options.className) {
      rowClasses.push(String(options.className).trim());
    }

    return `
      <div class="${rowClasses.join(" ")}">
        ${renderTeamParticipantGroup(debate, "a", options)}
        <span class="mini-tag">vs</span>
        ${renderTeamParticipantGroup(debate, "b", options)}
      </div>
    `;
  }

  function getDraftFormSelector(owner = "schedule") {
    return owner === "lazy" ? "#lazy-debate-form" : "#schedule-form";
  }

  function getDraftFormElement(owner = "schedule") {
    return el.mainContent?.querySelector(getDraftFormSelector(owner)) || null;
  }

  function getDraftTeamLabel(owner, teamId, fallback = "") {
    const draft = getDraftState(owner);
    const teamSize = getDraftTeamSize(owner);
    if (!draft) {
      return fallback || (String(teamId || "").trim().toLowerCase() === "b" ? "Team B" : "Team A");
    }

    const safeTeamId = String(teamId || "").trim().toLowerCase() === "b" ? "b" : "a";
    const labels = getDraftTeamParticipantFields(safeTeamId, teamSize)
      .map((field) => getDraftDebaterQueryValue(owner, field))
      .map((value) => formatDisplayName(value, ""))
      .filter(Boolean);
    return labels.join(" & ") || fallback || (safeTeamId === "b" ? "Team B" : "Team A");
  }

  function getDebaterSelectLabel(field) {
    return getDraftParticipantMeta(field)?.label || "Debater";
  }

  function hasPublishedRating(rating) {
    return Boolean(rating?.isPublishedRating || (Number(rating?.debates || 0) >= MIN_RANKED_DEBATES));
  }

  function getRatingDisplayValue(rating) {
    return hasPublishedRating(rating) ? String(roundHalfAwayFromZero(rating?.ratingRounded ?? rating?.rating ?? ELO_BASELINE)) : "?";
  }

  function getCategoryMetaLabel(rating) {
    const debateCount = Math.max(0, Number(rating?.debates || 0));
    if (!hasPublishedRating(rating)) {
      return `Placement - ${debateCount}/${MIN_RANKED_DEBATES} debates`;
    }
    return `${getCategoryRankLabel(rating)} - ${debateCount} ${debateCount === 1 ? "debate" : "debates"}`;
  }

  function getCategoryRankLabel(rating) {
    if (!hasPublishedRating(rating)) {
      return "Placement";
    }
    const safeRank = Number(rating?.rank || 0);
    return rating?.isRanked && safeRank > 0 ? `#${safeRank}` : "Rated";
  }

  function renderVideoModeOptions(selectedMode) {
    const safeMode = normalizeVideoClipMode(selectedMode);
    return `
      <option value="full"${safeMode === "full" ? " selected" : ""}>Full Video</option>
      <option value="clip"${safeMode === "clip" ? " selected" : ""}>Part of Video</option>
    `;
  }

  function getVideoModeSelectKey(options = {}) {
    const owner = String(options.owner || "").trim();
    const resolveDebateId = String(options.resolveDebateId || "").trim();
    const inputNamePrefix = String(options.inputNamePrefix || "").trim();

    if (owner) return `video-mode-${owner}`;
    if (resolveDebateId) return `resolve-video-mode-${resolveDebateId}`;
    if (inputNamePrefix) return `${inputNamePrefix}-video-mode`;
    return "video-mode";
  }

  function renderVideoModeSelect(options = {}) {
    const safeMode = normalizeVideoClipMode(options.mode);
    const safeSelectKey = getVideoModeSelectKey(options);
    const inputAttributes = String(options.inputAttributes || "").trim();
    const selectedLabel = getVideoModeLabel(safeMode);

    return `
      <label class="field video-clip-mode-field">
        <span>Video</span>
        <div
          class="custom-select${state.openSelectKey === safeSelectKey ? " is-open" : ""}"
          data-select-root="${escapeHtml(safeSelectKey)}"
          data-video-mode-root="true"
        >
          <input
            type="hidden"
            value="${escapeHtml(safeMode)}"
            data-video-mode-input="true"
            ${inputAttributes}
          />
          <button
            class="custom-select-trigger"
            type="button"
            data-action="toggle-video-mode-select"
            data-select-key="${escapeHtml(safeSelectKey)}"
            aria-haspopup="listbox"
            aria-expanded="${state.openSelectKey === safeSelectKey ? "true" : "false"}"
          >
            <span class="custom-select-value">${escapeHtml(selectedLabel)}</span>
            <span class="custom-select-caret" aria-hidden="true"></span>
          </button>
          <div class="custom-select-menu${state.openSelectKey === safeSelectKey ? "" : " hidden"}" role="listbox" aria-label="Video mode">
            <div class="custom-select-options">
              ${[
                { value: "full", label: "Full Video" },
                { value: "clip", label: "Part of Video" }
              ]
                .map(({ value, label }) => `
                  <button
                    class="custom-select-option${safeMode === value ? " is-selected" : ""}"
                    type="button"
                    data-action="choose-video-mode"
                    data-value="${escapeHtml(value)}"
                  >
                    ${escapeHtml(label)}
                  </button>
                `)
                .join("")}
            </div>
          </div>
        </div>
      </label>
    `;
  }

  function renderVideoClipSliderFields(options = {}) {
    const safeMode = normalizeVideoClipMode(options.mode);
    const { startSeconds, endSeconds } = getVideoClipRangeValues(options.startValue, options.endValue);
    const startInputAttributes = String(options.startInputAttributes || "").trim();
    const endInputAttributes = String(options.endInputAttributes || "").trim();

    return `
      <div class="video-clip-slider-grid${safeMode === "clip" ? "" : " is-disabled"}" data-video-clip-group="true">
        <div class="video-clip-slider-card">
          <div class="video-clip-slider-values">
            <span class="video-clip-slider-head">
              <span>Start</span>
              <strong data-video-clip-display="start">${escapeHtml(formatVideoClipInput(startSeconds) || "0:00")}</strong>
            </span>
            <span class="video-clip-slider-head">
              <span>End</span>
              <strong data-video-clip-display="end">${escapeHtml(formatVideoClipInput(endSeconds) || "0:00")}</strong>
            </span>
          </div>
          <div class="video-clip-slider-shell">
            <div class="video-clip-slider-track" aria-hidden="true"></div>
            <div class="video-clip-slider-track video-clip-slider-track-active" aria-hidden="true"></div>
            <input
              class="video-clip-slider-input is-start"
              type="range"
              min="0"
              max="${VIDEO_CLIP_SLIDER_MAX_SECONDS}"
              step="${VIDEO_CLIP_SLIDER_STEP_SECONDS}"
              value="${startSeconds}"
              data-video-clip-role="start"
              ${safeMode === "clip" ? "" : "disabled"}
              ${startInputAttributes}
            />
            <input
              class="video-clip-slider-input is-end"
              type="range"
              min="0"
              max="${VIDEO_CLIP_SLIDER_MAX_SECONDS}"
              step="${VIDEO_CLIP_SLIDER_STEP_SECONDS}"
              value="${endSeconds}"
              data-video-clip-role="end"
              ${safeMode === "clip" ? "" : "disabled"}
              ${endInputAttributes}
            />
          </div>
        </div>
      </div>
    `;
  }

  function renderDraftVideoFields(owner, draft) {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const safeDraft = draft || {};
    const safeMode = normalizeVideoClipMode(safeDraft.videoMode);
    return `
      <div class="video-link-fields" data-video-link-owner="${escapeHtml(safeOwner)}">
        <label class="field">
          <span>YouTube link</span>
          <input
            type="url"
            name="videoUrl"
            data-draft-owner="${escapeHtml(safeOwner)}"
            data-draft-field="videoUrl"
            value="${escapeHtml(String(safeDraft.videoUrl || "").trim())}"
            placeholder="Optional YouTube link"
          />
        </label>
        <div class="field-row video-clip-row">
          ${renderVideoModeSelect({
            mode: safeDraft.videoMode,
            owner: safeOwner,
            inputAttributes: `name="videoMode" data-draft-owner="${escapeHtml(safeOwner)}" data-draft-field="videoMode"`
          })}
        </div>
        ${renderVideoClipSliderFields({
          mode: safeMode,
          startValue: safeDraft.videoClipStart,
          endValue: safeDraft.videoClipEnd,
          startInputAttributes: `name="videoClipStart" data-draft-owner="${escapeHtml(safeOwner)}" data-draft-field="videoClipStart"`,
          endInputAttributes: `name="videoClipEnd" data-draft-owner="${escapeHtml(safeOwner)}" data-draft-field="videoClipEnd"`
        })}
        <p class="video-clip-note">Use the slider handles to choose the part shown when Part of Video is selected.</p>
      </div>
    `;
  }

  function renderDebateVideoFormFields(debate, options = {}) {
    const safeDebate = debate || {};
    const inputNamePrefix = String(options.inputNamePrefix || "").trim();
    const useNames = options.useNames !== false;
    const safePrefix = inputNamePrefix ? `${inputNamePrefix}-` : "";
    const mode = normalizeVideoClipMode(safeDebate.videoClipMode);

    return `
      <div class="video-link-fields">
        <label class="field${options.wrapperClassName ? ` ${escapeHtml(options.wrapperClassName)}` : ""}">
          <span>YouTube link</span>
          <input
            type="url"
            ${useNames ? 'name="videoUrl"' : ""}
            ${options.resolveDebateId ? `data-resolve-video-input="${escapeHtml(options.resolveDebateId)}"` : ""}
            value="${escapeHtml(String(safeDebate.videoUrl || "").trim())}"
            placeholder="Optional YouTube link"
          />
        </label>
        <div class="field-row video-clip-row">
          ${renderVideoModeSelect({
            mode,
            resolveDebateId: options.resolveDebateId,
            inputNamePrefix: safePrefix ? safePrefix.replace(/-$/, "") : "debate-video",
            inputAttributes: `${useNames ? 'name="videoMode"' : ""} ${options.resolveDebateId ? `data-resolve-video-mode="${escapeHtml(options.resolveDebateId)}"` : ""} id="${escapeHtml(`${safePrefix}video-mode`)}"`
          })}
        </div>
        ${renderVideoClipSliderFields({
          mode,
          startValue: safeDebate.videoClipStart,
          endValue: safeDebate.videoClipEnd,
          startInputAttributes: `${useNames ? 'name="videoClipStart"' : ""} ${options.resolveDebateId ? `data-resolve-video-start="${escapeHtml(options.resolveDebateId)}"` : ""} id="${escapeHtml(`${safePrefix}video-start`)}"`,
          endInputAttributes: `${useNames ? 'name="videoClipEnd"' : ""} ${options.resolveDebateId ? `data-resolve-video-end="${escapeHtml(options.resolveDebateId)}"` : ""} id="${escapeHtml(`${safePrefix}video-end`)}"`
        })}
        <p class="video-clip-note">Use the slider handles to choose the exact clip shown when Part of Video is selected.</p>
      </div>
    `;
  }

  function buildDebateVideoPayload(videoUrl, options = {}) {
    const safeVideoUrl = String(videoUrl || "").trim();
    const clipMode = normalizeVideoClipMode(options.mode);
    const clipStart = clipMode === "clip" ? parseVideoClipSeconds(options.start) : null;
    const clipEnd = clipMode === "clip" ? parseVideoClipSeconds(options.end) : null;
    const embedUrl = safeVideoUrl
      ? getYouTubeEmbedUrl(safeVideoUrl, {
          startSeconds: clipStart,
          endSeconds: clipEnd
        })
      : "";
    if (safeVideoUrl && !embedUrl) {
      return null;
    }
    if (safeVideoUrl && clipMode === "clip" && (!Number.isFinite(clipStart) || !Number.isFinite(clipEnd) || clipEnd <= clipStart)) {
      return null;
    }

    return {
      videoUrl: safeVideoUrl,
      videoEmbedUrl: embedUrl,
      videoClipMode: safeVideoUrl ? clipMode : "full",
      videoClipStart: safeVideoUrl && clipMode === "clip" ? clipStart : null,
      videoClipEnd: safeVideoUrl && clipMode === "clip" ? clipEnd : null,
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
    return currentIsAdmin() && state.currentPage === "admin" && debate?.status === "scheduled";
  }

  function renderResolveVideoField(debate, options = {}) {
    if (!shouldShowResolveVideoField(debate)) return "";

    const safeDebateId = String(debate?.id || "").trim();

    return `
      <div class="admin-video-field${options.mobile ? " is-mobile" : ""}" data-action="hold-admin-controls">
        ${renderDebateVideoFormFields(debate, {
          useNames: false,
          resolveDebateId: safeDebateId
        })}
      </div>
    `;
  }

  function renderProfileRatingHistoryPanel(categoryRating, historyPoints, options = {}) {
    const safeCategory = categoryRating || null;
    const safeHistory = Array.isArray(historyPoints) ? historyPoints : [];
    const label = safeCategory?.label || "Category";
    const published = hasPublishedRating(safeCategory);
    const latestPoint = safeHistory[safeHistory.length - 1] || null;

    if (!published || !safeHistory.length) {
      const debateCount = Math.max(0, Number(safeCategory?.debates || 0));
      const emptyCopy = debateCount
        ? `Placement history appears after ${MIN_RANKED_DEBATES} debates in ${label}.`
        : `No ${label.toLowerCase()} debates yet.`;

      return `
        <section class="profile-history-panel${options.mobile ? " is-mobile" : ""}">
          <div class="profile-history-head">
            <div>
              <span class="summary-label">ELO History</span>
              <h3 class="profile-history-title">${escapeHtml(label)}</h3>
            </div>
            <div class="profile-history-current">
              <span>Current</span>
              <strong>${escapeHtml(getRatingDisplayValue(safeCategory))}</strong>
            </div>
          </div>
          <div class="profile-history-empty">
            <strong>History not unlocked yet</strong>
            <span>${escapeHtml(emptyCopy)}</span>
          </div>
        </section>
      `;
    }

    return `
      <section class="profile-history-panel${options.mobile ? " is-mobile" : ""}">
        <div class="profile-history-head">
          <div>
            <span class="summary-label">ELO History</span>
            <h3 class="profile-history-title">${escapeHtml(label)}</h3>
          </div>
          <div class="profile-history-current">
            <span>Current</span>
            <strong>${escapeHtml(getRatingDisplayValue(safeCategory))}</strong>
          </div>
        </div>
        ${renderProfileRatingChart(safeHistory, {
          categoryLabel: label
        })}
        <div class="profile-history-foot">
          <span>${escapeHtml(`${safeHistory.length} ${safeHistory.length === 1 ? "rating update" : "rating updates"}`)}</span>
          <span>${escapeHtml(formatShortDate(safeHistory[0]?.at))} - ${escapeHtml(formatShortDate(latestPoint?.at))}</span>
        </div>
      </section>
    `;
  }

  function renderProfileRatingChart(historyPoints, options = {}) {
    const safeHistory = (Array.isArray(historyPoints) ? historyPoints : []).filter((point) => {
      return Number.isFinite(Number(point?.at || 0)) && Number.isFinite(Number(point?.ratingRounded ?? point?.rating));
    });

    if (!safeHistory.length) {
      return "";
    }

    const chartWidth = 720;
    const chartHeight = 280;
    const paddingTop = 24;
    const paddingRight = 24;
    const paddingBottom = 46;
    const paddingLeft = 54;
    const innerWidth = chartWidth - paddingLeft - paddingRight;
    const innerHeight = chartHeight - paddingTop - paddingBottom;
    const ratingValues = safeHistory.map((point) => roundHalfAwayFromZero(point.ratingRounded ?? point.rating));
    const rawMin = Math.min(...ratingValues);
    const rawMax = Math.max(...ratingValues);
    const spread = rawMax - rawMin;
    const ratingPadding = spread > 0 ? Math.max(18, Math.round(spread * 0.18)) : 24;
    const minRating = Math.floor((rawMin - ratingPadding) / 10) * 10;
    const maxRating = Math.ceil((rawMax + ratingPadding) / 10) * 10;
    const firstAt = Number(safeHistory[0].at || 0);
    const lastAt = Number(safeHistory[safeHistory.length - 1].at || firstAt);
    const useTimeScale = safeHistory.length > 1 && lastAt > firstAt;

    function getX(point, index) {
      if (safeHistory.length === 1) {
        return paddingLeft + (innerWidth / 2);
      }
      if (!useTimeScale) {
        return paddingLeft + ((innerWidth / Math.max(1, safeHistory.length - 1)) * index);
      }
      return paddingLeft + (((Number(point.at || firstAt) - firstAt) / Math.max(1, lastAt - firstAt)) * innerWidth);
    }

    function getY(value) {
      const safeValue = Number(value) || 0;
      return paddingTop + (((maxRating - safeValue) / Math.max(1, maxRating - minRating)) * innerHeight);
    }

    const points = safeHistory.map((point, index) => ({
      ...point,
      displayRating: roundHalfAwayFromZero(point.ratingRounded ?? point.rating),
      x: getX(point, index),
      y: getY(point.ratingRounded ?? point.rating)
    }));

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    const areaPath =
      points.length > 1
        ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(paddingTop + innerHeight).toFixed(2)} L ${points[0].x.toFixed(2)} ${(paddingTop + innerHeight).toFixed(2)} Z`
        : "";
    const tickCount = 4;
    const yTicks = [...new Set(
      Array.from({ length: tickCount }, (_, index) => {
        if (tickCount === 1) return maxRating;
        const ratio = index / (tickCount - 1);
        return roundHalfAwayFromZero(maxRating - ((maxRating - minRating) * ratio));
      })
    )];
    const labelIndexes =
      points.length === 1 ? [0] : points.length === 2 ? [0, 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
    const uniqueLabelIndexes = [...new Set(labelIndexes)];
    const gradientId = `profile-history-fill-${String(options.categoryLabel || "category")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") || "category"}-${Math.abs(firstAt)}-${safeHistory.length}`;

    return `
      <div class="profile-history-chart-shell" data-profile-history-chart="true">
        <div class="profile-history-tooltip" data-profile-history-tooltip="true" aria-live="polite">
          <span class="profile-history-tooltip-date" data-profile-history-tooltip-date="true"></span>
          <strong class="profile-history-tooltip-rating" data-profile-history-tooltip-rating="true"></strong>
          <span class="profile-history-tooltip-meta" data-profile-history-tooltip-meta="true"></span>
        </div>
        <svg
          class="profile-history-chart"
          viewBox="0 0 ${chartWidth} ${chartHeight}"
          role="img"
          aria-label="${escapeHtml(options.categoryLabel || "Category")} ELO history"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="${escapeHtml(gradientId)}" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" class="profile-history-gradient-start"></stop>
              <stop offset="100%" class="profile-history-gradient-end"></stop>
            </linearGradient>
          </defs>
          ${yTicks
            .map((tick) => {
              const y = getY(tick);
              return `
                <line class="profile-history-grid-line" x1="${paddingLeft}" y1="${y}" x2="${chartWidth - paddingRight}" y2="${y}"></line>
                <text class="profile-history-axis-text" x="${paddingLeft - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(String(tick))}</text>
              `;
            })
            .join("")}
          ${uniqueLabelIndexes
            .map((index) => {
              const point = points[index];
              return `
                <line
                  class="profile-history-grid-line profile-history-grid-line-vertical"
                  x1="${point.x}"
                  y1="${paddingTop}"
                  x2="${point.x}"
                  y2="${paddingTop + innerHeight}"
                ></line>
              `;
            })
            .join("")}
          ${
            areaPath
              ? `<path class="profile-history-area" d="${areaPath}" fill="url(#${escapeHtml(gradientId)})"></path>`
              : ""
          }
          ${points.length > 1 ? `<path class="profile-history-line" d="${linePath}"></path>` : ""}
          ${points
            .map((point, index) => {
              const previousPoint = index > 0 ? points[index - 1] : null;
              const delta = previousPoint ? point.displayRating - previousPoint.displayRating : 0;
              const deltaLabel = previousPoint
                ? delta === 0
                  ? "No change from previous"
                  : `${delta > 0 ? "+" : ""}${delta} from previous`
                : "Starting point";
              return `
                <g class="profile-history-point-group" data-chart-point-group="${index}">
                  <line
                    class="profile-history-focus-line"
                    x1="${point.x}"
                    y1="${paddingTop}"
                    x2="${point.x}"
                    y2="${paddingTop + innerHeight}"
                  ></line>
                  <circle class="profile-history-point-halo" cx="${point.x}" cy="${point.y}" r="8.5"></circle>
                  <circle class="profile-history-point" cx="${point.x}" cy="${point.y}" r="5.25"></circle>
                  <circle
                    class="profile-history-hit-area"
                    cx="${point.x}"
                    cy="${point.y}"
                    r="18"
                    tabindex="0"
                    focusable="true"
                    role="button"
                    aria-label="${escapeHtml(`${formatRelativeStamp(point.at)} — ${point.displayRating}`)}"
                    data-chart-point-index="${index}"
                    data-chart-ratio-x="${(point.x / chartWidth).toFixed(6)}"
                    data-chart-ratio-y="${(point.y / chartHeight).toFixed(6)}"
                    data-chart-date="${escapeHtml(formatRelativeStamp(point.at))}"
                    data-chart-rating="${escapeHtml(String(point.displayRating))}"
                    data-chart-meta="${escapeHtml(deltaLabel)}"
                  ></circle>
                </g>
              `;
            })
            .join("")}
          ${uniqueLabelIndexes
            .map((index) => {
              const point = points[index];
              const anchor = point.x <= paddingLeft + 24 ? "start" : point.x >= chartWidth - paddingRight - 24 ? "end" : "middle";
              const labelX =
                anchor === "start"
                  ? point.x + 4
                  : anchor === "end"
                    ? point.x - 4
                    : point.x;
              return `
                <text class="profile-history-axis-text" x="${labelX}" y="${chartHeight - 10}" text-anchor="${anchor}">
                  ${escapeHtml(formatShortDate(point.at))}
                </text>
              `;
            })
            .join("")}
        </svg>
      </div>
    `;
  }

  function setActiveProfileHistoryPoint(chartRoot, index) {
    if (!(chartRoot instanceof HTMLElement)) return false;
    const pointNodes = Array.from(chartRoot.querySelectorAll("[data-chart-point-index]"));
    const tooltip = chartRoot.querySelector("[data-profile-history-tooltip]");
    const tooltipDate = chartRoot.querySelector("[data-profile-history-tooltip-date]");
    const tooltipRating = chartRoot.querySelector("[data-profile-history-tooltip-rating]");
    const tooltipMeta = chartRoot.querySelector("[data-profile-history-tooltip-meta]");
    const svg = chartRoot.querySelector(".profile-history-chart");

    if (!pointNodes.length || !(tooltip instanceof HTMLElement) || !(svg instanceof SVGElement)) {
      return false;
    }

    const safeIndex = Math.max(0, Math.min(pointNodes.length - 1, Number(index) || 0));
    const activeNode = pointNodes[safeIndex];
    const svgRect = svg.getBoundingClientRect();
    const shellRect = chartRoot.getBoundingClientRect();
    const ratioX = Math.max(0, Math.min(1, Number(activeNode.getAttribute("data-chart-ratio-x") || 0)));
    const ratioY = Math.max(0, Math.min(1, Number(activeNode.getAttribute("data-chart-ratio-y") || 0)));
    const x = (svgRect.left - shellRect.left) + (ratioX * svgRect.width);
    const y = (svgRect.top - shellRect.top) + (ratioY * svgRect.height);

    pointNodes.forEach((node, nodeIndex) => {
      const isActive = nodeIndex === safeIndex;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-current", isActive ? "true" : "false");
      const group = node.closest("[data-chart-point-group]");
      if (group) {
        group.classList.toggle("is-active", isActive);
      }
    });

    chartRoot.style.setProperty("--profile-history-tooltip-x", `${x.toFixed(2)}px`);
    chartRoot.style.setProperty("--profile-history-tooltip-y", `${y.toFixed(2)}px`);
    chartRoot.classList.toggle("is-tooltip-left", ratioX > 0.72);
    chartRoot.classList.toggle("is-tooltip-right", ratioX < 0.28);
    chartRoot.dataset.activeChartIndex = String(safeIndex);

    if (tooltipDate) {
      tooltipDate.textContent = String(activeNode.getAttribute("data-chart-date") || "");
    }
    if (tooltipRating) {
      tooltipRating.textContent = String(activeNode.getAttribute("data-chart-rating") || "");
    }
    if (tooltipMeta) {
      tooltipMeta.textContent = String(activeNode.getAttribute("data-chart-meta") || "");
    }

    tooltip.classList.add("is-visible");
    return true;
  }

  function syncProfileHistoryCharts(scope = el.mainContent) {
    const root = scope instanceof HTMLElement ? scope : document;
    let found = false;

    root.querySelectorAll("[data-profile-history-chart]").forEach((chartRoot) => {
      if (!(chartRoot instanceof HTMLElement)) return;
      found = true;

      const pointNodes = Array.from(chartRoot.querySelectorAll("[data-chart-point-index]"));
      if (!pointNodes.length) return;

      if (chartRoot.dataset.chartBound !== "true") {
        pointNodes.forEach((node, index) => {
          node.addEventListener("pointerenter", () => {
            setActiveProfileHistoryPoint(chartRoot, index);
          });
          node.addEventListener("click", () => {
            setActiveProfileHistoryPoint(chartRoot, index);
          });
          node.addEventListener("focus", () => {
            setActiveProfileHistoryPoint(chartRoot, index);
          });
          node.addEventListener("keydown", (event) => {
            if (!(event instanceof KeyboardEvent)) return;

            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              const nextIndex = Math.max(0, index - 1);
              pointNodes[nextIndex]?.focus();
              setActiveProfileHistoryPoint(chartRoot, nextIndex);
              return;
            }

            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              const nextIndex = Math.min(pointNodes.length - 1, index + 1);
              pointNodes[nextIndex]?.focus();
              setActiveProfileHistoryPoint(chartRoot, nextIndex);
              return;
            }

            if (event.key === "Home") {
              event.preventDefault();
              pointNodes[0]?.focus();
              setActiveProfileHistoryPoint(chartRoot, 0);
              return;
            }

            if (event.key === "End") {
              event.preventDefault();
              pointNodes[pointNodes.length - 1]?.focus();
              setActiveProfileHistoryPoint(chartRoot, pointNodes.length - 1);
            }
          });
        });
        chartRoot.dataset.chartBound = "true";
      }

      const activeIndex = Number(chartRoot.dataset.activeChartIndex || pointNodes.length - 1);
      setActiveProfileHistoryPoint(chartRoot, activeIndex);
    });

    return found;
  }

  function renderCategoryRatingGrid(categoryRatings, options = {}) {
    const ratings = Array.isArray(categoryRatings) ? categoryRatings : [];
    const interactive = Boolean(options.interactive);
    const preferredCategoryId = String(options.preferredCategoryId || "").trim();
    const selectedCategoryId = String(options.selectedCategoryId || preferredCategoryId).trim();
    const mobile = Boolean(options.mobile);
    const gridClassName = mobile ? "mobile-category-grid" : "category-rating-grid";
    const cardClassName = mobile ? "mobile-category-card" : "category-rating-card";
    const wrapperAttributes = interactive
      ? ' role="tablist" aria-label="Profile categories"'
      : "";

    return `
      <div class="${gridClassName}"${wrapperAttributes}>
        ${ratings
          .map((rating) => {
            const isPreferred = rating.id === preferredCategoryId;
            const isSelected = rating.id === selectedCategoryId;
            const tagName = interactive ? "button" : "article";
            const actionAttributes = interactive
              ? ` type="button" role="tab" aria-selected="${isSelected ? "true" : "false"}" data-action="set-profile-category" data-value="${escapeHtml(rating.id)}"`
              : "";

            return `
              <${tagName}
                class="${cardClassName}${isPreferred ? " is-featured" : ""}${isSelected ? " is-selected" : ""}${interactive ? " is-clickable" : ""}"${actionAttributes}
              >
                <span class="summary-label">${escapeHtml(rating.label)}</span>
                <strong class="category-rating-value">${escapeHtml(getRatingDisplayValue(rating))}</strong>
                <span class="category-rating-meta">${escapeHtml(getCategoryMetaLabel(rating))}</span>
              </${tagName}>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderLeaderboardTabs(selectedCategory) {
    const safeCategory = normalizeRankingsCategory(selectedCategory);

    return `
      <div class="leaderboard-tabs rankings-tabs" role="tablist" aria-label="Ranking categories">
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
    const activeResult = lazyDraft.result === "b" || lazyDraft.result === "draw" ? lazyDraft.result : "a";
    const debaterALabel = getDraftTeamLabel("lazy", "a", "Team A");
    const debaterBLabel = getDraftTeamLabel("lazy", "b", "Team B");

    function renderWinnerButton(value, label, toneClass, activeCopy) {
      const isActive = activeResult === value;
      return `
        <button
          class="result-btn ${toneClass}${isActive ? " is-active" : ""}"
          type="button"
          data-action="set-lazy-result"
          data-value="${escapeHtml(value)}"
          aria-pressed="${isActive ? "true" : "false"}"
        >
          <span class="winner-btn-copy">
            <span class="winner-btn-title">${escapeHtml(label)}</span>
            <span class="winner-btn-note">${escapeHtml(isActive ? activeCopy : "Tap to select")}</span>
          </span>
          <span class="winner-btn-indicator" aria-hidden="true">${isActive ? "Selected" : ""}</span>
        </button>
      `;
    }

    return `
      ${renderWinnerButton("a", debaterALabel, "win", "Winner selected")}
      ${renderWinnerButton("b", debaterBLabel, "win", "Winner selected")}
      ${renderWinnerButton("draw", "Draw", "draw", "Draw selected")}
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
      if (
        !field ||
        field === "category" ||
        field === "teamSize" ||
        DEBATE_PARTICIPANT_FIELD_META.some((entry) => entry.field === field)
      ) return;
      const nextValue = String(draft[field] ?? "");
      if (node.value !== nextValue) {
        node.value = nextValue;
      }
    });

    const participantShell = form.querySelector(`[data-draft-participants-owner="${safeOwner}"]`);
    if (participantShell) {
      participantShell.outerHTML = renderDraftParticipantFields(safeOwner);
    }

    syncCategorySelectUi(safeOwner);

    if (safeOwner === "lazy") {
      syncLazyResultUi();
    }

    return true;
  }

  function renderResultCopy(debate) {
    if (isDebateAwaitingReview(debate)) {
      return `Awaiting admin - ${getDebateSubmittedResultLabel(debate)}`;
    }
    if (debate.status !== "resolved") return "Pending";
    if (debate.result === "draw") return "Draw";
    if (debate.result === "a" || debate.result === "b") {
      return `Winner: ${getDebateResultTeamLabel(debate, debate.result, "Winner")}`;
    }
    return "Resolved";
  }

  function getDebateSubmittedResultLabel(debate) {
    if (!debate) return "Pending";
    if (debate.result === "draw") return "Draw";
    if (debate.result === "a") {
      return getDebateResultTeamLabel(debate, "a", "Team A");
    }
    if (debate.result === "b") {
      return getDebateResultTeamLabel(debate, "b", "Team B");
    }
    return "Pending";
  }

  function renderArchiveEditButton(options = {}) {
    if (!currentIsAdmin()) return "";
    const mobile = Boolean(options.mobile);
    return `
      <button
        class="secondary-btn archive-edit-btn${mobile ? " archive-edit-btn-mobile" : ""}"
        type="button"
        data-action="toggle-archive-edit"
      >
        ${state.archiveEditMode ? "Done" : "Edit"}
      </button>
    `;
  }

  function renderDebateEditButton(debate, options = {}) {
    if (!canToggleDebateEdit(debate)) return "";
    const mobile = Boolean(options.mobile);
    return `
      <button
        class="secondary-btn archive-edit-btn${mobile ? " archive-edit-btn-mobile" : ""}"
        type="button"
        data-action="toggle-debate-edit"
      >
        ${state.debateEditMode ? "Done" : "Edit"}
      </button>
    `;
  }

  function renderDebateDateEditForm(debate, options = {}) {
    if (!currentIsAdmin() || !debate) return "";
    const mobile = Boolean(options.mobile);
    const safeDebateId = String(debate.id || "").trim();
    const isBusy = state.actionBusyKey === `${safeDebateId}:date`;

    return `
      <form class="stack-form debate-date-edit-form${mobile ? " is-mobile" : ""}" id="debate-date-form">
        <input type="hidden" name="debateId" value="${escapeHtml(safeDebateId)}" />
        <label class="field">
          <span>Debate date and time</span>
          <input
            type="datetime-local"
            name="scheduledFor"
            value="${escapeHtml(formatDateTimeLocalInputValue(debate.scheduledFor))}"
            ${isBusy ? "disabled" : ""}
          />
        </label>
        <div class="form-actions">
          <button class="secondary-btn" type="submit" ${isBusy ? "disabled" : ""}>
            ${isBusy ? "Saving..." : "Save Date"}
          </button>
        </div>
      </form>
    `;
  }

  function getDebateParticipantEditValue(debate, field) {
    const meta = getDraftParticipantMeta(field);
    if (!meta || !debate) return "";

    return (
      normalizeUsername(debate[meta.nameField] || "") ||
      normalizeUsername(getPlaceholderUsername(debate[meta.field])) ||
      normalizeUsername(getNameForUid(debate[meta.field], "")) ||
      ""
    );
  }

  function renderDebateDetailsEditForm(debate, options = {}) {
    if (!currentIsAdmin() || !debate) return "";

    const mobile = Boolean(options.mobile);
    const safeDebateId = String(debate.id || "").trim();
    const teamSize = getDebateTeamSize(debate, 1);
    const isBusy = state.actionBusyKey === `${safeDebateId}:details`;

    function renderParticipantField(field) {
      const meta = getDraftParticipantMeta(field);
      if (!meta) return "";

      const active = getActiveDraftParticipantFields(teamSize).includes(field);
      return `
        <label class="field" data-debate-details-participant="${escapeHtml(field)}" ${active ? "" : "hidden"}>
          <span>${escapeHtml(meta.label)}</span>
          <input
            type="text"
            name="${escapeHtml(field)}"
            value="${escapeHtml(getDebateParticipantEditValue(debate, field))}"
            placeholder="username"
            ${isBusy ? "disabled" : ""}
          />
        </label>
      `;
    }

    return `
      <form class="stack-form debate-details-edit-form${mobile ? " is-mobile" : ""}" id="debate-details-form">
        <input type="hidden" name="debateId" value="${escapeHtml(safeDebateId)}" />
        <label class="field">
          <span>Debate name</span>
          <input
            type="text"
            name="topic"
            value="${escapeHtml(String(debate.topic || "").trim())}"
            ${isBusy ? "disabled" : ""}
          />
        </label>
        <div class="field-row">
          <label class="field">
            <span>Category</span>
            <select name="category" ${isBusy ? "disabled" : ""}>
              ${DEBATE_CATEGORIES.map((category) => `
                <option value="${escapeHtml(category.id)}" ${normalizeDebateCategory(debate.category) === category.id ? "selected" : ""}>
                  ${escapeHtml(category.label)}
                </option>
              `).join("")}
            </select>
          </label>
          <label class="field">
            <span>Format</span>
            <select name="teamSize" data-debate-details-team-size ${isBusy ? "disabled" : ""}>
              ${DEBATE_TEAM_OPTIONS.map((option) => `
                <option value="${escapeHtml(String(option.id))}" ${teamSize === option.id ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `).join("")}
            </select>
          </label>
        </div>
        <div class="debate-team-grid${teamSize !== 1 ? " is-expanded" : ""}${teamSize === 2 ? " is-2v2" : ""}${teamSize === 3 ? " is-2v1" : ""}" data-debate-details-participants>
          <section class="debate-team-card">
            <span class="summary-label">Team A</span>
            <div class="debate-team-fields">
              ${renderParticipantField("debaterAUid")}
              ${renderParticipantField("debaterA2Uid")}
            </div>
          </section>
          <section class="debate-team-card">
            <span class="summary-label">Team B</span>
            <div class="debate-team-fields">
              ${renderParticipantField("debaterBUid")}
              ${renderParticipantField("debaterB2Uid")}
            </div>
          </section>
        </div>
        <label class="field">
          <span>Moderator</span>
          <input
            type="text"
            name="moderator"
            value="${escapeHtml(String(debate.moderator || "").trim())}"
            ${isBusy ? "disabled" : ""}
          />
        </label>
        <div class="form-actions">
          <button class="secondary-btn" type="submit" ${isBusy ? "disabled" : ""}>
            ${isBusy ? "Saving..." : "Save Details"}
          </button>
        </div>
      </form>
    `;
  }

  function renderDebateAdminTools(debate, options = {}) {
    if (!currentIsAdmin() || !state.debateEditMode || !debate) return "";

    const isBusy = state.actionBusyKey.startsWith(`${debate.id}:`);
    const isAwaitingReview = isDebateAwaitingReview(debate);
    const mobile = Boolean(options.mobile);
    const shellClassName = mobile ? "mobile-block" : "section-panel";
    const stackClassName = mobile ? "mobile-admin-stack" : "admin-control-stack";
    const actionsClassName = mobile ? "mobile-admin-actions" : "admin-actions";
    const headingMarkup = mobile
      ? `
          <div class="mobile-section-head">
            <h3>Edit Debate</h3>
          </div>
        `
      : `
          <div class="section-header">
            <div>
              <h3 class="section-title">Edit Debate</h3>
            </div>
          </div>
        `;

    let content = "";
    if (isAwaitingReview) {
      content = `
        ${renderDebateDetailsEditForm(debate, { mobile })}
        ${renderDebateDateEditForm(debate, { mobile })}
        <div class="mini-copy">Submitted by ${escapeHtml(formatDisplayName(debate.createdByName || "member", "Member"))}</div>
        <div class="${actionsClassName}">
          <button
            class="result-btn win"
            type="button"
            data-action="review-submitted-debate"
            data-debate-id="${escapeHtml(debate.id)}"
            data-outcome="accept"
            ${isBusy ? "disabled" : ""}
          >
            Accept
          </button>
          <button
            class="result-btn reopen"
            type="button"
            data-action="review-submitted-debate"
            data-debate-id="${escapeHtml(debate.id)}"
            data-outcome="decline"
            ${isBusy ? "disabled" : ""}
          >
            Decline
          </button>
        </div>
      `;
    } else if (debate.status === "scheduled") {
      content = `
        ${renderDebateDetailsEditForm(debate, { mobile })}
        ${renderDebateDateEditForm(debate, { mobile })}
        ${renderResolveVideoField(debate, mobile ? { mobile: true } : {})}
        <div class="${actionsClassName}">
          <button
            class="result-btn win"
            type="button"
            data-action="claim-result"
            data-debate-id="${escapeHtml(debate.id)}"
            data-outcome="a"
            ${isBusy ? "disabled" : ""}
          >
            ${escapeHtml(getDebateTeamLabel(debate, "a", "Team A"))}
          </button>
          <button
            class="result-btn win"
            type="button"
            data-action="claim-result"
            data-debate-id="${escapeHtml(debate.id)}"
            data-outcome="b"
            ${isBusy ? "disabled" : ""}
          >
            ${escapeHtml(getDebateTeamLabel(debate, "b", "Team B"))}
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
      `;
    } else if (debate.status === "resolved") {
      content = `
        ${renderDebateDetailsEditForm(debate, { mobile })}
        ${renderDebateDateEditForm(debate, { mobile })}
        <div class="${actionsClassName}">
          <button
            class="result-btn win"
            type="button"
            data-action="claim-result"
            data-debate-id="${escapeHtml(debate.id)}"
            data-outcome="a"
            ${isBusy ? "disabled" : ""}
          >
            ${escapeHtml(getDebateTeamLabel(debate, "a", "Team A"))}
          </button>
          <button
            class="result-btn win"
            type="button"
            data-action="claim-result"
            data-debate-id="${escapeHtml(debate.id)}"
            data-outcome="b"
            ${isBusy ? "disabled" : ""}
          >
            ${escapeHtml(getDebateTeamLabel(debate, "b", "Team B"))}
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
        </div>
      `;
    }

    if (!content) return "";

    return `
      <section class="${shellClassName}">
        ${headingMarkup}
        <div class="${stackClassName}" data-action="hold-admin-controls">
          ${content}
        </div>
      </section>
    `;
  }

  function getDebateWinnerName(debate) {
    if (!debate || debate.status !== "resolved" || debate.result === "draw") {
      return "";
    }

    if (debate.result === "a") {
      return getDebateResultTeamLabel(debate, "a", "Team A");
    }

    if (debate.result === "b") {
      return getDebateResultTeamLabel(debate, "b", "Team B");
    }

    return formatDisplayName(debate.winnerName || "", "");
  }

  function renderRecordChips(player, options = {}) {
    const compact = Boolean(options.compact);
    const showDraws = options.showDraws !== false;
    const labelStyle = String(options.labelStyle || "").trim().toLowerCase();
    const winLabel = labelStyle === "full" ? "Win" : "W";
    const lossLabel = labelStyle === "full" ? "Loss" : "L";
    const drawLabel = labelStyle === "full" ? "Draw" : "D";
    const items = [
      { tone: "win", label: winLabel, value: Number(player?.wins || 0) },
      { tone: "loss", label: lossLabel, value: Number(player?.losses || 0) }
    ];

    if (showDraws) {
      items.push({ tone: "draw", label: drawLabel, value: Number(player?.draws || 0) });
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
                  <td class="rating-cell">${escapeHtml(getRatingDisplayValue(player))}</td>
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

  function syncDebaterSelectFilter(selectKey) {
    const safeSelectKey = String(selectKey || "").trim();
    const root = el.mainContent?.querySelector(`[data-select-root="${safeSelectKey}"]`);
    if (!root) return;

    const field = String(root.getAttribute("data-select-field") || "").trim();
    const owner = String(root.getAttribute("data-select-owner") || "schedule").trim();
    const draft = getDraftState(owner);
    const selectedUid = draft ? String(draft[field] || "").trim() : "";
    const createButton = root.querySelector(".custom-select-create");
    const emptyState = root.querySelector(".custom-select-empty");
    const filterValue = normalizeUsername(getDraftDebaterQueryValue(owner, field));
    let visibleCount = 0;
    let exactMatch = false;

    root.querySelectorAll('.custom-select-option[data-action="choose-debater"]').forEach((node) => {
      const label = normalizeUsername(node.getAttribute("data-label") || node.textContent || "");
      const value = String(node.getAttribute("data-value") || "").trim();
      const isClearOption = node.getAttribute("data-empty-option") === "true";
      const isVisible = isClearOption ? !filterValue : !filterValue || label.includes(filterValue);
      node.classList.toggle("hidden", !isVisible);
      node.classList.toggle("is-selected", !isClearOption && value === selectedUid);
      if (isVisible) {
        visibleCount += 1;
      }
      if (!isClearOption && filterValue && label === filterValue) {
        exactMatch = true;
      }
    });

    const canCreate = Boolean(filterValue) && isValidUsername(filterValue) && !exactMatch && !directoryHasNormalizedUsername(filterValue);
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

  function renderDebaterSelect({ label, field, selectedUid, otherUid, blockedUids, owner = "schedule" }) {
    const safeField = String(field || "").trim();
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const selectKey = getDebaterSelectKey(safeOwner, safeField);
    const selected = String(selectedUid || "").trim();
    const blockedSet = new Set(
      (Array.isArray(blockedUids) ? blockedUids : [otherUid])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    );
    const isOpen = state.openSelectKey === selectKey;
    const inputValue = getDraftDebaterQueryValue(safeOwner, safeField);
    const options = [
      '<button class="custom-select-option" type="button" data-action="choose-debater" data-empty-option="true" data-label="" data-select-field="' +
        escapeHtml(safeField) +
        '" data-select-owner="' +
        escapeHtml(safeOwner) +
        '" data-value="">Select debater</button>'
    ];

    state.directory.forEach((entry) => {
      const uid = String(entry.uid || "").trim();
      if (!uid || blockedSet.has(uid)) return;
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
          ${escapeHtml(formatDisplayName(entry.username || "debater", "Debater"))}
        </button>
      `);
    });

    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <div
          class="custom-select${isOpen ? " is-open" : ""}"
          data-select-root="${escapeHtml(selectKey)}"
          data-select-field="${escapeHtml(safeField)}"
          data-select-owner="${escapeHtml(safeOwner)}"
        >
          <input type="hidden" name="${escapeHtml(safeField)}" value="${escapeHtml(selected)}" />
          <div class="custom-select-trigger custom-select-input-row">
            <input
              class="custom-select-input${inputValue ? "" : " is-placeholder"}"
              id="custom-select-input-${escapeHtml(selectKey)}"
              type="text"
              value="${escapeHtml(inputValue)}"
              data-select-input="${escapeHtml(safeField)}"
              data-select-field="${escapeHtml(safeField)}"
              data-select-owner="${escapeHtml(safeOwner)}"
              data-select-key="${escapeHtml(selectKey)}"
              autocomplete="off"
              autocapitalize="words"
              spellcheck="false"
              placeholder="Select debater"
              aria-haspopup="listbox"
              aria-expanded="${isOpen ? "true" : "false"}"
            />
            <button
              class="custom-select-toggle"
              type="button"
              data-action="toggle-debater-select"
              data-select-key="${escapeHtml(selectKey)}"
              aria-label="Toggle debater list"
              tabindex="-1"
            >
              <span class="custom-select-caret" aria-hidden="true"></span>
            </button>
          </div>
          <div class="custom-select-menu${isOpen ? "" : " hidden"}" role="listbox" aria-label="${escapeHtml(label)}">
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

  function setCustomSelectOpenState(selectKey, open) {
    const root = el.mainContent?.querySelector(`[data-select-root="${selectKey}"]`);
    if (!root) return;

    root.classList.toggle("is-open", open);
    root.querySelector(".custom-select-menu")?.classList.toggle("hidden", !open);
    const triggerButton = root.querySelector(".custom-select-trigger");
    if (triggerButton instanceof HTMLButtonElement) {
      triggerButton.setAttribute("aria-expanded", open ? "true" : "false");
    }
    const visibleInput = root.querySelector(".custom-select-input");
    if (visibleInput instanceof HTMLInputElement) {
      visibleInput.setAttribute("aria-expanded", open ? "true" : "false");
      syncDebaterSelectFilter(selectKey);
      if (open) {
        window.requestAnimationFrame(() => {
          visibleInput.focus();
          const currentLength = visibleInput.value.length;
          try {
            visibleInput.setSelectionRange(currentLength, currentLength);
          } catch (_) {}
        });
      }
    }
  }

  function closeOpenSelect() {
    if (!state.openSelectKey) return;
    setCustomSelectOpenState(state.openSelectKey, false);
    state.openSelectKey = "";
  }

  function toggleOpenSelect(selectKey) {
    const safeSelectKey = String(selectKey || "").trim();
    if (!safeSelectKey) return;

    if (state.openSelectKey === safeSelectKey) {
      closeOpenSelect();
      return;
    }

    closeOpenSelect();
    state.openSelectKey = safeSelectKey;
    setCustomSelectOpenState(safeSelectKey, true);
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

  function toggleAuthPasswordVisibility(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const targetId = String(button.getAttribute("data-target") || "").trim();
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!(input instanceof HTMLInputElement)) return;

    const nextVisible = input.type === "password";
    input.type = nextVisible ? "text" : "password";
    button.classList.toggle("is-visible", nextVisible);
    button.setAttribute("aria-label", nextVisible ? "Hide password" : "Show password");
    button.setAttribute("title", nextVisible ? "Hide password" : "Show password");
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
    openAccountModal("role", {
      targetUid: safeUid,
      targetName: getNameForUid(safeUid, "debater"),
      currentRole,
      nextRole
    });
  }

  async function submitAdminManagedUserStatus(targetUid, nextRoleInput) {
    const safeUid = String(targetUid || "").trim();
    const nextRole = normalizeUserRole(nextRoleInput, "");
    if (!safeUid || !nextRole || !currentIsAdmin() || !state.user) return;

    const currentRole = getUserRoleForUid(safeUid);
    if (currentRole === nextRole) {
      closeAccountModal();
      return;
    }

    const safeName = formatDisplayName(getNameForUid(safeUid, "debater"), "That User") || "That User";
    state.accountModalBusy = true;
    syncAccountModalUi();

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

      closeAccountModal(true);
      showToast(`${safeName} is now ${nextRole === "admin" ? "an admin" : "a user"}.`, "success");
    } catch (error) {
      console.warn("Could not change user role", error);
      const message = isFirestorePermissionDenied(error)
        ? getAdminRulesDeployMessage("changing user status")
        : "Could not change that status right now.";
      setHint(el.accountModalHint, message, "error");
      showToast(message, "error");
    } finally {
      state.accountModalBusy = false;
      syncAccountModalUi();
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
    const safeName = formatDisplayName(getNameForUid(uid, "debater"), "That User") || "That User";
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

  async function uploadProfilePictureDataUrl(dataUrl) {
    if (!state.user) {
      throw new Error("Sign in to change your profile picture.");
    }

    const viewerUid = String(state.user.uid || "").trim();
    const targetUid = String(state.profilePictureTargetUid || viewerUid).trim();
    const targetName =
      normalizeUsername(state.profilePictureTargetName || getNameForUid(targetUid, targetUid === viewerUid ? state.username || "debater" : "debater")) ||
      "debater";
    const targetDisplayName = formatDisplayName(targetName, "Debater");
    const isOwnTarget = targetUid === viewerUid;
    const isPlaceholderTarget = isPlaceholderUid(targetUid);
    if (!isOwnTarget && !currentIsAdmin()) {
      throw new Error("Only admins can change another user's profile picture.");
    }

    state.profilePictureBusy = true;
    if (isOwnTarget && el.menuChangeProfilePictureBtn) {
      el.menuChangeProfilePictureBtn.disabled = true;
      el.menuChangeProfilePictureBtn.textContent = "Uploading...";
    }

    try {
      if (isPreviewMode()) {
        if (isOwnTarget) {
          state.selfProfile = {
            ...(state.selfProfile || {}),
            avatarDataUrl: dataUrl
          };
        }
        applyDirectoryAvatarLocally(targetUid, dataUrl);
        renderApp({ preserveScroll: true });
        showToast(isOwnTarget ? "Profile picture updated." : `${targetDisplayName} profile picture updated.`, "success");
        return;
      }

      const username =
        normalizeUsername(
          isOwnTarget
            ? state.username || state.user?.displayName || ""
            : getNameForUid(targetUid, "")
        ) ||
        (isPlaceholderTarget ? getPlaceholderUsername(targetUid) : (await resolveUsernameForUid(targetUid))) ||
        "";
      if (!username) {
        throw new Error("Could not find that username.");
      }
      const batch = db.batch();
      if (!isPlaceholderTarget) {
        batch.set(
          db.collection("users").doc(targetUid),
          {
            avatarDataUrl: dataUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
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

      if (isOwnTarget && !isPlaceholderTarget) {
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
      showToast(isOwnTarget ? "Profile picture updated." : `${targetDisplayName} profile picture updated.`, "success");
    } finally {
      state.profilePictureBusy = false;
      if (isOwnTarget && el.menuChangeProfilePictureBtn) {
        el.menuChangeProfilePictureBtn.disabled = false;
        el.menuChangeProfilePictureBtn.textContent = "Change Profile Picture";
      }
    }
  }

  async function handleProfilePictureInputChange(event) {
    const file = event.target?.files?.[0] || null;
    if (!file) return;

    try {
      await openAvatarCropModal(file);
    } catch (error) {
      console.warn("Could not open avatar cropper", error);
      showToast(String(error?.message || "Could not load that image."), "error");
      state.profilePictureTargetUid = "";
      state.profilePictureTargetName = "";
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function submitAvatarCrop() {
    if (!state.avatarCropOpen || state.avatarCropBusy || !state.avatarCropFile) return;

    const cropRect = getAvatarCropSourceRect();
    state.avatarCropBusy = true;
    syncAvatarCropModalUi();

    try {
      const dataUrl = await encodeProfileAvatarFromFile(state.avatarCropFile, cropRect);
      await uploadProfilePictureDataUrl(dataUrl);
      closeAvatarCropModal(true);
    } catch (error) {
      console.warn("Could not save avatar crop", error);
      const viewerUid = String(state.user?.uid || "").trim();
      const targetUid = String(state.profilePictureTargetUid || viewerUid).trim();
      const isOwnTarget = targetUid === viewerUid;
      const targetName =
        normalizeUsername(state.profilePictureTargetName || getNameForUid(targetUid, isOwnTarget ? state.username || "debater" : "debater")) ||
        "debater";
      const targetDisplayName = formatDisplayName(targetName, "Debater");
      const message =
        !isOwnTarget && isFirestorePermissionDenied(error)
          ? getAdminRulesDeployMessage("changing other users' profile pictures")
          : String(error?.message || `Could not update ${isOwnTarget ? "your" : `${targetDisplayName}'s`} profile picture.`);
      showToast(message, "error");
    } finally {
      state.avatarCropBusy = false;
      syncAvatarCropModalUi();
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

    DEBATE_PARTICIPANT_FIELD_META.forEach((entry) => {
      if (String(debate[entry.field] || "").trim() === placeholderUid) {
        patch[entry.field] = safeUid;
        patch[entry.nameField] = safeName;
      }
    });
    if (String(debate.winnerUid || "").trim() === placeholderUid) {
      patch.winnerUid = safeUid;
      patch.winnerName = safeName;
    }

    return Object.keys(patch).length ? patch : null;
  }

  function updateDraftParticipantUid(previousUid, nextUid) {
    const safePreviousUid = String(previousUid || "").trim();
    const safeNextUid = String(nextUid || "").trim();
    if (!safePreviousUid || !safeNextUid || safePreviousUid === safeNextUid) return;

    ["scheduleDraft", "lazyDebateDraft"].forEach((draftKey) => {
      const draft = state[draftKey];
      if (!draft || typeof draft !== "object") return;
      DEBATE_PARTICIPANT_FIELD_META.forEach((entry) => {
        if (String(draft[entry.field] || "").trim() === safePreviousUid) {
          draft[entry.field] = safeNextUid;
        }
      });
    });
  }

  function buildPlaceholderRenamePatch(debate, previousUid, nextName) {
    const safePreviousUid = String(previousUid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    const nextPlaceholderUid = makePlaceholderUid(safeName);
    if (!debate || !safePreviousUid || !safeName || !nextPlaceholderUid) return null;

    const patch = {};

    DEBATE_PARTICIPANT_FIELD_META.forEach((entry) => {
      if (String(debate[entry.field] || "").trim() === safePreviousUid) {
        patch[entry.field] = nextPlaceholderUid;
        patch[entry.nameField] = safeName;
      }
    });
    if (String(debate.winnerUid || "").trim() === safePreviousUid) {
      patch.winnerUid = nextPlaceholderUid;
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
    updateDraftParticipantUid(placeholderUid, safeUid);
  }

  function applyPlaceholderRenameLocally(previousUid, nextName) {
    const safePreviousUid = String(previousUid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    const nextPlaceholderUid = makePlaceholderUid(safeName);
    if (!safePreviousUid || !safeName || !nextPlaceholderUid) return;

    let foundEntry = false;
    state.directory = state.directory
      .map((entry) => {
        if (String(entry.uid || "").trim() !== safePreviousUid) {
          return entry;
        }

        foundEntry = true;
        return {
          ...entry,
          uid: nextPlaceholderUid,
          actualUid: "",
          username: safeName,
          isPlaceholder: true
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

    if (!foundEntry) {
      state.directory = [
        ...state.directory,
        {
          uid: nextPlaceholderUid,
          actualUid: "",
          username: safeName,
          isPlaceholder: true
        }
      ];
    }

    state.debates = state.debates.map((debate) => {
      const patch = buildPlaceholderRenamePatch(debate, safePreviousUid, safeName);
      return patch ? { ...debate, ...patch } : debate;
    });
    updateDraftParticipantUid(safePreviousUid, nextPlaceholderUid);
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

  async function syncPlaceholderRenameAcrossDebates(previousUid, nextName) {
    const safePreviousUid = String(previousUid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    if (!safePreviousUid || !safeName || isPreviewMode()) return;

    const updates = state.debates
      .map((debate) => {
        const patch = buildPlaceholderRenamePatch(debate, safePreviousUid, safeName);
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

  function buildDebateUsernamePatch(debate, uid, nextName) {
    const safeUid = String(uid || "").trim();
    const safeName = normalizeUsername(nextName || "");
    if (!debate || !safeUid || !safeName) return null;

    const patch = {};

    DEBATE_PARTICIPANT_FIELD_META.forEach((entry) => {
      if (
        String(debate[entry.field] || "").trim() === safeUid &&
        normalizeUsername(debate[entry.nameField] || "") !== safeName
      ) {
        patch[entry.nameField] = safeName;
      }
    });
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
    const isPlaceholderTarget = isPlaceholderUid(safeUid);

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
      if (isPlaceholderTarget) {
        applyPlaceholderRenameLocally(safeUid, next);
      } else {
        applyUsernameLocally(safeUid, next);
      }
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
      if (!authHandle && !isPlaceholderTarget) {
        throw new Error("MISSING_AUTH_HANDLE");
      }

      await db.runTransaction(async (tx) => {
        const currentRef = db.collection("usernames").doc(current);
        const nextRef = db.collection("usernames").doc(next);
        const currentSnap = await tx.get(currentRef);
        const nextSnap = await tx.get(nextRef);
        const nextData = nextSnap.exists ? nextSnap.data() || {} : {};
        const nextUid = String(nextData.uid || "").trim();

        if (nextSnap.exists && (isPlaceholderTarget ? current !== next : (nextUid && nextUid !== safeUid))) {
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
            uid: isPlaceholderTarget ? "" : safeUid,
            authHandle: isPlaceholderTarget ? "" : authHandle,
            invitedByUid: isPlaceholderTarget
              ? (currentTxData.invitedByUid || nextData.invitedByUid || String(state.user?.uid || "").trim())
              : nextData.invitedByUid || "",
            invitedByName: isPlaceholderTarget
              ? (currentTxData.invitedByName || nextData.invitedByName || state.username || "member")
              : nextData.invitedByName || "",
            avatarDataUrl,
            createdAt,
            ...(isPlaceholderTarget ? {} : { claimedAt }),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        if (!isPlaceholderTarget) {
          tx.set(
            db.collection("users").doc(safeUid),
            {
              username: next,
              name: next,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
      });

      try {
        if (isPlaceholderTarget) {
          await syncPlaceholderRenameAcrossDebates(safeUid, next);
        } else {
          await syncUsernameAcrossDebates(safeUid, next);
        }
      } catch (error) {
        syncedDebateNames = false;
        console.warn("Failed syncing debate names after admin username change", error);
      }

      if (isPlaceholderTarget) {
        applyPlaceholderRenameLocally(safeUid, next);
      } else {
        applyUsernameLocally(safeUid, next);
      }
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
        message.includes("USERNAME_TAKEN")
          ? "That username is already taken."
          : isFirestorePermissionDenied(error)
            ? getAdminRulesDeployMessage("changing other users' usernames")
            : "Could not change that username.",
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
      return;
    }

    if (state.accountModalType === "role") {
      await submitAdminManagedUserStatus(state.accountModalTargetUid, state.accountModalRoleNext);
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
      state.scheduleSection = "future";
      state.archiveEditMode = false;
      state.debateEditMode = false;
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
      state.scheduleSection = "future";
      state.archiveEditMode = false;
      state.debateEditMode = false;
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

  function getDraftParticipantSelectionEntries(owner = "schedule") {
    const safeOwner = owner === "lazy" ? "lazy" : "schedule";
    const draft = getDraftState(safeOwner);
    const teamSize = getDraftTeamSize(safeOwner);
    if (!draft) return [];
    return getActiveDraftParticipantFields(teamSize).map((field) => {
      const meta = getDraftParticipantMeta(field);
      return {
        ...meta,
        field,
        selection: getDraftDebaterSelectionValue(safeOwner, field)
      };
    });
  }

  async function resolveDraftParticipantIdentities(owner = "schedule") {
    const selectionEntries = getDraftParticipantSelectionEntries(owner);
    const resolvedEntries = await Promise.all(
      selectionEntries.map(async (entry) => {
        const identity = entry.selection ? await resolveScheduledDebaterIdentity(entry.selection) : null;
        const uid = String(identity?.uid || "").trim();
        const name = normalizeUsername(identity?.username || "debater") || "debater";
        return {
          ...entry,
          uid,
          name
        };
      })
    );
    return {
      teamSize: getDraftTeamSize(owner),
      participants: resolvedEntries,
      teamA: resolvedEntries.filter((entry) => entry.team === "a"),
      teamB: resolvedEntries.filter((entry) => entry.team === "b")
    };
  }

  function buildDebateParticipantPatch(participants) {
    const patch = {};
    (Array.isArray(participants) ? participants : []).forEach((entry) => {
      if (!entry?.field || !entry?.nameField) return;
      patch[entry.field] = String(entry.uid || "").trim();
      patch[entry.nameField] = normalizeUsername(entry.name || "debater") || "debater";
    });
    return patch;
  }

  function buildResolvedWinnerMeta(teamSize, result, teamAEntries, teamBEntries) {
    if (result !== "a" && result !== "b") {
      return { winnerUid: "", winnerName: "" };
    }
    if (normalizeDebateTeamSize(teamSize, 1) !== 1) {
      return { winnerUid: "", winnerName: "" };
    }
    const winnerEntry = result === "a" ? teamAEntries?.[0] : teamBEntries?.[0];
    return {
      winnerUid: String(winnerEntry?.uid || "").trim(),
      winnerName: normalizeUsername(winnerEntry?.name || "") || ""
    };
  }

  async function handleScheduleSubmit(event) {
    event.preventDefault();
    if (!state.user || state.scheduleSaving) return;

    const formData = new FormData(event.target);
    const topic = String(formData.get("topic") || "").trim();
    const teamSize = getDraftTeamSize("schedule");
    const participantSelections = getDraftParticipantSelectionEntries("schedule");
    const category = normalizeDebateCategory(formData.get("category"), "");
    const scheduledForRaw = String(formData.get("scheduledFor") || "").trim();
    const moderator = String(formData.get("moderator") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!topic) {
      showToast("Add a topic or resolution before logging.", "error");
      return;
    }
    if (participantSelections.some((entry) => !entry.selection)) {
      showToast(getDraftParticipantRequirementMessage(teamSize, "logging"), "error");
      return;
    }
    if (new Set(participantSelections.map((entry) => entry.selection)).size !== participantSelections.length) {
      showToast("Each debater slot needs a different person.", "error");
      return;
    }
    if (!isValidDebateCategory(category)) {
      showToast("Choose a category before logging.", "error");
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
      const resolvedParticipants = await resolveDraftParticipantIdentities("schedule");
      const participantPatch = buildDebateParticipantPatch(resolvedParticipants.participants);
      const participantUids = resolvedParticipants.participants.map((entry) => entry.uid).filter(Boolean);

      if (participantUids.length !== participantSelections.length) {
        throw new Error("INVALID_DEBATERS");
      }
      if (new Set(participantUids).size !== participantUids.length) {
        showToast("Each debater slot needs a different person.", "error");
        return;
      }

      if (isPreviewMode()) {
        state.debates = [
          ...state.debates,
          {
            id: `preview-${Date.now().toString(36)}`,
            topic,
            category,
            teamSize,
            ...participantPatch,
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
        showToast("Future debate logged.", "success");
        setPage("dashboard");
        return;
      }

      await db.collection("debates").add({
        topic,
        category,
        teamSize,
        ...participantPatch,
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
      showToast("Future debate logged.", "success");
      setPage("dashboard");
    } catch (error) {
      console.warn("Could not log future debate", error);
      const message = isFirestorePermissionDenied(error)
        ? getAdminRulesDeployMessage("logging future debates")
        : "Could not log that future debate right now.";
      showToast(message, "error");
    } finally {
      state.scheduleSaving = false;
      renderApp();
    }
  }

  async function handleLazyDebateSubmit(event) {
    event.preventDefault();
    if (!state.user || state.adminLogSaving) return;

    const formData = new FormData(event.target);
    const submittedByAdmin = currentIsAdmin();
    const topic = String(formData.get("topic") || "").trim();
    const teamSize = getDraftTeamSize("lazy");
    const participantSelections = getDraftParticipantSelectionEntries("lazy");
    const category = normalizeDebateCategory(formData.get("category"), "");
    const scheduledForRaw = String(formData.get("scheduledFor") || "").trim();
    const moderator = String(formData.get("moderator") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const videoUrl = String(formData.get("videoUrl") || "").trim();
    const videoMode = normalizeVideoClipMode(formData.get("videoMode"));
    const videoClipStart = String(formData.get("videoClipStart") || "").trim();
    const videoClipEnd = String(formData.get("videoClipEnd") || "").trim();
    const result = String(formData.get("result") || state.lazyDebateDraft.result || "a").trim();

    if (!topic) {
      showToast("Add a topic or resolution before logging.", "error");
      return;
    }
    if (participantSelections.some((entry) => !entry.selection)) {
      showToast(getDraftParticipantRequirementMessage(teamSize, "logging"), "error");
      return;
    }
    if (new Set(participantSelections.map((entry) => entry.selection)).size !== participantSelections.length) {
      showToast("Each debater slot needs a different person.", "error");
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

    if (scheduledForRaw && Number.isNaN(new Date(scheduledForRaw).getTime())) {
      showToast("Choose a valid debate date and time.", "error");
      return;
    }

    state.adminLogSaving = true;
    state.openSelectKey = "";
    renderApp({ preserveScroll: true });

    try {
      const resolvedParticipants = await resolveDraftParticipantIdentities("lazy");
      const participantPatch = buildDebateParticipantPatch(resolvedParticipants.participants);
      const participantUids = resolvedParticipants.participants.map((entry) => entry.uid).filter(Boolean);
      if (participantUids.length !== participantSelections.length) {
        throw new Error("INVALID_DEBATERS");
      }
      const now = new Date();
      const scheduledDate = await resolveLoggedDebateDate(scheduledForRaw, videoUrl, now);
      const actorName = state.username || (submittedByAdmin ? "admin" : "member");
      const videoPayload = buildDebateVideoPayload(videoUrl, {
        mode: videoMode,
        start: videoClipStart,
        end: videoClipEnd,
        addedAt: now,
        addedByUid: String(state.user.uid || "").trim(),
        addedByName: actorName
      });

      if (new Set(participantUids).size !== participantUids.length) {
        showToast("Each debater slot needs a different person.", "error");
        return;
      }
      if (!videoPayload) {
        showToast("Use a valid YouTube link and clip range.", "error");
        return;
      }

      const { winnerUid, winnerName } = buildResolvedWinnerMeta(
        teamSize,
        result,
        resolvedParticipants.teamA,
        resolvedParticipants.teamB
      );
      const reviewStatus = submittedByAdmin ? "resolved" : "awaiting_review";

      if (isPreviewMode()) {
        state.debates = [
          ...state.debates,
          {
            id: `preview-${Date.now().toString(36)}`,
            topic,
            category,
            teamSize,
            ...participantPatch,
            scheduledFor: scheduledDate,
            moderator,
            description,
            status: reviewStatus,
            result,
            winnerUid,
            winnerName,
            createdByUid: String(state.user.uid || "").trim(),
            createdByName: actorName,
            claimedByUid: submittedByAdmin ? String(state.user.uid || "").trim() : "",
            claimedByName: submittedByAdmin ? actorName : "",
            claimedAt: submittedByAdmin ? now : null,
            createdAt: now,
            updatedAt: now,
            comments: [],
            ...videoPayload
          }
        ];

        state.lazyDebateDraft = makeDefaultLazyDebateDraft();
        showToast(submittedByAdmin ? "Debate logged." : "Debate submitted for admin review.", "success");
        renderApp({ preserveScroll: true });
        return;
      }

      await db.collection("debates").add({
        topic,
        category,
        teamSize,
        ...participantPatch,
        scheduledFor: firebase.firestore.Timestamp.fromDate(scheduledDate),
        moderator,
        description,
        status: reviewStatus,
        result,
        winnerUid,
        winnerName,
        createdByUid: String(state.user.uid || "").trim(),
        createdByName: actorName,
        claimedByUid: submittedByAdmin ? String(state.user.uid || "").trim() : "",
        claimedByName: submittedByAdmin ? actorName : "",
        claimedAt: submittedByAdmin ? firebase.firestore.FieldValue.serverTimestamp() : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...buildDebateVideoPayload(videoUrl, {
          addedAt: firebase.firestore.FieldValue.serverTimestamp(),
          addedByUid: String(state.user.uid || "").trim(),
          addedByName: actorName
        })
      });

      state.lazyDebateDraft = makeDefaultLazyDebateDraft();
      showToast(submittedByAdmin ? "Debate logged." : "Debate submitted for admin review.", "success");
    } catch (error) {
      console.warn("Could not log debate", error);
      const message = isFirestorePermissionDenied(error)
        ? submittedByAdmin
          ? getAdminRulesDeployMessage("logging debates")
          : "Could not submit that debate. Publish the latest Firestore rules, then try again."
        : submittedByAdmin
          ? "Could not log that debate right now."
          : "Could not submit that debate right now.";
      showToast(message, "error");
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
    const videoMode = normalizeVideoClipMode(formData.get("videoMode"));
    const videoClipStart = String(formData.get("videoClipStart") || "").trim();
    const videoClipEnd = String(formData.get("videoClipEnd") || "").trim();
    const debate = state.debates.find((entry) => entry.id === debateId);

    if (!debate || !canEditDebateVideo(debate)) {
      showToast("You cannot edit that video link.", "error");
      return;
    }

    const videoPayload = buildDebateVideoPayload(videoUrl, {
      mode: videoMode,
      start: videoClipStart,
      end: videoClipEnd,
      addedAt: Date.now(),
      addedByUid: String(state.user?.uid || "").trim(),
      addedByName: state.username || "member"
    });
    if (!videoPayload) {
      showToast("Use a valid YouTube link and clip range.", "error");
      return;
    }

    state.actionBusyKey = `${debateId}:video`;
    renderApp({ preserveScroll: true });

    try {
      const payload = videoPayload;

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

  async function handleDebateDateSubmit(event) {
    event.preventDefault();
    if (!state.user) return;

    const formData = new FormData(event.target);
    const debateId = String(formData.get("debateId") || "").trim();
    const scheduledForRaw = String(formData.get("scheduledFor") || "").trim();
    const debate = state.debates.find((entry) => entry.id === debateId);

    if (!debate || !currentIsAdmin()) {
      showToast("You cannot edit that debate date.", "error");
      return;
    }

    const scheduledDate = new Date(scheduledForRaw);
    if (!scheduledForRaw || Number.isNaN(scheduledDate.getTime())) {
      showToast("Choose a valid debate date and time.", "error");
      return;
    }

    state.actionBusyKey = `${debateId}:date`;
    renderApp({ preserveScroll: true });

    try {
      if (isPreviewMode()) {
        state.debates = state.debates.map((entry) => {
          if (entry.id !== debateId) return entry;
          return {
            ...entry,
            scheduledFor: scheduledDate,
            updatedAt: new Date()
          };
        });
      } else {
        await db.collection("debates").doc(debateId).update({
          scheduledFor: firebase.firestore.Timestamp.fromDate(scheduledDate),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Debate date updated.", "success");
    } catch (error) {
      console.warn("Could not update debate date", error);
      const message = isFirestorePermissionDenied(error)
        ? getAdminRulesDeployMessage("changing debate dates")
        : "Could not update that debate date right now.";
      showToast(message, "error");
    } finally {
      state.actionBusyKey = "";
      renderApp({ preserveScroll: true });
    }
  }

  function syncDebateDetailsParticipantFields(form) {
    if (!(form instanceof HTMLFormElement)) return;

    const teamSizeInput = form.querySelector("[data-debate-details-team-size]");
    const teamSize = normalizeDebateTeamSize(teamSizeInput?.value, 1);
    const activeFields = new Set(getActiveDraftParticipantFields(teamSize));

    form.querySelectorAll("[data-debate-details-participant]").forEach((node) => {
      const field = String(node.getAttribute("data-debate-details-participant") || "").trim();
      node.hidden = !activeFields.has(field);
    });

    const grid = form.querySelector("[data-debate-details-participants]");
    if (grid) {
      grid.className = `debate-team-grid${teamSize !== 1 ? " is-expanded" : ""}${teamSize === 2 ? " is-2v2" : ""}${teamSize === 3 ? " is-2v1" : ""}`;
      grid.setAttribute("data-debate-details-participants", "");
    }
  }

  async function handleDebateDetailsSubmit(event) {
    event.preventDefault();
    if (!state.user || !currentIsAdmin()) return;

    const formData = new FormData(event.target);
    const debateId = String(formData.get("debateId") || "").trim();
    const debate = state.debates.find((entry) => entry.id === debateId);
    if (!debate) {
      showToast("Could not find that debate.", "error");
      return;
    }

    const topic = String(formData.get("topic") || "").trim();
    const category = normalizeDebateCategory(formData.get("category"), "");
    const teamSize = normalizeDebateTeamSize(formData.get("teamSize"), 1);
    const moderator = String(formData.get("moderator") || "").trim();
    const activeFields = getActiveDraftParticipantFields(teamSize);

    if (!topic) {
      showToast("Add a debate name before saving.", "error");
      return;
    }
    if (!isValidDebateCategory(category)) {
      showToast("Choose a valid category.", "error");
      return;
    }

    const participantNames = activeFields.map((field) => {
      const name = normalizeUsername(formData.get(field) || "");
      return { field, name };
    });
    const invalidParticipant = participantNames.find((entry) => !isValidUsername(entry.name));
    if (invalidParticipant) {
      showToast("Every active debater needs a 3-20 character username.", "error");
      return;
    }

    const uniqueNames = new Set(participantNames.map((entry) => entry.name));
    if (uniqueNames.size !== participantNames.length) {
      showToast("Each debater slot needs a different person.", "error");
      return;
    }

    state.actionBusyKey = `${debateId}:details`;
    renderApp({ preserveScroll: true });

    try {
      const patch = {};
      const currentTeamSize = getDebateTeamSize(debate, 1);

      if (String(debate.topic || "").trim() !== topic) {
        patch.topic = topic;
      }
      if (normalizeDebateCategory(debate.category) !== category) {
        patch.category = category;
      }
      if (currentTeamSize !== teamSize) {
        patch.teamSize = teamSize;
      }
      if (String(debate.moderator || "").trim() !== moderator) {
        patch.moderator = moderator;
      }

      for (const entry of participantNames) {
        const meta = getDraftParticipantMeta(entry.field);
        if (!meta) continue;

        const currentUid = String(debate[meta.field] || "").trim();
        const currentName = getDebateParticipantEditValue(debate, meta.field);
        const shouldResolveIdentity = currentTeamSize !== teamSize || currentName !== entry.name || !currentUid;
        if (!shouldResolveIdentity) continue;

        const identity = await ensureReservedUsername(entry.name);
        const nextUid = String(identity?.uid || "").trim();
        const nextName = normalizeUsername(identity?.username || entry.name);
        if (!nextUid || !nextName) {
          throw new Error("INVALID_DEBATER");
        }

        if (currentUid !== nextUid) {
          patch[meta.field] = nextUid;
        }
        if (normalizeUsername(debate[meta.nameField] || "") !== nextName) {
          patch[meta.nameField] = nextName;
        }
      }

      const nextDebate = { ...debate, ...patch };
      if (nextDebate.status === "resolved" && (nextDebate.result === "a" || nextDebate.result === "b")) {
        const { winnerUid, winnerName } = buildResolvedWinnerMeta(
          getDebateTeamSize(nextDebate, 1),
          nextDebate.result,
          getDebateTeamParticipants(nextDebate, "a"),
          getDebateTeamParticipants(nextDebate, "b")
        );
        if (String(nextDebate.winnerUid || "").trim() !== winnerUid) {
          patch.winnerUid = winnerUid;
        }
        if (normalizeUsername(nextDebate.winnerName || "") !== normalizeUsername(winnerName || "")) {
          patch.winnerName = winnerName;
        }
      }

      if (!Object.keys(patch).length) {
        showToast("No debate details changed.", "success");
        return;
      }

      if (isPreviewMode()) {
        state.debates = state.debates.map((entry) => {
          if (entry.id !== debateId) return entry;
          return {
            ...entry,
            ...patch,
            updatedAt: new Date()
          };
        });
      } else {
        await db.collection("debates").doc(debateId).update({
          ...patch,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Debate details updated.", "success");
    } catch (error) {
      console.warn("Could not update debate details", error);
      const message = isFirestorePermissionDenied(error)
        ? getAdminRulesDeployMessage("editing debates")
        : "Could not update those debate details right now.";
      showToast(message, "error");
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

  function getResolveVideoSettings(debateId) {
    const safeDebateId = String(debateId || "").trim();
    if (!safeDebateId) {
      return {
        videoUrl: "",
        videoMode: "full",
        videoClipStart: "",
        videoClipEnd: ""
      };
    }

    const modeInput = el.mainContent?.querySelector(
      `[data-resolve-video-mode="${safeDebateId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`
    );
    const startInput = el.mainContent?.querySelector(
      `[data-resolve-video-start="${safeDebateId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`
    );
    const endInput = el.mainContent?.querySelector(
      `[data-resolve-video-end="${safeDebateId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`
    );

    return {
      videoUrl: getResolveVideoInputValue(safeDebateId),
      videoMode: (modeInput instanceof HTMLInputElement || modeInput instanceof HTMLSelectElement)
        ? normalizeVideoClipMode(modeInput.value)
        : "full",
      videoClipStart: startInput instanceof HTMLInputElement ? String(startInput.value || "").trim() : "",
      videoClipEnd: endInput instanceof HTMLInputElement ? String(endInput.value || "").trim() : ""
    };
  }

  async function reviewSubmittedDebate(debateId, outcome) {
    if (!currentIsAdmin() || !state.user || !debateId || !["accept", "decline"].includes(String(outcome || ""))) return;

    const debate = state.debates.find((entry) => entry.id === debateId);
    if (!isDebateAwaitingReview(debate)) return;

    state.actionBusyKey = `${debateId}:review:${outcome}`;
    renderApp({ preserveScroll: true });

    try {
      if (outcome === "decline") {
        if (isPreviewMode()) {
          state.debates = state.debates.filter((entry) => entry.id !== debateId);
        } else {
          await db.collection("debates").doc(debateId).delete();
        }
        showToast("Debate submission declined.", "success");
        return;
      }

      const { winnerUid, winnerName } = buildResolvedWinnerMeta(
        getDebateTeamSize(debate, 1),
        debate.result,
        getDebateTeamParticipants(debate, "a"),
        getDebateTeamParticipants(debate, "b")
      );

      if (isPreviewMode()) {
        state.debates = state.debates.map((entry) => {
          if (entry.id !== debateId) return entry;
          return {
            ...entry,
            status: "resolved",
            winnerUid,
            winnerName,
            claimedByUid: String(state.user.uid || "").trim(),
            claimedByName: state.username || "admin",
            claimedAt: new Date(),
            updatedAt: new Date()
          };
        });
      } else {
        await db.collection("debates").doc(debateId).update({
          status: "resolved",
          winnerUid,
          winnerName,
          claimedByUid: String(state.user.uid || "").trim(),
          claimedByName: state.username || "admin",
          claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Debate approved.", "success");
    } catch (error) {
      console.warn("Could not review submitted debate", error);
      const message = isFirestorePermissionDenied(error)
        ? getAdminRulesDeployMessage("reviewing submitted debates")
        : "Could not review that debate right now.";
      showToast(message, "error");
    } finally {
      state.actionBusyKey = "";
      renderApp({ preserveScroll: true });
    }
  }

  async function claimDebateResult(debateId, outcome, videoUrl = "") {
    if (!currentIsAdmin() || !state.user || !debateId || !outcome) return;
    const debate = state.debates.find((entry) => entry.id === debateId);
    if (!debate) return;

    const resolveVideo = typeof videoUrl === "object" && videoUrl
      ? videoUrl
      : { videoUrl };
    const safeVideoUrl = String(resolveVideo.videoUrl || "").trim();
    const videoPayload =
      outcome === "reopen"
        ? null
        : buildDebateVideoPayload(safeVideoUrl, {
            mode: resolveVideo.videoMode,
            start: resolveVideo.videoClipStart,
            end: resolveVideo.videoClipEnd,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedByUid: String(state.user.uid || "").trim(),
            addedByName: state.username || "admin"
          });
    if (outcome !== "reopen" && !videoPayload) {
      showToast("Use a valid YouTube link and clip range.", "error");
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
        const { winnerUid, winnerName } = buildResolvedWinnerMeta(
          getDebateTeamSize(debate, 1),
          outcome,
          getDebateTeamParticipants(debate, "a"),
          getDebateTeamParticipants(debate, "b")
        );
        payload.status = "resolved";
        payload.result = outcome;
        payload.winnerUid = winnerUid;
        payload.winnerName = winnerName;
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
      const message = isFirestorePermissionDenied(error)
        ? getAdminRulesDeployMessage("resolving debates")
        : "Could not update that result right now.";
      showToast(message, "error");
    } finally {
      state.actionBusyKey = "";
      renderApp();
    }
  }

  function handleDocumentClick(event) {
    const target = event.target;
    const clickedInsideSelect = target.closest("[data-select-root]");
    const clickedInsideSearch = target.closest("#search-shell");
    const clickedSelectInput = target.closest("[data-select-input]");

    if (state.userMenuOpen && !target.closest("#user-menu")) {
      closeUserMenu();
    }

    if (state.searchMenuOpen && !clickedInsideSearch) {
      closeSearchMenu();
    }

    if (state.openSelectKey && !clickedInsideSelect) {
      closeOpenSelect();
    }

    if (clickedSelectInput instanceof HTMLInputElement) {
      const selectKey = String(clickedSelectInput.getAttribute("data-select-key") || "").trim();
      if (selectKey && state.openSelectKey !== selectKey) {
        toggleOpenSelect(selectKey);
      }
    }

    const pageLink = target.closest("[data-page-link]");
    if (pageLink) {
      event.preventDefault();
      if (pageLink.classList.contains("is-disabled") || pageLink.getAttribute("aria-disabled") === "true") {
        return;
      }
      const page = pageLink.getAttribute("data-page-link");
      if (page) {
        setPage(page);
      }
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.getAttribute("data-action");
    if (action === "toggle-auth-password") {
      event.preventDefault();
      toggleAuthPasswordVisibility(actionButton);
      return;
    }

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

    if (action === "toggle-archive-edit") {
      event.preventDefault();
      toggleArchiveEditMode();
      return;
    }

    if (action === "toggle-debate-edit") {
      event.preventDefault();
      toggleDebateEditMode();
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
      claimDebateResult(debateId, actionButton.getAttribute("data-outcome"), getResolveVideoSettings(debateId));
      return;
    }

    if (action === "review-submitted-debate") {
      event.preventDefault();
      reviewSubmittedDebate(
        actionButton.getAttribute("data-debate-id"),
        actionButton.getAttribute("data-outcome")
      );
      return;
    }

    if (action === "toggle-debater-select") {
      event.preventDefault();
      const selectKey = String(actionButton.getAttribute("data-select-key") || "").trim();
      toggleOpenSelect(selectKey);
      return;
    }

    if (action === "toggle-category-select") {
      event.preventDefault();
      const selectKey = String(actionButton.getAttribute("data-select-key") || "").trim();
      toggleOpenSelect(selectKey);
      return;
    }

    if (action === "toggle-video-mode-select") {
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
      setDebaterDraftSelection(owner, field, value, value ? formatDisplayName(getNameForUid(value, "debater"), "Debater") : "");
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

    if (action === "choose-video-mode") {
      event.preventDefault();
      const root = actionButton.closest("[data-video-mode-root]");
      const value = normalizeVideoClipMode(actionButton.getAttribute("data-value"));
      const modeInput = root?.querySelector("[data-video-mode-input]");
      const selectKey = String(root?.getAttribute("data-select-root") || "").trim();
      const owner =
        modeInput instanceof HTMLInputElement
          ? String(modeInput.getAttribute("data-draft-owner") || "").trim()
          : "";

      if (modeInput instanceof HTMLInputElement) {
        modeInput.value = value;
      }
      if (owner) {
        setDraftField(owner, "videoMode", value);
      }

      if (selectKey) {
        setCustomSelectOpenState(selectKey, false);
      }
      state.openSelectKey = "";

      const labelNode = root?.querySelector(".custom-select-value");
      if (labelNode) {
        labelNode.textContent = getVideoModeLabel(value);
        labelNode.classList.remove("is-placeholder");
      }
      const optionButtons = root ? root.querySelectorAll('[data-action="choose-video-mode"]') : [];
      optionButtons.forEach((node) => {
        if (!(node instanceof HTMLButtonElement)) return;
        node.classList.toggle("is-selected", normalizeVideoClipMode(node.getAttribute("data-value")) === value);
      });

      syncVideoLinkFieldsUi(root);
      return;
    }

    if (action === "create-placeholder-debater") {
      event.preventDefault();
      const field = String(actionButton.getAttribute("data-select-field") || "").trim();
      const owner = String(actionButton.getAttribute("data-select-owner") || "schedule").trim();
      const username = normalizeUsername(actionButton.getAttribute("data-value") || "");
      if (!field || !isValidUsername(username)) return;
      setDebaterDraftSelection(owner, field, makePlaceholderUid(username), formatDisplayName(username, "Debater"));
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

    if (action === "set-draft-team-size") {
      event.preventDefault();
      const owner = String(actionButton.getAttribute("data-draft-owner") || "schedule").trim();
      setDraftField(owner, "teamSize", actionButton.getAttribute("data-value"));
      state.openSelectKey = "";
      if (!syncDraftFormUi(owner)) {
        renderApp({ preserveScroll: true });
      }
      return;
    }

    if (action === "set-rankings-category") {
      event.preventDefault();
      state.rankingsCategory = normalizeRankingsCategory(actionButton.getAttribute("data-value"));
      renderApp({ preserveScroll: true });
      return;
    }

    if (action === "set-profile-category") {
      event.preventDefault();
      state.profileCategory = normalizeRankingsCategory(actionButton.getAttribute("data-value"));
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
      return;
    }

    if (event.key === "Escape" && state.avatarCropOpen) {
      event.preventDefault();
      closeAvatarCropModal();
    }
  }

  function handleMainFocusIn(event) {
    if (!(event.target instanceof HTMLInputElement) || !event.target.hasAttribute("data-select-input")) {
      return;
    }

    const selectKey = String(event.target.getAttribute("data-select-key") || "").trim();
    if (selectKey && state.openSelectKey !== selectKey) {
      toggleOpenSelect(selectKey);
    }
  }

  function handleMainInput(event) {
    const videoLinkFields = event.target?.closest?.(".video-link-fields") || null;
    const debateDetailsForm = event.target?.closest?.("#debate-details-form") || null;

    if (
      debateDetailsForm instanceof HTMLFormElement &&
      event.target instanceof HTMLSelectElement &&
      event.target.hasAttribute("data-debate-details-team-size")
    ) {
      syncDebateDetailsParticipantFields(debateDetailsForm);
      return;
    }

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

    if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-select-input")) {
      const field = String(event.target.getAttribute("data-select-field") || "").trim();
      const owner = String(event.target.getAttribute("data-select-owner") || "schedule").trim();
      const selectKey = String(event.target.getAttribute("data-select-key") || "").trim();
      setDebaterDraftQuery(owner, field, event.target.value || "");
      if (owner === "lazy") {
        syncLazyResultUi();
      }
      if (selectKey && state.openSelectKey !== selectKey) {
        toggleOpenSelect(selectKey);
      } else if (selectKey) {
        syncDebaterSelectFilter(selectKey);
      }
      return;
    }

    const isVideoFieldInput =
      videoLinkFields &&
      (
        ((event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) && (
          event.target.name === "videoClipStart" ||
          event.target.name === "videoClipEnd" ||
          event.target.hasAttribute("data-video-clip-role") ||
          event.target.hasAttribute("data-resolve-video-start") ||
          event.target.hasAttribute("data-resolve-video-end")
        ))
      );

    const field = event.target.getAttribute("data-draft-field");
    if (!field) {
      if (isVideoFieldInput) {
        syncVideoLinkFieldsUi(videoLinkFields, {
          activeRole: String(event.target.getAttribute("data-video-clip-role") || "").trim()
        });
      }
      return;
    }

    const owner = String(event.target.getAttribute("data-draft-owner") || "schedule").trim();
    const draft = getDraftState(owner);
    if (!draft) return;

    setDraftField(owner, field, String(event.target.value || ""));
    if (videoLinkFields) {
      syncVideoLinkFieldsUi(videoLinkFields, {
        activeRole: String(event.target.getAttribute("data-video-clip-role") || "").trim()
      });
    }

  }

  function handleMainKeydown(event) {
    if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-mobile-search-input")) {
      if (event.key === "Enter") {
        event.preventDefault();
        openSearchResultsPage(event.target.value || "");
      }
      return;
    }

    if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-select-input")) {
      const selectKey = String(event.target.getAttribute("data-select-key") || "").trim();
      if (event.key === "Escape") {
        event.preventDefault();
        closeOpenSelect();
        return;
      }

      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && selectKey && state.openSelectKey !== selectKey) {
        event.preventDefault();
        toggleOpenSelect(selectKey);
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
    state.archiveEditMode = false;
    state.debateEditMode = false;
    state.openSelectKey = "";
    state.searchSuggestions = [];
    state.searchMenuOpen = false;
    state.searchHighlightIndex = -1;
    renderApp();
  }

  function handleWindowResize() {
    if (state.avatarCropOpen) {
      syncAvatarCropModalUi();
    }

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
    syncProfileHistoryCharts();
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
    el.avatarCropZoomInput?.addEventListener("input", (event) => {
      setAvatarCropZoom(event.target?.value);
    });
    el.avatarCropCancelBtn?.addEventListener("click", () => closeAvatarCropModal());
    el.avatarCropCloseBtn?.addEventListener("click", () => closeAvatarCropModal());
    el.avatarCropSaveBtn?.addEventListener("click", submitAvatarCrop);
    el.avatarCropShell?.addEventListener("click", (event) => {
      if (event.target === el.avatarCropShell) {
        closeAvatarCropModal();
      }
    });
    el.avatarCropViewport?.addEventListener("pointerdown", startAvatarCropDrag);
    el.avatarCropViewport?.addEventListener("pointermove", handleAvatarCropPointerMove);
    el.avatarCropViewport?.addEventListener("pointerup", finishAvatarCropDrag);
    el.avatarCropViewport?.addEventListener("pointercancel", finishAvatarCropDrag);
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
      } else if (event.target && event.target.id === "debate-details-form") {
        handleDebateDetailsSubmit(event);
      } else if (event.target && event.target.id === "debate-date-form") {
        handleDebateDateSubmit(event);
      } else if (event.target && event.target.id === "debate-comment-form") {
        handleDebateCommentSubmit(event);
      } else if (event.target && event.target.id === "debate-video-form") {
        handleDebateVideoSubmit(event);
      }
    });
    el.mainContent?.addEventListener("input", handleMainInput);
    el.mainContent?.addEventListener("change", handleMainInput);
    el.mainContent?.addEventListener("focusin", handleMainFocusIn);
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
