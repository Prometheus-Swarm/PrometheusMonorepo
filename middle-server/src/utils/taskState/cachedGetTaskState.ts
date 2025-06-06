import { getTaskStateInfo } from "@_koii/create-task-cli";
import { Connection } from "@_koii/web3.js";
import NodeCache from "node-cache";

const taskCache = new NodeCache({ stdTTL: 10, checkperiod: 10 });

export async function cachedGetTaskState(taskId: string) {
  const cachedTaskState = taskCache.get(taskId);
  if (cachedTaskState) {
    return cachedTaskState;
  }
  const connection = new Connection("https://mainnet.koii.network", "confirmed");
  const taskState = await getTaskStateInfo(connection, taskId);
  taskCache.set(taskId, taskState);
  return taskState;
}
