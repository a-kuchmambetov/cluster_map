import { env } from "@config/env";
import cors from "cors";
import express from "express";
import { errorMiddleware } from "./middleware/error";
import { requestLogger } from "./middleware/requestLogger";
import { routes } from "./routes";

export const app: express.Express = express();

// Requests arrive through Coolify's TLS proxy and then the WAF/nginx container,
// so the client address lives in X-Forwarded-For with a format of
// `X-Forwarded-For: Real ip of the client, Coolify proxy ip, Nginx/WAF ip`.
// Setting trust proxy as 2 lets Express skip 2 ips from the right end and take
// the client's real ip.
//
// Without this, express-rate-limit keys every caller on the nginx container's
// address and they all share one bucket, and an attacker can forge their way
// past the rate limiter.
app.set("trust proxy", 2);

app.use(requestLogger);

const origin =
  process.env.NODE_ENV === "development" ? [env.WEB_ORIGIN] : env.WEB_ORIGIN;

app.use(cors({ origin: origin, credentials: true }));

app.use(express.json());

app.use("/api", routes);

app.use(errorMiddleware);
