/* eslint-disable no-await-in-loop -- Release ordering and bounded polling must be sequential. */
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export function imageConfig(release, app, sha) {
  if (
    release.sha !== sha ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    release.image !== `ghcr.io/a-kuchmambetov/cluster-map-${app}` ||
    !/^sha256:[a-f0-9]{64}$/.test(release.digest)
  )
    throw new Error(`Invalid ${app} release`);
  return {
    docker_registry_image_name: release.image,
    docker_registry_image_tag: release.digest.replace(":", "-"),
  };
}
export async function deploy({
  env = process.env,
  request = fetch,
  sleep = delay,
} = {}) {
  const apps = ["api", "web", "docs"];
  const required = [
    "COOLIFY_URL",
    "COOLIFY_TOKEN",
    "RELEASE_SHA",
    ...apps.flatMap((a) => [
      `COOLIFY_${a.toUpperCase()}_UUID`,
      `${a.toUpperCase()}_URL`,
    ]),
  ];
  for (const key of required) if (!env[key]) throw new Error(`Missing ${key}`);
  for (const key of ["COOLIFY_URL", "API_URL", "WEB_URL", "DOCS_URL"]) {
    if (new URL(env[key]).protocol !== "https:")
      throw new Error(`${key} requires HTTPS`);
  }
  const configs = Object.fromEntries(
    apps.map((app) => [
      app,
      imageConfig(
        JSON.parse(readFileSync(`release/${app}.json`, "utf8")),
        app,
        env.RELEASE_SHA,
      ),
    ]),
  );
  async function api(path, method = "GET", body) {
    const response = await request(
      `${env.COOLIFY_URL.replace(/\/$/, "")}/api/v1/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${env.COOLIFY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error(`Coolify ${method} failed (${response.status})`);
    return response.json();
  }
  const previous = {};
  // Persist only image fields, never the application response (which can include secrets).
  for (const app of apps) {
    const config = await api(
      `applications/${encodeURIComponent(env[`COOLIFY_${app.toUpperCase()}_UUID`])}`,
    );
    previous[app] = {
      docker_registry_image_name: config.docker_registry_image_name,
      docker_registry_image_tag: config.docker_registry_image_tag,
    };
  }
  writeFileSync("release/previous.json", JSON.stringify(previous, null, 2));
  for (const app of apps) {
    const uuid = encodeURIComponent(env[`COOLIFY_${app.toUpperCase()}_UUID`]);
    await api(`applications/${uuid}`, "PATCH", configs[app]);
    const accepted = await api(`deploy?uuid=${uuid}`, "POST");
    const id = accepted.deployments?.[0]?.deployment_uuid;
    if (!id) throw new Error("Coolify did not return a deployment UUID");
    let finished = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      const result = await api(`deployments/${encodeURIComponent(id)}`);
      if (result.status === "finished") {
        finished = true;
        break;
      }
      if (!["queued", "in_progress"].includes(result.status))
        throw new Error(`${app} deployment failed: ${result.status}`);
      await sleep(10000);
    }
    if (!finished)
      throw new Error(
        `${app} deployment timed out; inspect/cancel it before rollback`,
      );
    const current = await api(`applications/${uuid}`);
    if (
      current.docker_registry_image_tag !==
        configs[app].docker_registry_image_tag ||
      current.docker_registry_image_name !==
        configs[app].docker_registry_image_name ||
      current.status !== "running:healthy"
    )
      throw new Error(`${app} image or health mismatch`);
  }
  // Same-origin API checks need Web running, including on the first release.
  for (const app of apps) {
    const base = env[`${app.toUpperCase()}_URL`].replace(/\/$/, "");
    const paths = app === "api" ? ["/api/health", "/api/health/ready"] : ["/"];
    for (const path of paths) {
      let healthy = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const response = await request(`${base}${path}`, {
            signal: AbortSignal.timeout(10000),
            redirect: "error",
          });
          if (
            response.status === 200 &&
            (app !== "api" ||
              ["ok", "ready"].includes((await response.json()).status))
          ) {
            healthy = true;
            break;
          }
        } catch {
          /* Retry while the proxy converges. */
        }
        await sleep(5000);
      }
      if (!healthy) throw new Error(`${app} public smoke check failed`);
    }
  }
  writeFileSync(
    "release/healthy.json",
    JSON.stringify({ sha: env.RELEASE_SHA, images: configs }, null, 2),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await deploy();
}
