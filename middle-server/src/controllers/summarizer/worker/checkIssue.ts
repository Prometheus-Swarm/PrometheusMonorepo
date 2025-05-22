import { Request, Response } from "express";
import { IssueModel } from "../../../models/Issue";
import { verifySignature } from "../../../utils/sign";
import { taskIDs } from "../../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
import { getPRDict } from "../../../utils/issueUtils";
import { SwarmBountyType } from "../../../config/constant";
import { SystemPromptModel } from "../../../models/SystemPrompt";

// Helper function to verify request body
function verifyRequestBody(req: Request): {
  signature: string;
  stakingKey: string;
  pubKey: string;
} | null {
  try {
    console.log("Request body:", req.body);
    const signature = req.body.signature as string;
    const stakingKey = req.body.stakingKey as string;
    const pubKey = req.body.pubKey as string;
    if (!signature || !stakingKey || !pubKey) {
      return null;
    }
    return { signature, pubKey, stakingKey };
  } catch {
    return null;
  }
}

// Helper function to verify signature
async function verifySignatureData(
  signature: string,
  stakingKey: string,
  pubKey: string,
): Promise<{ roundNumber: number; issueUuid: string; taskId: string; prUrl: string; bountyId: string } | null> {
  try {
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("Signature verification failed:", error);
      return null;
    }
    const body = JSON.parse(data);
    console.log("Signature payload:", body);

    if (
      !body.taskId ||
      typeof body.roundNumber !== "number" ||
      !taskIDs.includes(body.taskId) ||
      body.action !== "audit" ||
      !body.pubKey ||
      body.pubKey !== pubKey ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey ||
      !body.prUrl ||
      !body.bountyId
    ) {
      console.log("Signature payload validation failed");
      return null;
    }
    return {
      roundNumber: body.roundNumber,
      issueUuid: body.issueUuid,
      taskId: body.taskId,
      prUrl: body.prUrl,
      bountyId: body.bountyId,
    };
  } catch (error) {
    console.error("Error in verifySignatureData:", error);
    return null;
  }
}

async function checkIssueAssignment(
  stakingKey: string,
  roundNumber: number,
  prUrl: string,
  bountyId: string,
): Promise<{ issueUuid: string | null; systemPrompt?: string }> {
  try {
    const result = await IssueModel.findOne({
      bountyId: bountyId,
      bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER,
      assignees: {
        $elemMatch: {
          stakingKey: stakingKey,
          roundNumber: roundNumber,
          prUrl: prUrl,
        },
      },
    })
      .select("uuid bountyId")
      .lean();

    if (!result) {
      return { issueUuid: null };
    }

    // Get system prompt
    const systemPrompt = await SystemPromptModel.findOne({
      bountyId: result.bountyId,
      bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER,
    })
      .select("prompt")
      .lean();

    return {
      issueUuid: result.uuid,
      systemPrompt: systemPrompt?.prompt,
    };
  } catch (error) {
    console.error("Error checking issue assignment:", error);
    return { issueUuid: null };
  }
}

export const checkIssue = async (req: Request, res: Response) => {
  console.log("\nProcessing check-issue request");
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    console.log("Invalid request body");
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const signatureData = await verifySignatureData(requestBody.signature, requestBody.stakingKey, requestBody.pubKey);
  if (!signatureData) {
    console.log("Failed to verify signature data");
    res.status(401).json({
      success: false,
      message: "Failed to verify signature",
    });
    return;
  }

  if (!(await isValidStakingKey(signatureData.taskId, requestBody.stakingKey))) {
    console.log("Invalid staking key:", requestBody.stakingKey);
    res.status(401).json({
      success: false,
      message: "Invalid staking key",
    });
    return;
  }

  const result = await checkIssueAssignment(
    requestBody.stakingKey,
    signatureData.roundNumber,
    signatureData.prUrl,
    signatureData.bountyId,
  );

  if (!result.issueUuid) {
    console.log("No matching issue assignment found");
    res.status(409).json({
      success: false,
      message: "No matching issue assignment found",
    });
    return;
  }

  // Get the PR dictionary
  const prDict = await getPRDict(result.issueUuid);
  if (!prDict) {
    res.status(409).json({
      success: false,
      message: "Issue not found",
    });
    return;
  }

  console.log("Issue assignment verified successfully");
  res.status(200).json({
    success: true,
    message: "Issue assignment verified successfully",
    data: {
      pr_list: prDict,
      issue_uuid: result.issueUuid,
      system_prompt: result.systemPrompt,
    },
  });
};
