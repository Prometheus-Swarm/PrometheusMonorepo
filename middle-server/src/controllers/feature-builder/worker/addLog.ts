import { Request, Response } from "express";
import { BugFinderErrorLogsModel } from "../../../models/BugFinderErrorLogs";
import { BugFinderLogsModel } from "../../../models/BugFinderLogs";
import { verifySignature } from "../../../utils/sign";

export const addErrorLog = async (stakingKey: string, swarmBountyId: string, error: string) => {
  try {
    const bugFinderErrorLogs = await BugFinderErrorLogsModel.findOne({ stakingKey, swarmBountyId });
    if (bugFinderErrorLogs) {
      bugFinderErrorLogs.errors.push({ message: error, timestamp: new Date() });
      await bugFinderErrorLogs.save();
    } else {
      const newBugFinderErrorLogs = new BugFinderErrorLogsModel({
        stakingKey,
        swarmBountyId,
        errors: [{ message: error, timestamp: new Date() }],
      });
      await newBugFinderErrorLogs.save();
    }
  } catch (err) {
    console.error("Error adding failed info:", err);
    throw err;
  }
};

export const addLog = async (stakingKey: string, swarmBountyId: string, logMessage: string, logLevel: string) => {
  try {
    const bugFinderLogs = await BugFinderLogsModel.findOne({ stakingKey, swarmBountyId });
    if (bugFinderLogs) {
      bugFinderLogs.logs.push({ level: logLevel, message: logMessage, timestamp: new Date() });
      await bugFinderLogs.save();
    } else {
      const newBugFinderLogs = new BugFinderLogsModel({
        stakingKey,
        swarmBountyId,
        logs: [{ level: logLevel, message: logMessage, timestamp: new Date() }],
      });
      await newBugFinderLogs.save();
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
    const existingFailedInfo = await BugFinderErrorLogsModel.findOne({
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
    // const { data, error } = await verifySignature(signature, stakingKey);
    // if (error || !data) {
    //   console.log("signature error", error);
    //   return null;
    // }
    // const parsedData = JSON.parse(data);
    // if (stakingKey !== parsedData.stakingKey) {
    //   return res.status(400).json({ message: "Signature error - unparseable data" });
    // }

    // check if stakingKey and error already in the DB
    const existingFailedInfo = await BugFinderLogsModel.findOne({
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
