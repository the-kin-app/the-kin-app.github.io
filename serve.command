#!/bin/bash
# Double-click this file to preview the site.
# It always serves from the folder it lives in, which is the fix for the
# recurring problem of a server left running in some other directory and
# quietly serving stale files.
cd "$(dirname "$0")" || exit 1

PORT=8000
# take the port back if something is squatting on it
if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "Port $PORT was in use — freeing it."
  lsof -ti:$PORT | xargs kill -9 2>/dev/null
  sleep 1
fi

echo ""
echo "  Serving:  $(pwd)"
echo "  Homepage: http://localhost:$PORT/"
echo "  Waitlist: http://localhost:$PORT/waitlist/"
echo ""
echo "  Leave this window OPEN. Closing it stops the server."
echo "  Press Ctrl+C to stop."
echo ""

# open the browser once the server is actually up
( sleep 1; open "http://localhost:$PORT/waitlist/" ) &

exec python3 -m http.server $PORT
