/**
 * Seeds fictional fixtures (is_fixture=true) for local development screenshots and tests.
 *   bun run db:seed:fixtures            # development database
 *   bun run db:seed:fixtures -- --test  # test database
 * Fixtures are only visible publicly when SHOW_FIXTURES=1, and never in production.
 */
import { seedFixtures } from "../data/fixtures";
import { closeDb } from "../src/server/db";
import { seedReferenceData } from "../src/server/services/reference-data";
import { db } from "../src/server/db";
import { assertNotProduction, testDatabaseUrl } from "./lib/env";

assertNotProduction("Fixture seeding");
if (process.argv.includes("--test")) process.env.DATABASE_URL = testDatabaseUrl();

seedReferenceData(db)
  .then(() => seedFixtures())
  .then((result) => console.log(result.skipped ? "[fixtures] Already present; nothing to do." : `[fixtures] Seeded ${result.offers} fixture offers.`))
  .catch((error) => {
    console.error("[fixtures] Failed:", error?.fieldErrors ?? error);
    process.exitCode = 1;
  })
  .finally(closeDb);
