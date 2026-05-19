# Render 公開手順

この手順で、警告の出ない `https://` の固定URLで公開できます。

## 1. GitHub へ置く

このフォルダを GitHub の新規リポジトリへアップします。

## 2. Render で Web Service を作る

1. Render で `New` → `Web Service`
2. GitHub リポジトリを接続
3. `render.yaml` を使ってデプロイ

## 3. 環境変数を入れる

- `SURVEY_PUBLIC_BASE_URL`
  例: `https://yakiniku-like-survey.onrender.com`
- `ADMIN_PASSWORD`
  管理画面用の強いパスワード

## 4. 公開後に使うURL

- お客さま用: `https://<your-render-url>/`
- 管理画面: `https://<your-render-url>/admin.html`

## 5. QRを作り直す

公開URLが決まったら、そのURLでQRを再生成して印刷します。
