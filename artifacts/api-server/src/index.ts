import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/catalog";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Awaited before the first request, so no client can read the empty catalog
// that exists for the moment before seeding lands and then hold that state.
try {
  await seedIfEmpty();
} catch (err) {
  logger.error({ err }, "Could not seed the catalog");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
