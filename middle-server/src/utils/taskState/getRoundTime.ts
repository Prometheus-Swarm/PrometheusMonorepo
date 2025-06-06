import { TaskRoundTimeModel } from "../../models/TaskRoundTime";
import { cachedGetTaskState } from "./cachedGetTaskState";

export async function getRoundTime(taskId: string) {
  try {
    const documentationModelResult = await TaskRoundTimeModel.findOne({ taskId: taskId });
    if (!documentationModelResult) {
      const taskState = await cachedGetTaskState(taskId);
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
