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
  // console.log("Raw API response data:", JSON.stringify(data, null, 2));

  const swarmBounties = data.data.filter((bounty: any) => bounty.swarmType === SwarmBountyType.BUILD_FEATURE);
  // console.log("Filtered swarm bounties:", JSON.stringify(swarmBounties, null, 2));

  const specs = await SpecModel.find();
  // console.log("Existing specs:", JSON.stringify(specs, null, 2));

  // Create a map of existing specs by swarmBountyId for quick lookup
  const existingSpecs = new Map(specs.map((spec) => [spec.swarmBountyId, spec]));
  // console.log("existingSpecs", existingSpecs.size);

  // Process each feature bounty
  for (const bounty of swarmBounties) {
    console.log("Processing bounty:", JSON.stringify(bounty, null, 2));
    const bountyId = bounty._id.toString();
    if (!existingSpecs.has(bountyId)) {
      // Check if description exists
      if (!bounty.description) {
        console.warn(`Skipping bounty ${bountyId} (${bounty.projectName}) - missing description`);
        // console.warn("Full bounty object:", JSON.stringify(bounty, null, 2));
        continue;
      }

      try {
        // Create new spec if it doesn't exist
        const newSpec = await SpecModel.create({
          title: bounty.projectName,
          description: bounty.description,
          repoOwner: bounty.githubUrl.split("/")[3], // Extract owner from GitHub URL
          repoName: bounty.githubUrl.split("/")[4], // Extract repo name from GitHub URL
          swarmBountyId: bountyId,
        });
        console.log("Successfully created spec:", JSON.stringify(newSpec, null, 2));

        console.log("created spec", bounty.projectName);

        const forkUrl = await createFork(bounty.githubUrl);

        const response = await startPlannerLogic({
          sourceUrl: bounty.githubUrl,
          forkUrl: forkUrl,
          issueSpec: bounty.description,
          bountyId: bountyId,
          bountyType: bounty.swarmType as SwarmBountyType,
        });
        if (response.statuscode < 200 || response.statuscode >= 300) {
          await sendMessageToSlack(
            `Planner failed for ${bounty.projectName} with bounty id ${bountyId} and error ${response.data.message}`,
          );
        } else {
          console.log("Planner completed for ", bounty.projectName);
        }
      } catch (error) {
        console.error("Error creating spec:", error);
        console.error("Bounty data that caused error:", JSON.stringify(bounty, null, 2));
      }
    }
  }
  console.log("syncDB planner completed");
}

syncDB();
