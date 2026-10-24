/** Test preload: every test process talks to the test database, never the development one. */
import { DEFAULT_TEST_DATABASE_URL } from "../scripts/lib/env";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
process.env.SESSION_SECRET ??= "test-session-secret-not-for-production-use-0123456789";
process.env.SHOW_FIXTURES = "1";
// Connector tests use a loopback fixture server and must not wait between requests.
process.env.CONNECTOR_ALLOW_PRIVATE_HOSTS = "1";
process.env.CONNECTOR_HOST_INTERVAL_MS = "0";
