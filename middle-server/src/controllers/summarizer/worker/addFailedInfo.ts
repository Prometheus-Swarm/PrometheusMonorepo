import { Request, Response } from "express";
import { DocumentationErrorLogsModel } from "../../../models/DocumentationErrorLogs";

export const addFailedInfo = async (stakingKey: string, swarmBountyId: string, error: string) => {
  try {
    const documentationErrorLogs = await DocumentationErrorLogsModel.findOne({ stakingKey, swarmBountyId });
    if (documentationErrorLogs) {
      documentationErrorLogs.error.push(error);
      await documentationErrorLogs.save();
    } else {
      const newDocumentationErrorLogs = new DocumentationErrorLogsModel({ stakingKey, swarmBountyId, error: [error] });
      await newDocumentationErrorLogs.save();
    }
  } catch (err) {
    console.error("Error adding failed info:", err);
    throw err;
  }
};

export const addFailedInfoRequest = async (req: Request, res: Response) => {
  try {
    const { stakingKey, swarmBountyId, error } = req.body;
    // check if stakingKey and error already in the DB
    const existingFailedInfo = await DocumentationErrorLogsModel.findOne({ stakingKey, error });
    if (existingFailedInfo) {
      res.status(200).json({ message: "Failed info already exists" });
      return;
    }

    await addFailedInfo(stakingKey, swarmBountyId, error);
    res.status(200).json({ message: "Failed info added" });
  } catch (err) {
    console.error("Error in addFailedInfoRequest:", err);
    res.status(500).json({ error: "Failed to add error information" });
  }
};
