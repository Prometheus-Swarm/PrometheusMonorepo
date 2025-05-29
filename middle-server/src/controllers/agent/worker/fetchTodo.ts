import { Request, Response } from "express";
import "dotenv/config";

import { TodoModel, Status } from "../../../models/Todo";
// import { documentSummarizerTaskID } from "../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
import { verifySignature } from "../../../utils/sign";
import { taskIDs, SwarmBountyStatus, SwarmBountyType } from "../../../config/constant";
import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";
import { getRoundTime } from "../../../utils/taskState/getRoundTime";
import { getCurrentRound } from "../../../utils/taskState/submissionRound";

// Check if the user has already completed the task
async function checkExistingAssignment(stakingKey: string, taskId: string): Promise<any> {
  try {
    const result = await TodoModel.findOne({
      assignees: {
        $elemMatch: {
          taskId: taskId,
          stakingKey: stakingKey,
        },
      },
      // TODO: CHECK WHEN TASK GOES TO DONE OR FAILED (Currently only going upto PR_RECEIVED)
      status: { $nin: [Status.DONE, Status.FAILED] },
    }).lean();

    if (!result) return null;

    // Find the specific assignment entry
    const assignment = result.assignees?.find(
      (a: any) => a.stakingKey === stakingKey && a.taskId === taskId,
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
): Promise<{ githubUsername: string, taskId: string } | null> {
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
      !taskIDs.includes(body.taskId) ||
      body.action !== action ||
      !body.githubUsername ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey
    ) {
      console.log("bad signature data");
      return null;
    }
    return { githubUsername: body.githubUsername, taskId: body.taskId };
  } catch (error) {
    console.log("unexpected signature error", error);
    return null;
  }
}
export const preProcessTodoLogic = async () => {
  // if (process.env.NODE_ENV !== "development") {
  //   await syncDB();
  // }
  await updateFailedTodoTask();
};
export const updateFailedTodoTask = async () => {
  const docs = await TodoModel.find({
    assignedTo: { $size: 5 },
    // TODO: CHECK WHEN TASK GOES TO DONE OR FAILED (Currently only going upto PR_RECEIVED)
    status: { $nin: [Status.DONE, Status.FAILED] },
  });
  for (const doc of docs) {
    for (const assignee of doc.assignees ?? []) {
      if (assignee.prUrl) {
        doc.status = Status.DONE;
        break;
      }
    }
    if (doc.status !== Status.DONE) {
      doc.status = Status.FAILED;
      if (process.env.NODE_ENV !== "development" && doc.bountyId) {
        await updateSwarmBountyStatus(doc.bountyId, SwarmBountyStatus.FAILED);
      }
    }
    await doc.save();
  }
};

export const fetchTodo = async (req: Request, res: Response) => {
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

  if (!(await isValidStakingKey(signatureData.taskId, requestBody.stakingKey))) {
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
  signatureData: { githubUsername: string, taskId: string },
): Promise<{ statuscode: number; data: any }> => {
  await preProcessTodoLogic();
  const existingAssignment = await checkExistingAssignment(requestBody.stakingKey, signatureData.taskId);
  if (existingAssignment) {
    // TODO: It might get stuck here, if it hasPR but its not being marked failed or completed
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
            id: existingAssignment.spec.bountyId?.toString() ?? "",
            repo_owner: existingAssignment.spec.repoOwner,
            repo_name: existingAssignment.spec.repoName,
          },
        },
      };
    }
  }

  try {
    const roundTimeInMS = await getRoundTime(signatureData.taskId);
    if (!roundTimeInMS) {
      return {
        statuscode: 500,
        data: {
          success: false,
          message: "Failed to get round time",
        },
      };
    }
    const currentRound = await getCurrentRound(signatureData.taskId);
    if (currentRound === null || currentRound === undefined) {
      return {
        statuscode: 500,
        data: {
          success: false,
          message: "Failed to get current round",
        },
      };
    }
    /**
     * The design of the task assignment is like ACL...
     */
    const updatedTodo = await TodoModel.findOneAndUpdate(
      {
        // Not assigned to the nodes that have already attempted the task
        $nor: [
          { status: { $in: [Status.DONE, Status.FAILED] } },
          { "assignedTo.stakingKey": requestBody.stakingKey },
          { "assignedTo.githubUsername": signatureData.githubUsername },
        ],
        $or: [
          // Condition: If Status is Initialized, then it should be assigned to the user
          { $and: [{ status: Status.INITIALIZED }] },
          // Condition: If Status is IN_PROGRESS, and it takes more than 1 round to be PR_RECEIVED, then it should be assigned to the user
          {
            $and: [
              { status: Status.IN_PROGRESS },
              { updatedAt: { $lt: new Date(Date.now() - roundTimeInMS) } },
            ],
          },
          // Condition: If status is DRAFT_PR_RECEIVED, and it takes more than 1 round to be PR_RECEIVED, then it should be assigned to the user
          {
            $and: [
              { status: Status.DRAFT_PR_RECEIVED },
              { updatedAt: { $lt: new Date(Date.now() - roundTimeInMS) } },
            ],
          },
          {
            $and: [
              { status: Status.PR_RECEIVED },
              { updatedAt: { $lt: new Date(Date.now() - roundTimeInMS) } },
            ],
          },
          // Condition: If status is IN_REVIEW, and it takes more than 4 rounds to be DONE, then it should be assigned to the new user
          {
            $and: [{ status: Status.IN_REVIEW }, { roundNumber: { $lt: currentRound - 4 } }],
          },
          // Condition: If Assigned to previous task, and it is not done or failed, then it should be assigned to the user

          { taskId: { $ne: signatureData.taskId } },
        ],
      },
      {
        $push: {
          assignedTo: {
            stakingKey: requestBody.stakingKey,
            taskId: signatureData.taskId,
            githubUsername: signatureData.githubUsername,
            todoSignature: requestBody.signature,
          },
        },
        $set: {
          status: Status.IN_PROGRESS,
          taskId: signatureData.taskId,
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
      if (process.env.NODE_ENV !== "development" && updatedTodo.bountyId) {
        await updateSwarmBountyStatus(updatedTodo.bountyId, SwarmBountyStatus.ASSIGNED);
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
          id: updatedTodo.bountyId?.toString() ?? "",
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
