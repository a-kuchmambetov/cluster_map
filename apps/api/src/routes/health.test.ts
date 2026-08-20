import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app";

describe("GET /api/health", () => {
    it("returns 200 with status ok", async () => {
        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
