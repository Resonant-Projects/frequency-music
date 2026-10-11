import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { workflowManager } from "./components";

export const execute = internalAction({
  args: { failureId: v.id("operationFailures"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.runQuery(
      internal.operationFailures.getForRecovery,
      { failureId: args.failureId },
    );
    if (
      !failure ||
      failure.status !== "retrying" ||
      failure.attempts !== args.attempt
    )
      return null;
    try {
      if (failure.target.kind === "extraction") {
        const result = await ctx.runAction(internal.extract.resumeAttempt, {
          attemptId: failure.target.attemptId,
        });
        await ctx.runMutation(internal.operationFailures.finish, {
          ...args,
          success: "success" in result,
        });
      } else if (
        !(await ctx.runMutation(internal.operationFailures.dispatch, args))
      ) {
        await ctx.runMutation(internal.operationFailures.finish, {
          ...args,
          success: false,
        });
      }
    } catch {
      await ctx.runMutation(internal.operationFailures.finish, {
        ...args,
        success: false,
      });
    }
    return null;
  },
});
export const recover = workflowManager.define({
  args: { failureId: v.id("operationFailures") },
  returns: v.null(),
  handler: async (step, args): Promise<null> => {
    const attempt = await step.runMutation(
      internal.operationFailures.claimRecovery,
      args,
    );
    if (attempt !== null) {
      // The domain counter owns retries. Workpool must not repeat a paid operation.
      await step.runAction(
        internal.recoveryWorkflows.execute,
        { ...args, attempt },
        { retry: false },
      );
    }
    return null;
  },
});
export const start = internalMutation({
  args: { failureId: v.id("operationFailures") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await workflowManager.start(ctx, internal.recoveryWorkflows.recover, args);
    return null;
  },
});
