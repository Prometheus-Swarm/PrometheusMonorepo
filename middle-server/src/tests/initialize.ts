import { Request, Response } from "express";
import { TodoModel, TodoStatus } from "../models/Todo";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { IssueStatus } from "../models/Issue";
import { IssueModel } from "../models/Issue";

dotenv.config();
// @ this is a testing only endpoint
export const createTodo = async (req: Request, res: Response) => {
  const { acceptanceCriteria, repoOwner, repoName, phasesData } = req.body;
  const todo = new TodoModel({
    acceptanceCriteria,
    repoOwner,
    repoName,
    phasesData,
  });
  await todo.save();
  res.status(201).json({ todo });
};

export const insertMultipleExampleTodos = async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
  for (let i = 0; i < 10; i++) {
    const exampleTodo = new TodoModel({
      uuid: `123e4567-e89b-12d3-a456-426614174000${i}`,
      issueUuid: `456e7890-e12b-34d5-f678-526614174111`,
      acceptanceCriteria: ["The feature should be fully functional and pass all tests."],
      repoOwner: "exampleOwner",
      repoName: "exampleRepo",
      dependencyTasks: ["123e4567-e89b-12d3-a456-4266141740001"],
      status: TodoStatus.INITIALIZED,
      phasesData: [
        {
          prompt: "Implement new feature",
          tools: ["read_file", "list_files"],
        },
      ],
    });
    await exampleTodo.save();
  }
  const exampleIssue = new IssueModel({
    issueUuid: `456e7890-e12b-34d5-f678-526614174111`,
    status: IssueStatus.INITIALIZED,
    description: "This task involves implementing a new feature in the application.",
    repoOwner: "exampleOwner",
    repoName: "exampleRepo",
    assignedTo: [],
  });
  await exampleIssue.save();
  console.log("Example todos inserted");
};

insertMultipleExampleTodos();
