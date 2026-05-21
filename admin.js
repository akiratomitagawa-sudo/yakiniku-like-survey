const totalCountEl = document.getElementById("total-count");
const averageRatingEl = document.getElementById("average-rating");
const reviewCountEl = document.getElementById("review-count");
const responsesBody = document.getElementById("responses-body");
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
const adminTableShell = document.getElementById("admin-table-shell");

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

function showLogin(message = "") {
  loginCard.classList.remove("hidden");
  adminSummary.classList.add("hidden");
  adminTableShell.classList.add("hidden");
  refreshButton.classList.add("hidden");
  downloadLink.classList.add("hidden");
  logoutButton.classList.add("hidden");
  loginStatus.textContent = message;
}

function showAdmin() {
  loginCard.classList.add("hidden");
  adminSummary.classList.remove("hidden");
  adminTableShell.classList.remove("hidden");
  refreshButton.classList.remove("hidden");
  downloadLink.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
}

function renderSummary(responses) {
  totalCountEl.textContent = `${responses.length}件`;

  if (responses.length === 0) {
    averageRatingEl.textContent = "-";
    reviewCountEl.textContent = "0件";
    return;
  }

  const totalRating = responses.reduce((sum, entry) => sum + entry.rating, 0);
  const reviewEligibleCount = responses.filter((entry) => entry.reviewEligible).length;

  averageRatingEl.textContent = `${(totalRating / responses.length).toFixed(1)} / 5`;
  reviewCountEl.textContent = `${reviewEligibleCount}件`;
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
    renderSummary(responses);
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

refreshButton.addEventListener("click", loadResponses);
loginForm.addEventListener("submit", login);
logoutButton.addEventListener("click", logout);

showLogin();
loadResponses();
