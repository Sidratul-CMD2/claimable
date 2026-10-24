/**
 * Creates a staff account.
 *   bun run admin:create -- --email you@example.com --name "Your Name" [--role admin|editor]
 * The password is read from ADMIN_PASSWORD; if unset, a strong random password is generated
 * and printed once (or written to --password-file).
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { closeDb } from "../src/server/db";
import { SYSTEM_ACTOR } from "../src/server/services/audit";
import { ValidationFailure } from "../src/server/services/admin-offers";
import { createUser } from "../src/server/services/users";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string", default: "Administrator" },
    role: { type: "string", default: "admin" },
    "password-file": { type: "string" },
  },
});

async function main() {
  if (!values.email) throw new Error("--email is required");
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");
  const user = await createUser({ ...SYSTEM_ACTOR, label: "create-admin script" }, { email: values.email, name: values.name, role: values.role, password });
  console.log(`[admin] Created ${user.role} ${user.email}`);
  if (generated) {
    if (values["password-file"]) {
      writeFileSync(values["password-file"], `${user.email}\n${password}\n`, { mode: 0o600 });
      console.log(`[admin] Generated password written to ${values["password-file"]} (mode 600).`);
    } else {
      console.log(`[admin] Generated password (shown once): ${password}`);
    }
  }
}

main()
  .catch((error) => {
    if (error instanceof ValidationFailure) console.error("[admin]", error.fieldErrors);
    else console.error("[admin]", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
