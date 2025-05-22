import { Request, Response } from "express";
import { IssueModel, IssueStatus } from "../../../models/Issue";
import { verifySignature } from "../../../utils/sign";
import { taskIDs, SwarmBountyType } from "../../../config/constant";

export function verifyRequestBody(req: Request): {
  signature: string;
  stakingKey: string;
  pubKey: string;
  issueUuid: string;
  isFinal: boolean;
  prUrl?: string;
} | null {
  console.log("verifyRequestBody", req.body);
  try {
    const signature = req.body.signature as string;
    const stakingKey = req.body.stakingKey as string;
    const pubKey = req.body.pubKey as string;
    const issueUuid = req.body.issueUuid as string;
    const isFinal = req.body.isFinal as boolean;
    const prUrl = req.body.prUrl as string;
    if (!signature || !stakingKey || !pubKey || !issueUuid || isFinal === undefined || (isFinal && !prUrl)) {
      return null;
    }
    return { signature, stakingKey, pubKey, issueUuid, isFinal, prUrl };
  } catch {
    return null;
  }
}

async function verifySignatureData(
  signature: string,
  stakingKey: string,
  pubKey: string,
  action: string,
): Promise<{ roundNumber: number; taskId: string; prUrl?: string; isFinal: boolean } | null> {
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
    return { roundNumber: body.roundNumber, taskId: body.taskId, prUrl: body.prUrl, isFinal: body.isFinal };
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
    issueUuid: string;
    prUrl?: string;
  },
  signatureData: { roundNumber: number; taskId: string; prUrl?: string; isFinal: boolean },
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

  const issue = await IssueModel.findOneAndUpdate(
    {
      uuid: requestBody.issueUuid,
      bountyType: SwarmBountyType.DOCUMENT_SUMMARIZER,
      assignees: {
        $elemMatch: {
          stakingKey: requestBody.stakingKey,
          roundNumber: signatureData.roundNumber,
        },
      },
    },
    {
      $set: {
        "assignees.$.prUrl": prUrl,
        "assignees.$.isFinal": signatureData.isFinal,
        status: signatureData.isFinal ? IssueStatus.IN_REVIEW : IssueStatus.IN_PROGRESS,
      },
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
