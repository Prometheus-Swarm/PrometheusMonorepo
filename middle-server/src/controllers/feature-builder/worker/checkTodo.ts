import { Request, Response } from "express";
import { TodoModel } from "../../../models/Todo";
import { verifySignature } from "../../../utils/sign";
import { taskIDs, SwarmBountyType } from "../../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
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
): Promise<{ roundNumber: string; githubUsername: string; prUrl: string; taskId: string; bountyId: string } | null> {
  try {
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("Signature verification failed:", error);
      return null;
    }
    const body = JSON.parse(data);
    console.log("Signature payload:", body);

    // Log all validation checks
    console.log({
      taskIDFromEnv: taskIDs,
      taskIdFromPayload: body.taskId,
      roundNumberValue: body.roundNumber,
      githubUsername: body.githubUsername,
      pubKey: body.pubKey,
      stakingKey: body.stakingKey,
      prUrl: body.prUrl,
      taskIDMatch: taskIDs.includes(body.taskId),
      roundNumberTypeMatch: typeof body.roundNumber === "number",
      actionMatch: body.action === "audit",
      pubKeyMatch: body.pubKey === pubKey,
      stakingKeyMatch: body.stakingKey === stakingKey,
    });

    if (
      !body.taskId ||
      typeof body.roundNumber !== "number" ||
      !taskIDs.includes(body.taskId) ||
      body.action !== "audit" ||
      !body.prUrl ||
      !body.githubUsername ||
      !body.pubKey ||
      body.pubKey !== pubKey ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey ||
      !body.bountyId
    ) {
      console.log("Signature payload validation failed");
      return null;
    }
    return {
      roundNumber: body.roundNumber,
      githubUsername: body.githubUsername,
      prUrl: body.prUrl,
      taskId: body.taskId,
      bountyId: body.bountyId,
    };
  } catch (error) {
    console.error("Error in verifySignatureData:", error);
    return null;
  }
}

async function checkToDoAssignment(
  stakingKey: string,
  githubUsername: string,
  prUrl: string,
  bountyId: string,
): Promise<{ isValid: boolean; systemPrompt?: string }> {
  try {
    const result = await TodoModel.findOne({
      bountyId: bountyId,
      bountyType: SwarmBountyType.BUILD_FEATURE,
      assignees: {
        $elemMatch: {
          stakingKey: stakingKey,
          githubUsername: githubUsername,
          prUrl: prUrl,
        },
      },
    })
      .select("_id bountyId")
      .lean();

    if (!result) {
      return { isValid: false };
    }

    // Get system prompt
    const systemPrompt = await SystemPromptModel.findOne({
      bountyId: result.bountyId,
      bountyType: SwarmBountyType.BUILD_FEATURE,
    })
      .select("prompt")
      .lean();

    return {
      isValid: true,
      systemPrompt: systemPrompt?.prompt,
    };
  } catch (error) {
    console.error("Error checking todo assignment:", error);
    return { isValid: false };
  }
}

export const checkToDo = async (req: Request, res: Response) => {
  console.log("\nProcessing check-to-do request");
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
    res.status(401).json({
      success: false,
      message: "Invalid staking key",
    });
    return;
  }

  const result = await checkToDoAssignment(
    requestBody.stakingKey,
    signatureData.githubUsername,
    signatureData.prUrl,
    signatureData.bountyId,
  );

  if (!result.isValid) {
    console.log("No matching todo assignment found");
    res.status(409).json({
      success: false,
      message: "No matching todo assignment found",
    });
    return;
  }

  console.log("Todo assignment verified successfully");
  res.status(200).json({
    success: true,
    message: "Todo assignment verified successfully",
    data: {
      system_prompt: result.systemPrompt,
    },
  });
};
