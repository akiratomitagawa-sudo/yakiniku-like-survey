# Render + Supabase 公開手順

この手順で、警告の出ない固定 `https://` URL と回答保存を無料構成で公開できます。

## 1. GitHub へ置く

このフォルダを GitHub の新規リポジトリへアップします。

## 2. Supabase を作る

1. Supabase で新しい project を作成
2. `SQL Editor` を開く
3. [supabase-schema.sql](/Users/tomitakawatan/Documents/New project/supabase-schema.sql:1) の内容を実行
4. `Project Settings` → `API` から次を控える
   - `Project URL`
   - `service_role` key

## 3. Render で Web Service を作る

1. Render で `New` → `Blueprint`
2. GitHub リポジトリを接続
3. `render.yaml` を使ってデプロイ

## 4. 環境変数を入れる

- `SURVEY_PUBLIC_BASE_URL`
  例: `https://yakiniku-like-survey.onrender.com`
- `ADMIN_PASSWORD`
  管理画面用の強いパスワード
- `SUPABASE_URL`
  Supabase の Project URL
- `SUPABASE_SERVICE_ROLE_KEY`
  Supabase の service_role key
- `SUPABASE_TABLE`
  通常は `survey_responses`

## 5. 公開後に使うURL

- お客さま用: `https://<your-render-url>/`
- 管理画面: `https://<your-render-url>/admin.html`

## 6. QRを作り直す

公開URLが決まったら、そのURLでQRを再生成して印刷します。

## 補足

- Render 無料Webサービスは無通信が続くとスリープするため、最初の1回だけ起動待ちが出ることがあります
- Render 無料プランでは永続ディスクが使えないため、回答保存は Supabase 側で行います
