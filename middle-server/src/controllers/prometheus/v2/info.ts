import { Request, Response } from "express";
import { Status, Todo } from "../../../models/Todo";

import { SwarmBountyStatus, SwarmBountyType } from "../../../config/constant";

import { SpecModel, SpecStatus } from "../../../models/Spec";
import { TodoModel, TodoStatus } from "../../../models/Todo";

// TODO: Fix the endpoints below

interface ResponseInfo {
  success: boolean;
  data?: DetailedInfo | null;
  error?: string;
}
interface DetailedInfo {
  swarmBountyId: string;
  taskName: string;
  swarmType: SwarmBountyType;
  nodes: number;
  status: SwarmBountyStatus; // TODO the insider ones are not matching
  githubUsername: string;
  prUrl: string;
  subTasks?: DetailedInfo[];
}
export const SwarmBountyStatusMapping = {
  [Status.DONE]: SwarmBountyStatus.COMPLETED,
  [Status.FAILED]: SwarmBountyStatus.FAILED,
  [Status.IN_PROGRESS]: SwarmBountyStatus.ASSIGNED,
  [Status.PR_RECEIVED]: SwarmBountyStatus.AUDITING,
  [Status.IN_REVIEW]: SwarmBountyStatus.AUDITING,
  [Status.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
  [Status.DRAFT_PR_RECEIVED]: SwarmBountyStatus.ASSIGNED,
};

export const SwarmBountyStatusSpecStatusMapping = {
  [SpecStatus.DONE]: SwarmBountyStatus.COMPLETED,
  [SpecStatus.FAILED]: SwarmBountyStatus.FAILED,
  [SpecStatus.IN_PROGRESS]: SwarmBountyStatus.IN_PROGRESS,
  [SpecStatus.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
};

export const SwarmBountyStatusTodoStatusMapping = {
  // [TodoStatus.INITIALIZED]: SwarmBountyStatus.PENDING,
  [TodoStatus.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
  [TodoStatus.IN_PROGRESS]: SwarmBountyStatus.IN_PROGRESS,
  [TodoStatus.IN_REVIEW]: SwarmBountyStatus.AUDITING,
  // [TodoStatus.APPROVED]: SwarmBountyStatus.APPROVED,
  [TodoStatus.APPROVED]: SwarmBountyStatus.AUDITING,
  [TodoStatus.MERGED]: SwarmBountyStatus.COMPLETED,
  [TodoStatus.FAILED]: SwarmBountyStatus.FAILED,
};

export const info = async (req: Request, res: Response) => {
  const { swarmBountyId, swarmType } = req.query;

  if (!swarmBountyId || !swarmType) {
    const response: ResponseInfo = {
      success: false,
      error: "swarmBountyId and swarmType are required",
    };
    res.status(400).json(response);
    return;
  }
  const validTypes = Object.values(SwarmBountyType);
  if (!validTypes.includes(swarmType as any)) {
    const response: ResponseInfo = {
      success: false,
      error: "Invalid swarm type",
    };
    res.status(400).json(response);
    return;
  }
  const { statuscode, data } = await getInfo(swarmBountyId as string);
  res.status(statuscode).json(data);
};

async function getLastAvailableAssigneeInfo(assignees: { githubUsername?: string; prUrl?: string }[]) {
  for (let i = assignees.length - 1; i >= 0; i--) {
    if (assignees[i].prUrl) {
      return {
        githubUsername: assignees[i].githubUsername || "",
        prUrl: assignees[i].prUrl || "",
      };
    }
  }
  return {
    githubUsername: "",
    prUrl: "",
  };
}
// @dummy function

export const getSpecInfo = async (swarmBountyId: string): Promise<{ statuscode: number; data: ResponseInfo }> => {
  try {
    const spec = await SpecModel.findOne({ swarmBountyId: swarmBountyId });
    if (!spec) {
      return {
        statuscode: 409,
        data: {
          success: false,
          data: null,
        },
      };
    }
    const detailedInfo: DetailedInfo = {
      swarmBountyId: swarmBountyId,
      taskName: spec?.repoName + " - " + "Spec",
      swarmType: SwarmBountyType.BUILD_FEATURE,
      nodes: spec?.assignedTo.length || 0,
      status: SwarmBountyStatusSpecStatusMapping[spec.status as SpecStatus],
      githubUsername: "", // Not available for spec
      prUrl: "", // Not available for spec
    };
    return {
      statuscode: 200,
      data: {
        success: true,
        data: detailedInfo,
      },
    };
  } catch (error) {
    console.log("error", error);
    return {
      statuscode: 500,
      data: {
        success: false,
        data: null,
      },
    };
  }
};

export const getTodoInfo = async (issueUuid: string, swarmsBountyId: string): Promise<DetailedInfo[]> => {
  try {
    const todos = await TodoModel.find({ issueUuid: issueUuid, swarmBountyId: swarmsBountyId });
    return Promise.all(
      todos.map(async (todo) => {
        const { githubUsername, prUrl } = await getLastAvailableAssigneeInfo(todo.assignees || []);
        return {
          swarmBountyId: swarmsBountyId,
          taskName: todo.repoName + " - " + "Todo",
          swarmType: SwarmBountyType.BUILD_FEATURE,
          nodes: todo.assignees?.length || 0,
          status: SwarmBountyStatusTodoStatusMapping[todo.status as TodoStatus],
          githubUsername,
          prUrl,
        };
      }),
    );
  } catch (error) {
    console.log("error", error);
    return [];
  }
};
export const getInfo = async (
  swarmsBountyId: string,
): Promise<{ statuscode: number; data: { success: boolean; data: DetailedInfo | null } }> => {
  try {
    const todo = await TodoModel.findOne({ swarmBountyId: swarmsBountyId });
    if (!todo) {
      return {
        statuscode: 409,
        data: {
          success: false,
          data: null,
        },
      };
    }
    const { githubUsername, prUrl } = await getLastAvailableAssigneeInfo(todo.assignees || []);
    const detailedInfo: DetailedInfo = {
      swarmBountyId: swarmsBountyId,
      taskName: todo?.repoName + " - " + "Documentation",
      swarmType: SwarmBountyType.DOCUMENT_SUMMARIZER,
      nodes: todo?.assignees?.length || 0,
      status: SwarmBountyStatusMapping[todo.status as Status],
      githubUsername,
      prUrl,
    };
    return {
      statuscode: 200,
      data: {
        success: true,
        data: detailedInfo,
      },
    };
  } catch (error) {
    console.log("error", error);
    return {
      statuscode: 500,
      data: {
        success: false,
        data: null,
      },
    };
  }
};
