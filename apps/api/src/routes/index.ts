import { clustersRouter } from "@features/clusters/clusters.routes";
import { Router } from "express";
import { healthRouter } from "./health";

export const routes: Router = Router();

routes.use("/health", healthRouter);
routes.use("/clusters", clustersRouter);
