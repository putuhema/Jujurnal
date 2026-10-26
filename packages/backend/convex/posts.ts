import { v } from "convex/values";
import {
  query,
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { getUsersById, publicUser } from "./users";
import { paginationOptsValidator } from "convex/server";
import { getDateString, getDateStringForDay } from "./helpers";
import { FALLBACK_MOOD, readMoodWithGlm } from "./moodAi";

// The mood colours the flower a journal grows. The AI reads it from the writer's words.
const moodValidator = v.union(
  v.literal("A+"),
  v.literal("A"),
  v.literal("A-"),
  v.literal("B+"),
  v.literal("B"),
  v.literal("B-"),
  v.literal("C+"),
  v.literal("C"),
  v.literal("C-"),
  v.literal("D+"),
  v.literal("D"),
  v.literal("D-"),
  v.literal("F")
);

const FLOWER_COUNT = 98;

const countReactions = async (ctx: QueryCtx, post: Doc<"posts">) =>
  post.reactionCount ??
  (
    await ctx.db
      .query("plantReactions")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .collect()
  ).length;

// The AI's note on a journal is written to its author, so only they get it.
const forViewer = <T extends { userId: string; moodReason?: string }>(post: T, viewerId: string | undefined) => {
  if (post.userId === viewerId) return post;
  const { moodReason: _hidden, ...rest } = post;
  return rest;
};

const monthRange = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must look like 2026-10");
  return { start: `${month}-01`, end: `${month}-31` };
};

const WORLD_GARDENS = 40;

// The garden world: up to WORLD_GARDENS people who planted this month, most
// recent first, each with their whole month. Only what the 3D world draws is
// sent; a journal's words are fetched when someone opens it.
export const getWorld = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const { start, end } = monthRange(args.month);
    const userIds: string[] = [];
    const seen = new Set<string>();
    for await (const post of ctx.db
      .query("posts")
      .withIndex("by_entryDate", (q) => q.gte("entryDate", start).lte("entryDate", end))
      .order("desc")) {
      if (post.visibility === "private" || seen.has(post.userId)) continue;
      seen.add(post.userId);
      userIds.push(post.userId);
      if (userIds.length >= WORLD_GARDENS) break;
    }

    const [users, gardens, layouts] = await Promise.all([
      getUsersById(ctx, userIds),
      Promise.all(
        userIds.map((userId) =>
          ctx.db
            .query("posts")
            .withIndex("by_authorId_entryDate", (q) =>
              q.eq("userId", userId).gte("entryDate", start).lte("entryDate", end)
            )
            .collect()
        )
      ),
      Promise.all(userIds.map((userId) => ctx.db.query("gardenLayouts").withIndex("by_userId", (q) => q.eq("userId", userId)).unique())),
    ]);

    return {
      gardens: await Promise.all(
        userIds.map(async (userId, index) => ({
          userId,
          name: users.get(userId)?.name ?? "A gardener",
          arrangement: layouts[index] ? { moves: layouts[index].moves, decorations: layouts[index].decorations } : undefined,
          posts: await Promise.all(
            gardens[index]
              .filter((post) => post.visibility !== "private")
              .map(async (post) => ({
                _id: post._id,
                _creationTime: post._creationTime,
                entryDate: post.entryDate,
                mood: post.mood,
                reactionCount: await countReactions(ctx, post),
                selfWaterings: post.selfWaterings ?? 0,
              }))
          ),
        }))
      ),
    };
  },
});

// One person's journals for one month (their own garden on the home screen).
export const getUserMonth = query({
  args: { userId: v.string(), month: v.string() },
  handler: async (ctx, args) => {
    const { start, end } = monthRange(args.month);
    const [currentUser, posts] = await Promise.all([
      authComponent.safeGetAuthUser(ctx),
      ctx.db
        .query("posts")
        .withIndex("by_authorId_entryDate", (q) =>
          q.eq("userId", args.userId).gte("entryDate", start).lte("entryDate", end)
        )
        .collect(),
    ]);
    const isOwner = currentUser?._id === args.userId;
    return await Promise.all(
      posts
        .filter((post) => isOwner || post.visibility !== "private")
        .map(async (post) => ({ ...forViewer(post, currentUser?._id), reactionCount: await countReactions(ctx, post) }))
    );
  },
});

export const getAll = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    const posts = await ctx.db
      .query("posts")
      .order("desc")
      .paginate(args.paginationOpts);

    const visiblePosts = (posts.page ?? []).filter(
      (post) => post.visibility !== "private" || post.userId === currentUser?._id
    );
    const users = await getUsersById(ctx, visiblePosts.map((post) => post.userId));
    const themePromises = new Map<
      string,
      ReturnType<ReturnType<typeof ctx.db.query<"gardenPreferences">>["unique"]>
    >();
    const page = await Promise.all(
      visiblePosts.map(async (post) => {
        let themePromise = themePromises.get(post.userId);
        if (!themePromise) {
          themePromise = ctx.db
            .query("gardenPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", post.userId))
            .unique();
          themePromises.set(post.userId, themePromise);
        }

        const [preference, reactionCount] = await Promise.all([
          themePromise,
          countReactions(ctx, post),
        ]);
        return {
          ...forViewer(post, currentUser?._id),
          user: publicUser(users.get(post.userId)),
          gardenTheme: preference?.theme ?? "ivory",
          reactionCount,
        };
      })
    );

    return {
      ...posts,
      page,
    };
  },
});

export const getById = query({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) {
      return null;
    }
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (post.visibility === "private" && post.userId !== currentUser?._id) return null;
    const user = await authComponent.getAnyUserById(ctx, post.userId);
    return { ...forViewer(post, currentUser?._id), user: publicUser(user) };
  },
});

export const getUserYear = query({
  args: { userId: v.string(), year: v.number() },
  handler: async (ctx, args) => {
    const byDate = () => ctx.db.query("posts").withIndex("by_authorId_entryDate", (q) => q.eq("userId", args.userId));
    const [currentUser, dated, undated, first, layout] = await Promise.all([
      authComponent.safeGetAuthUser(ctx),
      ctx.db
        .query("posts")
        .withIndex("by_authorId_entryDate", (q) =>
          q.eq("userId", args.userId).gte("entryDate", `${args.year}-01-01`).lte("entryDate", `${args.year}-12-31`)
        )
        .collect(),
      // Journals from before entry dates existed; dated by when they were written.
      ctx.db
        .query("posts")
        .withIndex("by_authorId_entryDate", (q) => q.eq("userId", args.userId).eq("entryDate", undefined))
        .collect(),
      byDate().order("asc").filter((q) => q.neq(q.field("entryDate"), undefined)).first(),
      // How they've arranged their garden, so the island here matches the one on the home screen.
      ctx.db.query("gardenLayouts").withIndex("by_userId", (q) => q.eq("userId", args.userId)).unique(),
    ]);
    const isOwner = currentUser?._id === args.userId;
    const firstYears = [
      ...(first?.entryDate ? [Number(first.entryDate.slice(0, 4))] : []),
      ...undated.map((post) => new Date(post._creationTime).getFullYear()),
    ];
    const posts = [
      ...dated,
      ...undated.filter((post) => new Date(post._creationTime).getFullYear() === args.year),
    ].filter((post) => isOwner || post.visibility !== "private");
    return {
      firstYear: firstYears.length ? Math.min(...firstYears) : args.year,
      arrangement: layout ? { moves: layout.moves, decorations: layout.decorations } : undefined,
      posts: await Promise.all(
        posts.map(async (post) => ({ ...forViewer(post, currentUser?._id), reactionCount: await countReactions(ctx, post) }))
      ),
    };
  },
});

// One person's journals, newest first, a page at a time; or, with `search`,
// the ones whose words match (searching all of them, not just loaded pages).
export const getUserPage = query({
  args: {
    userId: v.string(),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.trim();
    const [currentUser, author, page] = await Promise.all([
      authComponent.safeGetAuthUser(ctx),
      authComponent.getAnyUserById(ctx, args.userId),
      search
        ? ctx.db
            .query("posts")
            .withSearchIndex("search_body", (q) => q.search("body", search).eq("userId", args.userId))
            .paginate(args.paginationOpts)
        : ctx.db
            .query("posts")
            .withIndex("by_authorId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .paginate(args.paginationOpts),
    ]);
    const user = publicUser(author);
    const isOwner = currentUser?._id === args.userId;
    return {
      ...page,
      page: await Promise.all(
        page.page
          .filter((post) => isOwner || post.visibility !== "private")
          .map(async (post) => ({
            ...forViewer(post, currentUser?._id),
            user,
            reactionCount: await countReactions(ctx, post),
            // Only you see how many people read your journals.
            readCount: isOwner ? (await ctx.db.query("postReads").withIndex("by_postId", (q) => q.eq("postId", post._id)).collect()).length : undefined,
          }))
      ),
    };
  },
});

const hasJournalFor = async (ctx: { db: QueryCtx["db"] }, userId: string, entryDate: string) =>
  (await ctx.db
    .query("posts")
    .withIndex("by_authorId_entryDate", (q) => q.eq("userId", userId).eq("entryDate", entryDate))
    .first()) !== null;

export const hasPostedToday = query({
  args: { timeZone: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    if (!currentUser) return false;
    return await hasJournalFor(ctx, currentUser._id, getDateString(Date.now(), args.timeZone));
  },
});

export const getEntryAvailability = query({
  args: { timeZone: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    const nowMs = Date.now();
    const today = getDateString(nowMs, args.timeZone);
    const yesterday = getDateStringForDay(nowMs, 1, args.timeZone);
    if (!currentUser) {
      return { today, yesterday, canPostToday: false, canPostYesterday: false };
    }
    const [postedToday, postedYesterday] = await Promise.all([
      hasJournalFor(ctx, currentUser._id, today),
      hasJournalFor(ctx, currentUser._id, yesterday),
    ]);
    return { today, yesterday, canPostToday: !postedToday, canPostYesterday: !postedYesterday };
  },
});

// Saves the journal straight away; its mood is read by the AI just after (readMood),
// so planting never waits on it. Until then it shows as a calm, steady plant.
export const create = mutation({
  args: {
    text: v.string(),
    timeZone: v.string(),
    entryDate: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    if (!currentUser) throw new Error("Not authenticated");

    const nowMs = Date.now();
    const today = getDateString(nowMs, args.timeZone);
    const yesterday = getDateStringForDay(nowMs, 1, args.timeZone);
    if (args.entryDate !== today && args.entryDate !== yesterday) {
      throw new Error("A journal can only be created for today or yesterday");
    }

    const text = args.text.trim();
    if (text.length < 12 || text.length > 280) {
      throw new Error("An entry must be between 12 and 280 characters");
    }

    if (await hasJournalFor(ctx, currentUser._id, args.entryDate)) {
      throw new Error("A journal already exists for that day");
    }

    const postId = await ctx.db.insert("posts", {
      body: text,
      userId: currentUser._id,
      mood: FALLBACK_MOOD,
      moodPending: true,
      flowerId: Math.floor(Math.random() * FLOWER_COUNT) + 1,
      entryDate: args.entryDate,
      year: Number(args.entryDate.slice(0, 4)),
      visibility: args.visibility,
    });
    await ctx.scheduler.runAfter(0, internal.posts.readMood, { postId, body: text });
    return { postId };
  },
});

// Asks the AI for a journal's mood, then stores it (or just clears the wait if it can't answer).
export const readMood = internalAction({
  args: { postId: v.id("posts"), body: v.string() },
  handler: async (ctx, args) => {
    const reading = await readMoodWithGlm(args.body);
    await ctx.runMutation(internal.posts.applyMood, {
      postId: args.postId,
      body: args.body,
      mood: reading?.grade,
      moodReason: reading?.reason,
    });
  },
});

export const applyMood = internalMutation({
  args: {
    postId: v.id("posts"),
    body: v.string(),
    mood: v.optional(moodValidator),
    moodReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    // Deleted, or rewritten since this reading started (a newer reading is on its way).
    if (!post || post.body !== args.body) return;
    await ctx.db.patch(
      args.postId,
      args.mood ? { mood: args.mood, moodReason: args.moodReason, moodPending: false } : { moodPending: false }
    );
  },
});

export const deletePost = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Entry not found");
    if (post.userId !== currentUser._id) {
      throw new Error("You can only delete your own entries");
    }

    const reactions = await ctx.db
      .query("plantReactions")
      .withIndex("by_postId", (q) => q.eq("postId", args.id))
      .collect();
    await Promise.all(reactions.map((reaction) => ctx.db.delete(reaction._id)));
    await ctx.db.delete("posts", args.id);
    return { success: true };
  },
});

// One-off: store reaction counts on posts written before reactionCount existed.
// Run with `npx convex run posts:backfillReactionCounts` after deploying.
export const backfillReactionCounts = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("posts").paginate({ numItems: 200, cursor: args.cursor ?? null });
    for (const post of page.page) {
      if (post.reactionCount !== undefined) continue;
      await ctx.db.patch(post._id, { reactionCount: await countReactions(ctx, post) });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.posts.backfillReactionCounts, { cursor: page.continueCursor });
    }
  },
});

// New words are saved at once and their mood read again in the background;
// if the AI can't answer, the old mood stays.
export const updatePost = mutation({
  args: {
    id: v.id("posts"),
    body: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.getAuthUser(ctx);
    if (!currentUser) throw new Error("Not authenticated");

    const body = args.body.trim();
    if (body.length < 12 || body.length > 280) {
      throw new Error("An entry must be between 12 and 280 characters");
    }

    const post = await ctx.db.get(args.id);
    if (!post) throw new Error("Entry not found");
    if (post.userId !== currentUser._id) {
      throw new Error("You can only edit your own entries");
    }

    const wordsChanged = body !== post.body;
    await ctx.db.patch(args.id, {
      body,
      visibility: args.visibility,
      ...(wordsChanged ? { moodPending: true } : {}),
    });
    if (wordsChanged) {
      await ctx.scheduler.runAfter(0, internal.posts.readMood, { postId: args.id, body });
    }

    if (args.visibility === "private") {
      const reactions = await ctx.db
        .query("plantReactions")
        .withIndex("by_postId", (q) => q.eq("postId", args.id))
        .collect();
      await Promise.all(reactions.map((reaction) => ctx.db.delete(reaction._id)));
      await ctx.db.patch(args.id, { reactionCount: 0 });
    }
  },
});
