import { Request, Response } from "express";
import { BuilderConversationModel } from "../../../models/BuilderConversation";

interface RecordMessageRequest {
  bounty_id: string;
  content?: string;
  tool?: string[];
  githubUsername: string;
  todoUUID: string;
  taskType: "todo";
  taskStage: "task" | "audit";
  prUrl?: string;
}

export const recordBuilderMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bounty_id, content, tool, githubUsername, todoUUID, taskType, taskStage, prUrl } =
      req.body as RecordMessageRequest;

    if (!bounty_id) {
      res.status(400).json({
        success: false,
        message: "bounty_id is required",
      });
      return;
    }

    const conversation = await BuilderConversationModel.create({
      bounty_id,
      content,
      tools: tool || [],
      githubUsername,
      todoUUID,
      taskType,
      taskStage,
      prUrl,
    });

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error recording builder message:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
