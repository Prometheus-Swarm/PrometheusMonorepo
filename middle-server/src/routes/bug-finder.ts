import { Router, RequestHandler } from "express";
import { fetchRequest as fetchSummarizerRequest } from "../controllers/bug-finder/worker/fetchTodo";
import { addRequest as addSummarizerRequest } from "../controllers/bug-finder/worker/addTodoPR";
// import { triggerFetchAuditResult as triggerFetchAuditResultSummarizer } from "../controllers/bug-finder/worker/updateAuditResult";
import { checkRequest as checkSummarizerRequest } from "../controllers/bug-finder/worker/checkTodo";
import { addTodoStatus } from "../controllers/bug-finder/worker/addTodoStatus";
import { addErrorLogToDB, addLogToDB } from "../controllers/bug-finder/worker/addLog";
import { addRoundNumberRequest } from "../controllers/bug-finder/worker/addRoundNumber";

const router = Router();

/********** Worker ***********/
router.post("/worker/fetch-todo", fetchSummarizerRequest as RequestHandler);
router.post("/worker/add-todo-pr", addSummarizerRequest as RequestHandler);
// router.post('/worker/update-audit-result', triggerFetchAuditResultSummarizer as RequestHandler);
router.post("/worker/check-todo", checkSummarizerRequest as RequestHandler);
router.post("/worker/record-error-log", addErrorLogToDB as RequestHandler);
router.post("/worker/record-log", addLogToDB as RequestHandler);
router.post("/worker/add-round-number", addRoundNumberRequest as RequestHandler);
// router.post("/worker/trigger-update-swarms-status", triggerUpdateSwarmsStatus as RequestHandler);
// router.post("/worker/trigger-save-swarms-for-round", triggerSaveSwarmsForRound as RequestHandler);
router.post("/worker/add-todo-status", addTodoStatus as RequestHandler);
export default router;
