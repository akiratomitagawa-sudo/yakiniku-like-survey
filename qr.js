const surveyUrlEl = document.getElementById("survey-url");
const openSurveyLink = document.getElementById("open-survey-link");
const copyLinkButton = document.getElementById("copy-link-button");
const copyStatus = document.getElementById("copy-status");

async function loadQrConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("config_failed");
    }

    const config = await response.json();
    surveyUrlEl.textContent = config.fixedSurveyUrl;
    openSurveyLink.href = config.fixedSurveyUrl;
    copyStatus.textContent =
      `固定URL: ${config.fixedSurveyUrl}。同じQRコードを継続してご利用いただけます。`;
  } catch (error) {
    surveyUrlEl.textContent = "URLを取得できませんでした";
    copyStatus.textContent =
      "URLを取得できませんでした。サーバー起動状況をご確認ください。";
  }
}

copyLinkButton.addEventListener("click", async () => {
  const surveyUrl = surveyUrlEl.textContent;
  if (!surveyUrl || surveyUrl === "URLを取得できませんでした") {
    return;
  }

  try {
    await navigator.clipboard.writeText(surveyUrl);
    copyStatus.textContent = "固定アンケートURLをコピーしました。";
  } catch (error) {
    copyStatus.textContent = "コピーできませんでした。表示中のURLをご利用ください。";
  }
});

loadQrConfig();
