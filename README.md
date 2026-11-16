# StrangerChat — Real Random Stranger Chat (Socket.IO)

A working Omegle-style text chat that pairs **real people** in real time. One Node.js server serves both the website and does the matchmaking + message relay.

## What's inside
- `server.js` — Express + Socket.IO backend (matchmaking queue, interest-based matching, message relay, typing indicators, online count, auto-cleanup)
- `public/index.html` — the website (connects to the server via Socket.IO)
- `package.json` — dependencies

## Run locally
```bash
npm install
npm start
# open http://localhost:3000 in TWO tabs to chat with yourself
```

## Deploy free (works from an iPad — no computer needed)

### Option A — Glitch (easiest, fully web-based)
1. Go to **glitch.com** → Sign up (free, Google or email)
2. **New Project** → **Import from GitHub** (or "hello-express" template, then paste the files)
3. Copy the contents of `server.js`, `package.json`, and `public/index.html` into the matching files (create `public/` folder for the HTML)
4. Glitch auto-installs and runs it → click **Share** → copy the live URL. Done.

### Option B — Render
1. Push this folder to a GitHub repo
2. Go to **render.com** → New → **Web Service** → connect the repo
3. Build command: `npm install` · Start command: `npm start` · Free tier
4. You get a URL like `https://strangerchat-xyz.onrender.com`

### Option C — Split hosting (frontend on Netlify, backend on Render)
If you want the HTML on Netlify Drop and the backend elsewhere:
1. Deploy `server.js` + `package.json` to Render (above) → copy backend URL
2. In `public/index.html`, set `var SERVER_URL = "https://your-backend.onrender.com";`
3. Upload just the edited `index.html` to Netlify Drop

## How matching works
- Click **Start** → you join a waiting queue with your interests
- Server pairs you with the first person who shares an interest; otherwise the longest-waiting person
- Messages, typing status, and disconnects all relay live through Socket.IO
- If no one is online, you'll get a "no one available" message after 5 minutes — share the link to get people online

## Adding real video (optional next step)
Video needs WebRTC on top of this (the server already relays signaling). Ask me to add it and I'll extend `server.js` with `webrtc:offer` / `webrtc:answer` / `webrtc:ice` relays and add the peer connection code to the frontend.

## Safety
- Messages are capped at 2000 chars, interests at 10. No data is stored.
- Add moderation / reporting before opening to the public. Users must be 18+.
