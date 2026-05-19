#!/bin/zsh
cd "$(dirname "$0")"

SERVER_STARTED_BY_SCRIPT=0

if ! lsof -iTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then
  node server.js &
  SERVER_PID=$!
  SERVER_STARTED_BY_SCRIPT=1
  sleep 1
fi

open "http://127.0.0.1:4173/admin.html"

echo ""
echo "HTTPS公開URLを発行しています。"
echo "このウィンドウを閉じると公開URLは停止します。"
echo ""

ssh -o StrictHostKeyChecking=no -R 80:127.0.0.1:4173 nokey@localhost.run
EXIT_CODE=$?

if [ "$SERVER_STARTED_BY_SCRIPT" -eq 1 ]; then
  kill "$SERVER_PID" 2>/dev/null
fi

exit "$EXIT_CODE"
