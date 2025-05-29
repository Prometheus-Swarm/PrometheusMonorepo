import { Router, RequestHandler } from "express";
import { verifyBearerToken } from "../middleware/auth";


/*************Agent *************/

import { addLogToDB, addErrorLogToDB } from '../controllers/agent/worker/addLogs';
import { fetchTodo } from '../controllers/agent/worker/fetchTodo';
import { addRoundNumberRequest } from '../controllers/agent/worker/addRoundNumber';
import { addDraftRequest } from '../controllers/agent/worker/addTodoDraftPR';
import { addTodoPR } from '../controllers/agent/worker/addTodoPR';
// import {addTodoStatus} from '../controllers/agent/worker/addTodoStatus';
import { checkTodoRequest } from '../controllers/agent/worker/checkTodo';
import { recordBuilderMessage } from '../controllers/agent/worker/recordBuilderConversation';
/******** Prometheus Website ***********/
import { getAssignedTo } from "../controllers/prometheus/getAssignedTo";
import { classification } from "../controllers/prometheus/classification";
import { recordPlannerMessage } from "../controllers/agent/worker/recordPlannerConversation";

const router = Router();

/********** Worker ***********/
router.post("/worker/record-error-log", addErrorLogToDB as RequestHandler);
router.post("/worker/record-log", addLogToDB as RequestHandler);
router.post("/worker/fetch-todo", fetchTodo as RequestHandler);
router.post("/worker/add-round-number", addRoundNumberRequest as RequestHandler);
router.post("/worker/add-todo-draft-pr", addDraftRequest as RequestHandler);
router.post("/worker/add-todo-pr", addTodoPR as RequestHandler);
// router.post("/worker/add-todo-status", addTodoStatus as RequestHandler);
router.post("/worker/check-todo", checkTodoRequest as RequestHandler);
router.post("/worker/record-builder-conversation", recordBuilderMessage as RequestHandler);


/********** Planner ***********/
router.post("/planner/record-planner-converstaion", recordPlannerMessage as RequestHandler);

/*********** Prometheus Website ***********/
router.get("/prometheus/get-assigned-nodes", getAssignedTo as RequestHandler);
router.post("/prometheus/classification", verifyBearerToken, classification as RequestHandler);



router.get("/hello", (req, res) => {
  res.json({ status: 200, message: "running" });
});

export default router;
