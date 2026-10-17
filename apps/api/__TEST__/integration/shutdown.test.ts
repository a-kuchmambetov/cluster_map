import { createServer, get } from "node:http";
import { connect } from "node:net";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { createRuntime } from "../../src/lifecycle/runtime.js";
import { createShutdown } from "../../src/lifecycle/shutdown.js";
import { createOccupancyPool } from "../../src/features/clusters/clusters.pool.js";
import { createTestDependencies } from "../helpers/fakes.js";
import { captureLogs } from "../helpers/logs.js";

const repo = vi.hoisted(() => ({ occupancy: vi.fn() }));
vi.mock("../../src/features/clusters/clusters.repository.js", () => ({
  getClusterOccupancy: repo.occupancy,
}));

describe("real HTTP draining", () => {
  it("ends SSE, drains normal HTTP and an in-flight poll before DB close, with no late writes", async () => {
    const runtime = createRuntime();
    const { logger, entries } = captureLogs();
    let settlePoll!: (rows: never[]) => void;
    repo.occupancy.mockImplementation(
      () =>
        new Promise((resolve) => {
          settlePoll = resolve;
        }),
    );
    const deps = createTestDependencies();
    const app = createApp({
      ...deps,
      runtime,
      logger,
      occupancyPool: createOccupancyPool(runtime),
    });
    let finishHttp!: () => void;
    app.get("/slow", (_req, res) => {
      finishHttp = () => res.end("finished");
    });
    const server = createServer(app);
    const closeDatabase = vi.fn(async () => {});
    const exit = vi.fn();
    const lifecycle = createShutdown({
      server,
      runtime,
      logger,
      closeDatabase,
      exit,
      timeoutMs: 1000,
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const sseRequest = get(`http://127.0.0.1:${port}/api/clusters/1/events`);
    const [stream] = await once(sseRequest, "response");
    stream.resume();
    const ended = once(stream, "end");
    let httpBody = "";
    const normalResponse = new Promise<void>((resolve, reject) => {
      const slowRequest = get(`http://127.0.0.1:${port}/slow`, (response) => {
        response.on("data", (chunk) => {
          httpBody += chunk;
        });
        response.once("end", resolve);
        response.once("error", reject);
      });
      slowRequest.once("error", reject);
    });
    if (!finishHttp) await once(server, "request");
    const done = lifecycle.shutdown();
    await ended;
    expect(closeDatabase).not.toHaveBeenCalled();
    finishHttp();
    await normalResponse;
    expect(closeDatabase).not.toHaveBeenCalled();
    settlePoll([]);
    await done;
    expect(httpBody).toBe("finished");
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(
      entries.filter((entry) => entry.path === "/api/clusters/1/events"),
    ).toHaveLength(1);
    expect(repo.occupancy).toHaveBeenCalledOnce();
  });
  it("destroys upgraded connections at the hard deadline", async () => {
    const server = createServer();
    server.on("upgrade", (_req, socket) => {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: test\r\n\r\n",
      );
    });
    const { logger } = captureLogs();
    const exit = vi.fn();
    const lifecycle = createShutdown({
      server,
      runtime: createRuntime(),
      logger,
      closeDatabase: async () => {},
      exit,
      timeoutMs: 75,
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const socket = connect(
      (server.address() as { port: number }).port,
      "127.0.0.1",
    );
    await once(socket, "connect");
    socket.write(
      "GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: test\r\n\r\n",
    );
    await once(socket, "data");
    const closed = once(socket, "close");
    await lifecycle.shutdown();
    await closed;
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});

it("retains disconnected handler ownership and logs the aborted request once", async () => {
  const runtime = createRuntime();
  const { logger, entries } = captureLogs();
  const deps = createTestDependencies();
  let finishSession!: () => void;
  let started!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  deps.authService.getSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishSession = () =>
          resolve({
            user: {
              id: "test",
              name: "test",
              email: "test@example.com",
              emailVerified: false,
              image: null,
              role: "user",
            },
          });
        started();
      }),
  );
  const server = createServer(createApp({ ...deps, runtime, logger }));
  const closeDatabase = vi.fn(async () => {});
  const lifecycle = createShutdown({
    server,
    runtime,
    logger,
    closeDatabase,
    exit: vi.fn(),
    timeoutMs: 1000,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const client = get(
    `http://127.0.0.1:${(server.address() as { port: number }).port}/api/auth/session`,
  );
  client.on("error", () => {});
  await began;
  const closed = once(server, "close");
  client.destroy();
  const done = lifecycle.shutdown();
  await closed;
  expect(closeDatabase).not.toHaveBeenCalled();
  finishSession();
  await done;
  expect(closeDatabase).toHaveBeenCalledOnce();
  expect(
    entries.filter((entry) => entry.event === "request_completed"),
  ).toEqual([
    expect.objectContaining({ path: "/api/auth/session", outcome: "aborted" }),
  ]);
});
