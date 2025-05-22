import { Request, Response } from "express";
import { BuilderErrorLogsModel } from "../../../models/BuilderErrorLogs";
import { BuilderLogsModel } from "../../../models/BuilderLogs";
import { verifySignature } from "../../../utils/sign";

export const addErrorLog = async (stakingKey: string, swarmBountyId: string, error: string) => {
  try {
    const builderErrorLogs = await BuilderErrorLogsModel.findOne({ stakingKey, swarmBountyId });
    if (builderErrorLogs) {
      builderErrorLogs.errors.push({ message: error, timestamp: new Date() });
      await builderErrorLogs.save();
    } else {
      const newBuilderErrorLogs = new BuilderErrorLogsModel({
        stakingKey,
        swarmBountyId,
        errors: [{ message: error, timestamp: new Date() }],
      });
      await newBuilderErrorLogs.save();
    }
  } catch (err) {
    console.error("Error adding failed info:", err);
    throw err;
  }
};

export const addLog = async (stakingKey: string, swarmBountyId: string, logMessage: string, logLevel: string) => {
  try {
    const builderLogs = await BuilderLogsModel.findOne({ stakingKey, swarmBountyId });
    if (builderLogs) {
      builderLogs.logs.push({ level: logLevel, message: logMessage, timestamp: new Date() });
      await builderLogs.save();
    } else {
      const newBuilderLogs = new BuilderLogsModel({
        stakingKey,
        swarmBountyId,
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
    const { stakingKey, swarmBountyId, error: errorMessage, signature } = req.body;

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
    const existingFailedInfo = await BuilderErrorLogsModel.findOne({
      stakingKey,
      "errors.message": errorMessage,
    });
    if (existingFailedInfo) {
      res.status(200).json({ message: "Failed info already exists" });
      return;
    }
    await addErrorLog(stakingKey, swarmBountyId, errorMessage);
    res.status(200).json({ message: "Failed info added" });
  } catch (err) {
    console.error("Error in addErrorLogToDB:", err);
    res.status(500).json({ error: "Failed to add Error log to db" });
  }
};

export const addLogToDB = async (req: Request, res: Response) => {
  try {
    const { stakingKey, swarmBountyId, logMessage, logLevel, signature } = req.body;

    console.log("addLogToDB", { stakingKey, swarmBountyId, logMessage, logLevel, signature });
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
    });
    if (existingFailedInfo) {
      res.status(200).json({ message: "logMessage already exists" });
      return;
    }
    await addLog(stakingKey, swarmBountyId, logMessage, logLevel);
    res.status(200).json({ message: "logMessage added" });
  } catch (err) {
    console.error("Error in addLogToDB:", err);
    res.status(500).json({ error: "Failed to add logMessage" });
  }
};
