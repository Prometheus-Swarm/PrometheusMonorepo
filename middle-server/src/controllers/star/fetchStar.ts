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

async function verifySignatureData(signature: string, stakingKey: string): Promise<{ githubUsername: string } | null> {
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
  // check if recent 30 mins already have a star
  const recentStar = await StarFollowModel.findOne({
    "assignedTo.githubUsername": githubUsername,
    "assignedTo.assignedAt": { $gte: new Date(Date.now() - 30 * 60 * 1000) },
  });
  if (recentStar) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Recent star found",
      },
    };
  }

  // check last 24 hours if already have 10 stars
  const last24HoursStar = await StarFollowModel.find({
    "assignedTo.githubUsername": githubUsername,
    "assignedTo.assignedAt": { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  if (last24HoursStar.length >= 10) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Maximum stars reached for 24 hours",
      },
    };
  }

  // Find a repository that hasn't been starred by this user
  const availableStar = await StarFollowModel.findOne({
    "assignedTo.githubUsername": { $ne: githubUsername },
  });

  if (!availableStar) {
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "No available repositories found",
      },
    };
  }

  // Add to assignedTo
  availableStar.assignedTo.push({
    stakingKey,
    githubUsername,
    assignedAt: new Date(),
  });

  await StarFollowModel.findByIdAndUpdate(availableStar._id, availableStar);

  return {
    statuscode: 200,
    data: {
      success: true,
      repo_owner: availableStar.repoOwner,
      repo_name: availableStar.repoName,
    },
  };
};
