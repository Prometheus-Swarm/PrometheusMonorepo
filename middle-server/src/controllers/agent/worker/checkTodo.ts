import { Request, Response } from "express";
import { TodoModel } from "../../../models/Todo";

// Helper function to verify request body
function verifyRequestBody(req: Request): {
  stakingKey: string;
  githubUsername: string;
  prUrl: string;
  taskId: string;
} | null {
  try {
    console.log("Request body:", req.body);

    const stakingKey = req.body.stakingKey as string;
    const githubUsername = req.body.githubUsername as string;
    const prUrl = req.body.prUrl as string;
    const taskId = req.body.taskId as string;
    if (!stakingKey || !githubUsername || !prUrl || !taskId) {
      return null;
    }
    return { stakingKey, githubUsername, prUrl, taskId };
  } catch {
    return null;
  }
}

export async function checkToDoAssignment(
  stakingKey: string,
  githubUsername: string,
  prUrl: string,
  taskId: string
): Promise<boolean> {
  try {
    const data = {
      stakingKey,
      githubUsername,
      prUrl,
      taskId: taskId,
    };
    console.log("Data:", data);
    const result = await TodoModel.findOne({
      assignedTo: {
        $elemMatch: {
          stakingKey: stakingKey,
          taskId: taskId,
          prUrl: prUrl,
        },
      },
    });

    console.log("Todo assignment check result:", result);
    return result !== null;
  } catch (error) {
    console.error("Error checking todo assignment:", error);
    return false;
  }
}

export const checkTodoRequest = async (req: Request, res: Response) => {
  const requestBody = verifyRequestBody(req);
  if (!requestBody) {
    res.status(401).json({
      success: false,
      message: "Invalid request body",
    });
    return;
  }
  const isValid = await checkToDoAssignment(
    requestBody.stakingKey,
    requestBody.githubUsername,
    requestBody.prUrl,
    requestBody.taskId,
  );

  if (!isValid) {
    res.status(409).json({
      success: false,
      message: "No matching todo assignment found",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Todo assignment verified successfully",
  });
};
