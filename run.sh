#!/bin/bash

# Go to script location (project root)
cd "$(dirname "$0")"

# Start frontend in new terminal
gnome-terminal -- bash -c "cd client && echo '🔥 Frontend Starting...' && npm run dev; exec bash" &

# Start backend instantly in another terminal
gnome-terminal -- bash -c "cd server && echo '⚙️ Backend Starting...' && npm run server; exec bash" &

exit 0
