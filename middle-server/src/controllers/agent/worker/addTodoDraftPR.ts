import { TodoModel, Status } from "../../../models/Todo";

import { Request, Response } from "express";
import { verifySignature } from "../../../utils/sign";
import { SwarmBountyStatus, taskIDs } from "../../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";

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
): Promise<{ prUrl: string; swarmBountyId: string, taskId: string } | null> {
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
      !taskIDs.includes(body.taskId) ||
      body.action !== action ||
      !body.prUrl ||
      !body.stakingKey ||
      !body.swarmBountyId ||
      body.stakingKey !== stakingKey
    ) {
      return null;
    }
    return { prUrl: body.prUrl, swarmBountyId: body.swarmBountyId, taskId: body.taskId };
  } catch {
    return null;
  }
}
export async function updateAssignedInfoPrUrl(
  stakingKey: string,
  prUrl: string,
  swarmBountyId: string,
  taskId: string,
): Promise<{ statuscode: number; data: { success: boolean; message: string; swarmBountyId?: string } }> {
  console.log("updateAssignedInfoWithIPFS", { stakingKey, prUrl, swarmBountyId });
  console.log({
    taskId: taskId,
    stakingKey: stakingKey,
    swarmBountyId: swarmBountyId,
    assignedTo: {
      $elemMatch: {
        taskId: taskId,
        stakingKey: stakingKey,
      },
    },
  });
  const result = await TodoModel.findOneAndUpdate(
    {
      taskId: taskId,
      stakingKey: stakingKey,
      bountyId: swarmBountyId,
      assignedTo: {
        $elemMatch: {
          taskId: taskId,
          stakingKey: stakingKey,
        },
      },
    },
    {
      $set: { "assignedTo.$.prUrl": prUrl, status: Status.DRAFT_PR_RECEIVED },
      $unset: {
        roundNumber: "",
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
        message: "PR URL updated",
        swarmBountyId: swarmBountyId,
      },
    };
  }
  return {
    statuscode: 401,
    data: {
      success: false,
      message: "Failed to update PR URL",
    },
  };
}

export const addDraftRequest = async (req: Request, res: Response) => {
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const signatureData = await verifySignatureData(requestBody.signature, requestBody.stakingKey, "add-todo-draft-pr");
  if (!signatureData) {
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

  const response = await addPRUrlLogic(requestBody, signatureData);
  res.status(response.statuscode).json(response.data);
};

export const addPRUrlLogic = async (
  requestBody: { signature: string; stakingKey: string },
  signatureData: { prUrl: string; swarmBountyId: string, taskId: string },
) => {
  console.log("prUrl", signatureData.prUrl);
  const result = await updateAssignedInfoPrUrl(
    requestBody.stakingKey,
    signatureData.prUrl,
    signatureData.swarmBountyId,
    signatureData.taskId,
  );
  if (result.data.swarmBountyId && process.env.NODE_ENV !== "development") {
    await updateSwarmBountyStatus(result.data.swarmBountyId, SwarmBountyStatus.IN_PROGRESS);
  }
  return result;
};
