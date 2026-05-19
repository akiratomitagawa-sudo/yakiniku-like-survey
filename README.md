# 店内アンケート

## 使い方

1. `node server.js` を実行する
2. お客さま用アンケート画面: `http://yakiniku-like.local:4173/`
3. 管理画面: `http://127.0.0.1:4173/admin.html`
4. 店頭掲示用QR確認ページ: `http://127.0.0.1:4173/qr.html`

## QR運用

- 印刷用の固定QR: `assets/store-survey-qr.svg`
- 固定URL: `http://yakiniku-like.local:4173/`
- 同じWi-Fiにつないだスマホで固定QRを読み取るとアンケートが開きます
- `start_survey.command` を開くと、スタッフ用に管理画面が立ち上がります
- 星4以上の回答後だけ、指定済みのGoogle口コミURLへ進めます

## 安全性

- 管理画面とCSV取得はパスワードログイン必須です
- 管理パスワード保存先: `data/admin-password.txt`
- 回答データには不要な端末情報を保存しません
- セキュリティ用レスポンスヘッダーをサーバー側で付与しています

## 保存場所

- 回答データ: `data/survey-responses.json`
- CSV出力: 管理画面の `CSVをダウンロード`
