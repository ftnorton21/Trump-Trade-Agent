const express = require("express");
const { start, state, getStats } = require("./agent");

const app = express();
const PORT = process.env.PORT || 3000;

// SSE clients
const clients = new Set();

// Patch state.signals to notify SSE clients when a new signal arrives
const originalUnshift = Array.prototype.unshift;
state.signals = new Proxy([], {
  get(target, prop) {
    if (prop === "unshift") {
      return function (...args) {
        const result = originalUnshift.apply(target, args);
        // Broadcast to all SSE clients
        const signal = args[0];
        const data = JSON.stringify({ type: "signal", signal });
        clients.forEach((res) => res.write(`data: ${data}\n\n`));
        return result;
      };
    }
    return typeof target[prop] === "function" ? target[prop].bind(target) : target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
});

// SSE endpoint — dashboard connects here to get live signals
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Send current state on connect
  const init = JSON.stringify({ type: "init", stats: getStats(), signals: state.signals.slice(0, 10) });
  res.write(`data: ${init}\n\n`);

  clients.add(res);
  console.log(`Dashboard client connected. Total: ${clients.size}`);

  req.on("close", () => {
    clients.delete(res);
    console.log(`Dashboard client disconnected. Total: ${clients.size}`);
  });
});

// Stats endpoint
app.get("/stats", (req, res) => {
  res.json({ ...getStats(), uptime: process.uptime(), interval: process.env.SCAN_INTERVAL_MINS || 60 });
});

// Signals history
app.get("/signals", (req, res) => {
  res.json(state.signals);
});

// Health check for Railway
app.get("/health", (req, res) => res.json({ ok: true }));

// Serve dashboard HTML
app.get("/", (req, res) => {
  res.send(getDashboardHTML());
});

app.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT}`);
  start();
});

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trump Trade Agent</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0a;color:#e8e8e0;font-family:'IBM Plex Sans',sans-serif;min-height:100vh;padding:24px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
  .logo{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:#fff}
  .badge{background:#4dffaa;color:#0a0a0a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:500;padding:3px 8px;border-radius:2px;letter-spacing:1px;animation:bp 2s infinite}
  @keyframes bp{0%,100%{opacity:1}50%{opacity:.6}}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .stat{background:#141414;border:1px solid #1e1e1e;border-radius:6px;padding:14px;text-align:center}
  .stat-val{font-family:'Bebas Neue',sans-serif;font-size:30px;color:#c8f135;line-height:1}
  .stat-label{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#444;letter-spacing:1px;margin-top:4px}
  .section-title{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#444;letter-spacing:2px;margin-bottom:10px}
  .signal-card{background:#0d1a05;border:1px solid #2a4a10;border-radius:6px;padding:18px;margin-bottom:10px;animation:fi .4s ease}
  @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .sig-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .ticker{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#c8f135;letter-spacing:2px}
  .direction{font-family:'Bebas Neue',sans-serif;font-size:20px;padding:4px 14px;border-radius:3px;letter-spacing:2px}
  .buy{background:rgba(77,255,170,.12);color:#4dffaa;border:1px solid #4dffaa}
  .sell{background:rgba(255,77,77,.12);color:#ff4d4d;border:1px solid #ff4d4d}
  .sig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
  .si-label{font-size:9px;color:#4a6a30;letter-spacing:1px;margin-bottom:3px}
  .si-val{font-size:13px;color:#c8f135;font-family:'IBM Plex Mono',monospace}
  .sig-reason{font-size:12px;color:#778870;line-height:1.6;border-top:1px solid #1a3010;padding-top:10px}
  .sig-meta{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#333;margin-top:8px}
  .confirmed{color:#4dffaa}.unconfirmed{color:#f5a623}
  .empty{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#333;padding:30px;text-align:center;background:#111;border:1px solid #1a1a1a;border-radius:6px}
  .ping{width:8px;height:8px;background:#4dffaa;border-radius:50%;display:inline-block;margin-right:8px;animation:bp 1.4s infinite}
  .interval-info{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#444}
  .interval-info span{color:#c8f135}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo">TRUMP TRADE AGENT</div>
    <div class="badge">LIVE</div>
  </div>
  <div class="interval-info">Scanning every <span id="intervalVal">—</span> mins</div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-val" id="statScans">0</div><div class="stat-label">SCANS RUN</div></div>
  <div class="stat"><div class="stat-val" id="statSignals">0</div><div class="stat-label">SIGNALS FOUND</div></div>
  <div class="stat"><div class="stat-val" id="statUptime">0m</div><div class="stat-label">UPTIME</div></div>
  <div class="stat"><div class="stat-val" id="statLast">—</div><div class="stat-label">LAST TICKER</div></div>
</div>

<div class="section-title">LIVE SIGNALS</div>
<div id="signalsFeed"><div class="empty"><span class="ping"></span>Watching for Trump stock mentions...</div></div>

<script>
  let uptimeSeconds = 0;
  let signalsRendered = 0;

  function fmt(secs) {
    const m = Math.floor(secs/60), h = Math.floor(m/60);
    return h > 0 ? h+'h '+( m%60)+'m' : m+'m';
  }

  function renderSignal(sig) {
    const feed = document.getElementById('signalsFeed');
    if (signalsRendered === 0) feed.innerHTML = '';
    signalsRendered++;

    const card = document.createElement('div');
    card.className = 'signal-card';
    const dir = sig.direction?.toLowerCase() || 'buy';
    const ts = new Date(sig.timestamp).toLocaleString();
    card.innerHTML = \`
      <div class="sig-top">
        <div>
          <div style="font-size:9px;color:#4a6a30;letter-spacing:1px;margin-bottom:3px">SIGNAL #\${sig.scanId || signalsRendered}</div>
          <div class="ticker">\${sig.ticker}</div>
          <div style="font-size:11px;color:#556650;margin-top:2px">\${sig.companyName}</div>
        </div>
        <div class="direction \${dir}">\${sig.direction}</div>
      </div>
      <div class="sig-grid">
        <div><div class="si-label">ENTRY</div><div class="si-val">\${sig.entryRange}</div></div>
        <div><div class="si-label">STOP LOSS</div><div class="si-val">\${sig.stopLoss}</div></div>
        <div><div class="si-label">TARGET</div><div class="si-val">\${sig.target}</div></div>
      </div>
      <div class="sig-reason">\${sig.reason}</div>
      <div class="sig-meta" style="margin-top:8px;display:flex;justify-content:space-between">
        <span>Source: \${sig.source}</span>
        <span class="\${sig.confirmed ? 'confirmed' : 'unconfirmed'}">\${sig.confirmed ? '✓ ' + sig.confirmationType : '⚠ unconfirmed'}</span>
      </div>
      <div class="sig-meta">\${ts}</div>
    \`;
    feed.insertBefore(card, feed.firstChild);
    document.getElementById('statLast').textContent = sig.ticker;
  }

  const evtSource = new EventSource('/events');
  evtSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'init') {
      document.getElementById('statScans').textContent = data.stats.scanCount;
      document.getElementById('statSignals').textContent = data.stats.signalCount;
      document.getElementById('intervalVal').textContent = data.stats.interval;
      uptimeSeconds = Math.floor(data.stats.uptime || 0);
      if (data.signals && data.signals.length > 0) {
        data.signals.reverse().forEach(renderSignal);
        document.getElementById('statLast').textContent = data.signals[data.signals.length-1]?.ticker || '—';
      }
    }
    if (data.type === 'signal') {
      const sig = data.signal;
      document.getElementById('statSignals').textContent = parseInt(document.getElementById('statSignals').textContent||0) + 1;
      document.getElementById('statScans').textContent = sig.scanId;
      renderSignal(sig);
    }
  };

  // Poll stats for scan count + uptime
  setInterval(async () => {
    const r = await fetch('/stats').then(r=>r.json()).catch(()=>null);
    if (r) {
      document.getElementById('statScans').textContent = r.scanCount;
      document.getElementById('statSignals').textContent = r.signalCount;
      document.getElementById('statUptime').textContent = fmt(Math.floor(r.uptime));
    }
  }, 15000);
</script>
</body>
</html>`;
}
