const totalCountEl = document.getElementById("total-count");
const averageRatingEl = document.getElementById("average-rating");
const reviewCountEl = document.getElementById("review-count");
const periodStartEl = document.getElementById("period-start");
const responsesBody = document.getElementById("responses-body");
const storeSummaryBody = document.getElementById("store-summary-body");
const emptyState = document.getElementById("empty-state");
const lastUpdatedEl = document.getElementById("last-updated");
const refreshButton = document.getElementById("refresh-button");
const downloadLink = document.getElementById("download-link");
const logoutButton = document.getElementById("logout-button");
const loginCard = document.getElementById("login-card");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginStatus = document.getElementById("login-status");
const passwordInput = document.getElementById("password-input");
const adminSummary = document.getElementById("admin-summary");
const adminStoreShell = document.getElementById("admin-store-shell");
const adminControlsShell = document.getElementById("admin-controls-shell");
const adminTableShell = document.getElementById("admin-table-shell");
const passwordForm = document.getElementById("password-form");
const currentPasswordInput = document.getElementById("current-password-input");
const newPasswordInput = document.getElementById("new-password-input");
const changePasswordButton = document.getElementById("change-password-button");
const passwordStatus = document.getElementById("password-status");
const resetMonthButton = document.getElementById("reset-month-button");
const resetStatus = document.getElementById("reset-status");

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonthStart(value) {
  if (!value) {
    return "全期間";
  }

  const date = new Date(value);
  return `${new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)} から`;
}

function showLogin(message = "") {
  loginCard.classList.remove("hidden");
  adminSummary.classList.add("hidden");
  adminStoreShell.classList.add("hidden");
  adminControlsShell.classList.add("hidden");
  adminTableShell.classList.add("hidden");
  refreshButton.classList.add("hidden");
  downloadLink.classList.add("hidden");
  logoutButton.classList.add("hidden");
  loginStatus.textContent = message;
}

function showAdmin() {
  loginCard.classList.add("hidden");
  adminSummary.classList.remove("hidden");
  adminStoreShell.classList.remove("hidden");
  adminControlsShell.classList.remove("hidden");
  adminTableShell.classList.remove("hidden");
  refreshButton.classList.remove("hidden");
  downloadLink.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
}

function renderSummary(summary, activePeriodStart) {
  const overall = summary?.overall || {
    totalCount: 0,
    averageRating: null,
    reviewEligibleCount: 0,
  };

  totalCountEl.textContent = `${overall.totalCount}件`;
  averageRatingEl.textContent =
    overall.averageRating === null ? "-" : `${overall.averageRating.toFixed(1)} / 5`;
  reviewCountEl.textContent = `${overall.reviewEligibleCount}件`;
  periodStartEl.textContent = formatMonthStart(activePeriodStart);
}

function renderStoreSummary(summary) {
  storeSummaryBody.innerHTML = "";

  const stores = Array.isArray(summary?.stores) ? summary.stores : [];
  stores.forEach((store) => {
    const row = document.createElement("tr");

    const storeCell = document.createElement("td");
    storeCell.textContent = store.storeName || store.storeId || "-";

    const averageCell = document.createElement("td");
    averageCell.textContent =
      store.averageRating === null ? "-" : `${store.averageRating.toFixed(1)} / 5`;

    const countCell = document.createElement("td");
    countCell.textContent = `${store.totalCount || 0}件`;

    row.append(storeCell, averageCell, countCell);
    storeSummaryBody.appendChild(row);
  });
}

function renderTable(responses) {
  responsesBody.innerHTML = "";

  if (responses.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  responses.forEach((entry) => {
    const row = document.createElement("tr");
    const createdAtCell = document.createElement("td");
    createdAtCell.textContent = formatDate(entry.createdAt);

    const storeCell = document.createElement("td");
    storeCell.textContent = entry.storeName || entry.storeId || "-";

    const ratingCell = document.createElement("td");
    const ratingPill = document.createElement("span");
    ratingPill.className = "rating-pill";
    ratingPill.textContent = `★ ${entry.rating}`;
    ratingCell.appendChild(ratingPill);

    const reviewCell = document.createElement("td");
    reviewCell.textContent = entry.reviewEligible ? "対象" : "-";

    const goodPointCell = document.createElement("td");
    goodPointCell.textContent = entry.goodPoint || "-";

    const commentCell = document.createElement("td");
    commentCell.textContent = entry.comment || "-";

    row.append(createdAtCell, storeCell, ratingCell, reviewCell, goodPointCell, commentCell);
    responsesBody.appendChild(row);
  });
}

async function loadResponses() {
  refreshButton.disabled = true;
  refreshButton.textContent = "更新中…";

  try {
    const response = await fetch("/api/surveys", {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (response.status === 401) {
      showLogin("ログインしてください。");
      return;
    }

    if (!response.ok) {
      throw new Error("load_failed");
    }

    const payload = await response.json();
    const responses = Array.isArray(payload.responses) ? payload.responses : [];
    showAdmin();
    renderSummary(payload.summary, payload.activePeriodStart);
    renderStoreSummary(payload.summary);
    renderTable(responses);
    lastUpdatedEl.textContent = `最終更新: ${formatDate(new Date().toISOString())}`;
  } catch (error) {
    showLogin("回答を読み込めませんでした。もう一度お試しください。");
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "更新する";
  }
}

async function login(event) {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = "確認中…";
  loginStatus.textContent = "";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        password: passwordInput.value,
      }),
    });

    if (response.status === 401) {
      loginStatus.textContent = "パスワードが違います。";
      return;
    }

    if (!response.ok) {
      throw new Error("login_failed");
    }

    passwordInput.value = "";
    await loadResponses();
  } catch (error) {
    loginStatus.textContent = "ログインできませんでした。";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "ログイン";
  }
}

async function logout() {
  logoutButton.disabled = true;
  logoutButton.textContent = "ログアウト中…";

  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = "ログアウト";
    showLogin("ログアウトしました。");
  }
}

async function changePassword(event) {
  event.preventDefault();
  changePasswordButton.disabled = true;
  changePasswordButton.textContent = "変更中…";
  passwordStatus.textContent = "";

  try {
    const response = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        currentPassword: currentPasswordInput.value,
        newPassword: newPasswordInput.value,
      }),
    });

    if (response.status === 401) {
      passwordStatus.textContent = "現在のパスワードが違います。";
      return;
    }

    if (response.status === 400) {
      passwordStatus.textContent = "新しいパスワードは8文字以上で入力してください。";
      return;
    }

    if (!response.ok) {
      throw new Error("change_failed");
    }

    passwordForm.reset();
    passwordStatus.textContent = "パスワードを変更しました。";
  } catch (error) {
    passwordStatus.textContent = "パスワードを変更できませんでした。";
  } finally {
    changePasswordButton.disabled = false;
    changePasswordButton.textContent = "変更する";
  }
}

async function resetMonth() {
  const confirmed = window.confirm(
    "今月1日を基準に集計をリセットします。以前の回答は集計対象から外れます。続けますか？",
  );
  if (!confirmed) {
    return;
  }

  resetMonthButton.disabled = true;
  resetMonthButton.textContent = "リセット中…";
  resetStatus.textContent = "";

  try {
    const response = await fetch("/api/admin/reset-month", {
      method: "POST",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("reset_failed");
    }

    const payload = await response.json();
    resetStatus.textContent = `集計開始日を ${formatMonthStart(payload.effectiveFrom)} に更新しました。`;
    await loadResponses();
  } catch (error) {
    resetStatus.textContent = "月初リセットに失敗しました。";
  } finally {
    resetMonthButton.disabled = false;
    resetMonthButton.textContent = "今月分へリセット";
  }
}

refreshButton.addEventListener("click", loadResponses);
loginForm.addEventListener("submit", login);
logoutButton.addEventListener("click", logout);
passwordForm.addEventListener("submit", changePassword);
resetMonthButton.addEventListener("click", resetMonth);

showLogin();
loadResponses();
