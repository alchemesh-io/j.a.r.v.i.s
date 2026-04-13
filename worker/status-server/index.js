const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");

const PORT = 8080;

function getClaudeStatus() {
  try {
    const pidFile = "/tmp/claude.pid";
    if (!fs.existsSync(pidFile)) {
      return { state: "error", message: "Claude Code process not running" };
    }

    const pid = fs.readFileSync(pidFile, "utf-8").trim();

    // Check if process is alive
    try {
      process.kill(parseInt(pid), 0);
    } catch {
      return { state: "error", message: "Claude Code process not running" };
    }

    // Check if Claude Code is actively writing (has recent fd activity)
    // A simple heuristic: check if the process has been CPU-active recently
    try {
      const stat = execSync(`ps -o state= -p ${pid}`, { encoding: "utf-8" }).trim();
      // S = sleeping (waiting for input), R = running (working)
      if (stat.startsWith("R") || stat.startsWith("D")) {
        return { state: "working" };
      }
      return { state: "waiting_for_human" };
    } catch {
      return { state: "waiting_for_human" };
    }
  } catch (err) {
    return { state: "error", message: err.message };
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    const status = getClaudeStatus();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status));
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
