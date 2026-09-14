import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { healthHandler } from "./health";

function makeRes() {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    return { res: { json, status } as unknown as Response, json, status };
}

describe("healthHandler", () => {
    it("responds 200 with db ok when the database is reachable", async () => {
        const { res, json, status } = makeRes();
        await healthHandler(() => Promise.resolve(true))({} as Request, res);

        expect(status).not.toHaveBeenCalled();
        expect(json).toHaveBeenCalledWith({ status: "ok", db: "ok" });
    });

    it("responds 503 with db unreachable when the database is not reachable", async () => {
        const { res, json, status } = makeRes();
        await healthHandler(() => Promise.resolve(false))({} as Request, res);

        expect(status).toHaveBeenCalledWith(503);
        expect(json).toHaveBeenCalledWith({ status: "degraded", db: "unreachable" });
    });
});
