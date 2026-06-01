# Trump Trade Agent

Scans the web on a schedule for Trump stock mentions and surfaces buy/sell signals with entry, stop loss, and target levels. Runs 24/7 on Railway with a live dashboard.

## Deploy to Railway (5 minutes)

### 1. Push to GitHub
- Create a new GitHub repo (e.g. `trump-trade-agent`)
- Upload all files in this folder to it

### 2. Deploy on Railway
- Go to https://railway.app and sign up (free)
- Click **New Project → Deploy from GitHub repo**
- Select your repo
- Railway will auto-detect Node.js and deploy

### 3. Set Environment Variables
In Railway dashboard → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from https://console.anthropic.com) |
| `SCAN_INTERVAL_MINS` | `60` (or 30, 120, 240) |
| `CONFIRM_MODE` | `volume` (or `price` or `both`) |

### 4. Get your live URL
Railway gives you a public URL like `https://trump-trade-agent-production.up.railway.app`
Open it in your browser — that's your live dashboard.

### 5. Bookmark it
Bookmark the URL. Every time Trump mentions a stock, the signal appears on the dashboard in real time with:
- Ticker + BUY/SELL direction
- Entry range, stop loss, target
- Reason and source
- Confirmation status

## How it works
- `agent.js` — runs the scan loop, calls Anthropic API with web search
- `server.js` — Express server hosting the dashboard + SSE for live updates
- Signals stream to the dashboard instantly via Server-Sent Events

## Cost
- Railway free tier: 500 hours/month (enough for 24/7)
- Anthropic API: ~$0.01–0.05 per scan depending on web search results
