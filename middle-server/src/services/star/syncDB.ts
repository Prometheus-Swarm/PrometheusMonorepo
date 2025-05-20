import { SwarmBountyType } from "../../config/constant";
import { StarFollowModel } from "../../models/StarFollow";
import { getSwarmBounty } from "../../utils/prometheus/api";

export async function syncDB() {
  const starData = await getSwarmBounty();
  if (!starData) {
    console.log("No data found");
    return;
  }
  const starFollows = starData.data;
  //   const starFollows = data.data.filter((bounty: any) => bounty.swarmType === SwarmBountyType.STAR_FOLLOW);
  console.log("starFollows", starFollows.length);
}

async function test() {
  await syncDB();
}

test();
