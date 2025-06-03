import { Request, Response } from "express";
import { IssueModel, IssueStatus } from "../../../models/Issue";
import { SwarmBountyType } from "../../../config/constant";

const AGGREGATOR_TIMEOUT = 60 * 1000; // 1 minute

export function verifyRequestBody(req: Request): { githubUsername: string } | null {
  console.log("verifyRequestBody", req.body);
  const githubUsername = req.body.githubUsername as string;
  if (!githubUsername) {
    return null;
  }
  return { githubUsername };
}

export const assignIssue = async (req: Request, res: Response) => {
  const body = verifyRequestBody(req);
  if (!body) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const response = await assignIssueLogic();
  res.status(response.statuscode).json(response.data);
};

export const assignIssueLogic = async () => {
  // First check for any issues stuck in AGGREGATOR_PENDING
  const stuckIssue = await IssueModel.findOneAndUpdate(
    {
      status: IssueStatus.AGGREGATOR_PENDING,
      bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER,
      updatedAt: { $lt: new Date(Date.now() - AGGREGATOR_TIMEOUT) },
    },
    { $set: { status: IssueStatus.INITIALIZED } },
    { new: true, sort: { createdAt: 1 } },
  );

  if (stuckIssue) {
    console.log(`Found stuck issue ${stuckIssue.uuid} in AGGREGATOR_PENDING, resetting to INITIALIZED`);
  }

  // Find all issues in initialized status, sorted by creation date
  const issues = await IssueModel.find({
    status: IssueStatus.INITIALIZED,
    bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER,
  }).sort({ createdAt: 1 });

  if (!issues || issues.length === 0) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "No issues available for assignment",
      },
    };
  }

  // Keep track of bounties we've skipped
  const skippedBounties = new Set<string>();

  // Loop through issues to find the first assignable one
  for (const issue of issues) {
    // Skip issues from bounties we've already determined are blocked
    if (issue.bountyId && skippedBounties.has(issue.bountyId)) {
      console.log(`Skipping issue from blocked bounty ${issue.bountyId}`);
      continue;
    }

    // If issue has no predecessor, it can be assigned
    if (!issue.predecessorUuid) {
      const result = await IssueModel.findOneAndUpdate(
        { uuid: issue.uuid, bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER },
        { $set: { status: IssueStatus.AGGREGATOR_PENDING } },
        { new: true },
      );

      if (!result) {
        console.error(`Failed to update issue ${issue.uuid}`);
        continue;
      }

      return {
        statuscode: 200,
        data: {
          success: true,
          message: "Issue assigned",
          issueId: result.uuid,
          repoOwner: result.forkOwner,
          repoName: result.repoName,
          bountyId: result.bountyId,
          forkUrl: result.forkUrl,
        },
      };
    }

    // Check if predecessor is approved
    const predecessor = await IssueModel.findOne({
      uuid: issue.predecessorUuid,
      bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER,
    });
    if (!predecessor) {
      console.error(`Predecessor issue ${issue.predecessorUuid} not found`);
      continue;
    }

    if (predecessor.status === IssueStatus.APPROVED) {
      const result = await IssueModel.findOneAndUpdate(
        { uuid: issue.uuid, bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER },
        { $set: { status: IssueStatus.AGGREGATOR_PENDING } },
        { new: true },
      );

      if (!result) {
        console.error(`Failed to update issue ${issue.uuid}`);
        continue;
      }

      return {
        statuscode: 200,
        data: {
          success: true,
          message: "Issue assigned",
          issueId: result.uuid,
          repoOwner: result.forkOwner,
          repoName: result.repoName,
          bountyId: result.bountyId,
          forkUrl: result.forkUrl,
        },
      };
    }

    // If predecessor is not approved, mark this bounty as skipped
    if (predecessor.bountyId) {
      console.log(`Marking bounty ${predecessor.bountyId} as blocked due to unapproved predecessor`);
      skippedBounties.add(predecessor.bountyId);
    }
  }

  return {
    statuscode: 409,
    data: {
      success: false,
      message: "No issues available for assignment",
    },
  };
};
