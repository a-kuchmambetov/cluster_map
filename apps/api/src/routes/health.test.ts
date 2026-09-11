import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../app";

const executeMock = vi.fn();

vi.mock("@repo/db", () => ({
    db: {
        execute: (...args: unknown[]) => executeMock(...args),
    },
}));

describe("GET /api/health", () => {
    afterEach(() => {
        executeMock.mockReset();
    });

    it("returns 200 with db ok when the database is reachable", async () => {
        executeMock.mockResolvedValueOnce(undefined);

        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok", db: "ok" });
    });

    it("returns 503 with db unreachable when the database is not reachable", async () => {
        executeMock.mockRejectedValueOnce(new Error("connection refused"));

        const response = await request(app).get("/api/health");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: "degraded", db: "unreachable" });
    });
});
