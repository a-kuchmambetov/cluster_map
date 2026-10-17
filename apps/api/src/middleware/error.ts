import { AppError } from "@repo/errors";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { type AppLogger, silentLogger } from "../logger.js";

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

export function createErrorMiddleware(
  logger: AppLogger = silentLogger,
  isProduction = false,
): ErrorRequestHandler {
  return (error, _req, res, _next) => {
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
      error:
        isProduction && isServerError
          ? "Internal server error"
          : appError.message,
    };

    if ((!isProduction || !isServerError) && appError.details !== undefined) {
      response.details = appError.details;
    }

    // Give the request logger access to the error code before "finish" fires.
    res.locals.errorCode = appError.code;

    if (isServerError) {
      logger.error({
        event: "request_failed",
        requestId: res.locals.requestId,
        statusCode: appError.statusCode,
        errorCode: appError.code,
        diagnostic: error,
      });
    }

    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.status(appError.statusCode).json(response);
  };
}

// Compatibility for standalone middleware tests; production injects configuration.
export const errorMiddleware = createErrorMiddleware();
