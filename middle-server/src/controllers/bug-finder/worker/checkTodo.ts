import { Request, Response } from "express";
import { BugFinderModel } from "../../../models/BugFinder";
import { bugFinderSummarizerTaskID } from "../../../config/constant";

// Helper function to verify request body
function verifyRequestBody(req: Request): {
  stakingKey: string;
  roundNumber: string; // remove roundNumber to use time based
  githubUsername: string;
  prUrl: string;
} | null {
  try {
    console.log("Request body:", req.body);

    const stakingKey = req.body.stakingKey as string;
    const roundNumber = req.body.roundNumber as string;
    const githubUsername = req.body.githubUsername as string;
    const prUrl = req.body.prUrl as string;
    if (!stakingKey || !githubUsername || !prUrl) {
      return null;
    }
    return { stakingKey, roundNumber, githubUsername, prUrl };
  } catch {
    return null;
  }
}

export async function checkToDoAssignment(
  stakingKey: string,
  roundNumber: string,
  githubUsername: string,
  prUrl: string,
): Promise<boolean> {
  try {
    const data = {
      stakingKey,
      roundNumber,
      githubUsername,
      prUrl,
      taskId: bugFinderSummarizerTaskID,
    };
    console.log("Data:", data);
    // WE SHOULD NOT CHECK THE LIVE ROUND NUMBER, BECAUSE WE NEED TO PAY IF DISTRIBUTION LATE
    const result = await BugFinderModel.findOne({
      assignedTo: {
        $elemMatch: {
          stakingKey: stakingKey,
          taskId: bugFinderSummarizerTaskID,
          prUrl: prUrl,
          roundNumber: Number(roundNumber),
        },
      },
    });

    console.log("Todo assignment check result:", result);
    return result !== null;
  } catch (error) {
    console.error("Error checking todo assignment:", error);
    return false;
  }
}

export const checkRequest = async (req: Request, res: Response) => {
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }
  const isValid = await checkToDoAssignment(
    requestBody.stakingKey,
    requestBody.roundNumber,
    requestBody.githubUsername,
    requestBody.prUrl,
  );

  if (!isValid) {
    res.status(409).json({
      success: false,
      message: "No matching todo assignment found",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Todo assignment verified successfully",
  });
};
