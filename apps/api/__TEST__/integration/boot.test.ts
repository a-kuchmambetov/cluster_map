import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished } from "vitest";

const apiDirectory = fileURLToPath(new URL("../../", import.meta.url));

describe("API entrypoint signal smoke", () => {
  it.each([
    ["production", "SIGTERM"],
    ["production", "SIGINT"],
    ["development", "SIGTERM"],
    ["development", "SIGINT"],
  ] as const)(
    "%s boots without a DB, keeps liveness local and aborts a stalled probe on %s",
    async (mode, signal) => {
      const sockets = new Set<Socket>();
      // This TCP listener deliberately never speaks PostgreSQL. It is owned only
      // by this test; no existing databases or arbitrary processes are contacted.
      const blackhole = createServer((socket) => {
        sockets.add(socket);
        socket.once("close", () => sockets.delete(socket));
        socket.resume();
      });
      blackhole.listen(0, "127.0.0.1");
      await once(blackhole, "listening");
      const pgPort = (blackhole.address() as { port: number }).port;
      const child = spawn(
        // Match dev Compose: signal the watcher itself, never its API child.
        mode === "development" ? "./node_modules/.bin/tsx" : process.execPath,
        mode === "development"
          ? ["watch", "--include", "./src", "./src/index.ts"]
          : ["--import", "tsx", "src/index.ts"],
        {
          cwd: apiDirectory,
          env: {
            ...process.env,
            NODE_ENV: mode,
            API_PORT: "0",
            PG_HOST: "127.0.0.1",
            PG_PORT: String(pgPort),
            PG_PASSWORD: "smoke-private/password",
            PG_USER: "smoke",
            PG_DB: "smoke",
            BETTER_AUTH_SECRET: "smoke-secret-that-is-at-least-32-characters",
            BETTER_AUTH_URL: "https://api.example",
            WEB_ORIGIN: "https://map.example",
            GITHUB_CLIENT_ID: "smoke",
            GITHUB_CLIENT_SECRET: "smoke-oauth-secret",
            SHUTDOWN_TIMEOUT_MS: mode === "development" ? "4000" : "1000",
            LOG_LEVEL: "info",
          },
          stdio: ["ignore", "pipe", "pipe"],
          // Cleanup can target only this test's watcher and its descendants.
          detached: mode === "development",
        },
      );
      onTestFinished(() => {
        if (mode === "development" && child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
        } else if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
        for (const socket of sockets) socket.destroy();
        blackhole.close();
      });
      let stdout = "";
      let stderr = "";
      const exited = once(child, "exit");
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      const started = new Promise<number>((resolve, reject) => {
        child.stdout.on("data", (chunk) => {
          stdout += String(chunk);
          const lines = stdout.trim().split("\n");
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.event === "server_started") resolve(entry.port);
            } catch {
              /* An incomplete JSON line waits for the next chunk. */
            }
          }
        });
        child.once("error", reject);
        child.once("exit", () =>
          reject(new Error(`API failed to start: ${stderr}`)),
        );
      });
      const port = await started;
      const origin = `http://127.0.0.1:${port}`;
      const live = await fetch(`${origin}/api/health`);
      expect(live.status).toBe(200);
      expect(await live.json()).toEqual({ status: "ok" });
      expect(sockets.size).toBe(0);
      if (signal === "SIGTERM") {
        const firstConnected = once(blackhole, "connection");
        const timeoutProbe = fetch(`${origin}/api/health/ready`);
        const [firstSocket] = await firstConnected;
        const closed = once(firstSocket, "close");
        expect((await timeoutProbe).status).toBe(503);
        await closed;
        expect(sockets.size).toBe(0);
      }
      const connected = once(blackhole, "connection");
      const probe = fetch(`${origin}/api/health/ready`).then(
        (response) => response.status,
        () => 0,
      );
      await connected;
      const startedAt = Date.now();
      child.kill(signal);
      const [code, exitSignal] = await exited;
      expect(code, stdout + stderr).toBe(0);
      expect(exitSignal).toBeNull();
      expect(Date.now() - startedAt).toBeLessThan(1500);
      expect(await probe).toBe(503);
      expect(stdout).toContain('"event":"shutdown_completed"');
      expect(stdout).not.toContain('"event":"shutdown_forced"');
      expect(stdout + stderr).not.toMatch(
        /smoke-private|smoke-oauth|smoke-secret|postgres:\/\//,
      );
    },
    8000,
  );
});

it.each(["http", "database"])(
  "forces child exit at the overall deadline for hanging %s",
  async (mode) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "__TEST__/fixtures/shutdown.ts", mode],
      { cwd: apiDirectory, stdio: ["ignore", "pipe", "pipe"] },
    );
    onTestFinished(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    });
    let output = "";
    const exited = once(child, "exit");
    const port = await new Promise<number>((resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
        const firstLine = output.split("\n")[0];
        try {
          const entry = JSON.parse(firstLine);
          if (entry.event === "server_started") resolve(entry.port);
        } catch {
          /* Incomplete line. */
        }
      });
      child.once("error", reject);
    });
    if (mode === "http") {
      const response = await fetch(`http://127.0.0.1:${port}/hold`);
      void response.text().catch(() => {});
    }
    const start = Date.now();
    child.kill("SIGTERM");
    const [code, signal] = await exited;
    expect(code).toBe(1);
    expect(signal).toBeNull();
    expect(Date.now() - start).toBeLessThan(1000);
    expect(output).toContain('"event":"shutdown_forced"');
  },
  4000,
);
