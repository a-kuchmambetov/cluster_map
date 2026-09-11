import { env } from "@config/env";
import cors from "cors";
import express from "express";
import { errorMiddleware } from "./middleware/error";
import { requestLogger } from "./middleware/requestLogger";
import { routes } from "./routes";

export const app: express.Express = express();

app.use(requestLogger);

const origin = process.env.NODE_ENV === "development" ? [env.WEB_ORIGIN] : env.WEB_ORIGIN;

app.use(cors({ origin: origin, credentials: true }));

app.use(express.json());

app.use("/api", routes);

app.use(errorMiddleware);
