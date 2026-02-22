import { makeFunctionReference } from "convex/server";

const queryRef = (name: string) => makeFunctionReference<"query">(name);
const mutationRef = (name: string) => makeFunctionReference<"mutation">(name);
const actionRef = (name: string) => makeFunctionReference<"action">(name);

export const convexApi = {
  inbox: {
    list: queryRef("inbox:list"),
    counts: queryRef("inbox:counts"),
  },
  sources: {
    listRecent: queryRef("sources:listRecent"),
    createFromUrlInput: mutationRef("sources:createFromUrlInput"),
    createFromYouTubeInput: mutationRef("sources:createFromYouTubeInput"),
    updateStatus: mutationRef("sources:updateStatus"),
    setVisibility: mutationRef("sources:setVisibility"),
  },
  extract: {
    extractSource: actionRef("extract:extractSource"),
  },
  hypotheses: {
    listByStatus: queryRef("hypotheses:listByStatus"),
    create: mutationRef("hypotheses:create"),
  },
  recipes: {
    listByStatus: queryRef("recipes:listByStatus"),
    create: mutationRef("recipes:create"),
    generateFromHypothesis: actionRef("recipes:generateFromHypothesis"),
  },
  weeklyBriefs: {
    list: queryRef("weeklyBriefs:list"),
    generate: actionRef("weeklyBriefs:generate"),
    publish: mutationRef("weeklyBriefs:publish"),
  },
  compositions: {
    list: queryRef("compositions:list"),
    create: mutationRef("compositions:create"),
    update: mutationRef("compositions:update"),
  },
  listening: {
    listRecent: queryRef("listening:listRecent"),
    create: mutationRef("listening:create"),
  },
  admin: {
    workspaceSnapshot: queryRef("admin:workspaceSnapshot"),
    listFeeds: queryRef("admin:listFeeds"),
    createFeed: mutationRef("admin:createFeed"),
    setFeedEnabled: mutationRef("admin:setFeedEnabled"),
    pollFeedsNow: actionRef("admin:pollFeedsNow"),
    setSourceStatus: mutationRef("admin:setSourceStatus"),
    promoteVisibility: mutationRef("admin:promoteVisibility"),
  },
  dashboard: {
    pipeline: queryRef("dashboard:pipeline"),
    zodiacSectors: queryRef("dashboard:zodiacSectors"),
    activityFeed: queryRef("dashboard:activityFeed"),
  },
};
