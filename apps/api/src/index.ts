import { env } from "@config/env";
import { db } from "@repo/db";
import { createAuth } from "@config/auth";
import * as authRepository from "@features/auth/auth.repository";
import { createAuthService } from "@features/auth/auth.service";
import { createApp } from "./app";
import { createDatabaseCheck } from "./routes/health";
import { createReadinessCheck, createSchemaCheck } from "./routes/readiness";

const auth = createAuth({ env, db, findAuthUser: authRepository.findAuthUser });
const authService = createAuthService(auth, authRepository);
const app = createApp({
  env,
  authService,
  checkDb: createDatabaseCheck(() => db.execute("SELECT 1"), env.PG_PASSWORD),
  checkReady: createReadinessCheck(env, createSchemaCheck(db)),
});

app.listen(env.API_PORT, () => {
  console.log(`API server running on port ${env.API_PORT}`);
});
