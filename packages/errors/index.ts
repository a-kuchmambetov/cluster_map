export type AppErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "INTERNAL_SERVER_ERROR";

type AppErrorOptions = {
    message: string;
    statusCode: number;
    code?: AppErrorCode;
    details?: unknown;
    isOperational?: boolean;
    cause?: unknown;
};

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly status: "fail" | "error";
    public readonly code: AppErrorCode;
    public readonly details?: unknown;
    public readonly isOperational: boolean;
    public readonly cause?: unknown;

    constructor({ message, statusCode, code, details, isOperational = true, cause }: AppErrorOptions) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.status = statusCode < 500 ? "fail" : "error";
        this.code = code ?? "INTERNAL_SERVER_ERROR";
        this.details = details;
        this.isOperational = isOperational;
        this.cause = cause;

        Error.captureStackTrace?.(this, this.constructor);
    }

    static badRequest(message = "Bad request", details?: unknown) {
        return new AppError({
            message,
            statusCode: 400,
            code: "BAD_REQUEST",
            details,
        });
    }

    static unauthorized(message = "Unauthorized") {
        return new AppError({
            message,
            statusCode: 401,
            code: "UNAUTHORIZED",
        });
    }

    static forbidden(message = "Forbidden") {
        return new AppError({
            message,
            statusCode: 403,
            code: "FORBIDDEN",
        });
    }

    static notFound(message = "Resource not found") {
        return new AppError({
            message,
            statusCode: 404,
            code: "NOT_FOUND",
        });
    }

    static conflict(message = "Conflict", details?: unknown) {
        return new AppError({
            message,
            statusCode: 409,
            code: "CONFLICT",
            details,
        });
    }

    static validation(message = "Validation error", details?: unknown) {
        return new AppError({
            message,
            statusCode: 422,
            code: "VALIDATION_ERROR",
            details,
        });
    }

    static internal(message = "Internal server error", cause?: unknown) {
        return new AppError({
            message,
            statusCode: 500,
            code: "INTERNAL_SERVER_ERROR",
            isOperational: false,
            cause,
        });
    }
}
