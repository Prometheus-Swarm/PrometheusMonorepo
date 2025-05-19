import { DocumentationModel, DocumentationStatus } from "../../../models/Documentation";

import { Request, Response } from "express";
import { verifySignature } from "../../../utils/sign";
import { documentSummarizerTaskID, SwarmBountyStatus } from "../../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";
import { getCurrentRound } from "../../../utils/taskState/submissionRound";

function verifyRequestBody(req: Request): { signature: string; stakingKey: string } | null {
  try {
    console.log("req.body", req.body);
    const signature = req.body.signature as string;
    const stakingKey = req.body.stakingKey as string;
    if (!signature || !stakingKey) {
      return null;
    }

    return { signature, stakingKey };
  } catch {
    return null;
  }
}

// Helper function to verify signature
async function verifySignatureData(
  signature: string,
  stakingKey: string,
  action: string,
): Promise<{ prUrl: string; swarmBountyId: string | null } | null> {
  try {
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("signature error", error);
      return null;
    }
    const body = JSON.parse(data);
    console.log("signature payload", { body, stakingKey });
    if (
      !body.taskId ||
      body.taskId !== documentSummarizerTaskID ||
      body.action !== action ||
      !body.prUrl ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey ||
      !body.swarmBountyId
    ) {
      return null;
    }
    return { prUrl: body.prUrl, swarmBountyId: body.swarmBountyId };
  } catch {
    return null;
  }
}
export async function updateAssignedInfoRoundNumber(
  stakingKey: string,
  prUrl: string,
  signature: string,
  roundNumber: number,
  swarmBountyId: string | null,
): Promise<{ statuscode: number; data: { success: boolean; message: string; swarmBountyId?: string } }> {
  if (!swarmBountyId) {
    return {
      statuscode: 401,
      data: {
        success: false,
        message: "Failed to verify signature",
      },
    };
  }
  console.log("updateAssignedInfoRoundNumber", { stakingKey, prUrl, signature, roundNumber });
  console.log({
    taskId: documentSummarizerTaskID,
    stakingKey: stakingKey,
    prUrl: prUrl,
    roundNumber: roundNumber,
  });
  const result = await DocumentationModel.findOneAndUpdate(
    {
      taskId: documentSummarizerTaskID,
      stakingKey: stakingKey,
      roundNumber: { $exists: false },
      assignedTo: {
        $elemMatch: {
          taskId: documentSummarizerTaskID,
          stakingKey: stakingKey,
          prUrl: prUrl,
          roundNumber: { $exists: false },
        },
      },
    },
    {
      $set: {
        roundNumber: roundNumber - 1,
        "assignedTo.$.roundNumber": roundNumber - 1,
        status: DocumentationStatus.IN_REVIEW,
      },
    },
  )
    .select("_id")
    .lean();
  console.log("prUrl update result", result);

  if (result !== null) {
    return {
      statuscode: 200,
      data: {
        success: true,
        message: "Round number added",
        swarmBountyId: result?.swarmBountyId,
      },
    };
  }
  return {
    statuscode: 401,
    data: {
      success: false,
      message: "Failed to add round number",
    },
  };
}

export const addRoundNumberRequest = async (req: Request, res: Response) => {
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const signatureData = await verifySignatureData(requestBody.signature, requestBody.stakingKey, "add-round-number");
  if (!signatureData) {
    res.status(401).json({
      success: false,
      message: "Failed to verify signature",
    });
    return;
  }

  if (!(await isValidStakingKey(documentSummarizerTaskID, requestBody.stakingKey))) {
    res.status(401).json({
      success: false,
      message: "Invalid staking key",
    });
    return;
  }

  const response = await addRoundNumberLogic(requestBody, signatureData);
  res.status(response.statuscode).json(response.data);
};

export const addRoundNumberLogic = async (
  requestBody: { signature: string; stakingKey: string },
  signatureData: { prUrl: string; swarmBountyId: string | null },
) => {
  // console.log("prUrl", signatureData.prUrl);
  const roundNumber = await getCurrentRound(documentSummarizerTaskID);
  if (roundNumber === null || roundNumber === undefined) {
    return {
      statuscode: 401,
      data: {
        success: false,
        message: "Failed to get current round",
      },
    };
  }
  const result = await updateAssignedInfoRoundNumber(
    requestBody.stakingKey,
    signatureData.prUrl,
    requestBody.signature,
    roundNumber,
    signatureData.swarmBountyId,
  );
  if (result.data.swarmBountyId && process.env.NODE_ENV !== "development") {
    await updateSwarmBountyStatus(result.data.swarmBountyId, SwarmBountyStatus.AUDITING);
  }
  return result;
};
