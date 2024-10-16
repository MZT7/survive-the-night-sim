import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { ZombieSurvival } from "../simulators/zombie-survival";
import { api, internal } from "./_generated/api";
import { runModel } from "../models";

const LEVELS = [
  {
    grid: [
      ["Z", " "],
      [" ", " "],
    ],
  },
  {
    grid: [["Z", " ", " ", " "]],
  },
  {
    grid: [
      ["Z", " "],
      [" ", " "],
      [" ", " "],
      ["Z", " "],
    ],
  },
  // {
  //   grid: [
  //     ["Z", " ", " ", "R", " "],
  //     [" ", "R", " ", " ", " "],
  //     [" ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", "Z"],
  //     [" ", " ", " ", " ", " "],
  //   ],
  // },
  // {
  //   grid: [
  //     ["Z", " ", " ", "R", " "],
  //     [" ", "R", " ", " ", " "],
  //     [" ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", "Z"],
  //     [" ", " ", " ", " ", " "],
  //   ],
  // },
  // {
  //   grid: [
  //     [" ", " ", "R", " ", "Z"],
  //     [" ", " ", " ", " ", " "],
  //     [" ", " ", " ", "R", " "],
  //     ["Z", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " "],
  //   ],
  // },
  // {
  //   grid: [
  //     ["Z", " ", " ", "R", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", "Z", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //     [" ", "R", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", "R", " ", " "],
  //   ],
  // },
  // {
  //   grid: [
  //     [" ", "Z", " ", " ", "R", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", "Z"],
  //     [" ", " ", "R", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " "],
  //   ],
  // },
  // {
  //   grid: [
  //     [" ", " ", " ", " ", "R", "Z", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " "],
  //     ["Z", " ", " ", " ", " ", "R", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", "R", " ", " ", " ", " ", "Z", " "],
  //     [" ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", "R", " ", " ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", "Z", " ", " ", " ", " "],
  //     ["B", " ", " ", " ", " ", " ", " ", " ", " ", " ", " "],
  //     [" ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " "],
  //     ["Z", " ", " ", " ", "Z", " ", " ", " ", " ", " ", "Z"],
  //   ],
  // },
];

export const seedMaps = internalMutation({
  handler: async (ctx) => {
    // delete all existing maps
    const maps = await ctx.db.query("maps").collect();

    for (const map of maps) {
      await ctx.db.delete(map._id);
    }

    LEVELS.forEach((map, idx) => {
      ctx.db.insert("maps", {
        level: idx + 1,
        grid: map.grid,
      });
    });
  },
});

export const getMaps = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("maps").withIndex("by_level").collect();
  },
});

export const getMapByLevel = query({
  args: { level: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("maps")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .first();
  },
});

export const playMapAction = internalAction({
  args: {
    level: v.number(),
    gameId: v.id("games"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    const resultId = await ctx.runMutation(
      internal.results.createInitialResult,
      {
        gameId: args.gameId,
        level: args.level,
      },
    );

    const map: Doc<"maps"> | null = (await ctx.runQuery(
      api.maps.getMapByLevel,
      {
        level: args.level,
      },
    )) as any;

    if (!map) {
      throw new Error("Map not found");
    }

    if (process.env.MOCK_MODELS === "true") {
      const existingMap = [...map.grid.map((row) => [...row])];

      existingMap[0][0] = "P";
      existingMap[0][1] = "B";
      existingMap[0][2] = "B";

      await ctx.runMutation(internal.results.updateResult, {
        resultId,
        isWin: ZombieSurvival.isWin(existingMap),
        reasoning: "This is a mock response",
        map: existingMap,
      });

      return;
    }

    try {
      const { solution, reasoning } = await runModel(args.modelId, map.grid);

      await ctx.runMutation(internal.results.updateResult, {
        resultId,
        isWin: ZombieSurvival.isWin(solution),
        reasoning,
        map: solution,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unexpected error happened";

      await ctx.runMutation(internal.results.failResult, {
        resultId,
        error: errorMessage,
      });
    }
  },
});
