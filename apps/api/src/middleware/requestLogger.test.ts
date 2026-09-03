import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../app";

describe("requestLogger", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logs timestamp, method, path, status and response time on a successful request", async () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});

        await request(app).get("/api/clusters");

        expect(spy).toHaveBeenCalledOnce();
        const line = spy.mock.calls[0][0] as string;
        expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
        expect(line).toContain("GET");
        expect(line).toContain("/api/clusters");
        expect(line).toContain("200");
        expect(line).toMatch(/\d+ms/);
        expect(line).not.toContain("["); // no errorCode bracket on success
    });

    it("includes the error code in the log on a 404 response", async () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {}); // suppress error middleware output

        await request(app).get("/api/clusters/999/map");

        expect(spy).toHaveBeenCalledOnce();
        const line = spy.mock.calls[0][0] as string;
        expect(line).toContain("404");
        expect(line).toContain("[CLUSTER_NOT_FOUND]");
    });

    it("does not log any peer data from an occupancy response", async () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});

        // This endpoint returns a response containing intraName, displayName and photo
        // from the occupancy fixture. None of it should appear in the log.
        await request(app).get("/api/clusters/1/map");

        const allOutput = spy.mock.calls.map((call) => String(call[0])).join("\n");
        expect(allOutput).not.toContain("jdoe");
        expect(allOutput).not.toContain("John Doe");
        expect(allOutput).not.toContain("intraName");
        expect(allOutput).not.toContain("displayName");
        expect(allOutput).not.toContain("photo");
        expect(allOutput).not.toContain("peer");
    });
});
