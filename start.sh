#!/bin/bash
set -e

# Get the directory where this script lives (repo root)
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting LiveKit voice agent in background..."
cd "$DIR/livekit-voice-agent"
python agent.py start &
AGENT_PID=$!

echo "Starting FastAPI server on port ${PORT:-8001}..."
cd "$DIR/server"
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} &
SERVER_PID=$!

echo "Both processes started (agent=$AGENT_PID, server=$SERVER_PID)"

# Wait for either to exit — if one dies, kill the other
wait -n $AGENT_PID $SERVER_PID
echo "A process exited, shutting down..."
kill $AGENT_PID $SERVER_PID 2>/dev/null
wait
