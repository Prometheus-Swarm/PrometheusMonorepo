import { Request, Response } from "express";

interface PlannerRequestBody {
  sourceUrl: string;
  forkUrl: string;
  issueSpec: string;
  bountyId: string;
}

export const planner = async (req: Request, res: Response) => {
  console.log(req.body);
  const response = await startPlannerLogic(req.body as PlannerRequestBody);
  res.json(response.data);
};

export const startPlannerLogic = async (
  requestBody: PlannerRequestBody,
): Promise<{
  statuscode: number;
  data: {
    success: boolean;
    data?: any;
    message?: string;
  };
}> => {
  try {
    const baseUrl = process.env.NODE_ENV === "production" ? "http://planner-agent:8080" : "http://127.0.0.1:8080";

    const response = await fetch(`${baseUrl}/create-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
    return {
      statuscode: response.status,
      data: {
        success: response.ok,
        data: data,
      },
    };
  } catch (error) {
    return {
      statuscode: 500,
      data: {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};
