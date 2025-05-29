import { Request, Response } from "express";
import { AgentErrorLogsModel } from "../../../models/AgentErrorLogs";
import { AgentLogsModel } from "../../../models/AgentLogs";
import { verifySignature } from "../../../utils/sign";

export const addErrorLog = async (stakingKey: string, swarmBountyId: string, error: string, todoUUID: string) => {
  try {
    const agentErrorLogs = await AgentErrorLogsModel.findOne({ stakingKey, swarmBountyId, todoUUID });
    if (agentErrorLogs) {
      agentErrorLogs.errors.push({ message: error, timestamp: new Date() });
      await agentErrorLogs.save();
    } else {
      const newAgentErrorLogs = new AgentErrorLogsModel({
        stakingKey,
        swarmBountyId,
        todoUUID,
        errors: [{ message: error, timestamp: new Date() }],
      });
      await newAgentErrorLogs.save();
    }
  } catch (err) {
    console.error("Error adding failed info:", err);
    throw err;
  }
};

export const addLog = async (
  stakingKey: string,
  swarmBountyId: string,
  logMessage: string,
  logLevel: string,
  todoUUID: string,
) => {
  try {
    const agentLogs = await AgentLogsModel.findOne({ stakingKey, swarmBountyId, todoUUID });
    if (agentLogs) {
      agentLogs.logs.push({ level: logLevel, message: logMessage, timestamp: new Date() });
      await agentLogs.save();
    } else {
      const newAgentLogs = new AgentLogsModel({
        stakingKey,
        swarmBountyId,
        todoUUID,
        logs: [{ level: logLevel, message: logMessage, timestamp: new Date() }],
      });
      await newAgentLogs.save();
    }
  } catch (err) {
    console.error("Error adding failed info:", err);
    throw err;
  }
};

export const addErrorLogToDB = async (req: Request, res: Response) => {
  try {
    const { stakingKey, swarmBountyId, error: errorMessage, signature, todoUUID } = req.body;

    // Verify Signature
    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("signature error", error);
      return res.status(400).json({ message: "Invalid signature error" });
    }
    const parsedData = JSON.parse(data);
    if (stakingKey !== parsedData.stakingKey) {
      return res.status(400).json({ message: "Signature error - unparseable data" });
    }
    // check if stakingKey and error already in the DB
    const existingFailedInfo = await AgentErrorLogsModel.findOne({
      stakingKey,
      swarmBountyId,
      todoUUID,
      "errors.message": errorMessage,
    });
    if (existingFailedInfo) {
      res.status(200).json({ message: "Failed info already exists" });
      return;
    }
    await addErrorLog(stakingKey, swarmBountyId, errorMessage, todoUUID);
    res.status(200).json({ message: "Failed info added" });
  } catch (err) {
    console.error("Error in addErrorLogToDB:", err);
    res.status(500).json({ error: "Failed to add Error log to db" });
  }
};

export const addLogToDB = async (req: Request, res: Response) => {
  try {
    const { stakingKey, swarmBountyId, logMessage, logLevel, signature, todoUUID } = req.body;

    const { data, error } = await verifySignature(signature, stakingKey);
    if (error || !data) {
      console.log("signature error", error);
      return null;
    }
    const parsedData = JSON.parse(data);
    if (stakingKey !== parsedData.stakingKey) {
      return res.status(400).json({ message: "Signature error - unparseable data" });
    }

    // check if stakingKey and error already in the DB
    const existingFailedInfo = await AgentLogsModel.findOne({
      stakingKey,
      swarmBountyId,
      todoUUID: todoUUID,
      "logs.message": logMessage,
    });
    if (existingFailedInfo) {
      res.status(200).json({ message: "logMessage already exists" });
      return;
    }
    await addLog(stakingKey, swarmBountyId, logMessage, logLevel, todoUUID);
    res.status(200).json({ message: "logMessage added" });
  } catch (err) {
    console.error("Error in addLogToDB:", err);
    res.status(500).json({ error: "Failed to add logMessage" });
  }
};
