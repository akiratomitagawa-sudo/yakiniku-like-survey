#!/bin/zsh
cd "$(dirname "$0")"
node server.js &
SERVER_PID=$!
sleep 1
open "http://127.0.0.1:4173/admin.html"
wait $SERVER_PID
