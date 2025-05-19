import { DocumentationModel } from "../../../models/Documentation";
import { Request, Response } from "express";
import { DocumentationStatus } from "../../../models/Documentation";

import { SwarmBountyStatus, SwarmBountyType } from "../../../config/constant";
import { getLastRoundValueLength } from "../../../utils/taskState/activeNode";
import { BugFinderModel, BugFinderStatus } from "../../../models/BugFinder";
import { SpecModel, SpecStatus } from "../../../models/Spec";
import { IssueModel, IssueStatus } from "../../../models/Issue";
import { Todo, TodoModel, TodoStatus } from "../../../models/Todo";

interface ResponseInfo {
  success: boolean;
  data?: DocsBugFinderInfo | BuilderInfo | null;
  error?: string;
}

interface DocsBugFinderInfo {
  swarmBountyId: string;
  taskName: string;
  swarmType: SwarmBountyType;
  nodes: number;
  status: SwarmBountyStatus; // TODO the insider ones are not matching
  githubUsername: string;
  prUrl: string;
}

interface BuilderInfo {
  swarmBountyId: string;
  taskName: string;
  swarmType: SwarmBountyType;
  nodes: number;
  status: SwarmBountyStatus; // TODO the insider ones are not matching
  githubUsername: string;
  prUrl: string;
  issues?: IssueInfo[];
}

interface IssueInfo {
  title: string;
  description: string;
  nodes: number;
  status: SwarmBountyStatus; // TODO the insider ones are not matching
  githubUsername: string;
  prUrl: string;
  todos?: TodoInfo[];
}

interface TodoInfo {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  nodes: number;
  status: SwarmBountyStatus; // TODO the insider ones are not matching
  githubUsername: string;
  prUrl: string;
}

export const SwarmBountyStatusDocumentationStatusMapping = {
  [DocumentationStatus.DONE]: SwarmBountyStatus.COMPLETED,
  [DocumentationStatus.FAILED]: SwarmBountyStatus.FAILED,
  [DocumentationStatus.IN_PROGRESS]: SwarmBountyStatus.ASSIGNED,
  [DocumentationStatus.PR_RECEIVED]: SwarmBountyStatus.AUDITING,
  [DocumentationStatus.IN_REVIEW]: SwarmBountyStatus.AUDITING,
  [DocumentationStatus.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
  [DocumentationStatus.DRAFT_PR_RECEIVED]: SwarmBountyStatus.ASSIGNED,
};

export const SwarmBountyStatusBugFinderStatusMapping = {
  [BugFinderStatus.DONE]: SwarmBountyStatus.COMPLETED,
  [BugFinderStatus.FAILED]: SwarmBountyStatus.FAILED,
  [BugFinderStatus.IN_PROGRESS]: SwarmBountyStatus.ASSIGNED,
  [BugFinderStatus.PR_RECEIVED]: SwarmBountyStatus.AUDITING,
  [BugFinderStatus.IN_REVIEW]: SwarmBountyStatus.AUDITING,
  [BugFinderStatus.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
};

export const SwarmBountyStatusSpecStatusMapping = {
  [SpecStatus.DONE]: SwarmBountyStatus.COMPLETED,
  [SpecStatus.FAILED]: SwarmBountyStatus.FAILED,
  [SpecStatus.IN_PROGRESS]: SwarmBountyStatus.IN_PROGRESS,
  [SpecStatus.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
};

export const SwarmBountyStatusIssueStatusMapping = {
  // [IssueStatus.INITIALIZED]: SwarmBountyStatus.PENDING,
  [IssueStatus.INITIALIZED]: SwarmBountyStatus.IN_PROGRESS,
  [IssueStatus.AGGREGATOR_PENDING]: SwarmBountyStatus.ASSIGNED,
  [IssueStatus.IN_PROGRESS]: SwarmBountyStatus.IN_PROGRESS,
  [IssueStatus.ASSIGN_PENDING]: SwarmBountyStatus.IN_PROGRESS,
  [IssueStatus.ASSIGNED]: SwarmBountyStatus.IN_PROGRESS,
  [IssueStatus.IN_REVIEW]: SwarmBountyStatus.AUDITING,
  // [IssueStatus.APPROVED]: SwarmBountyStatus.APPROVED,
  [IssueStatus.APPROVED]: SwarmBountyStatus.AUDITING,
  [IssueStatus.SUBMITTED]: SwarmBountyStatus.COMPLETED,
  [IssueStatus.MERGED]: SwarmBountyStatus.COMPLETED,
  [IssueStatus.FAILED]: SwarmBountyStatus.FAILED,
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
  if (swarmType === SwarmBountyType.DOCUMENT_SUMMARIZER) {
    const { statuscode, data } = await getDocumentationInfo(swarmBountyId as string);
    res.status(statuscode).json(data);
    return;
  }
  if (swarmType === SwarmBountyType.FIND_BUGS) {
    const { statuscode, data } = await getFindBugsInfo(swarmBountyId as string);
    res.status(statuscode).json(data);
    return;
  }
  if (swarmType === SwarmBountyType.BUILD_FEATURE) {
    const { statuscode, data } = await getSpecInfo(swarmBountyId as string);
    res.status(statuscode).json(data);
    return;
  }
  res.status(500).json({ error: "Internal server error" });
  return;
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
export const getFindBugsInfo = async (swarmsBountyId: string): Promise<{ statuscode: number; data: ResponseInfo }> => {
  try {
    const bugFinder = await BugFinderModel.findOne({ swarmBountyId: swarmsBountyId });
    if (!bugFinder) {
      return {
        statuscode: 409,
        data: {
          success: false,
          data: null,
        },
      };
    }
    const { githubUsername, prUrl } = await getLastAvailableAssigneeInfo(bugFinder.assignedTo);

    const detailedInfo: DocsBugFinderInfo = {
      swarmBountyId: swarmsBountyId,
      taskName: bugFinder?.repoName + " - " + "Bug Finder",
      swarmType: SwarmBountyType.FIND_BUGS,
      nodes: bugFinder?.assignedTo.length || 0,
      status: SwarmBountyStatusBugFinderStatusMapping[bugFinder.status as BugFinderStatus],
      githubUsername,
      prUrl,
    };
    //
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
    const issues = await getIssueInfo(swarmBountyId);
    const detailedInfo: BuilderInfo = {
      swarmBountyId: swarmBountyId,
      taskName: spec?.repoName + " - " + "Spec",
      swarmType: SwarmBountyType.BUILD_FEATURE,
      nodes: spec?.assignedTo.length || 0,
      status: SwarmBountyStatusSpecStatusMapping[spec.status as SpecStatus],
      githubUsername: "", // Not available for spec
      prUrl: "", // Not available for spec
      issues: issues,
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
export const getIssueInfo = async (swarmBountyId: string): Promise<IssueInfo[]> => {
  try {
    const issues = await IssueModel.find({ bountyId: swarmBountyId });
    const responseInfo: IssueInfo[] = await Promise.all(
      issues.map(async (issue) => {
        const todos = await getTodoInfo(issue.uuid);
        const { githubUsername, prUrl } = await getLastAvailableAssigneeInfo(issue.assignees || []);
        return {
          title: issue.title || "",
          description: issue.description || "",
          swarmBountyId: swarmBountyId,
          // taskName: issue.repoName + " - " + "Issue",
          swarmType: SwarmBountyType.BUILD_FEATURE,
          nodes: todos.length || 0,
          status: SwarmBountyStatusIssueStatusMapping[issue.status as IssueStatus],
          githubUsername,
          prUrl,
          todos: todos,
        };
      }),
    );
    return responseInfo;
  } catch (error) {
    console.log("error", error);
    return [];
  }
};
export const getTodoInfo = async (issueUuid: string): Promise<TodoInfo[]> => {
  try {
    const todos = await TodoModel.find({ issueUuid: issueUuid });
    return Promise.all(
      todos.map(async (todo) => {
        const { githubUsername, prUrl } = await getLastAvailableAssigneeInfo(todo.assignees || []);
        return {
          title: todo.title || "",
          description: todo.description || "",
          acceptanceCriteria: todo.acceptanceCriteria || [],
          //   swarmBountyId: swarmsBountyId,
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
export const getDocumentationInfo = async (
  swarmsBountyId: string,
): Promise<{ statuscode: number; data: { success: boolean; data: DocsBugFinderInfo | null } }> => {
  try {
    const documentation = await DocumentationModel.findOne({ swarmBountyId: swarmsBountyId });
    if (!documentation) {
      return {
        statuscode: 409,
        data: {
          success: false,
          data: null,
        },
      };
    }
    const { githubUsername, prUrl } = await getLastAvailableAssigneeInfo(documentation.assignedTo);
    const detailedInfo: DocsBugFinderInfo = {
      swarmBountyId: swarmsBountyId,
      taskName: documentation?.repoName + " - " + "Documentation",
      swarmType: SwarmBountyType.DOCUMENT_SUMMARIZER,
      nodes: documentation?.assignedTo.length || 0,
      status: SwarmBountyStatusDocumentationStatusMapping[documentation.status],
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
