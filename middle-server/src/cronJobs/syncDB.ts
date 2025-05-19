import { syncDB as syncSummarizerDB } from "../services/summarizer/syncDB";
import { syncDB as syncPlannerDB } from "../services/planner/syncDB";
import { syncDB as syncBugFinderDB } from "../services/bugFinder/syncDB";

export async function syncDB() {
  await syncSummarizerDB();
  await syncPlannerDB();
  await syncBugFinderDB();
  process.exit(0);
}

syncDB();
