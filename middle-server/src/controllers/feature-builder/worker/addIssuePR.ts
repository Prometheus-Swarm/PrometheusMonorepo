import { Request, Response } from "express";
import { IssueModel, IssueStatus } from "../../../models/Issue";
import { verifySignature } from "../../../utils/sign";
import { taskIDs, SwarmBountyType } from "../../../config/constant";

export function verifyRequestBody(req: Request): {
  signature: string;
  stakingKey: string;
  pubKey: string;
  uuid?: string;
  prUrl?: string;
  bountyId?: string;
} | null {
  console.log("verifyRequestBody", req.body);
  try {
    const signature = req.body.signature as string;
    const stakingKey = req.body.stakingKey as string;
    const pubKey = req.body.pubKey as string;
    const uuid = req.body.uuid as string;
    const prUrl = req.body.prUrl as string;
    const bountyId = req.body.bountyId as string;
    if (!signature || !stakingKey || !pubKey) {
      return null;
    }
    return { signature, stakingKey, pubKey, uuid, prUrl, bountyId };
  } catch {
    return null;
  }
}

async function verifySignatureData(
  signature: string,
  stakingKey: string,
  pubKey: string,
  action: string,
): Promise<{
  roundNumber: number;
  taskId: string;
  prUrl?: string;
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

export const addIssuePR = async (req: Request, res: Response) => {
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
    requestBody.stakingKey,
    requestBody.pubKey,
    "add-issue-pr",
  );
  if (!signatureData) {
    res.status(401).json({
      success: false,
      message: "Failed to verify signature",
    });
    return;
  }

  const response = await addIssuePRLogic(requestBody, signatureData);
  res.status(response.statuscode).json(response.data);
};

export const addIssuePRLogic = async (
  requestBody: {
    signature: string;
    stakingKey: string;
    pubKey: string;
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

  const uuid = signatureData.isFinal ? signatureData.uuid : requestBody.uuid;
  if (!uuid) {
    return {
      statuscode: 400,
      data: {
        success: false,
        message: "Issue UUID is required",
      },
    };
  }

  // For draft PRs, look up by roundNumber
  // For final PRs, look up by existing prUrl
  const matchQuery = {
    uuid: uuid,
    bountyType: SwarmBountyType.BUILD_FEATURE,
    assignees: {
      $elemMatch: {
        stakingKey: requestBody.stakingKey,
        ...(signatureData.isFinal ? { prUrl: prUrl } : { roundNumber: signatureData.roundNumber }),
      },
    },
  };

  const updateFields = signatureData.isFinal
    ? {
        "assignees.$.roundNumber": signatureData.roundNumber,
        "assignees.$.isFinal": true,
        status: IssueStatus.IN_REVIEW,
      }
    : {
        "assignees.$.prUrl": prUrl,
        "assignees.$.isFinal": false,
        status: IssueStatus.IN_PROGRESS,
      };

  const issue = await IssueModel.findOneAndUpdate(
    matchQuery,
    {
      $set: updateFields,
    },
    { new: true },
  );

  if (!issue) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Issue not found",
      },
    };
  }

  return {
    statuscode: 200,
    data: {
      success: true,
      message: "Issue PR added",
    },
  };
};
