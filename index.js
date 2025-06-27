import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

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

function getDateRange() {
  const now = new Date();

  // If it's after the 25th UTC, use current month for end
  let endMonth = now.getUTCMonth();
  let endYear = now.getUTCFullYear();

  if (now.getUTCDate() <= 25) {
    endMonth -= 1;
    if (endMonth < 0) {
      endMonth = 11;
      endYear -= 1;
    }
  }

  const end = new Date(Date.UTC(endYear, endMonth + 1, 25, 23, 59, 59));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 26, 0, 0, 0));

  return {
    start_at: start.toISOString().split("T")[0],
    end_at: end.toISOString().split("T")[0],
  };
}

async function fetchAndCacheData() {
  try {
    const { start_at, end_at } = getDateRange();

    const API_URL = `https://services.rainbet.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=FbIc2agHLlrBXGZblcmgdGDv6MX6C1Zi`;

    const response = await fetch(API_URL);
    const json = await response.json();

    if (!json.affiliates || !Array.isArray(json.affiliates)) {
      throw new Error("Invalid affiliate data");
    }

    const filtered = json.affiliates.filter(
      a =>
        a.username &&
        !a.username.toLowerCase().includes("tyler") &&
        !isNaN(parseFloat(a.wagered_amount))
    );

    const sorted = filtered.sort(
      (a, b) => parseFloat(b.wagered_amount) - parseFloat(a.wagered_amount)
    );

    const top10 = sorted.slice(0, 10);

    if (top10.length >= 2) {
      [top10[0], top10[1]] = [top10[1], top10[0]];
    }

    cachedData = top10.map(entry => {
      const wager = Math.round(parseFloat(entry.wagered_amount));
      return {
        username: maskUsername(entry.username),
        wagered: wager,
        weightedWager: wager
      };
    });

    console.log(`[✅] Leaderboard updated for period ${start_at} → ${end_at}`);
  } catch (err) {
    console.error("[❌] Failed to fetch Rainbet data:", err.message);
  }
}

fetchAndCacheData();
setInterval(fetchAndCacheData, 5 * 60 * 1000); // every 5 minutes

app.get("/leaderboard/top14", (req, res) => {
  res.json(cachedData);
});

// Optional self-ping to keep alive
const SELF_URL = "https://ceroydata.onrender.com/leaderboard/top14";
setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log(`[🔁] Self-pinged ${SELF_URL}`))
    .catch(err => console.error("[⚠️] Self-ping failed:", err.message));
}, 270000); // every 4.5 minutes

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
