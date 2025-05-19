import { Request, Response } from "express";
import "dotenv/config";

import { BugFinderModel, BugFinderStatus } from "../../../models/BugFinder";
// import { documentSummarizerTaskID } from "../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
import { verifySignature } from "../../../utils/sign";
import { bugFinderSummarizerTaskID, SwarmBountyStatus } from "../../../config/constant";
import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";
import { getRoundTime } from "../../../utils/taskState/getRoundTime";
import { getCurrentRound } from "../../../utils/taskState/submissionRound";

// Check if the user has already completed the task
async function checkExistingAssignment(stakingKey: string) {
  try {
    const result = await BugFinderModel.findOne({
      taskId: bugFinderSummarizerTaskID,
      stakingKey: stakingKey,
      status: { $nin: [BugFinderStatus.DONE, BugFinderStatus.FAILED] },
    }).lean();

    if (!result) return null;

    // Find the specific assignment entry
    const assignment = result.assignedTo.find(
      (a: any) => a.stakingKey === stakingKey && a.taskId === bugFinderSummarizerTaskID,
    );

    return {
      spec: result,
      hasPR: Boolean(assignment?.prUrl),
    };
  } catch (error) {
    console.error("Error checking assigned info:", error);
    return null;
  }
}
export function verifyRequestBody(req: Request): { signature: string; stakingKey: string } | null {
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
async function verifySignatureData(
  signature: string,
  stakingKey: string,
  action: string,
): Promise<{ githubUsername: string } | null> {
  try {
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("bad signature");
      return null;
    }
    const body = JSON.parse(data);
    console.log({ signature_payload: body });
    if (
      !body.taskId ||
      body.taskId !== bugFinderSummarizerTaskID ||
      body.action !== action ||
      !body.githubUsername ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey
    ) {
      console.log("bad signature data");
      return null;
    }
    return { githubUsername: body.githubUsername };
  } catch (error) {
    console.log("unexpected signature error", error);
    return null;
  }
}
export const preProcessTodoLogic = async () => {
  // if (process.env.NODE_ENV !== "development") {
  //   await syncDB();
  // }
  await updateFailedPlannerTask();
};
export const updateFailedPlannerTask = async () => {
  const docs = await BugFinderModel.find({
    assignedTo: { $size: 5 },
    status: { $nin: [BugFinderStatus.DONE, BugFinderStatus.FAILED] },
  });
  for (const doc of docs) {
    for (const assignee of doc.assignedTo) {
      if (assignee.prUrl) {
        doc.status = BugFinderStatus.DONE;
        break;
      }
    }
    if (doc.status !== BugFinderStatus.DONE) {
      doc.status = BugFinderStatus.FAILED;
      if (process.env.NODE_ENV !== "development") {
        await updateSwarmBountyStatus(doc.swarmBountyId, SwarmBountyStatus.FAILED);
      }
    }
    await doc.save();
  }
};

export const fetchRequest = async (req: Request, res: Response) => {
  const requestBody: { signature: string; stakingKey: string } | null = verifyRequestBody(req);
  if (!requestBody) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }

  const signatureData = await verifySignatureData(requestBody.signature, requestBody.stakingKey, "fetch-todo");
  if (!signatureData) {
    res.status(401).json({
      success: false,
      message: "Failed to verify signature",
    });
    return;
  }

  if (!(await isValidStakingKey(bugFinderSummarizerTaskID, requestBody.stakingKey))) {
    res.status(401).json({
      success: false,
      message: "Invalid staking key",
    });
    return;
  }
  const response = await fetchTodoLogic(requestBody, signatureData);
  res.status(response.statuscode).json(response.data);
};

export const fetchTodoLogic = async (
  requestBody: { signature: string; stakingKey: string },
  signatureData: { githubUsername: string },
): Promise<{ statuscode: number; data: any }> => {
  await preProcessTodoLogic();
  const existingAssignment = await checkExistingAssignment(requestBody.stakingKey);
  if (existingAssignment) {
    if (existingAssignment.hasPR) {
      return {
        statuscode: 401,
        data: {
          success: false,
          message: "Task already completed",
        },
      };
    } else {
      return {
        statuscode: 200,
        data: {
          success: true,
          role: "worker",
          data: {
            id: existingAssignment.spec.swarmBountyId.toString(),
            repo_owner: existingAssignment.spec.repoOwner,
            repo_name: existingAssignment.spec.repoName,
          },
        },
      };
    }
  }

  try {
    const roundTimeInMS = await getRoundTime(bugFinderSummarizerTaskID);
    if (!roundTimeInMS) {
      return {
        statuscode: 500,
        data: {
          success: false,
          message: "Failed to get round time",
        },
      };
    }
    const currentRound = await getCurrentRound(bugFinderSummarizerTaskID);
    if (currentRound === null || currentRound === undefined) {
      return {
        statuscode: 500,
        data: {
          success: false,
          message: "Failed to get current round",
        },
      };
    }

    const updatedTodo = await BugFinderModel.findOneAndUpdate(
      {
        // Not assigned to the nodes that have already attempted the task
        $nor: [
          { status: { $in: [BugFinderStatus.DONE, BugFinderStatus.FAILED] } },
          { "assignedTo.stakingKey": requestBody.stakingKey },
          { "assignedTo.githubUsername": signatureData.githubUsername },
        ],
        $or: [
          // Condition: If Documentation Status is Initialized, then it should be assigned to the user
          { $and: [{ status: BugFinderStatus.INITIALIZED }] },
          // Condition: If Documentation Status is IN_PROGRESS, and it takes more than 2 round to be PR_RECEIVED, then it should be assigned to the user
          {
            $and: [
              { status: BugFinderStatus.IN_PROGRESS },
              { updatedAt: { $lt: new Date(Date.now() - roundTimeInMS * 2) } },
            ],
          },
          // Condition: If Documentation status is PR_RECEIVED, and it takes more than 2 round to be IN_REVIEW, then it should be assigned to the user
          {
            $and: [
              { status: BugFinderStatus.PR_RECEIVED },
              { updatedAt: { $lt: new Date(Date.now() - roundTimeInMS * 2) } },
            ],
          },
          // Condition: If Documentation status is IN_REVIEW, and it takes more than 4 rounds to be DONE, then it should be assigned to the new user
          {
            $and: [{ status: BugFinderStatus.IN_REVIEW }, { roundNumber: { $lt: currentRound - 4 } }],
          },
          // Condition: If Documentation Assigned to previous task, and it is not done or failed, then it should be assigned to the user

          { taskId: { $ne: bugFinderSummarizerTaskID } },
        ],
      },
      {
        $push: {
          assignedTo: {
            stakingKey: requestBody.stakingKey,
            taskId: bugFinderSummarizerTaskID,
            githubUsername: signatureData.githubUsername,
            todoSignature: requestBody.signature,
          },
        },
        $set: {
          status: BugFinderStatus.IN_PROGRESS,
          taskId: bugFinderSummarizerTaskID,
          stakingKey: requestBody.stakingKey,
        },
        $unset: {
          roundNumber: "",
        },
      },
      { new: true },
    )
      .sort({ createdAt: 1 })
      .exec();

    if (!updatedTodo) {
      return {
        statuscode: 409,
        data: {
          success: false,
          message: "No available todos found",
        },
      };
    }
    try {
      if (process.env.NODE_ENV !== "development") {
        await updateSwarmBountyStatus(updatedTodo.swarmBountyId, SwarmBountyStatus.ASSIGNED);
      }
    } catch (error) {
      console.error("Error updating swarm bounty status:", error);
    }
    // Validate required data fields
    if (!updatedTodo.repoOwner || !updatedTodo.repoName) {
      return {
        statuscode: 409,
        data: {
          success: false,
          message: "Todo data is incomplete",
        },
      };
    }

    return {
      statuscode: 200,
      data: {
        success: true,
        role: "worker",
        data: {
          id: updatedTodo.swarmBountyId.toString(),
          repo_owner: updatedTodo.repoOwner,
          repo_name: updatedTodo.repoName,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching todos:", error);
    return {
      statuscode: 500,
      data: {
        success: false,
        message: "Failed to fetch todos",
      },
    };
  }
};
