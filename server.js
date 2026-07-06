const express = require("express");
const { start, state, getStats } = require("./agent");

const app = express();
const PORT = process.env.PORT || 3000;
const clients = new Set();

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  const init = JSON.stringify({ type: "init", stats: getStats(), signals: state.signals.slice(0, 10) });
  res.write(`data: ${init}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

app.get("/stats", (req, res) => {
  res.json({ ...getStats(), uptime: process.uptime() });
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/", (req, res) => {
  const stats = getStats();
  const signals = state.signals;
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trump Trade Agent</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0a;color:#e8e8e0;font-family:'IBM Plex Sans',sans-serif;padding:24px}
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
  .logo{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;color:#fff}
  .badge{background:#4dffaa;color:#0a0a0a;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:500;padding:3px 8px;border-radius:2px;letter-spacing:1px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
  .stat{background:#141414;border:1px solid #1e1e1e;border-radius:6px;padding:14px;text-align:center}
  .stat-val{font-family:'Bebas Neue',sans-serif;font-size:30px;color:#c8f135;line-height:1}
  .stat-label{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#444;letter-spacing:1px;margin-top:4px}
  .section-title{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#444;letter-spacing:2px;margin-bottom:10px}
  .schedules{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px}
  .sched{background:#111;border:1px solid #1a1a1a;border-radius:4px;padding:10px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#556650}
  .sched span{color:#c8f135;display:block;font-size:13px;margin-bottom:2px}
  .signal-card{background:#0d1a05;border:1px solid #2a4a10;border-radius:6px;padding:18px;margin-bottom:10px}
  .sig-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .ticker{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#c8f135;letter-spacing:2px}
  .direction{font-family:'Bebas Neue',sans-serif;font-size:20px;padding:4px 14px;border-radius:3px;letter-spacing:2px}
  .buy{background:rgba(77,255,170,.12);color:#4dffaa;border:1px solid #4dffaa}
  .sell{background:rgba(255,77,77,.12);color:#ff4d4d;border:1px solid #ff4d4d}
  .sig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
  .si-label{font-size:9px;color:#4a6a30;letter-spacing:1px;margin-bottom:3px}
  .si-val{font-size:13px;color:#c8f135;font-family:'IBM Plex Mono',monospace}
  .sig-reason{font-size:12px;color:#778870;line-height:1.6;border-top:1px solid #1a3010;padding-top:10px}
  .sig-meta{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#333;margin-top:6px;display:flex;justify-content:space-between}
  .empty{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#333;padding:30px;text-align:center;background:#111;border:1px solid #1a1a1a;border-radius:6px}
  .ping{width:8px;height:8px;background:#4dffaa;border-radius:50%;display:inline-block;margin-right:8px}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo">TRUMP TRADE AGENT</div>
    <div class="badge">LIVE</div>
  </div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#444">4 scans/day • Discord alerts on</div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-val">${stats.scanCount}</div><div class="stat-label">SCANS RUN</div></div>
  <div class="stat"><div class="stat-val">${stats.signalCount}</div><div class="stat-label">SIGNALS FOUND</div></div>
  <div class="stat"><div class="stat-val">${stats.lastSignal?.ticker || "—"}</div><div class="stat-label">LAST TICKER</div></div>
</div>

<div class="section-title" style="margin-bottom:8px">DAILY SCAN SCHEDULE (NZT)</div>
<div class="schedules">
  <div class="sched"><span>11:00 PM</span>US pre-market — Trump morning posts</div>
  <div class="sched"><span>1:00 AM</span>US market open</div>
  <div class="sched"><span>4:00 AM</span>US afternoon / press briefings</div>
  <div class="sched"><span>8:00 AM</span>US post-market / Truth Social evening</div>
</div>

<div class="section-title">LIVE SIGNALS</div>
${signals.length === 0
  ? `<div class="empty"><span class="ping"></span>Watching for Trump stock mentions...</div>`
  : signals.map(sig => `
<div class="signal-card">
  <div class="sig-top">
    <div>
      <div style="font-size:9px;color:#4a6a30;letter-spacing:1px;margin-bottom:3px">SIGNAL #${sig.scanId}</div>
      <div class="ticker">${sig.ticker}</div>
      <div style="font-size:11px;color:#556650;margin-top:2px">${sig.companyName}</div>
    </div>
    <div class="direction ${sig.direction?.toLowerCase()}">${sig.direction}</div>
  </div>
  <div class="sig-grid">
    <div><div class="si-label">ENTRY</div><div class="si-val">${sig.entryRange}</div></div>
    <div><div class="si-label">STOP LOSS</div><div class="si-val">${sig.stopLoss}</div></div>
    <div><div class="si-label">TARGET</div><div class="si-val">${sig.target}</div></div>
  </div>
  <div class="sig-reason">${sig.reason}</div>
  <div class="sig-meta">
    <span>Source: ${sig.source}</span>
    <span>${sig.confirmed ? "✓ " + sig.confirmationType : "⚠ unconfirmed"}</span>
  </div>
  <div class="sig-meta"><span>${new Date(sig.timestamp).toLocaleString()}</span></div>
</div>`).join("")}
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT}`);
  start();
});
