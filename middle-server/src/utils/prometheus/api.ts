import { SwarmBountyStatus } from "../../config/constant";
import { BountyResponse } from "../../types/bounty";

export async function getSwarmBounty(
  status: SwarmBountyStatus | null = SwarmBountyStatus.IN_PROGRESS,
): Promise<BountyResponse | null> {
  let endpoint = "";
  if (!status) {
    endpoint = `${process.env.PROMETHEUS_SERVER_URL}/api/v1/bounty`;
  } else {
    endpoint = `${process.env.PROMETHEUS_SERVER_URL}/api/v1/bounty?status=${status}`;
  }
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${process.env.PROMETHEUS_SERVER_X_API_KEY || ""}`,
      "x-vercel-protection-bypass": process.env.PROMETHEUS_SERVER_BYPASS_KEY || "",
    },
  });

  if (!response.ok) {
    console.log("No data found");
    return null;
  }

  const data: BountyResponse = await response.json();
  return data;
}
