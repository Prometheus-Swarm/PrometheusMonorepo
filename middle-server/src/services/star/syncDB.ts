import { SwarmBountyType } from "../../config/constant";
import { StarFollowModel } from "../../models/StarFollow";
import { getSwarmBounty } from "../../utils/prometheus/api";

export async function syncDB() {
  const starData = await getSwarmBounty(null);
  if (!starData) {
    console.log("No data found");
    return;
  }
  const starFollows = starData.data;
  //   const starFollows = data.data.filter((bounty: any) => bounty.swarmType === SwarmBountyType.STAR_FOLLOW);
  console.log("starFollows", starFollows.length);
  const existingDocs = await StarFollowModel.find();
  const existingDocsMap = new Map(existingDocs.map((doc) => [doc.repoOwner + "/" + doc.repoName, doc]));
  for (const bounty of starFollows) {
    const bountyId = bounty._id.toString();
    if (!existingDocsMap.has(`${bounty.githubUrl.split("/")[3]}/${bounty.githubUrl.split("/")[4]}`)) {
      // Create new spec if it doesn't exist
      const newDoc = await StarFollowModel.create({
        repoOwner: bounty.githubUrl.split("/")[3], // Extract owner from GitHub URL
        repoName: bounty.githubUrl.split("/")[4], // Extract repo name from GitHub URL
      });
      existingDocsMap.set(`${bounty.githubUrl.split("/")[3]}/${bounty.githubUrl.split("/")[4]}`, newDoc);
    }
  }
}

// async function test() {
//   await syncDB();
// }

// test();
