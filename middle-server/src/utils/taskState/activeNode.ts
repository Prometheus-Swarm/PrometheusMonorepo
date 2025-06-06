import { cachedGetTaskState } from "./cachedGetTaskState";

export async function getLastRoundValueLength(taskId: string): Promise<number> {
  const taskState = await cachedGetTaskState(taskId);
  const roundKeys = Object.keys(taskState.submissions);
  const lastRound = Math.max(...roundKeys.map(Number));
  const lastRoundValue = taskState.submissions[(lastRound - 1).toString()];
  if (!lastRoundValue) {
    throw new Error("Last round value is undefined or null");
  }
  return Object.keys(lastRoundValue).length;
}
