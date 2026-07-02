import { type Request, type Response, Router } from "express";

export const healthRouter: Router = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});
