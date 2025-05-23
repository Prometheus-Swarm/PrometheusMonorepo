import { Router, RequestHandler } from "express";
import { verifyBearerToken } from "../middleware/auth";

/******** Builder *********/
import { fetchTodo } from "../controllers/feature-builder/worker/fetchTodo";
import { addPR } from "../controllers/feature-builder/worker/addTodoPR";
import { checkToDo } from "../controllers/feature-builder/worker/checkTodo";
import { updateAuditResult } from "../controllers/feature-builder/worker/updateAuditResult";
import { addAggregatorInfo } from "../controllers/feature-builder/worker/addAggregatorInfo";
import { addIssuePR } from "../controllers/feature-builder/worker/addIssuePR";
import { assignIssue } from "../controllers/feature-builder/worker/assignIssue";
import { fetchIssue } from "../controllers/feature-builder/worker/fetchIssue";
import { checkIssue } from "../controllers/feature-builder/worker/checkIssue";
import { getSourceRepo } from "../controllers/feature-builder/worker/getSourceRepo";
import { addErrorLogToDB, addLogToDB } from "../controllers/feature-builder/worker/addLog";
import { recordPlannerMessage } from "../controllers/feature-builder/planner/recordMessage";
import { recordBuilderMessage } from "../controllers/feature-builder/worker/recordMessage";
/******** Planner ***********/
import { fetchRequest as fetchPlannerRequest } from "../controllers/feature-builder/planner/fetchRequest";
import { addRequest as addPlannerRequest } from "../controllers/feature-builder/planner/addRequest";
import { checkRequest as checkPlannerRequest } from "../controllers/feature-builder/planner/checkRequest";
import { triggerFetchAuditResult as triggerFetchAuditResultPlanner } from "../controllers/feature-builder/planner/triggerFetchAuditResult";
import { planner } from "../controllers/feature-builder/planner/startPlanner";

/******** Prometheus Website ***********/
import { getAssignedTo } from "../controllers/prometheus/getAssignedTo";
import { classification } from "../controllers/prometheus/classification";

/********** Supporter ***********/
import { bindRequest } from "../controllers/supporter/bindRequest";
import { fetchRequest as fetchRepoList } from "../controllers/supporter/fetchRequest";
import { checkRequest as checkRepoRequest } from "../controllers/supporter/checkRequest";

const router = Router();

/********** Builder ***********/
router.post("/builder/fetch-to-do", fetchTodo as RequestHandler);
router.post("/builder/add-aggregator-info", addAggregatorInfo as RequestHandler);
router.post("/builder/add-pr-to-to-do", addPR as RequestHandler);
router.post("/builder/add-issue-pr", addIssuePR as RequestHandler);
router.post("/builder/check-to-do", checkToDo as RequestHandler);
router.post("/builder/assign-issue", assignIssue as RequestHandler);
router.post("/builder/update-audit-result", updateAuditResult as RequestHandler);
router.post("/builder/fetch-issue", fetchIssue as RequestHandler);
router.post("/builder/check-issue", checkIssue as RequestHandler);
router.post("/builder/record-log", addLogToDB as RequestHandler);
router.post("/builder/record-error-log", addErrorLogToDB as RequestHandler);
router.get("/builder/get-source-repo/:nodeType/:uuid", getSourceRepo as RequestHandler);
router.post("/builder/record-message", recordPlannerMessage as RequestHandler);
router.post("/builder/record-builder-message", recordBuilderMessage as RequestHandler);

/********** Planner ***********/
router.post("/planner/fetch-planner-todo", fetchPlannerRequest as RequestHandler);
router.post("/planner/add-pr-to-planner-todo", addPlannerRequest as RequestHandler);
router.post("/planner/check-planner", checkPlannerRequest as RequestHandler);
router.post("/planner/trigger-fetch-audit-result", triggerFetchAuditResultPlanner as RequestHandler);
router.post("/planner/start-planner", planner as RequestHandler);
/*********** Prometheus Website ***********/
router.get("/prometheus/get-assigned-nodes", getAssignedTo as RequestHandler);
router.post("/prometheus/classification", verifyBearerToken, classification as RequestHandler);

/****************** Supporter **************/
router.post("/supporter/bind-key-to-github", bindRequest as RequestHandler);
router.post("/supporter/fetch-repo-list", fetchRepoList as RequestHandler);
router.post("/supporter/check-request", checkRepoRequest as RequestHandler);

router.get("/hello", (req, res) => {
  res.json({ message: "Hello World!" });
});

export default router;
