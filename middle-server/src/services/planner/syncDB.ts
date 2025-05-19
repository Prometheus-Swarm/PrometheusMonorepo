import { SpecModel } from "../../models/Spec";
// import SwarmBounty from "../../models/SwarmBounties";
import { SwarmBountyType, SwarmBountyStatus } from "../../config/constant";
import { createFork } from "../../utils/gitHub/gitHub";
import { getSwarmBounty } from "../../utils/prometheus/api";
import { startPlannerLogic } from "../../controllers/feature-builder/planner/startPlanner";
import dotenv from "dotenv";
import { sendMessageToSlack } from "../slack/message";
dotenv.config();
export async function syncDB() {
  // Get all feature bounties
  const data = await getSwarmBounty();
  if (!data) {
    console.log("No data found");
    return;
  }
  const swarmBounties = data.data.filter((bounty: any) => bounty.swarmType === SwarmBountyType.BUILD_FEATURE);
  const specs = await SpecModel.find();

  // Create a map of existing specs by swarmBountyId for quick lookup
  const existingSpecs = new Map(specs.map((spec) => [spec.swarmBountyId, spec]));

  // Process each feature bounty
  for (const bounty of swarmBounties) {
    const bountyId = bounty._id.toString();
    if (!existingSpecs.has(bountyId)) {
      // Create new spec if it doesn't exist
      await SpecModel.create({
        title: bounty.projectName,
        description: bounty.description,
        repoOwner: bounty.githubUrl.split("/")[3], // Extract owner from GitHub URL
        repoName: bounty.githubUrl.split("/")[4], // Extract repo name from GitHub URL
        swarmBountyId: bountyId,
      });

      const forkUrl = await createFork(bounty.githubUrl);

      const response = await startPlannerLogic({
        sourceUrl: bounty.githubUrl,
        forkUrl: forkUrl,
        issueSpec: bounty.description,
        bountyId: bountyId,
      });
      if (response.statuscode < 200 || response.statuscode >= 300) {
        await sendMessageToSlack(
          `Planner failed for ${bounty.projectName} with bounty id ${bountyId} and error ${response.data.message}`,
        );
      } else {
        console.log("Planner completed for ", bounty.projectName);
      }
    }
  }
  console.log("syncDB planner completed");
}
