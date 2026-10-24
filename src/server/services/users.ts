import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../auth/password";
import { deleteSessionsForUser } from "../auth/sessions";
import { userInputSchema } from "../validation/admin";
import { parseOrThrow, ValidationFailure } from "./admin-offers";
import { writeAudit, type Actor } from "./audit";

export async function createUser(actor: Actor, raw: unknown) {
  const input = parseOrThrow(userInputSchema, raw);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new ValidationFailure({ email: ["A user with this email already exists."] });
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(users).values({ email: input.email, name: input.name, role: input.role, passwordHash }).returning({ id: users.id, email: users.email, role: users.role });
    await writeAudit(tx, actor, "user.create", "user", row.id, undefined, { email: input.email, role: input.role });
    return row;
  });
}

export async function setUserDisabled(actor: Actor, userId: string, disabled: boolean) {
  if (actor.id === userId && disabled) throw new ValidationFailure({ form: ["You cannot disable your own account."] });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ disabledAt: disabled ? new Date() : null, updatedAt: new Date() }).where(eq(users.id, userId));
    await writeAudit(tx, actor, disabled ? "user.disable" : "user.enable", "user", userId);
  });
  if (disabled) await deleteSessionsForUser(userId);
}

export async function listUsers() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, lastLoginAt: users.lastLoginAt, disabledAt: users.disabledAt, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.email));
}
