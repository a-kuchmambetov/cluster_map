import { env } from "@config/env.js";
import { db } from "@repo/db";
import { createAuth } from "@config/auth.js";
import * as authRepository from "@features/auth/auth.repository.js";
import { createAuthService } from "@features/auth/auth.service.js";
import { createApp } from "./app.js";
import { createDatabaseCheck } from "./routes/health.js";
import { createReadinessCheck, createSchemaCheck } from "./routes/readiness.js";

const auth = createAuth({ env, db, findAuthUser: authRepository.findAuthUser });
const authService = createAuthService(auth, authRepository);
const app = createApp({
  env,
  authService,
  checkDb: createDatabaseCheck(() => db.execute("SELECT 1"), env.PG_PASSWORD),
  checkReady: createReadinessCheck(env, createSchemaCheck(db)),
});

app.listen(env.API_PORT, (error?: Error) => {
  if (error) throw error;
  console.log(`API server running on port ${env.API_PORT}`);
});
