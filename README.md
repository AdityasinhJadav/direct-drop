# File Sharing (WebRTC + Socket.io)

Backend: Node.js/Express/Socket.io
Frontend: Vite + React + react-router

Run locally:

1) Backend
- cd backend
- create .env
  PORT=3001
  FRONTEND_ORIGIN=http://localhost:5173
- npm run dev

2) Frontend
- cd frontend
- create .env
  VITE_SIGNAL_SERVER=http://localhost:3001
- npm run dev

Open http://localhost:5173

Usage
- Go to /send to generate a key and create the connection, pick file, send
- Go to /receive, paste the same key, Join, then download link appears when done



