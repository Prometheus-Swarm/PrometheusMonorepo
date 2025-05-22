import { namespaceWrapper, app, TASK_ID } from "@_koii/task-manager/namespace-wrapper";
import { getLeaderNode } from "../utils/leader";
import { task } from "./1-task";
import { submission } from "./2-submission";
import { audit } from "./3-audit";
import { taskRunner } from "@_koii/task-manager";
import { middleServerUrl, status } from "../utils/constant";
import { fetchIssue, addAggregatorInfo, addIssuePR, checkIssue, assignIssue } from "../utils/requests/requests";

import { triggerStarFlow } from "../utils/supporter/gitHub";

/**
 *
 * Define all your custom routes here
 *
 */

//Example route
export async function routes() {
  app.get("/value", async (_req, res) => {
    const value = await namespaceWrapper.storeGet("value");
    console.log("value", value);
    res.status(200).json({ value: value });
  });
  app.get("/star", async (req, res) => {
    triggerStarFlow();
  });
  app.get("/leader/:roundNumber/:submitterPublicKey", async (req, res) => {
    const roundNumber = req.params.roundNumber;
    const submitterPublicKey = req.params.submitterPublicKey;
    const { isLeader, leaderNode } = await getLeaderNode({
      roundNumber: Number(roundNumber),
      submitterPublicKey: submitterPublicKey,
    });
    res.status(200).json({ isLeader: isLeader, leaderNode: leaderNode });
  });

  app.get("/task/:roundNumber", async (req, res) => {
    console.log("task endpoint called with round number: ", req.params.roundNumber);
    const roundNumber = req.params.roundNumber;
    const taskResult = await task(Number(roundNumber));
    res.status(200).json({ result: taskResult });
  });
  app.get("/audit/:roundNumber/:cid/:submitterPublicKey", async (req, res) => {
    const cid = req.params.cid;
    const roundNumber = req.params.roundNumber;
    const submitterPublicKey = req.params.submitterPublicKey;
    const auditResult = await audit(cid, Number(roundNumber), submitterPublicKey);
    res.status(200).json({ result: auditResult });
  });
  app.get("/submission/:roundNumber", async (req, res) => {
    const roundNumber = req.params.roundNumber;
    const submissionResult = await submission(Number(roundNumber));
    res.status(200).json({ result: submissionResult });
  });

  app.get("/submitDistribution/:roundNumber", async (req, res) => {
    const roundNumber = req.params.roundNumber;
    const submitDistributionResult = await taskRunner.submitDistributionList(Number(roundNumber));
    res.status(200).json({ result: submitDistributionResult });
  });
  app.post("/add-todo-draft-pr", async (req, res) => {
    const signature = req.body.signature;
    const prUrl = req.body.prUrl;
    const swarmBountyId = req.body.swarmBountyId;
    console.log("[TASK] req.body", req.body);
    try {
      const publicKey = await namespaceWrapper.getMainAccountPubkey();
      const stakingKeypair = await namespaceWrapper.getSubmitterAccount();
      if (!stakingKeypair) {
        throw new Error("No staking key found");
      }
      const stakingKey = stakingKeypair.publicKey.toBase58();
      const secretKey = stakingKeypair.secretKey;


      if (!publicKey) {
        throw new Error("No public key found");
      }

      const payload = await namespaceWrapper.verifySignature(signature, stakingKey);
      if (!payload) {
        throw new Error("Invalid signature");
      }
      console.log("[TASK] payload: ", payload);
      const data = payload.data;
      if (!data) {
        throw new Error("No signature data found");
      }
      const jsonData = JSON.parse(data);
      if (jsonData.taskId !== TASK_ID) {
        throw new Error(`Invalid task ID from signature: ${jsonData.taskId}. Actual task ID: ${TASK_ID}`);
      }

      const middleServerPayload = {
        taskId: jsonData.taskId,
        swarmBountyId,
        prUrl,
        stakingKey,
        publicKey,
        action: "add-todo-draft-pr",
      };
      const middleServerSignature = await namespaceWrapper.payloadSigning(middleServerPayload, secretKey);
      const middleServerResponse = await fetch(`${middleServerUrl}/summarizer/worker/add-todo-draft-pr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature: middleServerSignature, stakingKey: stakingKey }),
      });

      console.log("[TASK] Add Draft PR Response: ", middleServerResponse);

      if (middleServerResponse.status !== 200) {
        throw new Error(`Posting to middle server failed: ${middleServerResponse.statusText}`);
      }
      res.status(200).json({ result: "Successfully saved PR" });
    } catch (error) {
      console.error("[TASK] Error adding PR to summarizer todo:", error);
      // await namespaceWrapper.storeSet(`result-${roundNumber}`, status.SAVING_TODO_PR_FAILED);
      res.status(400).json({ error: "Failed to save PR" });
    }
  });

  app.post("/add-todo-pr", async (req, res) => {
    const signature = req.body.signature;
    const prUrl = req.body.prUrl;
    const swarmBountyId = req.body.swarmBountyId;
    const success = req.body.success;
    const message = req.body.message;
    console.log("[TASK] req.body", req.body);
    try {
      const publicKey = await namespaceWrapper.getMainAccountPubkey();
      const stakingKeypair = await namespaceWrapper.getSubmitterAccount();
      if (!stakingKeypair) {
        throw new Error("No staking key found");
      }
      const stakingKey = stakingKeypair.publicKey.toBase58();
      const secretKey = stakingKeypair.secretKey;
      if (!success) {
        const middleServerPayload = {
          taskId: TASK_ID,
          swarmBountyId,
          action: "add-todo-status",
          stakingKey,
        };
        const middleServerSignature = await namespaceWrapper.payloadSigning(middleServerPayload, secretKey);
        console.error("[TASK] Error summarizing repository:", message);
        console.log("[TASK] middleServerSignature", middleServerSignature);

        const middleServerResponse = await fetch(`${middleServerUrl}/summarizer/worker/add-todo-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ signature: middleServerSignature, stakingKey }),
        });
        if (middleServerResponse.status !== 200) {
          console.error("[TASK] Error posting to middle server:", middleServerResponse.statusText);
          // throw new Error(`Posting to middle server failed: ${middleServerResponse.statusText}`);
        }
        return;
      }

      if (!publicKey) {
        throw new Error("No public key found");
      }

      const payload = await namespaceWrapper.verifySignature(signature, stakingKey);
      if (!payload) {
        throw new Error("Invalid signature");
      }
      console.log("[TASK] payload: ", payload);
      const data = payload.data;
      if (!data) {
        throw new Error("No signature data found");
      }
      const jsonData = JSON.parse(data);
      if (jsonData.taskId !== TASK_ID) {
        throw new Error(`Invalid task ID from signature: ${jsonData.taskId}. Actual task ID: ${TASK_ID}`);
      }

      const middleServerPayload = {
        taskId: jsonData.taskId,
        swarmBountyId,
        prUrl,
        stakingKey,
        publicKey,
        action: "add-todo-pr",
      };
      const middleServerSignature = await namespaceWrapper.payloadSigning(middleServerPayload, secretKey);
      const middleServerResponse = await fetch(`${middleServerUrl}/summarizer/worker/add-todo-pr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature: middleServerSignature, stakingKey: stakingKey }),
      });

      console.log("[TASK] Add PR Response: ", middleServerResponse);

      if (middleServerResponse.status !== 200) {
        throw new Error(`Posting to middle server failed: ${middleServerResponse.statusText}`);
      }
      await namespaceWrapper.storeSet(`shouldMakeSubmission`, "true");
      await namespaceWrapper.storeSet(`swarmBountyId`, swarmBountyId.toString());
      res.status(200).json({ result: "Successfully saved PR" });
    } catch (error) {
      console.error("[TASK] Error adding PR to summarizer todo:", error);
      // await namespaceWrapper.storeSet(`result-${roundNumber}`, status.SAVING_TODO_PR_FAILED);
      res.status(400).json({ error: "Failed to save PR" });
    }
  });

  app.post("/fetch-issue", async (_req, res) => {
    try {
      const result = await fetchIssue();
      if (!result) {
        throw new Error("Failed to fetch issue");
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("[TASK] Error fetching issue:", error);
      res.status(400).json({ error: "Failed to fetch issue" });
    }
  });

  app.post("/add-aggregator-info", async (req, res) => {
    try {
      const { roundNumber, issueUuid, aggregatorUrl } = req.body;
      if (!roundNumber || !issueUuid || !aggregatorUrl) {
        throw new Error("Missing required parameters");
      }
      const result = await addAggregatorInfo({ roundNumber, issueUuid, aggregatorUrl });
      if (!result) {
        throw new Error("Failed to add aggregator info");
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("[TASK] Error adding aggregator info:", error);
      res.status(400).json({ error: "Failed to add aggregator info" });
    }
  });

  app.post("/add-issue-pr", async (req, res) => {
    try {
      const { roundNumber, issueUuid, prUrl, isFinal } = req.body;
      if (!roundNumber || !issueUuid || !prUrl || isFinal === undefined) {
        throw new Error("Missing required parameters");
      }
      const result = await addIssuePR({ roundNumber, issueUuid, prUrl, isFinal });
      if (!result) {
        throw new Error("Failed to add issue PR");
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("[TASK] Error adding issue PR:", error);
      res.status(400).json({ error: "Failed to add issue PR" });
    }
  });

  app.post("/check-issue", async (req, res) => {
    try {
      const { roundNumber, issueUuid, prUrl, bountyId } = req.body;
      if (!roundNumber || !issueUuid || !prUrl || !bountyId) {
        throw new Error("Missing required parameters");
      }
      const result = await checkIssue({ roundNumber, issueUuid, prUrl, bountyId });
      if (!result) {
        throw new Error("Failed to check issue");
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("[TASK] Error checking issue:", error);
      res.status(400).json({ error: "Failed to check issue" });
    }
  });

  app.post("/assign-issue", async (_req, res) => {
    try {
      const result = await assignIssue();
      if (!result) {
        throw new Error("Failed to assign issue");
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("[TASK] Error assigning issue:", error);
      res.status(400).json({ error: "Failed to assign issue" });
    }
  });
}

// TODO: To be completed
app.post("/failed-task", async (req, res) => {
  res.status(200).json({ result: "Successfully saved task result" });
});
