import { getTaskStateInfo } from "@_koii/create-task-cli";
import { Connection } from "@_koii/web3.js";
import { TaskRoundTimeModel } from "../../models/TaskRoundTime";

export async function getRoundTime(taskId: string) {
  try {
    const documentationModelResult = await TaskRoundTimeModel.findOne({ taskId: taskId });
    if (!documentationModelResult) {
      const connection = new Connection("https://mainnet.koii.network", "confirmed");
      const taskState = await getTaskStateInfo(connection, taskId);
      const roundTime = taskState.round_time;
      const roundTimeInMS = roundTime * 408;
      await TaskRoundTimeModel.create({ taskId: taskId, roundTimeInMS: roundTimeInMS });
      return roundTimeInMS;
    }
    return documentationModelResult.roundTimeInMS;
  } catch (error) {
    console.error("Error in getRoundTime", error);
    return null;
  }
}
