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

    if (!isProduction) {
        console.error({
            statusCode: appError.statusCode,
            message: appError.message,
            stack: appError.stack,
            details: appError.details,
            cause: appError.cause,
        });
    }

    res.status(appError.statusCode).json(response);
};
