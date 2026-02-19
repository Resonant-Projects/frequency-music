/**
 * Convex Components Setup
 *
 * This file configures the main components:
 * 1. Workflow - Durable extraction pipeline
 *
 * Note: Aggregate and ActionCache are configured in their respective modules
 * after codegen creates the _generated types.
 */

import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

// ============================================================================
// WORKFLOW MANAGER
// ============================================================================

/**
 * Workflow manager for durable pipelines
 * Handles retries, timeouts, and status tracking
 */
export const workflowManager = new WorkflowManager(components.workflow, {
  // Default retry policy for all steps
  defaultRetryPolicy: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
  },
});
