import { AppError } from "@repo/errors";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

const isProduction = process.env.NODE_ENV === "production";

function normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof ZodError) {
        return AppError.validation(
            "Validation error",
            error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
                code: issue.code,
            })),
        );
    }

    if (error instanceof SyntaxError && "body" in error) {
        return AppError.badRequest("Invalid JSON body");
    }

    if (error instanceof Error) {
        return AppError.internal(error.message, error);
    }

    return AppError.internal("Unknown error", error);
}

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const appError = normalizeError(error);
    const isServerError = appError.statusCode >= 500;

    const response: {
        ok: false;
        status: "fail" | "error";
        code: string;
        error: string;
        details?: unknown;
    } = {
        ok: false,
        status: appError.status,
        code: appError.code,
        error: isProduction && isServerError ? "Internal server error" : appError.message,
    };

    if ((!isProduction || !isServerError) && appError.details !== undefined) {
        response.details = appError.details;
    }

    // Give the request logger access to the error code before "finish" fires.
    res.locals.errorCode = appError.code;

    if (!isProduction) {
        // Omit details and cause: details can contain validation input (user data),
        // cause may carry DB error internals. Code + message + stack is enough to debug.
        console.error({
            statusCode: appError.statusCode,
            code: appError.code,
            message: appError.message,
            stack: appError.stack,
        });
    } else if (isServerError) {
        // Production: log 5xx to stderr as a JSON line. 4xx are already captured by
        // the request log; 5xx need their message preserved for operational debugging.
        process.stderr.write(
            JSON.stringify({
                timestamp: new Date().toISOString(),
                level: "error",
                code: appError.code,
                message: appError.message,
            }) + "\n",
        );
    }

    res.status(appError.statusCode).json(response);
};
