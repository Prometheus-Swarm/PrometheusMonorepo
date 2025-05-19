import dotenv from "dotenv";
dotenv.config();
export const SUPPORTER_TASK_ID = process.env.SUPPORTER_TASK_ID || "";
export const documentSummarizerTaskID = process.env.DOCUMENT_SUMMARIZER_TASK_ID || "1111";
export const bugFinderSummarizerTaskID = process.env.BUG_FINDER_TASK_ID || "1111";
export const RPCURL = "https://mainnet.koii.network";
export const defaultBountyMarkdownFile =
  process.env.DEFAULT_BOUNTY_MARKDOWN_FILE ||
  "https://raw.githubusercontent.com/HermanL02/prometheus-swarm-bounties/master/README.md";
export const plannerTaskID = process.env.PLANNER_TASK_ID || "";

import { DocumentationStatus } from "../models/Documentation";
export enum SwarmBountyStatus {
  // PENDING = "pending",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  AUDITING = "auditing",
  // APPROVED = "approved",
  FAILED = "failed",
}

export enum SwarmBountyType {
  DOCUMENT_SUMMARIZER = "document-summarizer",
  FIND_BUGS = "find-bugs",
  BUILD_FEATURE = "build-feature",
}
export const taskIDs = process.env.TASK_IDS?.split(",").map((id) => id.trim()) || ["tempSimulateTaskID"];
export const BYPASS_TASK_STATE_CHECK = process.env.NODE_ENV === "development";
