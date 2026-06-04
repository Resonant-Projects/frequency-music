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
    createFromUrlAndQueue: actionRef("sources:createFromUrlAndQueue"),
    createFromYouTubeAndQueue: actionRef("sources:createFromYouTubeAndQueue"),
    updateStatus: mutationRef("sources:updateStatus"),
    setVisibility: mutationRef("sources:setVisibility"),
  },
  extract: {
    extractSource: actionRef("extract:extractSource"),
  },
  theses: {
    list: queryRef("theses:list"),
    get: queryRef("theses:get"),
    getByIds: queryRef("theses:getByIds"),
    getDetail: queryRef("theses:getDetail"),
    create: mutationRef("theses:create"),
    update: mutationRef("theses:update"),
  },
  campaigns: {
    list: queryRef("campaigns:list"),
    listForSelection: queryRef("campaigns:listForSelection"),
    get: queryRef("campaigns:get"),
    getActive: queryRef("campaigns:getActive"),
    getRecommendedActions: queryRef("campaigns:getRecommendedActions"),
    create: mutationRef("campaigns:create"),
    update: mutationRef("campaigns:update"),
    setActive: mutationRef("campaigns:setActive"),
    attachThesis: mutationRef("campaigns:attachThesis"),
    detachThesis: mutationRef("campaigns:detachThesis"),
  },
  hypotheses: {
    get: queryRef("hypotheses:get"),
    listByStatus: queryRef("hypotheses:listByStatus"),
    listByThesis: queryRef("hypotheses:listByThesis"),
    listMissingWhyThisMatters: queryRef("hypotheses:listMissingWhyThisMatters"),
    create: mutationRef("hypotheses:create"),
    update: mutationRef("hypotheses:update"),
    deleteById: mutationRef("hypotheses:deleteById"),
  },
  recipes: {
    get: queryRef("recipes:get"),
    listByStatus: queryRef("recipes:listByStatus"),
    create: mutationRef("recipes:create"),
    generateFromHypothesis: actionRef("recipes:generateFromHypothesis"),
  },
  weeklyBriefs: {
    get: queryRef("weeklyBriefs:get"),
    list: queryRef("weeklyBriefs:list"),
    generate: actionRef("weeklyBriefs:generate"),
    publish: mutationRef("weeklyBriefs:publish"),
    publishToNotion: actionRef("weeklyBriefs:publishToNotion"),
  },
  compositions: {
    list: queryRef("compositions:list"),
    getLineage: queryRef("compositions:getLineage"),
    create: mutationRef("compositions:create"),
    update: mutationRef("compositions:update"),
  },
  failures: {
    listArchive: queryRef("failures:listArchive"),
    getByKey: queryRef("failures:getByKey"),
    getByKeys: queryRef("failures:getByKeys"),
  },
  agentRuns: {
    get: queryRef("agentRuns:get"),
    listRecent: queryRef("agentRuns:listRecentPublic"),
    listEvents: queryRef("agentRuns:listEventsPublic"),
    statusCounts: queryRef("agentRuns:statusCountsPublic"),
  },
  listening: {
    listRecent: queryRef("listening:listRecent"),
    create: mutationRef("listening:create"),
  },
  editorialArtifacts: {
    list: queryRef("editorialArtifacts:list"),
    get: queryRef("editorialArtifacts:get"),
    createDraftFromWeeklyBrief: mutationRef("editorialArtifacts:createDraftFromWeeklyBrief"),
    createDraftFromCampaign: mutationRef("editorialArtifacts:createDraftFromCampaign"),
    createDraftFromThesis: mutationRef("editorialArtifacts:createDraftFromThesis"),
    update: mutationRef("editorialArtifacts:update"),
    submitForReview: mutationRef("editorialArtifacts:submitForReview"),
    approve: mutationRef("editorialArtifacts:approve"),
    publish: mutationRef("editorialArtifacts:publish"),
    listPublicExport: queryRef("editorialArtifacts:listPublicExport"),
    exportForAstro: actionRef("editorialArtifacts:exportForAstro"),
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
    editorialSignals: queryRef("dashboard:editorialSignals"),
    activityFeed: queryRef("dashboard:activityFeed"),
    domainSubTopics: queryRef("dashboard:domainSubTopics"),
    pipelineItems: queryRef("dashboard:pipelineItems"),
    itemRelations: queryRef("dashboard:itemRelations"),
  },
  vocabulary: {
    reviewSummary: queryRef("vocabulary:reviewSummary"),
  },
  graph: {
    getConceptsForDomain: queryRef("graph:getConceptsForDomain"),
    getConceptEdges: queryRef("graph:getConceptEdges"),
    getConceptDetail: queryRef("graph:getConceptDetail"),
  },
  workflows: {
    startBatchExtraction: mutationRef("workflows:startBatchExtraction"),
    startSingleSourceExtraction: mutationRef("workflows:startSingleSourceExtraction"),
  },
};
