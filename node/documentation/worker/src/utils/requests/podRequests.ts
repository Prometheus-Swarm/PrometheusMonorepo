import { TASK_ID } from "@_koii/namespace-wrapper";
import { getOrcaClient } from "@_koii/task-manager/extensions";
type CreateAggregatorRepoResponse = {
    fork_url: string;
    branch_name: string;
    issue_uuid: string;
}
export const createAggregatorRepo = async (issueUuid: string, repoOwner: string, repoName: string) : Promise<CreateAggregatorRepoResponse | null> => {
    try {
        const orcaClient = await getOrcaClient();
        const jsonBody = {
            issueUuid: issueUuid,
            repoOwner: repoOwner,
            repoName: repoName,
        };
      const response = await orcaClient.podCall(`worker-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonBody),
      });
      return response.data;
    } catch (error) {
        console.error("[CREATE AGGREGATOR REPO] Error creating aggregator repo:", error);
        return null;
    }
}

