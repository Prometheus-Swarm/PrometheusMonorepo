import { syncDB as syncSummarizerDB } from "../services/summarizer/syncDB";
import { syncDB as syncPlannerDB } from "../services/planner/syncDB";
import { syncDB as syncBugFinderDB } from "../services/bugFinder/syncDB";
import { syncDB as syncStarDB } from "../services/star/syncDB";
export async function syncDB() {
  await syncSummarizerDB();
  await syncPlannerDB();
  await syncBugFinderDB();
  await syncStarDB();
  process.exit(0);
}

syncDB();
