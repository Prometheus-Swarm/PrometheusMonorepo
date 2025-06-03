import { Request, Response } from "express";
import { BuilderErrorLogsModel } from "../../../models/BuilderErrorLogs";
import { BuilderLogsModel } from "../../../models/BuilderLogs";
import { verifySignature } from "../../../utils/sign";

export const addErrorLog = async (
  stakingKey: string,
  swarmBountyId: string,
  error: string,
  taskId: string,
  todoUUID: string,
) => {
  try {
    const builderErrorLogs = await BuilderErrorLogsModel.findOne({ stakingKey, swarmBountyId, todoUUID });
    if (builderErrorLogs) {
      builderErrorLogs.errors.push({ message: error, timestamp: new Date() });
      await builderErrorLogs.save();
    } else {
      const newBuilderErrorLogs = new BuilderErrorLogsModel({
        stakingKey,
        swarmBountyId,
        taskId,
        todoUUID,
        errors: [{ message: error, timestamp: new Date() }],
      });
      await newBuilderErrorLogs.save();
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
  taskId: string,
  todoUUID: string,
) => {
  try {
    const builderLogs = await BuilderLogsModel.findOne({ stakingKey, swarmBountyId, todoUUID });
    if (builderLogs) {
      builderLogs.logs.push({ level: logLevel, message: logMessage, timestamp: new Date() });
      await builderLogs.save();
    } else {
      const newBuilderLogs = new BuilderLogsModel({
        stakingKey,
        swarmBountyId,
        taskId,
        todoUUID,
        logs: [{ level: logLevel, message: logMessage, timestamp: new Date() }],
      });
      await newBuilderLogs.save();
    }
  } catch (err) {
    console.error("Error adding failed info:", err);
    throw err;
  }
};

export const addErrorLogToDB = async (req: Request, res: Response) => {
  try {
    const { stakingKey, error: errorMessage, signature } = req.body;
    let { swarmBountyId, todoUUID } = req.body;
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
    if (!todoUUID) {
      todoUUID = "Initial";
    }
    if (!swarmBountyId) {
      swarmBountyId = "Initial";
    }
    // check if stakingKey and error already in the DB
    const existingFailedInfo = await BuilderErrorLogsModel.findOne({
      stakingKey,
      "errors.message": errorMessage,
      todoUUID,
    });
    if (existingFailedInfo) {
      res.status(200).json({ message: "Failed info already exists" });
      return;
    }
    await addErrorLog(stakingKey, swarmBountyId, errorMessage, parsedData.taskId, todoUUID);
    res.status(200).json({ message: "Failed info added" });
  } catch (err) {
    console.error("Error in addErrorLogToDB:", err);
    res.status(500).json({ error: "Failed to add Error log to db" });
  }
};

export const addLogToDB = async (req: Request, res: Response) => {
  try {
    const { stakingKey, swarmBountyId, logMessage, logLevel, signature, todoUUID } = req.body;

    if (!todoUUID || !swarmBountyId) {
      return res.status(400).json({ message: "Missing todoUUID or swarmBountyId" });
    }
    // Verify Signature
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
    const existingFailedInfo = await BuilderLogsModel.findOne({
      stakingKey,
      "logs.message": logMessage,
      todoUUID,
    });
    if (existingFailedInfo) {
      res.status(200).json({ message: "logMessage already exists" });
      return;
    }
    await addLog(stakingKey, swarmBountyId, logMessage, logLevel, parsedData.taskId, todoUUID);
    res.status(200).json({ message: "logMessage added" });
  } catch (err) {
    console.error("Error in addLogToDB:", err);
    res.status(500).json({ error: "Failed to add logMessage" });
  }
};
