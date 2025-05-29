// import { TodoModel, Status } from "../../../models/Todo";

// import { Request, Response } from "express";
// import { verifySignature } from "../../../utils/sign";
// import { taskIDs, SwarmBountyStatus } from "../../../config/constant";
// import { isValidStakingKey } from "../../../utils/taskState";
// // import { updateSwarmBountyStatus } from "../../../services/swarmBounty/updateStatus";

// function verifyRequestBody(req: Request): { signature: string; stakingKey: string } | null {
//   try {
//     console.log("req.body", req.body);
//     const signature = req.body.signature as string;
//     const stakingKey = req.body.stakingKey as string;
//     if (!signature || !stakingKey) {
//       return null;
//     }

//     return { signature, stakingKey };
//   } catch {
//     return null;
//   }
// }

// // Helper function to verify signature
// async function verifySignatureData(
//   signature: string,
//   stakingKey: string,
//   action: string,
// ): Promise<{ SwarmBountyId: string | null, taskId: string }> {
//   try {
//     const { data, error } = await verifySignature(signature, stakingKey);
//     if (error || !data) {
//       console.log("signature error", error);
//       return { SwarmBountyId: null, taskId: "" };
//     }
//     const body = JSON.parse(data);
//     console.log("signature payload", { body, stakingKey });
//     if (
//       !body.taskId ||
//       !taskIDs.includes(body.taskId) ||
//       body.action !== action ||
//       !body.stakingKey ||
//       body.stakingKey !== stakingKey ||
//       !body.swarmBountyId
//     ) {
//       return { SwarmBountyId: null, taskId: "" };
//     }
//     return { SwarmBountyId: body.swarmBountyId, taskId: body.taskId };
//   } catch {
//     return { SwarmBountyId: null, taskId: "" };
//   }
// }
// async function updateTaskStatus(stakingKey: string, signature: string, swarmBountyId: string, taskId: string): Promise<boolean> {
//   console.log("updateAssignedInfoWithIPFS", { stakingKey, signature, swarmBountyId });
//   const result = await TodoModel.findOneAndUpdate(
//     {
//       assignedTo: {
//         $elemMatch: {
//           taskId: taskId,
//           stakingKey: stakingKey,
//           bountyId: swarmBountyId,
//         },
//       },
//     },
//     {
//       $set: { status: Status.INITIALIZED },
//       $unset: {
//         taskId: "",
//         stakingKey: "",
//         roundNumber: "",
//       },
//     },
//   )
//     .select("_id")
//     .lean();
//   return result !== null;
// }

// export const addTodoStatus = async (req: Request, res: Response) => {
//   const requestBody = verifyRequestBody(req);
//   if (!requestBody) {
//     res.status(401).json({
//       success: false,
//       message: "Invalid request body",
//     });
//     return;
//   }

//   const signatureData = await verifySignatureData(requestBody.signature, requestBody.stakingKey, "add-todo-status");
//   if (!signatureData.SwarmBountyId) {
//     res.status(401).json({
//       success: false,
//       message: "Failed to verify signature",
//     });
//     return;
//   }

//   if (!(await isValidStakingKey(signatureData.taskId, requestBody.stakingKey))) {
//     res.status(401).json({
//       success: false,
//       message: "Invalid staking key",
//     });
//     return;
//   }

//   const response = await addStatusLogic(requestBody, signatureData);
//   res.status(response.statuscode).json(response.data);
// };

// export const addStatusLogic = async (
//   requestBody: { signature: string; stakingKey: string },
//   signatureData: { SwarmBountyId: string | null, taskId: string },
// ) => {
//   if (!signatureData.SwarmBountyId) {
//     return {
//       statuscode: 401,
//       data: {
//         success: false,
//         message: "Failed to verify signature",
//       },
//     };
//   }
//   const result = await updateTaskStatus(requestBody.stakingKey, requestBody.signature, signatureData.SwarmBountyId, signatureData.taskId);
//   if (!result) {
//     return {
//       statuscode: 401,
//       data: {
//         success: false,
//         message: "Failed to update status",
//       },
//     };
//   }

//   return {
//     statuscode: 200,
//     data: {
//       success: true,
//       message: "Status updated",
//     },
//   };
// };



// Unncessary as when adding draftPR the status is set to DRAFT_PR_RECEIVED which is equivalent to initialized