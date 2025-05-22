import { Request, Response } from "express";
import { TodoModel, TodoStatus } from "../../../models/Todo";
import { verifySignature } from "../../../utils/sign";
import { taskIDs } from "../../../config/constant";
import { isValidStakingKey } from "../../../utils/taskState";

type FailureSource = "task" | "audit";

interface FailTodoRequest {
  signature: string;
  stakingKey: string;
  uuid: string;
  reason: string;
  source: FailureSource;
}

async function verifySignatureData(
  signature: string,
  stakingKey: string,
): Promise<{
  roundNumber: number;
  taskId: string;
  uuid: string;
  reason: string;
  source: FailureSource;
} | null> {
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
      !body.stakingKey ||
      body.stakingKey !== stakingKey
    ) {
      console.log("bad signature data");
      return null;
    }
    return {
      roundNumber: body.roundNumber,
      taskId: body.taskId,
      uuid: body.uuid,
      reason: body.reason,
      source: body.source as FailureSource,
    };
  } catch (error) {
    console.log("unexpected signature error", error);
    return null;
  }
}

export async function failTodo(req: Request, res: Response): Promise<void> {
  try {
    const { signature, stakingKey, uuid, reason, source }: FailTodoRequest = req.body;

    // Validate request body
    if (!signature || !stakingKey || !uuid || !reason || !source) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    // Verify signature
    const signatureData = await verifySignatureData(signature, stakingKey);
    if (!signatureData) {
      res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
      return;
    }

    // Validate staking key
    if (!(await isValidStakingKey(signatureData.taskId, stakingKey))) {
      res.status(401).json({
        success: false,
        message: "Invalid staking key",
      });
      return;
    }

    // Find the todo
    const todo = await TodoModel.findOne({ uuid });
    if (!todo) {
      res.status(404).json({
        success: false,
        message: "Todo not found",
      });
      return;
    }

    // Find the assignee for this round
    const assignee = todo.assignees?.find(
      (a) =>
        a.stakingKey === stakingKey && a.roundNumber === signatureData.roundNumber && a.taskId === signatureData.taskId,
    );
    if (!assignee) {
      res.status(404).json({
        success: false,
        message: "Assignee not found for this round",
      });
      return;
    }

    // Add feedback to the assignee
    assignee.feedback.push({
      recoverable: source === "task",
      reason: signatureData.reason,
      timestamp: new Date(),
    });

    // If this is a task failure (not an audit failure), update the todo status
    if (source === "task") {
      todo.status = TodoStatus.INITIALIZED;
    }

    // Save the changes
    await todo.save();

    res.status(200).json({
      success: true,
      message: "Todo failure recorded successfully",
    });
  } catch (error) {
    console.error("Error in failTodo:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
