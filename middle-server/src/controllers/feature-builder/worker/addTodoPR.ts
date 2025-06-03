import { Request, Response } from "express";
import { taskIDs, SwarmBountyType } from "../../../config/constant";
import { verifySignature } from "../../../utils/sign";
import { isValidStakingKey } from "../../../utils/taskState";
import { TodoModel, TodoStatus } from "../../../models/Todo";

function verifyRequestBody(req: Request): {
  signature: string;
  pubKey: string;
  stakingKey: string;
  uuid?: string;
  prUrl?: string;
  bountyId?: string;
} | null {
  try {
    console.log("req.body", req.body);
    const signature = req.body.signature as string;
    const pubKey = req.body.pubKey as string;
    const stakingKey = req.body.stakingKey as string;
    const uuid = req.body.uuid as string;
    const prUrl = req.body.prUrl as string;
    const bountyId = req.body.bountyId as string;
    if (!signature || !pubKey || !stakingKey) {
      return null;
    }

    return { signature, pubKey, stakingKey, uuid, prUrl, bountyId };
  } catch {
    return null;
  }
}

// Helper function to verify signature
async function verifySignatureData(
  signature: string,
  pubKey: string,
  stakingKey: string,
  action: string,
): Promise<{
  roundNumber: number;
  taskId: string;
  prUrl: string;
  isFinal: boolean;
  uuid?: string;
  bountyId?: string;
} | null> {
  try {
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("signature error", error);
      return null;
    }
    const body = JSON.parse(data);
    console.log("signature payload", { body, pubKey, stakingKey });
    console.log("taskIDs match", taskIDs.includes(body.taskId));
    console.log("typeof body.roundNumber", typeof body.roundNumber);
    console.log("body.action", body.action);
    console.log("body.pubKey", body.pubKey);
    console.log("body.stakingKey", body.stakingKey);
    if (
      !body.taskId ||
      !taskIDs.includes(body.taskId) ||
      typeof body.roundNumber !== "number" ||
      body.action !== action ||
      !body.pubKey ||
      body.pubKey !== pubKey ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey ||
      body.isFinal === undefined ||
      (body.isFinal && body.prUrl === undefined)
    ) {
      return null;
    }

    // For final PRs, we expect uuid and bountyId in the signature
    if (body.isFinal && (!body.uuid || !body.bountyId)) {
      return null;
    }

    return {
      roundNumber: body.roundNumber,
      taskId: body.taskId,
      prUrl: body.prUrl,
      isFinal: body.isFinal,
      uuid: body.uuid,
      bountyId: body.bountyId,
    };
  } catch {
    return null;
  }
}

async function updateTodoWithPRUrl(
  todo_uuid: string,
  stakingKey: string,
  roundNumber: number,
  prUrl: string,
  isFinal: boolean,
): Promise<boolean> {
  console.log("updateTodoWithPRUrl", { todo_uuid, stakingKey, roundNumber, prUrl, isFinal });

  // For draft PRs, look up by roundNumber
  // For final PRs, look up by existing prUrl
  const arrayFilters = isFinal
    ? [{ "elem.stakingKey": stakingKey, "elem.prUrl": prUrl }]
    : [{ "elem.stakingKey": stakingKey, "elem.roundNumber": roundNumber }];

  const updateFields = isFinal
    ? {
      //TEMP MEASURE! 
        status: TodoStatus.APPROVED,
        "assignees.$[elem].isFinal": true,
        "assignees.$[elem].roundNumber": roundNumber, // Update roundNumber for final PR
      }
    : {
        status: TodoStatus.IN_PROGRESS,
        "assignees.$[elem].prUrl": prUrl,
        "assignees.$[elem].isFinal": false,
      };

  const result = await TodoModel.findOneAndUpdate(
    {
      uuid: todo_uuid,
      bountyType: SwarmBountyType.BUILD_FEATURE,
    },
    {
      $set: updateFields,
    },
    {
      arrayFilters: arrayFilters,
      new: true,
    },
  )
    .select("_id")
    .lean();

  console.log("pr update result", result);

  return result !== null;
}

export const addPR = async (req: Request, res: Response) => {
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const signatureData = await verifySignatureData(
    requestBody.signature,
    requestBody.pubKey,
    requestBody.stakingKey,
    "add-todo-pr",
  );
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

  const response = await addPRLogic(requestBody, signatureData);
  res.status(response.statuscode).json(response.data);
};

export const addPRLogic = async (
  requestBody: {
    signature: string;
    pubKey: string;
    stakingKey: string;
    uuid?: string;
    prUrl?: string;
    bountyId?: string;
  },
  signatureData: {
    roundNumber: number;
    taskId: string;
    prUrl?: string;
    isFinal: boolean;
    uuid?: string;
    bountyId?: string;
  },
) => {
  const prUrl = signatureData.prUrl ?? requestBody.prUrl;
  if (!prUrl) {
    return {
      statuscode: 400,
      data: {
        success: false,
        message: "PR URL is required",
      },
    };
  }

  // Get uuid from either signature (if final) or request body (if draft)
  const uuid = signatureData.isFinal ? signatureData.uuid : requestBody.uuid;
  if (!uuid) {
    return {
      statuscode: 400,
      data: {
        success: false,
        message: "Todo UUID is required",
      },
    };
  }

  console.log("prUrl", prUrl);
  const result = await updateTodoWithPRUrl(
    uuid,
    requestBody.stakingKey,
    signatureData.roundNumber,
    prUrl,
    signatureData.isFinal,
  );
  if (!result) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Todo not found",
      },
    };
  }

  return {
    statuscode: 200,
    data: {
      success: true,
      message: "Pull request URL updated",
    },
  };
};
