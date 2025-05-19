import { Request, Response } from "express";
import { IssueModel } from "../../../models/Issue";
import { SpecModel } from "../../../models/Spec";
import {
  getDistributionListSubmitter,
  getDistributionListWrapper,
  getKeysByValueSign,
} from "../../../utils/taskState/getDistributionList";
import { IssueStatus } from "../../../models/Issue";
import { TodoModel, TodoStatus } from "../../../models/Todo";
import { AuditModel, AuditStatus } from "../../../models/Audit";
import { SwarmBountyStatus, SwarmBountyType } from "../../../config/constant";
import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";

let octokitInstance: any = null;

async function getOctokit() {
  if (octokitInstance) {
    return octokitInstance;
  }

  const { Octokit } = await import("@octokit/rest");
  octokitInstance = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  return octokitInstance;
}

const PROCESS_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Verify the request body for update-audit-result endpoint
 */
function verifyRequestBody(req: Request): { taskId: string; round: number } | null {
  console.log("updateAuditResult request body:", req.body);
  try {
    const taskId = req.body.taskId as string;
    const round = req.body.round as number;

    if (!taskId || typeof round !== "number") {
      return null;
    }

    return { taskId, round };
  } catch {
    return null;
  }
}

/**
 * Reset stale assignments for both todos and issues
 * This looks for any assignments where the last assignee's round number is <= current round
 * and the status is still in an active state
 */
async function resetStaleAssignments(round: number): Promise<void> {
  console.log(`Resetting stale assignments for round ${round}`);

  // Reset stale todos
  const staleTodos = await TodoModel.find({
    status: { $in: [TodoStatus.IN_PROGRESS, TodoStatus.IN_REVIEW] },
    bountyType: SwarmBountyType.BUILD_FEATURE,
    assignees: { $exists: true, $ne: [] },
  });

  for (const todo of staleTodos) {
    if (!todo.assignees || todo.assignees.length === 0) continue;
    const lastAssignee = todo.assignees[todo.assignees.length - 1];
    if (lastAssignee && lastAssignee.roundNumber <= round) {
      if (todo.assignees.length >= 5) {
        console.log(`Setting stale todo ${todo._id} to FAILED - has ${todo.assignees.length} assignees`);
        todo.status = TodoStatus.FAILED;
      } else {
        console.log(`Resetting stale todo ${todo._id} from ${todo.status} to INITIALIZED`);
        todo.status = TodoStatus.INITIALIZED;
      }
      await todo.save();
    }
  }

  // Reset stale issues
  const staleIssues = await IssueModel.find({
    status: { $in: [IssueStatus.ASSIGNED, IssueStatus.IN_PROGRESS, IssueStatus.IN_REVIEW] },
    bountyType: SwarmBountyType.BUILD_FEATURE,
    assignees: { $exists: true, $ne: [] },
  });

  for (const issue of staleIssues) {
    if (!issue.assignees || issue.assignees.length === 0) continue;
    const lastAssignee = issue.assignees[issue.assignees.length - 1];
    if (lastAssignee && lastAssignee.roundNumber <= round) {
      if (issue.assignees.length >= 5) {
        console.log(`Setting stale issue ${issue.uuid} to FAILED - has ${issue.assignees.length} assignees`);
        issue.status = IssueStatus.FAILED;
      } else {
        console.log(`Resetting stale issue ${issue.uuid} from ${issue.status} to ASSIGN_PENDING`);
        issue.status = IssueStatus.ASSIGN_PENDING;
      }
      await issue.save();
    }
  }
}

export async function updateAuditResult(req: Request, res: Response): Promise<void> {
  // Verify the request body
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    res.status(400).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const { taskId, round } = requestBody;

  if (process.env.NODE_ENV === "development") {
    console.log(`[TEST MODE] Update audit result in test mode for round ${round}`);

    // In test mode, directly update todos and issues without checking distribution list
    await updateTestEnvironmentStatus(round);
    res.status(200).json({
      success: true,
      message: "[TEST MODE] Task processed successfully.",
    });
    return;
  }

  // Check for existing audit
  const existingAudit = await AuditModel.findOne({
    roundNumber: round,
    taskId: taskId,
    bountyType: SwarmBountyType.BUILD_FEATURE,
    $or: [
      { status: AuditStatus.COMPLETED },
      {
        status: AuditStatus.IN_PROGRESS,
        updatedAt: { $gt: new Date(Date.now() - PROCESS_TIMEOUT) },
      },
    ],
  });

  if (existingAudit) {
    const message =
      existingAudit.status === AuditStatus.COMPLETED ? "Task already processed." : "Task is being processed.";
    res.status(200).json({
      success: true,
      message,
    });
    return;
  }

  // Case 3: Stale or failed - retry processing
  const audit = await AuditModel.findOneAndUpdate(
    {
      roundNumber: round,
    },
    {
      status: AuditStatus.IN_PROGRESS,
      error: null,
    },
    { upsert: true, new: true },
  );

  try {
    // Normal production flow - use distribution list
    let positiveKeys: string[] = [];
    let negativeKeys: string[] = [];

    const submitter = await getDistributionListSubmitter(taskId, String(round));
    if (!submitter) {
      await TodoModel.updateMany(
        { status: TodoStatus.IN_REVIEW, assignees: { $elemMatch: { roundNumber: round } } },
        {
          $set: {
            status: TodoStatus.INITIALIZED,
          },
        },
      );
      // Reset stale assignments when no distribution list
      await resetStaleAssignments(round);
      throw new Error("No Distribution List Submitter found");
    }

    const distributionList = await getDistributionListWrapper(taskId, String(round));
    if (!distributionList) {
      await TodoModel.updateMany(
        { status: TodoStatus.IN_REVIEW, assignees: { $elemMatch: { roundNumber: round } } },
        {
          $set: {
            status: TodoStatus.INITIALIZED,
          },
        },
      );
      // Reset stale assignments when no distribution list
      await resetStaleAssignments(round);
      throw new Error("No Distribution List found");
    }

    const { positive, negative } = await getKeysByValueSign(distributionList);
    positiveKeys = positive;
    negativeKeys = negative;

    await triggerFetchAuditResultLogic(positiveKeys, negativeKeys, round);

    // Reset any stale assignments after processing
    await resetStaleAssignments(round);

    await AuditModel.findByIdAndUpdate(audit._id, {
      status: AuditStatus.COMPLETED,
    });

    res.status(200).json({
      success: true,
      message: "Task processed successfully.",
    });
  } catch (error) {
    await AuditModel.findByIdAndUpdate(audit._id, {
      status: AuditStatus.FAILED,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Audit processing failed",
    });
  }
}

/**
 * Special function for test environment to update todos and issues statuses
 * without needing to check the distribution list
 */
async function updateTestEnvironmentStatus(round: number): Promise<void> {
  console.log(`[TEST MODE] Starting audit results processing for round ${round}`);

  // 1. Update IN_REVIEW todos to APPROVED if they have PR URLs
  const inReviewTodos = await TodoModel.find({
    status: TodoStatus.IN_REVIEW,
    assignees: {
      $elemMatch: {
        roundNumber: round,
        prUrl: { $exists: true, $ne: null },
      },
    },
  });

  for (const todo of inReviewTodos) {
    if (todo.assignees && todo.assignees.length >= 5) {
      todo.status = TodoStatus.FAILED;
      console.log(`[TEST MODE] Setting todo ${todo._id} to FAILED - has ${todo.assignees.length} assignees`);
    } else {
      todo.status = TodoStatus.APPROVED;
      const assignee = todo.assignees?.find((a) => a.roundNumber === round);
      if (assignee) {
        assignee.approved = true;
      }
      console.log(`[TEST MODE] Setting todo ${todo._id} to APPROVED`);
    }
    await todo.save();
  }

  console.log(`[TEST MODE] Updated ${inReviewTodos.length} todos from IN_REVIEW to APPROVED for round ${round}`);

  // 2. Find all IN_PROGRESS issues (these are issues that have been audited by the leader)
  const inProgressIssues = await IssueModel.find({ status: IssueStatus.IN_PROGRESS });

  console.log(`[TEST MODE] Found ${inProgressIssues.length} issues in IN_PROGRESS status`);

  // 3. For each IN_PROGRESS issue, check if all its todos are APPROVED
  for (const issue of inProgressIssues) {
    console.log(`[TEST MODE] Processing issue ${issue.uuid}`);
    const todos = await TodoModel.find({ issueUuid: issue.uuid });
    console.log(`[TEST MODE] Found ${todos.length} todos for issue ${issue.uuid}`);

    const allTodosApproved = todos.every((todo) => todo.status === TodoStatus.APPROVED);

    console.log(`[TEST MODE] All todos approved: ${allTodosApproved}`);

    if (allTodosApproved) {
      // Update to ASSIGN_PENDING if all todos are approved
      await IssueModel.updateOne({ _id: issue._id }, { $set: { status: IssueStatus.ASSIGN_PENDING } });
      console.log(`[TEST MODE] Updated issue ${issue.uuid} to ASSIGN_PENDING - all todos are approved`);
    } else {
      console.log(`[TEST MODE] Issue ${issue.uuid} remains IN_PROGRESS - not all todos are approved`);
    }
  }

  // 4. For issues IN_REVIEW, update them to APPROVED and set assignee.approved
  const inReviewIssues = await IssueModel.find({ status: IssueStatus.IN_REVIEW });
  for (const issue of inReviewIssues) {
    const assignee = issue.assignees?.find((a) => a.roundNumber === round);

    if (assignee?.prUrl && issue.forkOwner && issue.repoName) {
      try {
        // Use the same mergePullRequest function that production uses
        await mergePullRequest(issue);
        console.log(`[TEST MODE] Merged PR for issue ${issue.uuid}`);
      } catch (error) {
        console.error(`[TEST MODE] Failed to merge PR for issue ${issue.uuid}:`, error);
      }
    }

    if (issue.assignees && issue.assignees.length >= 5) {
      issue.status = IssueStatus.FAILED;
      console.log(`[TEST MODE] Setting issue ${issue.uuid} to FAILED - has ${issue.assignees.length} assignees`);
    } else {
      issue.status = IssueStatus.APPROVED;
      if (assignee) {
        assignee.approved = true;
      }
      console.log(`[TEST MODE] Setting issue ${issue.uuid} to APPROVED`);
    }
    await issue.save();
  }
  console.log(`[TEST MODE] Updated ${inReviewIssues.length} issues from IN_REVIEW to APPROVED`);

  // 5. Close unapproved PRs
  const unapprovedIssues = await IssueModel.find({
    status: IssueStatus.ASSIGN_PENDING,
    assignees: {
      $elemMatch: {
        roundNumber: round,
        prUrl: { $exists: true, $ne: null },
      },
    },
  });

  for (const issue of unapprovedIssues) {
    const assignee = issue.assignees?.find((a) => a.roundNumber === round);
    if (assignee?.prUrl && issue.forkOwner && issue.repoName) {
      try {
        const octokit = await getOctokit();
        const prNumber = parseInt(assignee.prUrl.split("/").pop() || "");
        if (!isNaN(prNumber)) {
          await octokit.pulls.update({
            owner: issue.forkOwner,
            repo: issue.repoName,
            pull_number: prNumber,
            state: "closed",
          });
          console.log(`[TEST MODE] Closed unapproved PR #${prNumber} for issue ${issue.uuid}`);
        }
      } catch (error) {
        console.error(`[TEST MODE] Failed to close unapproved PR for issue ${issue.uuid}:`, error);
      }
    }
  }

  // 6. Create PR to source repository for approved bounties
  const approvedIssues = await IssueModel.find({ status: IssueStatus.APPROVED });
  const uniqueBountyIds = new Set(approvedIssues.map((issue) => issue.bountyId));

  for (const bountyId of uniqueBountyIds) {
    if (!bountyId) continue;

    const bountyIssues = await IssueModel.find({
      bountyId: bountyId,
      status: IssueStatus.APPROVED,
    });

    // Check if all issues for this bounty are approved
    const allIssuesForBounty = await IssueModel.find({ bountyId: bountyId });
    const allApproved = allIssuesForBounty.every((issue) => issue.status === IssueStatus.APPROVED);

    if (allApproved && bountyIssues.length > 0) {
      try {
        console.log(`[TEST MODE] Creating PR to source repo for bounty ${bountyId}`);
        const prUrl = await createPullRequestToSource(bountyIssues[0]);
        console.log(`[TEST MODE] Created PR to source repo for bounty ${bountyId}: ${prUrl}`);
      } catch (error) {
        console.error(`[TEST MODE] Failed to create PR to source repo for bounty ${bountyId}:`, error);
      }
    }
  }

  // Add reset of stale assignments at the end of test environment updates
  await resetStaleAssignments(round);

  console.log(`[TEST MODE] Completed audit results processing for round ${round}`);
}

async function mergePullRequest(issue: any) {
  try {
    const octokit = await getOctokit();
    const assignee = issue.assignees?.find((a: any) => a.prUrl);
    if (!assignee?.prUrl) {
      console.log(`No PR URL found for issue ${issue.uuid}`);
      return;
    }

    // Parse PR URL to get owner, repo, and PR number
    // URL format: https://github.com/{owner}/{repo}/pull/{number}
    const urlParts = assignee.prUrl.replace("https://github.com/", "").split("/");
    if (urlParts.length < 4) {
      console.log(`Invalid PR URL format: ${assignee.prUrl}`);
      return;
    }

    const owner = urlParts[0];
    const repo = urlParts[1];
    const pull_number = parseInt(urlParts[3]);

    console.log({ owner, repo, pull_number });

    if (Number.isNaN(pull_number)) {
      console.log(`Invalid PR number from URL: ${assignee.prUrl}`);
      return;
    }

    // Merge the PR
    await octokit.pulls.merge({
      owner,
      repo,
      pull_number,
    });

    console.log(`Successfully merged PR ${pull_number} for issue ${issue.uuid}`);
  } catch (error) {
    console.error(`Failed to merge PR for issue ${issue.uuid}:`, error);
    throw error;
  }
}

async function createPullRequestToSource(issue: any) {
  try {
    const octokit = await getOctokit();

    // Get the spec for this bounty
    const spec = await SpecModel.findOne({ swarmBountyId: issue.bountyId });
    if (!spec) {
      throw new Error(`No spec found for bounty ${issue.bountyId}`);
    }

    // Get all issues for this bounty
    const bountyIssues = await IssueModel.find({ bountyId: issue.bountyId });

    // Build the PR description with spec and issue details
    let prBody = `# Bounty Specification\n\n${spec.description}\n\n`;
    prBody += `# Completed Issues\n\n`;

    for (const bountyIssue of bountyIssues) {
      const assignee = bountyIssue.assignees?.find((a) => a.prUrl);
      prBody += `## ${bountyIssue.title}\n\n`;
      prBody += `${bountyIssue.description}\n\n`;
      if (assignee?.prUrl) {
        prBody += `PR: [View Changes](${assignee.prUrl})\n\n`;
      }
    }

    // Create PR from fork's main to source repo
    const response = await octokit.pulls.create({
      owner: issue.repoOwner,
      repo: issue.repoName,
      title: spec.title,
      body: prBody,
      head: `${issue.forkOwner}:main`,
      base: "main",
    });

    console.log(`Created PR from fork to source repo: ${response.data.html_url}`);

    // Update all issues for this bounty to SUBMITTED status to prevent repeated PR creation
    await IssueModel.updateMany({ bountyId: issue.bountyId }, { $set: { status: IssueStatus.SUBMITTED } });
    console.log(`Updated all issues for bounty ${issue.bountyId} to SUBMITTED status`);

    return response.data.html_url;
  } catch (error) {
    console.error(`Failed to create PR to source repo for issue ${issue.uuid}:`, error);
    throw error;
  }
}

export const triggerFetchAuditResultLogic = async (positiveKeys: string[], negativeKeys: string[], round: number) => {
  console.log(`Processing audit results for round ${round}`);
  console.log(`Positive keys: ${positiveKeys.length}, Negative keys: ${negativeKeys.length}`);

  // Update the subtask status
  const auditableTodos = await TodoModel.find({ "assignees.roundNumber": round });

  console.log(`Found ${auditableTodos.length} auditable todos`);

  for (const todo of auditableTodos) {
    const assignee = todo.assignees?.find((a) => a.roundNumber === round);
    if (!assignee) continue;

    if (positiveKeys.includes(assignee.stakingKey)) {
      todo.status = TodoStatus.APPROVED;
      assignee.approved = true;
      console.log(`Approving todo ${todo._id} with key ${assignee.stakingKey}`);
    } else {
      if (todo.assignees && todo.assignees.length >= 5) {
        todo.status = TodoStatus.FAILED;
        console.log(`Setting todo ${todo._id} to FAILED - has ${todo.assignees.length} assignees`);
      } else {
        todo.status = TodoStatus.INITIALIZED;
        console.log(`Rejecting todo ${todo._id}`);
      }
      assignee.prUrl = undefined;
      assignee.approved = false;
    }
    await todo.save();
  }

  // Check all in progress issues
  const issues = await IssueModel.find({ status: IssueStatus.IN_PROGRESS });
  console.log(`Found ${issues.length} issues related to updated todos`);

  for (const issue of issues) {
    const todos = await TodoModel.find({ issueUuid: issue.uuid });
    if (todos.every((todo) => todo.status === TodoStatus.APPROVED)) {
      issue.status = IssueStatus.ASSIGN_PENDING;
      console.log(`Setting issue ${issue.uuid} to ASSIGN_PENDING - all todos approved`);
    } else {
      console.log(
        `Issue ${issue.uuid} remains in current status - not all todos are approved:`,
        todos.map((t) => ({
          id: t._id,
          status: t.status,
        })),
      );
    }
    await issue.save();
    if (issue.bountyId) {
      const allBountyIssues = await IssueModel.find({ bountyId: issue.bountyId }).lean();
      if (allBountyIssues.every((i) => i.status === IssueStatus.APPROVED)) {
        await updateSwarmBountyStatus(issue.bountyId, SwarmBountyStatus.COMPLETED);
      }
    }
  }

  // Now update the has PR issues
  const auditedIssues = await IssueModel.find({ "assignees.roundNumber": round });

  console.log(`Found ${auditedIssues.length} audited issues`);

  for (const issue of auditedIssues) {
    const assignee = issue.assignees?.find((a) => a.roundNumber === round);
    if (!assignee) continue;

    if (positiveKeys.includes(assignee.stakingKey)) {
      issue.status = IssueStatus.APPROVED;
      assignee.approved = true;
      await issue.save();
      console.log(`Setting issue ${issue.uuid} to APPROVED`);

      // Merge the PR into the fork
      await mergePullRequest(issue);

      console.log(`Merged PR for issue ${issue.uuid}`);

      await TodoModel.updateMany({ issueUuid: issue.uuid }, { $set: { status: TodoStatus.MERGED } });
      console.log(`Updated todos for issue ${issue.uuid} to MERGED`);
    } else {
      if (issue.assignees && issue.assignees.length >= 5) {
        issue.status = IssueStatus.FAILED;
        console.log(`Setting issue ${issue.uuid} to FAILED - has ${issue.assignees.length} assignees`);
      } else {
        issue.status = IssueStatus.ASSIGN_PENDING;
        console.log(`Setting issue back to ${issue.uuid} to ASSIGN_PENDING`);
      }
      assignee.approved = false;
      await issue.save();

      // Close the unapproved PR
      if (assignee.prUrl && issue.forkOwner && issue.repoName) {
        try {
          const octokit = await getOctokit();
          const prNumber = parseInt(assignee.prUrl.split("/").pop() || "");
          if (!isNaN(prNumber)) {
            await octokit.pulls.update({
              owner: issue.forkOwner,
              repo: issue.repoName,
              pull_number: prNumber,
              state: "closed",
            });
            console.log(`Closed unapproved PR #${prNumber} for issue ${issue.uuid}`);
          }
        } catch (error) {
          console.error(`Failed to close unapproved PR for issue ${issue.uuid}:`, error);
        }
      }
    }
  }

  // Get unique bounty IDs from audited issues
  const uniqueBountyIds = new Set(auditedIssues.map((issue) => issue.bountyId));

  // Check each bounty separately
  for (const bountyId of uniqueBountyIds) {
    if (!bountyId) continue;

    const bountyIssues = await IssueModel.find({
      bountyId: bountyId,
      status: IssueStatus.APPROVED,
    });

    // Check if all issues for this bounty are approved
    const allIssuesForBounty = await IssueModel.find({ bountyId: bountyId });
    const allApproved = allIssuesForBounty.every((issue) => issue.status === IssueStatus.APPROVED);

    if (allApproved && bountyIssues.length > 0) {
      // All issues for this bounty are approved, create PR to source repo
      try {
        const prUrl = await createPullRequestToSource(bountyIssues[0]);
        console.log(`Created PR to source repo for bounty ${bountyId}: ${prUrl}`);
      } catch (error) {
        console.error(`Failed to create PR to source repo for bounty ${bountyId}:`, error);
      }
    }
  }
};
