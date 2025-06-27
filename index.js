import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const SELF_URL = "https://ceroydata.onrender.com/leaderboard/top14";
const API_KEY = "FbIc2agHLlrBXGZblcmgdGDv6MX6C1Zi";

let cachedData = [];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

function maskUsername(username) {
  if (username.length <= 4) return username;
  return username.slice(0, 2) + "***" + username.slice(-2);
}

function getDynamicApiUrl() {
  const now = new Date();
  let startMonth = now.getUTCMonth();
  let startYear = now.getUTCFullYear();

  if (now.getUTCDate() < 26) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  const start = new Date(Date.UTC(startYear, startMonth, 26));
  const end = new Date(Date.UTC(startYear, startMonth + 1, 25, 23, 59, 59));

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  console.log(`[ℹ️] Fetching data from ${startStr} to ${endStr}`);

  return `https://services.rainbet.com/v1/external/affiliates?start_at=${startStr}&end_at=${endStr}&key=${API_KEY}`;
}


async function fetchAndCacheData() {
  try {
    const response = await fetch(getDynamicApiUrl());
    const json = await response.json();
    if (!json.affiliates) throw new Error("No data");

    const sorted = json.affiliates.sort(
      (a, b) => parseFloat(b.wagered_amount) - parseFloat(a.wagered_amount)
    );

    const top10 = sorted.slice(0, 20);
    if (top10.length >= 2) [top10[0], top10[1]] = [top10[1], top10[0]];

    cachedData = top10.map(entry => ({
      username: maskUsername(entry.username),
      wagered: Math.round(parseFloat(entry.wagered_amount)),
      weightedWager: Math.round(parseFloat(entry.wagered_amount)),
    }));

    console.log(`[✅] Leaderboard updated`);
  } catch (err) {
    console.error("[❌] Failed to fetch Rainbet data:", err.message);
  }
}

fetchAndCacheData();
setInterval(fetchAndCacheData, 5 * 60 * 1000); // every 5 minutes

app.get("/leaderboard/top14", (req, res) => {
  res.json(cachedData);
});

setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log(`[🔁] Self-pinged ${SELF_URL}`))
    .catch(err => console.error("[⚠️] Self-ping failed:", err.message));
}, 270000); // every 4.5 mins

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
