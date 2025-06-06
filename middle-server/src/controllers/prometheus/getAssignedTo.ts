import { Request, Response } from "express";
// import { DocumentationModel } from "../../models/Documentation";
import { TodoModel } from "../../models/Todo";
// @deprecated
export const getAssignedTo = async (req: Request, res: Response) => {
  const { swarmBountyId } = req.query;
  if (!swarmBountyId) {
    res.status(400).json({ error: "swarmBountyId is required" });
    return;
  }
  const assignedTo = await getAssignedToLogic(swarmBountyId as string);
  if (!assignedTo) {
    res.status(409).json({ error: "Assigned to not found" });
    return;
  }
  if (assignedTo.statuscode === 200) {
    res.json(assignedTo.data);
    return;
  }
  if (assignedTo.statuscode === 409) {
    res.status(409).json({ error: "Assigned to not found" });
    return;
  }
  if (assignedTo.statuscode === 500) {
    res.status(500).json({ error: "Error getting assigned to" });
    return;
  }

  res.status(409).json({ error: "Assigned to not found" });
};

export const getAssignedToLogic = async (swarmsBountyId: string): Promise<{ statuscode: number; data: any }> => {
  try {
    const assignedTo = await TodoModel.findOne({ bountyId: swarmsBountyId });
    console.log(assignedTo);
    if (assignedTo && assignedTo.assignees) {
      return {
        statuscode: 200,
        data: {
          success: true,
          message: "Returned assignedTo",
          assignedTo: assignedTo.assignees,
        },
      };
    }
    return {
      statuscode: 409,
      data: {
        success: false,
        message: "Assigned to not found",
      },
    };
  } catch (error) {
    return {
      statuscode: 500,
      data: {
        success: false,
        message: "Error getting assigned to",
      },
    };
  }
};
