import type { NextFunction, Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    // Capture before calling next(): Express sub-routers modify req.url (and therefore
    // req.path) as they strip mount prefixes. req.originalUrl is never touched.
    // Split on "?" to drop any query string — query params may carry sensitive input.
    const method = req.method;
    const path = req.originalUrl.split("?")[0];

    res.on("finish", () => {
        const ms = Date.now() - start;
        const errorCode = res.locals.errorCode as string | undefined;

        if (isProduction) {
            const entry: Record<string, unknown> = {
                timestamp: new Date().toISOString(),
                method,
                path,
                status: res.statusCode,
                ms,
            };
            if (errorCode !== undefined) {
                entry.errorCode = errorCode;
            }
            process.stdout.write(JSON.stringify(entry) + "\n");
        } else {
            const parts: Array<string | number> = [
                new Date().toISOString(),
                method,
                path,
                res.statusCode,
                `${ms}ms`,
            ];
            if (errorCode !== undefined) {
                parts.push(`[${errorCode}]`);
            }
            console.log(parts.join(" "));
        }
    });

    next();
}
