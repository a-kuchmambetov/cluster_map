import { app } from "./app";
import { env } from "./config/env";

app.listen(env.API_PORT, () => {
    console.log(`API server running on port ${env.API_PORT}`);
});
