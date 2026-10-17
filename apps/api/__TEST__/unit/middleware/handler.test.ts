import express, { type ErrorRequestHandler } from "express";
import request from "supertest";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@repo/errors";
import { clusterNumberParamSchema } from "../../../src/features/clusters/clusters.schema.js";
import { errorMiddleware } from "../../../src/middleware/error.js";
import { handler } from "../../../src/middleware/handler.js";

describe("handler", () => {
  it("keeps optional schemas optional in the controller context", async () => {
    const schemas: { params?: typeof clusterNumberParamSchema } = {};
    const app = express().get(
      "/",
      handler(schemas, ({ params, body, query }, res) => {
        expectTypeOf(params).toEqualTypeOf<
          { clusterNumber: number } | undefined
        >();
        expectTypeOf(body).toEqualTypeOf<undefined>();
        expectTypeOf(query).toEqualTypeOf<undefined>();
        expect(params).toBeUndefined();
        res.sendStatus(204);
      }),
    );
    app.use(errorMiddleware);

    expect((await request(app).get("/")).status).toBe(204);
  });

  it("infers Zod outputs, parses each part once and preserves the HTTP request", async () => {
    const transformBody = vi.fn((value: string) => ({ length: value.length }));
    const transformQuery = vi.fn((page: number) => page + 1);
    const schemas = {
      params: clusterNumberParamSchema,
      body: z.object({ name: z.string().transform(transformBody) }),
      query: z.object({ page: z.coerce.number().transform(transformQuery) }),
    };
    const parsed = Object.values(schemas).map((schema) =>
      vi.spyOn(schema, "parse"),
    );
    const closed = vi.fn();
    const app = express().use(express.json());
    app.post(
      "/clusters/:clusterNumber",
      handler(schemas, ({ params, body, query, req }, res) => {
        expectTypeOf(params).toEqualTypeOf<{ clusterNumber: number }>();
        expectTypeOf(body).toEqualTypeOf<{ name: { length: number } }>();
        expectTypeOf(query).toEqualTypeOf<{ page: number }>();
        expectTypeOf(params.clusterNumber).not.toBeAny();
        expectTypeOf(body.name).not.toBeAny();
        expectTypeOf(query.page).not.toBeAny();
        req.on("close", closed);
        res.setHeader("X-Request-Method", req.method);
        res.status(201).json({
          params,
          body,
          query,
          original: { params: req.params, body: req.body, query: req.query },
          cookie: req.headers.cookie,
        });
      }),
    );
    app.use(errorMiddleware);

    const response = await request(app)
      .post("/clusters/2?page=3")
      .set("Cookie", "session=token")
      .send({ name: "Alice" });

    expect(response.status).toBe(201);
    expect(response.headers["x-request-method"]).toBe("POST");
    expect(response.body).toEqual({
      params: { clusterNumber: 2 },
      body: { name: { length: 5 } },
      query: { page: 4 },
      original: {
        params: { clusterNumber: "2" },
        body: { name: "Alice" },
        query: { page: "3" },
      },
      cookie: "session=token",
    });
    for (const parse of parsed) {
      expect(parse).toHaveBeenCalledOnce();
      parse.mockRestore();
    }
    expect(transformBody).toHaveBeenCalledOnce();
    expect(transformQuery).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("validates query against Express 5's getter without assigning to it", async () => {
    const app = express();
    const descriptor = Object.getOwnPropertyDescriptor(app.request, "query");
    // The accessor lives on Express's shared request prototype.
    const queryDescriptor =
      descriptor ?? Object.getOwnPropertyDescriptor(express.request, "query");
    expect(queryDescriptor?.get).toBeTypeOf("function");
    expect(queryDescriptor?.set).toBeUndefined();
    app.get(
      "/",
      handler(
        { query: z.object({ page: z.coerce.number().default(1) }) },
        ({ query, params, body, req }, res) => {
          expectTypeOf(params).toEqualTypeOf<undefined>();
          expectTypeOf(body).toEqualTypeOf<undefined>();
          res.json({ query, original: req.query });
        },
      ),
    );
    app.use(errorMiddleware);

    expect((await request(app).get("/?page=2")).body).toEqual({
      query: { page: 2 },
      original: { page: "2" },
    });
    expect((await request(app).get("/")).body).toEqual({
      query: { page: 1 },
      original: {},
    });
  });

  it.each(["params", "body", "query"] as const)(
    "rejects invalid %s before invoking the controller",
    async (part) => {
      const controller = vi.fn();
      const app = express().use(express.json());
      app.post(
        "/:id",
        handler({ [part]: z.object({ id: z.string().uuid() }) }, controller),
      );
      app.use(errorMiddleware);

      const response = await request(app)
        .post("/invalid?id=invalid")
        .send({ id: "invalid" });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        ok: false,
        status: "fail",
        code: "VALIDATION_ERROR",
        error: "Validation error",
        details: [
          { path: "id", message: "Invalid uuid", code: "invalid_string" },
        ],
      });
      expect(controller).not.toHaveBeenCalled();
    },
  );

  it("passes an unparsed body as undefined for schema defaults", async () => {
    const app = express().use(express.json());
    app.post(
      "/",
      handler(
        { body: z.object({ name: z.string() }).default({ name: "default" }) },
        ({ body, req }, res) => {
          expect(req.body).toBeUndefined();
          res.json(body);
        },
      ),
    );
    app.use(errorMiddleware);

    const response = await request(app).post("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "default" });
  });

  it.each(["sync", "async"])(
    "lets Express forward a %s controller failure exactly once",
    async (mode) => {
      const failure = AppError.forbidden("Access denied");
      const controller =
        mode === "sync"
          ? () => {
              throw failure;
            }
          : () => Promise.reject(failure);
      const errors = vi.fn<ErrorRequestHandler>((error, req, res, next) => {
        errorMiddleware(error, req, res, next);
      });
      const fallback = vi.fn<ErrorRequestHandler>(
        (_error, _req, res, _next) => {
          res.end();
        },
      );
      const app = express()
        .get("/", handler({}, controller))
        .use(errors)
        .use(fallback);

      const response = await request(app).get("/");

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        status: "fail",
        code: "FORBIDDEN",
        error: "Access denied",
      });
      expect(errors).toHaveBeenCalledOnce();
      expect(errors.mock.calls[0][0]).toBe(failure);
      expect(fallback).not.toHaveBeenCalled();
    },
  );
});
