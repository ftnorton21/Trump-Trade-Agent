const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const INTERVAL_MINS = parseInt(process.env.SCAN_INTERVAL_MINS || "60");
const CONFIRM_MODE = process.env.CONFIRM_MODE || "volume";

let scanCount = 0;
let signalCount = 0;
let lastSignal = null;

// In-memory store for the dashboard to read
const state = {
  scans: [],
  signals: [],
  status: "running",
  startedAt: new Date().toISOString(),
};

async function scan() {
  scanCount++;
  const scanId = scanCount;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] Scan #${scanId} starting...`);
  state.scans.push({ id: scanId, timestamp, status: "searching" });

  const prompt = `You are a financial signal agent monitoring US stock trade opportunities based on Trump statements.

Search the web for the VERY LATEST news (today or this week) where Donald Trump has mentioned, recommended, or talked positively or negatively about a specific US-listed stock, company, or sector.

Keywords to flag: buy, great stock, recommend, invest, beautiful company, going to explode, tremendous, believe in, great company, tariff impact on specific company

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

    // Update scan record
    const scan = state.scans.find((s) => s.id === scanId);
    if (scan) {
      scan.status = "done";
      scan.found = result.found;
    }

    if (!result.found) {
      console.log(`[${new Date().toISOString()}] Scan #${scanId} — no signal. ${result.reason}`);
      return;
    }

    signalCount++;
    lastSignal = { ...result, scanId, timestamp };
    state.signals.unshift(lastSignal);
    if (state.signals.length > 50) state.signals.pop(); // keep last 50

    console.log(`[${new Date().toISOString()}] SIGNAL #${signalCount}: ${result.ticker} ${result.direction} — ${result.confirmationType}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Source: ${result.source}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scan #${scanId} error:`, err.message);
    const scan = state.scans.find((s) => s.id === scanId);
    if (scan) scan.status = "error";
  }
}

async function start() {
  console.log(`Trump Trade Agent starting...`);
  console.log(`Interval: every ${INTERVAL_MINS} minutes`);
  console.log(`Confirmation mode: ${CONFIRM_MODE}`);
  console.log(`---`);

  // Run immediately on start
  await scan();

  // Then on interval
  setInterval(scan, INTERVAL_MINS * 60 * 1000);
}

module.exports = { start, state, getStats: () => ({ scanCount, signalCount, lastSignal }) };
