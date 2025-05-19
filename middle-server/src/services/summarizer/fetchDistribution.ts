// import { triggerFetchAuditResultLogic } from "../../controllers/summarizer/worker/updateAuditResult";
import { DocumentationStatus } from "../../models/Documentation";
import { DistributionResultModel } from "../../models/DistributionResult";
import { DocumentationModel } from "../../models/Documentation";
import {
  getDistributionListRounds,
  getDistributionListWrapper,
  getKeysByValueSign,
} from "../../utils/taskState/distributionList";
import { updateSwarmBountyStatus } from "../swarmBounty/updateStatus";
import { SwarmBountyStatus } from "../../config/constant";
import dotenv from "dotenv";
dotenv.config();
export const loadMissingDistributionToDatabase = async () => {
  const rounds = await getDistributionListRounds(process.env.DOCUMENT_SUMMARIZER_TASK_ID!);

  console.log("rounds", rounds);
  for (const round of rounds) {
    // check if the round is already in the database
    const distributionResult = await DistributionResultModel.findOne({
      taskId: process.env.DOCUMENT_SUMMARIZER_TASK_ID!,
      round: round,
    });
    if (distributionResult) {
      continue;
    }
    const distributionList = await getDistributionListWrapper(
      process.env.DOCUMENT_SUMMARIZER_TASK_ID!,
      round.toString(),
    );
    await fetchDistribution(distributionList, process.env.DOCUMENT_SUMMARIZER_TASK_ID!, round);
  }
};

export const fetchDistribution = async (distributionList: any, taskId: string, round: number) => {
  let positiveKeys: string[] = [];
  let negativeKeys: string[] = [];
  if (distributionList) {
    const { positive, negative } = await getKeysByValueSign(distributionList);
    positiveKeys = positive;
    negativeKeys = negative;
  } else {
    return {
      statuscode: 200,
      data: {
        success: true,
        message: "No Distribution List found.",
      },
    };
  }
  // save rounds and positiveKeys and negativeKeys
  const distributionResult = await DistributionResultModel.create({
    taskId,
    round,
    positiveKeys,
    negativeKeys,
  });
  await distributionResult.save();
  const response = await updateSubtaskStatus(positiveKeys, negativeKeys, round);
  return response;
};
export const updateSubtaskStatus = async (positiveKeys: string[], negativeKeys: string[], round: number) => {
  console.log("positiveKeys", positiveKeys);
  console.log("negativeKeys", negativeKeys);
  console.log("round", round);
  // ============== Update the subtask status ==============
  const specs = await DocumentationModel.find({
    stakingKey: { $in: [...positiveKeys, ...negativeKeys] },
    roundNumber: round,
    status: DocumentationStatus.IN_REVIEW,
  });
  for (const spec of specs) {
    for (const assignee of spec.assignedTo) {
      if (!assignee.taskId || assignee.roundNumber == undefined || !assignee.stakingKey || !assignee.prUrl) {
        console.log("Missing required fields for assignee:");
        if (!assignee.taskId) console.log("- Missing taskId");
        if (assignee.roundNumber == undefined) console.log("- Missing roundNumber");
        if (!assignee.stakingKey) console.log("- Missing stakingKey");
        if (!assignee.prUrl) console.log("- Missing prUrl");
        console.log("Assignee object:", assignee);
        continue;
      }
      if (positiveKeys.includes(assignee.stakingKey) && assignee.roundNumber === round) {
        assignee.auditResult = true;
        spec.status = DocumentationStatus.DONE;
        if (spec.swarmBountyId && process.env.NODE_ENV !== "development") {
          await updateSwarmBountyStatus(spec.swarmBountyId, SwarmBountyStatus.COMPLETED);
        }
      }
      // Even the previous ones are passed, we need to set the status to initialized
      if (negativeKeys.includes(assignee.stakingKey) && assignee.roundNumber === round) {
        assignee.auditResult = false;
        // If the staking key is the current one, we need to set the status to initialized to allow it to be finished again
        if (spec.stakingKey === assignee.stakingKey && spec.roundNumber === round) {
          spec.status = DocumentationStatus.INITIALIZED;
        }
      }
    }
    // Save the todo
    await spec.save();
  }

  return {
    statuscode: 200,
    data: {
      success: true,
      message: "Task processed successfully.",
    },
  };
};
