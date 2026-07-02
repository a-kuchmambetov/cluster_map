import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";

type RequestSchemas = {
    body?: ZodTypeAny;
    query?: ZodTypeAny;
    params?: ZodTypeAny;
};

export function validateRequest(schema: ZodTypeAny): RequestHandler;
export function validateRequest(schemas: RequestSchemas): RequestHandler;
export function validateRequest(schemaOrSchemas: ZodTypeAny | RequestSchemas): RequestHandler {
    const schemas = "safeParse" in schemaOrSchemas ? { body: schemaOrSchemas } : schemaOrSchemas;

    return (req: Request, _res: Response, next: NextFunction) => {
        for (const [key, schema] of Object.entries(schemas) as [keyof RequestSchemas, ZodTypeAny][]) {
            const result = schema.safeParse(req[key]);

            if (!result.success) {
                return next(result.error);
            }

            req[key] = result.data as never;
        }

        return next();
    };
}
