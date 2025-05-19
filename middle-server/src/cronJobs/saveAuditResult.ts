import { loadMissingDistributionToDatabase } from "../services/summarizer/fetchDistribution";

export const triggerAudit = async () => {
  const response = await loadMissingDistributionToDatabase();
  console.log("response", response);
  process.exit(0);
};

triggerAudit();
