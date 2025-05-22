import { Request, Response } from "express";
import { PlannerConversationModel } from "../../../models/PlannerConversation";

interface RecordMessageRequest {
  bounty_id: string;
  content?: string;
  tool?: string[];
}

export const recordPlannerMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bounty_id, content, tool } = req.body as RecordMessageRequest;

    if (!bounty_id) {
      res.status(400).json({
        success: false,
        message: "bounty_id is required",
      });
      return;
    }

    const conversation = await PlannerConversationModel.create({
      bounty_id,
      content,
      tools: tool || [], // Map the 'tool' field from request to 'tools' in model
    });

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error recording planner message:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
