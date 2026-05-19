const GOOGLE_REVIEW_URL =
  "https://www.google.com/search?client=safari&hs=rOa&sca_esv=afc85aa92f7b31d4&channel=iphone_bm&sxsrf=ANbL-n5I-f0OznwiNtklUc1f_SwQc_upHw:1779210735684&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOaZcW6UIfWQXHqYa7aB54sDIi22diYPFQJufAyGScV5QLgLadejsjIN3Hk9sp0P5rcybZeF-xr3iMRude6lf17zGTXZI4jLwpmexIFBUQPonOyvvpstYtzJeueuzR2rPeh0ekhI%3D&q=%E7%84%BC%E8%82%89%E3%83%A9%E3%82%A4%E3%82%AF+%E5%8C%97%E5%8D%83%E4%BD%8F%E5%BA%97+%E3%82%AF%E3%83%81%E3%82%B3%E3%83%9F&sa=X&ved=2ahUKEwio-IW_7MWUAxUbdPUHHc-zMw8Q0bkNegQINhAH&biw=1470&bih=776&dpr=2#lrd=0x60188ff4d48f3263:0xa0b8a3f40a555a76,3,,,,";

const ratingInput = document.getElementById("rating-input");
const ratingValue = document.getElementById("rating-value");
const ratingMessage = document.getElementById("rating-message");
const surveyForm = document.getElementById("survey-form");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultText = document.getElementById("result-text");
const reviewLink = document.getElementById("review-link");
const resetButton = document.getElementById("reset-button");
const submitButton = document.getElementById("submit-button");
const goodPointInput = document.getElementById("good-point");
const commentInput = document.getElementById("comment");
const starButtons = Array.from(document.querySelectorAll(".star-button"));

const ratingMessages = {
  1: "ご期待に沿えず申し訳ありません。改善の参考にさせていただきます。",
  2: "貴重なお声をありがとうございます。今後の改善に活かします。",
  3: "ご回答ありがとうございます。さらにご満足いただけるよう努めます。",
  4: "高い評価をありがとうございます。よろしければ口コミもぜひお願いします。",
  5: "とてもうれしいご評価です。ぜひGoogleでもお声をいただけると励みになります。",
};

function setRating(rating) {
  ratingInput.value = String(rating);
  ratingValue.textContent = `★ ${rating} / 5`;
  ratingMessage.textContent = ratingMessages[rating];

  starButtons.forEach((button) => {
    const value = Number(button.dataset.rating);
    button.classList.toggle("active", value <= rating);
    button.setAttribute("aria-pressed", String(value === rating));
  });
}

function resetForm() {
  surveyForm.reset();
  ratingInput.value = "";
  ratingValue.textContent = "未選択";
  ratingMessage.textContent = "星をタップして評価してください";
  resultCard.classList.add("hidden");
  reviewLink.classList.add("hidden");
  reviewLink.href = "#";

  starButtons.forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });

  submitButton.disabled = false;
  submitButton.textContent = "回答を送信する";
}

function buildResultMessage(rating) {
  if (rating >= 4) {
    return {
      title: "ご回答ありがとうございます",
      text:
        "ご満足いただけたようでとてもうれしいです。 " +
        "よろしければこのままGoogleの口コミ投稿へお進みください。 " +
        "サービス内容はスタッフよりご案内いたします。",
      showReviewLink: true,
    };
  }

  return {
    title: "ご意見をありがとうございます",
    text:
      "いただいたご意見は、今後のお店づくりに活かしてまいります。 " +
      "スタッフからサービスのご案内をいたしますので、少々お待ちください。",
    showReviewLink: false,
  };
}

starButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setRating(Number(button.dataset.rating));
  });
});

surveyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const rating = Number(ratingInput.value);
  if (!rating) {
    ratingMessage.textContent = "先に星評価を選択してください";
    return;
  }

  submitSurvey(rating);
});

resetButton.addEventListener("click", resetForm);

resetForm();

async function submitSurvey(rating) {
  submitButton.disabled = true;
  submitButton.textContent = "送信中…";

  const payload = {
    rating,
    goodPoint: goodPointInput.value,
    comment: commentInput.value.trim(),
  };

  try {
    const response = await fetch("/api/surveys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("save_failed");
    }

    const result = buildResultMessage(rating);
    resultTitle.textContent = result.title;
    resultText.textContent = result.text;

    if (result.showReviewLink) {
      reviewLink.href = GOOGLE_REVIEW_URL;
      reviewLink.classList.remove("hidden");
    } else {
      reviewLink.classList.add("hidden");
      reviewLink.href = "#";
    }

    resultCard.classList.remove("hidden");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    submitButton.textContent = "送信完了";
  } catch (error) {
    resultTitle.textContent = "送信できませんでした";
    resultText.textContent =
      "通信状況を確認して、もう一度お試しください。改善しない場合はスタッフへお声がけください。";
    reviewLink.classList.add("hidden");
    reviewLink.href = "#";
    resultCard.classList.remove("hidden");
    submitButton.disabled = false;
    submitButton.textContent = "もう一度送信する";
  }
}
