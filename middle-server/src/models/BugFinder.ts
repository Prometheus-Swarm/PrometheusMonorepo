import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";
class AssignedInfo {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: true })
  public taskId!: string;

  @prop({ required: false })
  public githubUsername?: string;

  @prop({ required: false })
  public roundNumber?: number;

  @prop({ required: false })
  public prUrl?: string;

  @prop({ required: false })
  public auditResult?: boolean;
}

enum BugFinderStatus {
  INITIALIZED = "initialized",
  IN_PROGRESS = "in_progress",
  PR_RECEIVED = "pr_received",
  IN_REVIEW = "in_review",
  DONE = "done",
  FAILED = "failed",
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
class BugFinder {
  @prop({ required: true })
  public repoOwner!: string;

  @prop({ required: true })
  public repoName!: string;

  @prop({ required: true })
  public swarmBountyId!: string;

  @prop({ required: false })
  public taskId?: string;

  @prop({ required: false })
  public stakingKey?: string;

  @prop({ required: false })
  public roundNumber?: number;

  @prop({ type: () => [AssignedInfo], default: [] })
  public assignedTo!: AssignedInfo[];

  @prop({
    enum: BugFinderStatus,
    default: BugFinderStatus.INITIALIZED,
    required: true,
  })
  public status!: BugFinderStatus;
}

const BugFinderModel = getModelForClass(BugFinder);
export { BugFinder, BugFinderModel, BugFinderStatus, AssignedInfo };
