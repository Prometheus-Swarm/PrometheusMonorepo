import { loadMissingDistributionToDatabase } from "../services/summarizer/fetchDistribution";
import { loadMissingDistributionToDatabase as loadMissingDistributionToDatabaseBuilder } from "../services/builder/fetchDistribution";
export const triggerAudit = async () => {
  try {
    const response = await loadMissingDistributionToDatabase();
    console.log("response", response);
  } catch (error) {
    console.error("Error in triggerAudit", error);
  }
  try {
    const responseBuilder = await loadMissingDistributionToDatabaseBuilder();
    console.log("responseBuilder", responseBuilder);
  } catch (error) {
    console.error("Error in triggerAudit", error);
  }
  process.exit(0);
};

triggerAudit();
