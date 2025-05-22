// import { Request, Response } from "express";
// import { IssueModel, IssueStatus } from "../../../models/Issue";
// import { verifySignature } from "../../../utils/sign";
// import { taskIDs } from "../../../config/constant";
// import { isValidStakingKey } from "../../../utils/taskState";

// type FailureSource = "task" | "audit";

// interface FailIssueRequest {
//   signature: string;
//   stakingKey: string;
//   uuid: string;
//   reason: string;
//   source: FailureSource;
// }

// async function verifySignatureData(
//   signature: string,
//   stakingKey: string,
// ): Promise<{
//   roundNumber: number;
//   taskId: string;
//   uuid: string;
//   reason: string;
//   source: FailureSource;
// } | null> {
//   try {
//     const { data, error } = await verifySignature(signature, stakingKey);
//     if (error || !data) {
//       console.log("bad signature");
//       return null;
//     }
//     const body = JSON.parse(data);
//     console.log({ signature_payload: body });
//     if (
//       !body.taskId ||
//       typeof body.roundNumber !== "number" ||
//       !taskIDs.includes(body.taskId) ||
//       !body.stakingKey ||
//       body.stakingKey !== stakingKey
//     ) {
//       console.log("bad signature data");
//       return null;
//     }
//     return {
//       roundNumber: body.roundNumber,
//       taskId: body.taskId,
//       uuid: body.uuid,
//       reason: body.reason,
//       source: body.source as FailureSource,
//     };
//   } catch (error) {
//     console.log("unexpected signature error", error);
//     return null;
//   }
// }

// export async function failIssue(req: Request, res: Response): Promise<void> {
//   try {
//     const { signature, stakingKey, uuid, reason, source }: FailIssueRequest = req.body;

//     // Validate request body
//     if (!signature || !stakingKey || !uuid || !reason || !source) {
//       res.status(400).json({
//         success: false,
//         message: "Missing required fields",
//       });
//       return;
//     }

//     // Verify signature
//     const signatureData = await verifySignatureData(signature, stakingKey);
//     if (!signatureData) {
//       res.status(401).json({
//         success: false,
//         message: "Invalid signature",
//       });
//       return;
//     }

//     // Validate staking key
//     if (!(await isValidStakingKey(signatureData.taskId, stakingKey))) {
//       res.status(401).json({
//         success: false,
//         message: "Invalid staking key",
//       });
//       return;
//     }

//     // Find the issue
//     const issue = await IssueModel.findOne({ uuid });
//     if (!issue) {
//       res.status(404).json({
//         success: false,
//         message: "Issue not found",
//       });
//       return;
//     }

//     // Find the assignee for this round
//     const assignee = issue.assignees?.find(
//       (a) =>
//         a.stakingKey === stakingKey && a.roundNumber === signatureData.roundNumber && a.taskId === signatureData.taskId,
//     );
//     if (!assignee) {
//       res.status(404).json({
//         success: false,
//         message: "Assignee not found for this round",
//       });
//       return;
//     }

//     // Add feedback to the assignee
//     assignee.feedback.push({
//       recoverable: source === "task",
//       reason: signatureData.reason,
//       timestamp: new Date(),
//     });

//     // If this is a task failure (not an audit failure), update the issue status
//     if (source === "task") {
//       issue.status = IssueStatus.ASSIGN_PENDING;
//     }

//     // Save the changes
//     await issue.save();

//     res.status(200).json({
//       success: true,
//       message: "Issue failure recorded successfully",
//     });
//   } catch (error) {
//     console.error("Error in failIssue:", error);
//     res.status(500).json({
//       success: false,
//       message: error instanceof Error ? error.message : "Internal server error",
//     });
//   }
// }
