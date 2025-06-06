import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";
import { SwarmBountyType } from "../config/constant";

export enum DocumentationStatus {
  INITIALIZED = "initialized",
  IN_PROGRESS = "in_progress",
  DRAFT_PR_RECEIVED = "draft_pr_received",
  PR_RECEIVED = "pr_received",
  IN_REVIEW = "in_review",
  DONE = "done",
  FAILED = "failed",
}

enum TodoStatus {
  INITIALIZED = "initialized", // Not yet assigned to a node. Reset to this if anything goes wrong
  IN_PROGRESS = "in_progress", // Is assigned to a node, not completed
  IN_REVIEW = "in_review", // PR has been submitted but no audit yet
  APPROVED = "approved", // PR passed audit and appeared on the distribution list
  MERGED = "merged", // PR is merged by leader node
  FAILED = "failed", // Task has failed after maximum retries
}

class PhaseData {
  @prop({ required: true })
  public prompt!: string;

  @prop({ required: true, type: () => [String] })
  public tools!: string[];
}

class AssignedInfo {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: true })
  public githubUsername!: string;

  @prop({ required: true })
  public roundNumber!: number;

  @prop({ required: true })
  public taskId!: string;

  @prop({ required: false })
  public approved?: boolean;

  @prop({ required: false })
  public failedReason?: string;

  @prop({ required: false })
  public failedFeedback?: string;

  @prop({ required: false })
  public prUrl?: string;

  @prop({ default: true })
  public isFinal!: boolean;
}

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
  existingConnection: builder247DB,
})
class Todo {
  @prop({ required: false, enum: SwarmBountyType })
  public bountyType?: SwarmBountyType;

  @prop({ required: false })
  public title?: string;

  @prop({ required: false })
  public description?: string;

  @prop({ required: true })
  public uuid!: string;

  @prop({ required: false })
  public bountyId?: string;

  @prop({ required: true })
  public issueUuid!: string;

  @prop({ required: true, type: () => [String] })
  public acceptanceCriteria!: string[];

  @prop({ required: true })
  public repoOwner!: string;

  @prop({ required: true })
  public repoName!: string;

  @prop({ type: () => [String], default: [] })
  public dependencyTasks!: string[];

  @prop({ required: false })
  public assignees?: AssignedInfo[];

  @prop({ required: true, type: () => [PhaseData] })
  public phasesData?: PhaseData[];

  @prop({
    type: String,
    enum: [...Object.values(TodoStatus), ...Object.values(DocumentationStatus)],
    default: TodoStatus.INITIALIZED,
    required: true,
  })
  public status!: TodoStatus | DocumentationStatus;
}

const TodoModel = getModelForClass(Todo);
export { Todo, TodoModel, TodoStatus };
