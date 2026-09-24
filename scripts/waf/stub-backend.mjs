#!/usr/bin/env node
// Minimal stand-in for the API, used by scripts/waf/smoke.sh --stub.
//
// Lets the WAF rules be exercised without Postgres, migrations or Better Auth,
// which is what the CI job uses. Two behaviours matter:
//
//   * any path ending in /events streams text/event-stream on a 1s tick, so a
//     proxy that buffers responses shows up as events arriving in one batch;
//   * every other path echoes the forwarded headers back as JSON, so the
//     X-Forwarded-For chain the API would see can be asserted.
import { createServer } from "node:http";

const PORT = 8081;
const TICKS = 5;
const TICK_MS = 1000;

function streamEvents(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  let tick = 0;
  const send = () => {
    res.write(`data: ${JSON.stringify({ tick, at: Date.now() })}\n\n`);
    tick += 1;
    if (tick >= TICKS) {
      clearInterval(timer);
      res.end();
    }
  };

  // First event immediately, so a buffering proxy is visible as a delay rather
  // than being confused with the tick interval itself.
  send();
  const timer = setInterval(send, TICK_MS);
  res.on("close", () => clearInterval(timer));
}

function echoHeaders(req, res) {
  const body = JSON.stringify({
    uri: req.url,
    method: req.method,
    xff: req.headers["x-forwarded-for"] ?? "",
    xfp: req.headers["x-forwarded-proto"] ?? "",
    xRealIp: req.headers["x-real-ip"] ?? "",
    host: req.headers.host ?? "",
  });
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

createServer((req, res) => {
  // Drain the request body so keep-alive connections are not left stalled.
  req.resume();

  const { pathname } = new URL(req.url, "http://stub-backend");
  if (pathname.replace(/\/+$/, "").endsWith("/events")) {
    streamEvents(res);
  } else {
    echoHeaders(req, res);
  }
}).listen(PORT);
