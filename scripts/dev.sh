#!/bin/bash

# Port 3003 process check and kill
PORT=3003
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ ! -z "$PID" ]; then
  echo "Found process running on port $PORT (PID: $PID)"
  echo "Killing existing process..."
  kill -9 $PID 2>/dev/null
  sleep 1
  echo "Existing process terminated"
fi

echo "Starting development server on port $PORT..."
next dev -p $PORT

