import type { Request, RequestHandler, Response } from "express";
import type { output, ZodTypeAny } from "zod";

type Parsed<Schema> = Schema extends ZodTypeAny ? output<Schema> : undefined;

type RequestSchemas = {
  params?: ZodTypeAny;
  body?: ZodTypeAny;
  query?: ZodTypeAny;
};

// Keep parsed outputs separate from the HTTP request: Express 5's query is a getter.
// Returning the controller's result lets Express forward synchronous throws and
// rejected promises to the existing error middleware.
export function handler<Schemas extends RequestSchemas>(
  schemas: Schemas,
  controller: (
    context: {
      req: Request;
      params: Parsed<Schemas["params"]>;
      body: Parsed<Schemas["body"]>;
      query: Parsed<Schemas["query"]>;
    },
    res: Response,
  ) => unknown,
): RequestHandler {
  return (req, res) =>
    controller(
      {
        req,
        params: schemas.params?.parse(req.params),
        body: schemas.body?.parse(req.body),
        query: schemas.query?.parse(req.query),
      },
      res,
    );
}
