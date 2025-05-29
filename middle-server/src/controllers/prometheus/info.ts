import { Request, Response } from "express";
import { Status, TodoModel } from "../../models/Todo";
import { SwarmBountyStatus, SwarmBountyType } from "../../config/constant";
import { getLastRoundValueLength } from "../../utils/taskState/activeNode";

// TODO: Fix the endpoints below

export const info = async (req: Request, res: Response) => {
  const { swarmBountyId, swarmType } = req.query;

  if (!swarmBountyId || !swarmType) {
    res.status(400).json({ error: "swarmBountyId and swarmType are required" });
    return;
  }
  const validTypes = Object.values(SwarmBountyType);
  if (!validTypes.includes(swarmType as any)) {
    res.status(400).json({ error: "Invalid swarm type" });
    return;
  }
  const { statuscode, data } = await getInfo(swarmBountyId as string);
  res.status(statuscode).json(data);
};

export const getDocumentationNumberOfNodesTemp = async (): Promise<number> => {
  const documentationTaskId = process.env.DOCUMENT_SUMMARIZER_TASK_ID;
  if (!documentationTaskId) {
    throw new Error("DOCUMENTATION_TASK_ID is not set");
  }
  const numberOfNodes = await getLastRoundValueLength(documentationTaskId);
  return numberOfNodes;
};
export const getInfo = async (swarmsBountyId: string): Promise<{ statuscode: number; data: any }> => {
  try {
    console.log("swarmsBountyId", swarmsBountyId);
    const todo = await TodoModel.findOne({ swarmBountyId: swarmsBountyId });
    console.log("documentation", todo);
    if (todo && todo.assignees) {
      const numberOfNodes = await getDocumentationNumberOfNodesTemp();
      let status;
      if (todo.status === Status.IN_PROGRESS) {
        if (todo.assignees.length === 0) {
          status = SwarmBountyStatus.IN_PROGRESS;
        } else {
          if (todo.assignees[todo.assignees.length - 1].prUrl) {
            if (todo.assignees[todo.assignees.length - 1].approved == true) {
              status = SwarmBountyStatus.COMPLETED;
            } else {
              status = SwarmBountyStatus.AUDITING;
            }
          } else {
            status = SwarmBountyStatus.ASSIGNED;
          }
        }
      }
      return {
        statuscode: 200,
        data: {
          success: true,
          data: {
            issues: 1,
            nodes: numberOfNodes,
            status: todo.status,
          },
        },
      };
    }
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Documentation not found",
      },
    };
  } catch (error) {
    console.log("error", error);
    return {
      statuscode: 500,
      data: {
        success: false,
        message: "Error getting assigned to in documentation",
      },
    };
  }
};
