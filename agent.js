const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CONFIRM_MODE = process.env.CONFIRM_MODE || "volume";

let scanCount = 0;
let signalCount = 0;
let lastSignal = null;

const state = {
  scans: [],
  signals: [],
  status: "running",
  startedAt: new Date().toISOString(),
};

// Scan times in UTC (NZT = UTC+12)
// NZT 11:00pm = UTC 11:00
// NZT 1:00am  = UTC 13:00
// NZT 4:00am  = UTC 16:00
// NZT 8:00am  = UTC 20:00
const SCAN_TIMES_UTC = [
  { hour: 11, minute: 0, label: "NZT 11pm — US pre-market (Trump morning posts)" },
  { hour: 13, minute: 0, label: "NZT 1am  — US market open" },
  { hour: 16, minute: 0, label: "NZT 4am  — US afternoon / press briefings" },
  { hour: 20, minute: 0, label: "NZT 8am  — US post-market / Truth Social evening" },
];

async function scan(label) {
  scanCount++;
  const scanId = scanCount;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] Scan #${scanId} — ${label}`);
  state.scans.push({ id: scanId, timestamp, status: "searching", label });

  const prompt = `You are a financial signal agent monitoring US stock trade opportunities based on Trump statements.

Search the web for the VERY LATEST news (today or this week) where Donald Trump has mentioned, recommended, or talked positively or negatively about a specific US-listed stock, company, or sector. Also check for any crypto mentions including Bitcoin, Ethereum, or specific crypto projects.

Keywords to flag: buy, great stock, recommend, invest, beautiful company, going to explode, tremendous, believe in, great company, tariff impact on specific company, crypto, Bitcoin, strategic reserve

Confirmation requirement: ${
    CONFIRM_MODE === "volume"
      ? "Look for unusual trading volume spike as confirmation"
      : CONFIRM_MODE === "price"
      ? "Look for price momentum confirmation (stock already moving in direction)"
      : "Look for BOTH volume spike and price momentum as confirmation"
  }.

Risk style: Moderate — wait for at least one confirmation signal before recommending.

If you find a relevant signal respond ONLY with this JSON (no markdown, no backticks):
{"found":true,"ticker":"TICKER","direction":"BUY or SELL","companyName":"Full company name","entryRange":"$XX - $XX","stopLoss":"$XX","target":"$XX","confirmed":true or false,"confirmationType":"volume spike / price momentum / both / none","reason":"2-3 sentence explanation of what Trump said, why it moves the stock, and the confirmation signal.","source":"news headline or source name","sentiment":"bullish or bearish","urgency":"high or medium or low"}

If no relevant signal found respond ONLY with:
{"found":false,"reason":"Brief explanation of what you searched and found"}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const result = JSON.parse(jsonMatch[0]);

    const scanRecord = state.scans.find((s) => s.id === scanId);
    if (scanRecord) { scanRecord.status = "done"; scanRecord.found = result.found; }

    if (!result.found) {
      console.log(`[${new Date().toISOString()}] Scan #${scanId} — no signal. ${result.reason}`);
      return;
    }

    signalCount++;
    lastSignal = { ...result, scanId, timestamp };
    state.signals.unshift(lastSignal);
    if (state.signals.length > 50) state.signals.pop();

    console.log(`[${new Date().toISOString()}] SIGNAL #${signalCount}: ${result.ticker} ${result.direction} — ${result.confirmationType}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Source: ${result.source}`);

    await sendDiscordAlert(result, signalCount, label);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scan #${scanId} error:`, err.message);
    const scanRecord = state.scans.find((s) => s.id === scanId);
    if (scanRecord) scanRecord.status = "error";
  }
}

function scheduleScans() {
  console.log("Scheduled scan windows (UTC):");
  SCAN_TIMES_UTC.forEach(({ hour, minute, label }) => {
    console.log(`  ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} — ${label}`);
  });
  console.log("---");

  setInterval(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const match = SCAN_TIMES_UTC.find((t) => t.hour === utcHour && t.minute === utcMinute);
    if (match) scan(match.label);
  }, 60 * 1000);
}

async function start() {
  console.log("Trump Trade Agent starting...");
  console.log(`Confirmation mode: ${CONFIRM_MODE}`);
  await scan("Startup scan");
  scheduleScans();
}

async function sendDiscordAlert(result, signalNum, scanLabel) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) { console.log("No Discord webhook set, skipping."); return; }

  const color = result.direction === "BUY" ? 0x4dffaa : 0xff4d4d;
  const confirmed = result.confirmed
    ? `✅ Confirmed — ${result.confirmationType}`
    : `⚠️ Unconfirmed — wait for confirmation`;

  const payload = {
    username: "Trump Trade Agent",
    embeds: [{
      title: `🚨 Signal #${signalNum} — ${result.direction} $${result.ticker}`,
      description: result.reason,
      color,
      fields: [
        { name: "Company", value: result.companyName, inline: true },
        { name: "Direction", value: result.direction, inline: true },
        { name: "Urgency", value: result.urgency?.toUpperCase() || "—", inline: true },
        { name: "Entry Range", value: result.entryRange, inline: true },
        { name: "Stop Loss", value: result.stopLoss, inline: true },
        { name: "Target", value: result.target, inline: true },
        { name: "Confirmation", value: confirmed, inline: false },
        { name: "Source", value: result.source, inline: false },
        { name: "Scan Window", value: scanLabel, inline: false },
      ],
      footer: { text: "Trump Trade Agent • Moderate Risk • Volume Confirmation" },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const https = require("https");
    const body = JSON.stringify(payload);
    const url = new URL(webhookUrl);
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      }, (res) => {
        console.log(`Discord notification sent. Status: ${res.statusCode}`);
        resolve();
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    console.error("Discord webhook error:", err.message);
  }
}

module.exports = { start, state, getStats: () => ({ scanCount, signalCount, lastSignal }) };
