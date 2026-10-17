import type { Actor } from "../../../src/features/auth/auth.types.js";
import express from "express";
import request from "supertest";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@repo/errors";
import { createRequireAuth } from "../../../src/middleware/requireAuth.js";
import {
  authenticatedHandler,
  requireRole,
} from "../../../src/middleware/actor.js";
import { handler } from "../../../src/middleware/handler.js";
import { errorMiddleware } from "../../../src/middleware/error.js";

const session = {
  user: {
    id: "trusted",
    role: "admin" as const,
    name: "Admin",
    email: "admin@example.test",
    emailVerified: true,
  },
};

describe("typed authentication boundary", () => {
  it("makes locals optional for plain handlers", async () => {
    const app = express().get(
      "/",
      handler({}, (_context, res) => {
        expectTypeOf(res.locals.actor).toEqualTypeOf<Actor | undefined>();
        res.sendStatus(204);
      }),
    );
    expect((await request(app).get("/")).status).toBe(204);
  });

  it("attaches only server-resolved identity and preserves inference, validation once and async forwarding", async () => {
    const getSession = vi.fn().mockResolvedValue(session);
    const transform = vi.fn((text: string) => text.length);
    const schemas = {
      params: z.object({ id: z.string() }),
      body: z.object({ text: z.string().transform(transform) }),
      query: z.object({ page: z.coerce.number() }),
    };
    const parses = Object.values(schemas).map((schema) =>
      vi.spyOn(schema, "parse"),
    );
    const app = express()
      .use(express.json())
      .use(createRequireAuth({ getSession }));
    app.post(
      "/:id",
      requireRole("admin"),
      authenticatedHandler(
        schemas,
        async ({ actor, params, body, query }, res) => {
          expectTypeOf(actor).toEqualTypeOf<Actor>();
          expectTypeOf(params).toEqualTypeOf<{ id: string }>();
          expectTypeOf(body).toEqualTypeOf<{ text: number }>();
          expectTypeOf(query).toEqualTypeOf<{ page: number }>();
          expect(Object.isFrozen(actor)).toBe(true);
          expect(actor).toEqual({ id: "trusted", role: "admin" });
          expect(res.locals.actor).toBe(actor);
          await Promise.resolve();
          throw AppError.forbidden("Asynchronous rejection");
        },
      ),
    );
    app.use(errorMiddleware);
    const result = await request(app)
      .post("/target?page=2")
      .set("X-Role", "user")
      .set("X-User-Id", "forged")
      .send({ text: "abc", actor: { id: "forged" } });
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Asynchronous rejection");
    expect(getSession).toHaveBeenCalledOnce();
    for (const parse of parses) expect(parse).toHaveBeenCalledOnce();
    expect(transform).toHaveBeenCalledOnce();
  });

  it.each(["role", "handler"])(
    "fails closed if auth middleware is absent before %s",
    async (kind) => {
      const called = vi.fn();
      const app = express();
      if (kind === "role") app.get("/", requireRole("admin"), called);
      else app.get("/", authenticatedHandler({}, called));
      app.use(errorMiddleware);
      expect((await request(app).get("/")).status).toBe(401);
      expect(called).not.toHaveBeenCalled();
    },
  );

  it("retains optional schema output inference for authenticated handlers", async () => {
    const schemas: { params?: z.ZodObject<{ id: z.ZodString }> } = {};
    const app = express().use(
      createRequireAuth({ getSession: vi.fn().mockResolvedValue(session) }),
    );
    app.get(
      "/",
      authenticatedHandler(schemas, ({ actor, params, body, query }, res) => {
        expectTypeOf(actor).toEqualTypeOf<Actor>();
        expectTypeOf(params).toEqualTypeOf<{ id: string } | undefined>();
        expectTypeOf(body).toEqualTypeOf<undefined>();
        expectTypeOf(query).toEqualTypeOf<undefined>();
        res.sendStatus(204);
      }),
    );
    expect((await request(app).get("/")).status).toBe(204);
  });
});
