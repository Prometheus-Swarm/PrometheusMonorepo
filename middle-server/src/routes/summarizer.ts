import { Router, RequestHandler } from "express";
import { fetchRequest as fetchSummarizerRequest } from "../controllers/summarizer/worker/fetchTodo";
import { addRequest as addSummarizerRequest } from "../controllers/summarizer/worker/addTodoPR";
// import { triggerFetchAuditResult as triggerFetchAuditResultSummarizer } from '../controllers/summarizer/worker/updateAuditResult';
import { checkRequest as checkSummarizerRequest } from "../controllers/summarizer/worker/checkTodo";
import { addTodoStatus } from "../controllers/summarizer/worker/addTodoStatus";
// import { addFailedInfoRequest } from "../controllers/summarizer/worker/addFailedInfo";
import { addRoundNumberRequest } from "../controllers/summarizer/worker/addRoundNumber";
import { addDraftRequest } from "../controllers/summarizer/worker/addTodoDraftPR";
const router = Router();

/********** Worker ***********/
router.post("/worker/fetch-todo", fetchSummarizerRequest as RequestHandler);
router.post("/worker/add-todo-pr", addSummarizerRequest as RequestHandler);
router.post("/worker/add-todo-draft-pr", addDraftRequest as RequestHandler);
// router.post('/worker/update-audit-result', triggerFetchAuditResultSummarizer as RequestHandler);
router.post("/worker/check-todo", checkSummarizerRequest as RequestHandler);
// router.post("/worker/add-failed-info", addFailedInfoRequest as RequestHandler);
router.post("/worker/add-round-number", addRoundNumberRequest as RequestHandler);
// router.post("/worker/trigger-update-swarms-status", triggerUpdateSwarmsStatus as RequestHandler);
// router.post("/worker/trigger-save-swarms-for-round", triggerSaveSwarmsForRound as RequestHandler);
router.post("/worker/add-todo-status", addTodoStatus as RequestHandler);
export default router;
