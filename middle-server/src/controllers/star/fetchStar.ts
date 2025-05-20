import { Request, Response } from "express";
import { StarFollowModel } from "../../models/StarFollow";
import { verifySignature } from "../../utils/sign";

export const verifyRequestBody = (req: Request): { stakingKey: string; signature: string } | null => {
  const { stakingKey, signature } = req.body;
  if (!stakingKey || !signature) {
    return null;
  }
  return { stakingKey, signature };
};

export const fetchStar = async (req: Request, res: Response) => {
  const { stakingKey, signature } = req.body;
  const verified = verifyRequestBody(req);
  if (!verified) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  // verify signature
  const signatureData = await verifySignatureData(signature, stakingKey);
  if (!signatureData) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const starFollow = await fetchStarLogic(signatureData.githubUsername, stakingKey);
  res.status(starFollow.statuscode).json({
    success: starFollow.data.success,
    data: starFollow.data,
  });
};

async function verifySignatureData(
  signature: string,
  stakingKey: string,
  // action: string,
): Promise<{ githubUsername: string } | null> {
  try {
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("bad signature");
      return null;
    }
    const body = JSON.parse(data);
    console.log({ signature_payload: body });
    if (!body.githubUsername || !body.stakingKey || body.stakingKey !== stakingKey) {
      console.log("bad signature data");
      return null;
    }
    return { githubUsername: body.githubUsername };
  } catch (error) {
    console.log("unexpected signature error", error);
    return null;
  }
}

export const fetchStarLogic = async (githubUsername: string, stakingKey: string) => {
  const starFollow = await StarFollowModel.findOne({
    assignedTo: { $not: { $elemMatch: { githubUsername } } },
  });
  if (!starFollow) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "No available todos found",
      },
    };
  }
  // Add to assignedTo
  starFollow.assignedTo.push({
    stakingKey,
    githubUsername,
  });
  await starFollow.save();
  return {
    statuscode: 200,
    data: {
      success: true,
      repo_owner: starFollow.repoOwner,
      repo_name: starFollow.repoName,
    },
  };
};
