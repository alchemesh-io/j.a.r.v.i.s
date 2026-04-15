const http = require("http");
const fs = require("fs");

const PORT = 8080;
const STATE_FILE = "/tmp/claude-state";
const BACKEND_URL = process.env.BACKEND_URL;
const WORKER_ID = process.env.WORKER_ID;

let lastPushedState = null;

function getClaudeState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return "initialized";
    }
    return fs.readFileSync(STATE_FILE, "utf-8").trim() || "initialized";
  } catch {
    return "initialized";
  }
}

async function pushStateToBackend(state) {
  if (!BACKEND_URL || !WORKER_ID) return;
  if (state === lastPushedState) return;

  try {
    const url = `${BACKEND_URL}/api/v1/workers/${WORKER_ID}`;
    const resp = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (resp.ok) {
      lastPushedState = state;
    }
  } catch {
    // Backend unreachable — ignore, will retry on next poll
  }
}

// Poll state file and push changes to backend
setInterval(() => {
  const state = getClaudeState();
  pushStateToBackend(state);
}, 3000);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    const state = getClaudeState();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ state }));
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[status-server] Listening on port ${PORT}`);
});
