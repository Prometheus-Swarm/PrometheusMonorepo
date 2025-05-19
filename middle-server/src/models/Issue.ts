import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";
import { SwarmBountyType } from "../config/constant";
enum IssueStatus {
  INITIALIZED = "initialized",
  AGGREGATOR_PENDING = "aggregator_pending",
  IN_PROGRESS = "in_progress",
  ASSIGN_PENDING = "assign_pending", // Awaiting assignment to a leader node
  ASSIGNED = "assigned", // Assigned to a leader node
  IN_REVIEW = "in_review", // The PR is opened and waiting for review
  APPROVED = "approved", // The PR passed audit and appeared on the distribution list
  SUBMITTED = "submitted", // The PR has been submitted to the source repository
  MERGED = "merged", // The PR is merged (must be done manually by bounty owner)
  FAILED = "failed", // Issue has failed after maximum retries
}

class AssignedInfo {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: true })
  public githubUsername!: string;
  @prop({ required: true })
  public roundNumber!: number;

  @prop({ required: false })
  public approved?: boolean;

  @prop({ required: false })
  public failedAuditReason?: string;

  @prop({ required: false })
  public failedAuditFeedback?: string;

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
class Issue {
  @prop({ required: true })
  public uuid!: string;

  @prop({ required: false })
  public title?: string;

  @prop({ required: false })
  public description?: string;

  @prop({ required: false, enum: SwarmBountyType })
  public bountyType?: SwarmBountyType;

  @prop({ required: true })
  public repoOwner!: string;

  @prop({ required: false })
  public bountyId?: string;

  @prop({ required: true })
  public repoName!: string;

  @prop({ required: false })
  public aggregatorOwner?: string;

  @prop({ required: false })
  public aggregatorUrl?: string;

  @prop({ required: false })
  public forkOwner?: string;

  @prop({ required: false })
  public forkUrl?: string;
  @prop({ required: false })
  public assignees?: AssignedInfo[];

  @prop({ required: true, enum: IssueStatus, default: IssueStatus.INITIALIZED })
  public status!: IssueStatus;

  @prop({ required: false })
  public predecessorUuid?: string; // UUID of the immediately previous issue in the chain
}

const IssueModel = getModelForClass(Issue);
export { Issue, IssueModel, IssueStatus, AssignedInfo };
