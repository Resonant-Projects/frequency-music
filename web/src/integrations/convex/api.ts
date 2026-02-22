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
};
