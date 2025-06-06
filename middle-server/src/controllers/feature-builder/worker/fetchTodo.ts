import { Request, Response } from "express";
import "dotenv/config";

import { TodoModel, TodoStatus } from "../../../models/Todo";
import { SwarmBountyType, taskIDs } from "../../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";
import { IssueModel, IssueStatus } from "../../../models/Issue";
import { verifySignature } from "../../../utils/sign";
import { SystemPromptModel } from "../../../models/SystemPrompt";
import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";

// Get PR URLs for dependencies
async function getDependencies(dependencyUuids: string[]): Promise<string[]> {
  if (!dependencyUuids || dependencyUuids.length === 0) {
    console.log("No dependency UUIDs provided");
    return [];
  }

  console.log("Looking for dependencies with UUIDs:", dependencyUuids);

  const dependencyTodos = await TodoModel.find({
    uuid: { $in: dependencyUuids },
    bountyType: SwarmBountyType.BUILD_FEATURE,
    status: TodoStatus.APPROVED,
  })
    .select("uuid status assignees")
    .lean();

  console.log("Found dependency todos:", dependencyTodos);

  // If we didn't find all dependencies, some are not APPROVED
  if (dependencyTodos.length !== dependencyUuids.length) {
    console.log("Not all dependencies are APPROVED");
    throw new Error("Not all dependencies are APPROVED");
  }

  const prUrls = dependencyTodos
    .map((todo) => {
      const assignee = todo.assignees?.find((a) => a.approved);
      return assignee?.prUrl;
    })
    .filter((url): url is string => url !== null && url !== undefined);

  console.log("Extracted PR URLs:", prUrls);

  return prUrls;
}

// Check if the user has already completed the task
async function checkExistingAssignment(stakingKey: string, roundNumber: number) {
  try {
    const todo = await TodoModel.findOne({
      bountyType: SwarmBountyType.BUILD_FEATURE,
      assignees: {
        $elemMatch: {
          stakingKey: stakingKey,
          roundNumber: roundNumber,
        },
      },
    })
      .select("acceptanceCriteria repoOwner repoName uuid issueUuid assignees dependencyTasks bountyId phasesData")
      .lean();

    if (!todo) return null;

    console.log("Found todo with dependencies:", todo.dependencyTasks);

    // Get PR URLs for dependencies
    const dependencyPrUrls = await getDependencies(todo.dependencyTasks || []);

    const assignee = todo.assignees?.find((a) => a.stakingKey === stakingKey && a.roundNumber === roundNumber);
    const hasPR = Boolean(assignee?.prUrl && assignee?.isFinal);

    return {
      todo: todo,
      hasPR,
      dependencyPrUrls,
    };
  } catch (error) {
    console.error("Error checking assigned info:", error);
    return null;
  }
}

export function verifyRequestBody(req: Request): { signature: string; stakingKey: string; pubKey: string } | null {
  console.log("verifyRequestBody", req.body);
  try {
    const signature = req.body.signature as string;
    const stakingKey = req.body.stakingKey as string;
    const pubKey = req.body.pubKey as string;
    if (!signature || !stakingKey || !pubKey) {
      return null;
    }
    return { signature, stakingKey, pubKey };
  } catch {
    return null;
  }
}

async function verifySignatureData(
  signature: string,
  stakingKey: string,
  pubKey: string,
  action: string,
): Promise<{ roundNumber: number; githubUsername: string; taskId: string } | null> {
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
      typeof body.roundNumber !== "number" ||
      !taskIDs.includes(body.taskId) ||
      body.action !== action ||
      !body.githubUsername ||
      !body.pubKey ||
      body.pubKey !== pubKey ||
      !body.stakingKey ||
      body.stakingKey !== stakingKey
    ) {
      console.log("bad signature data");
      return null;
    }
    return {
      roundNumber: body.roundNumber,
      githubUsername: body.githubUsername,
      taskId: body.taskId,
    };
  } catch (error) {
    console.log("unexpected signature error", error);
    return null;
  }
}

export const fetchTodo = async (req: Request, res: Response) => {
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
    "fetch-todo",
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
  const response = await fetchTodoLogic(requestBody, signatureData);
  res.status(response.statuscode).json(response.data);
};

export const fetchTodoLogic = async (
  requestBody: { signature: string; stakingKey: string; pubKey: string },
  signatureData: { roundNumber: number; githubUsername: string; taskId: string },
) => {
  // 1. Check if user already has an assignment
  const existingAssignment = await checkExistingAssignment(requestBody.stakingKey, signatureData.roundNumber);
  if (existingAssignment) {
    console.log(`Found existing assignment ${existingAssignment.todo.uuid}`);
    if (existingAssignment.hasPR) {
      return {
        statuscode: 409,
        data: {
          success: false,
          message: "Task already completed",
        },
      };
    }
    // return {
    //   statuscode: 201,
    //   data: {
    //     success: true,
    //     data: {
    //       phasesData: existingAssignment.todo.phasesData,
    //       todo_uuid: existingAssignment.todo.uuid,
    //       issue_uuid: existingAssignment.todo.issueUuid,
    //       acceptance_criteria: existingAssignment.todo.acceptanceCriteria,
    //       repo_owner: existingAssignment.todo.repoOwner,
    //       repo_name: existingAssignment.todo.repoName,
    //       dependency_pr_urls: existingAssignment.dependencyPrUrls,
    //       bounty_id: existingAssignment.todo.bountyId,
    //     },
    //   },
    // };
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Task already assigned",
      },
    };
  }

  try {
    // 1. Find all in-progress issues, sorted by creation date (FIFO)
    const inProgressIssues = await IssueModel.find({
      status: IssueStatus.IN_PROGRESS,
      bountyType: SwarmBountyType.BUILD_FEATURE,
    }).sort({ createdAt: 1 });

    console.log("Found in-progress issues:", inProgressIssues.length);

    if (inProgressIssues.length === 0) {
      return {
        statuscode: 409,
        data: {
          success: false,
          message: "No active issues found",
        },
      };
    }

    const uniqueBountyIds = new Set();
    const uniqueBountyIssues = new Set();

    for (const issue of inProgressIssues) {
      if (issue.bountyId && !uniqueBountyIds.has(issue.bountyId)) {
        uniqueBountyIds.add(issue.bountyId);
      }
      if (issue.uuid && !uniqueBountyIssues.has(issue.uuid)) {
        uniqueBountyIssues.add(issue.uuid);
      }
    }

    console.log("Unique bounty issues:", Array.from(uniqueBountyIssues));

    // 3. Use aggregation to find eligible todos across all unique bounty issues
    const eligibleTodos = await TodoModel.aggregate([
      // Match initial criteria
      {
        $match: {
          phasesData: { $exists: true, $ne: [] },
          issueUuid: { $in: Array.from(uniqueBountyIssues) },
          $or: [
            { status: TodoStatus.INITIALIZED },
            {
              $and: [
                { status: TodoStatus.IN_PROGRESS },
                { updatedAt: { $lt: new Date(Date.now() - 40 * 60 * 1000) } }, // 40 minutes timeout
              ],
            },
          ],
        },
      },
      // Lookup dependencies
      {
        $lookup: {
          from: "todos",
          let: { dependencyTasks: { $ifNull: ["$dependencyTasks", []] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $in: ["$uuid", "$$dependencyTasks"] }, { $ne: ["$status", TodoStatus.APPROVED] }],
                },
              },
            },
          ],
          as: "unmetDependencies",
        },
      },
      // Only keep todos with no unmet dependencies
      {
        $match: {
          $or: [
            { dependencyTasks: { $size: 0 } }, // no dependencies
            { unmetDependencies: { $size: 0 } }, // all dependencies met
          ],
        },
      },
      // Lookup issues for the same bounty to count completed ones
      {
        $lookup: {
          from: "issues",
          let: { bountyId: "$bountyId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$bountyId", "$$bountyId"] },
                    { $in: ["$status", [IssueStatus.APPROVED, IssueStatus.SUBMITTED, IssueStatus.MERGED]] },
                  ],
                },
              },
            },
            {
              $count: "completedCount",
            },
          ],
          as: "completedIssues",
        },
      },
      // Add a field for the number of completed issues (default to 0 if none found)
      {
        $addFields: {
          completedIssuesCount: {
            $ifNull: [{ $arrayElemAt: ["$completedIssues.completedCount", 0] }, 0],
          },
        },
      },
      // Sort by completed issues count (ascending) and then by creation date
      {
        $sort: {
          completedIssuesCount: 1,
          createdAt: 1,
        },
      },
      // Take the first one
      {
        $limit: 1,
      },
    ]);

    console.log("Eligible todos found:", eligibleTodos.length);
    if (eligibleTodos.length === 0) {
      console.log("No eligible todos found. Checking raw todos...");
      const rawTodos = await TodoModel.find({
        issueUuid: { $in: Array.from(uniqueBountyIssues) },
        status: TodoStatus.INITIALIZED,
      });
      console.log("Raw todos found:", rawTodos.length);
      if (rawTodos.length > 0) {
        console.log("Sample todo:", {
          uuid: rawTodos[0].uuid,
          status: rawTodos[0].status,
          dependencyTasks: rawTodos[0].dependencyTasks,
          issueUuid: rawTodos[0].issueUuid,
        });
      }
    }

    if (eligibleTodos.length === 0) {
      return {
        statuscode: 409,
        data: {
          success: false,
          message: "No todos with completed dependencies available",
        },
      };
    }

    // 4. Assign the eligible todo to the worker
    const updatedTodo = await TodoModel.findOneAndUpdate(
      {
        _id: eligibleTodos[0]._id,
        bountyType: SwarmBountyType.BUILD_FEATURE,
        $or: [
          { status: TodoStatus.INITIALIZED },
          {
            $and: [{ status: TodoStatus.IN_PROGRESS }, { updatedAt: { $lt: new Date(Date.now() - 20 * 60 * 1000) } }],
          },
        ],
      },
      {
        $push: {
          assignees: {
            stakingKey: requestBody.stakingKey,
            githubUsername: signatureData.githubUsername,
            roundNumber: signatureData.roundNumber,
            taskId: signatureData.taskId,
          },
        },
        $set: {
          status: TodoStatus.IN_PROGRESS,
        },
      },
      { new: true },
    );

    if (!updatedTodo) {
      return {
        statuscode: 409,
        data: {
          success: false,
          message: "Task assignment conflict",
        },
      };
    }

    // Get PR URLs for dependencies
    const dependencyPrUrls = await getDependencies(updatedTodo.dependencyTasks || []);

    console.log("dependencyPrUrls", dependencyPrUrls);

    // Get task-specific system prompt using bounty ID
    const systemPrompt = await SystemPromptModel.findOne({
      bountyId: updatedTodo.bountyId,
      bountyType: SwarmBountyType.BUILD_FEATURE,
    });
    if (!systemPrompt) {
      return {
        statuscode: 500,
        data: {
          success: false,
          message: "System prompt not found for bounty",
        },
      };
    }

    const data = {
      _id: updatedTodo._id,
      phasesData: updatedTodo.phasesData,
      todo_uuid: updatedTodo.uuid,
      issue_uuid: updatedTodo.issueUuid,
      acceptance_criteria: updatedTodo.acceptanceCriteria,
      repo_owner: updatedTodo.repoOwner,
      repo_name: updatedTodo.repoName,
      dependency_pr_urls: dependencyPrUrls,
      bounty_id: updatedTodo.bountyId,
      system_prompt: systemPrompt.prompt,
    };

    console.log("TODO DATA:", data);

    // if (updatedTodo.bountyId) {
    //   await updateSwarmBountyStatus(updatedTodo.bountyId, SwarmBountyStatus.IN_PROGRESS);
    // }

    return {
      statuscode: 200,
      data: {
        success: true,
        data,
      },
    };
  } catch (error) {
    console.error("Error fetching todo:", error);
    return {
      statuscode: 500,
      data: {
        success: false,
        message: "Failed to fetch todo",
      },
    };
  }
};

// export const test = async () => {
//   const response = await fetchTodoLogic(
//     {
//       signature: "0x1234567890123456789012345678901234567890",
//       stakingKey: "0x1234567890123456789012345678901234567890",
//       pubKey: "0x1234567890123456789012345678901234567890",
//     },
//     {
//       githubUsername: "test",
//       roundNumber: 1,
//       taskId: "test-task",
//     },
//   );
//   console.log(response);
// };

// test();
