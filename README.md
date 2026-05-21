# 店内アンケート

## 使い方

1. `node server.js` を実行する
2. お客さま用アンケート画面: `http://yakiniku-like.local:4173/`
3. 管理画面: `http://127.0.0.1:4173/admin.html`
4. 店頭掲示用QR確認ページ: `http://127.0.0.1:4173/qr.html`
5. HTTPS公開が必要なときは `start_public_survey.command` を開く

## QR運用

- 印刷用の固定QR: `assets/store-survey-qr.svg`
- 固定URL: `http://yakiniku-like.local:4173/`
- 同じWi-Fiにつないだスマホで固定QRを読み取るとアンケートが開きます
- `start_survey.command` を開くと、スタッフ用に管理画面が立ち上がります
- 星4以上の回答後だけ、指定済みのGoogle口コミURLへ進めます
- 本番用の固定HTTPS QRは `assets/store-survey-onrender-qr.svg` です
- 本番用URLは `assets/store-survey-onrender-url.txt` に保存しています
- 多店舗用のURL一覧は `assets/store-url-list.csv` に保存しています

## HTTPS公開

- `start_public_survey.command` を開くと、外部公開用の HTTPS URL を発行できます
- 現在の公開URLは `assets/store-survey-https-url.txt` に保存しています
- 現在の公開用QRは `assets/store-survey-https-qr.svg` に保存しています
- `localhost.run` の無料URLは固定ではないため、再起動時にURLが変わることがあります
- URLを固定したまま HTTPS にしたい場合は、独自ドメインか有料の固定ドメイン運用が必要です

## 安全性

- 管理画面とCSV取得はパスワードログイン必須です
- 管理パスワード保存先: `data/admin-password.txt`
- 回答データには不要な端末情報を保存しません
- セキュリティ用レスポンスヘッダーをサーバー側で付与しています
- 本番では `SUPABASE_SERVICE_ROLE_KEY` をサーバー側だけに置き、ブラウザへは出しません

## 保存場所

- 回答データ: `data/survey-responses.json`
- CSV出力: 管理画面の `CSVをダウンロード`

## 無料の固定HTTPS公開

- `Render` の無料Webサービスを使うと、固定の `https://<service>.onrender.com` が使えます
- `Supabase` の無料データベースを使うと、Render 無料プランでも回答データを保持できます
- `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が設定されている場合、サーバーは自動で `Supabase` を使います
- `SUPABASE_TABLE` を省略した場合は `survey_responses` を使います
- `supabase-schema.sql` を `Supabase` の SQL Editor で1回実行すると、保存先テーブルを作れます
- 現在の本番URLは `https://yakiniku-like-survey.onrender.com/` です

## 多店舗対応

- 店舗ごとの口コミURL設定は `store-config.json` で管理しています
- 北千住店は既存のまま `https://yakiniku-like-survey.onrender.com/` で使えます
- 追加店舗は `?store=store-02` のようなURLで切り替えます
- 8店舗分は仮の店舗名 `追加店舗1` から `追加店舗8` で登録しています
- 正式な店舗名が分かれば `store-config.json` の `name` を差し替えるだけで更新できます
- 管理画面とCSVには回答店舗名も保存されます
