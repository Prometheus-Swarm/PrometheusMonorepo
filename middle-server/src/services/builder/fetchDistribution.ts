// import { triggerFetchAuditResultLogic } from "../../controllers/summarizer/worker/updateAuditResult";
import { TodoStatus } from "../../models/Todo";
import { DistributionResultModel } from "../../models/DistributionResult";
import { TodoModel } from "../../models/Todo";
import {
  getDistributionListRounds,
  getDistributionListWrapper,
  getKeysByValueSign,
} from "../../utils/taskState/distributionList";
import { updateSwarmBountyStatus } from "../swarmBounty/updateStatus";
import { SwarmBountyStatus } from "../../config/constant";
import dotenv from "dotenv";
import { IssueStatus } from "../../models/Issue";
import { IssueModel } from "../../models/Issue";
import { SpecModel } from "../../models/Spec";
dotenv.config();

let octokitInstance: any = null;

export const loadMissingDistributionToDatabase = async () => {
  const taskID = process.env.TASK_IDS!.split(",")[0];
  const rounds = await getDistributionListRounds(taskID);

  console.log("rounds", rounds);
  for (const round of rounds) {
    // check if the round is already in the database
    const distributionResult = await DistributionResultModel.findOne({
      taskId: taskID,
      round: round,
    });
    if (distributionResult) {
      continue;
    }
    const distributionList = await getDistributionListWrapper(taskID, round.toString());
    await fetchDistribution(distributionList, taskID, round);
  }
};

export const fetchDistribution = async (distributionList: any, taskId: string, round: number) => {
  let positiveKeys: string[] = [];
  let negativeKeys: string[] = [];
  if (distributionList) {
    const { positive, negative } = await getKeysByValueSign(distributionList);
    positiveKeys = positive;
    negativeKeys = negative;
  } else {
    return {
      statuscode: 200,
      data: {
        success: true,
        message: "No Distribution List found.",
      },
    };
  }
  // save rounds and positiveKeys and negativeKeys
  const distributionResult = await DistributionResultModel.create({
    taskId,
    round,
    positiveKeys,
    negativeKeys,
  });
  await distributionResult.save();
  const response = await updateSubtaskStatus(positiveKeys, negativeKeys, round);
  return response;
};
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

export const updateSubtaskStatus = async (positiveKeys: string[], negativeKeys: string[], round: number) => {
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
