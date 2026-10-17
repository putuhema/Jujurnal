import { components } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

export type AuthUser = NonNullable<Awaited<ReturnType<typeof authComponent.getAnyUserById>>>;

// Looks up many authors in a single call into the auth component. Each
// component call is a separate (serial) transaction, so one lookup per author
// made a page of posts from a few hundred people take seconds.
export const getUsersById = async (ctx: QueryCtx, userIds: string[]) => {
  const ids = [...new Set(userIds)];
  const users = new Map<string, AuthUser>();
  if (ids.length === 0) return users;
  const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "user",
    where: [{ field: "_id", operator: "in", value: ids }],
    paginationOpts: { numItems: ids.length, cursor: null },
  });
  for (const user of result.page as AuthUser[]) users.set(user._id, user);
  return users;
};

// What other people may see of an author (never their email).
export const publicUser = (user: AuthUser | null | undefined) =>
  user ? { _id: user._id, name: user.name, image: user.image ?? null } : null;
