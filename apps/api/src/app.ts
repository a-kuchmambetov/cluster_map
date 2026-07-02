import { env } from "@config/env";
import cors from "cors";
import express from "express";
import { errorMiddleware } from "./middleware/error";
import { routes } from "./routes";

export const app: express.Express = express();

const origins = process.env.NODE_ENV === "development" ? [env.WEB_ORIGIN, `http://192.168.51.254:3000`] : [env.WEB_ORIGIN];

app.use(cors({ origin: origins, credentials: true }));

app.use(express.json());

app.use("/api", routes);

app.use(errorMiddleware);
