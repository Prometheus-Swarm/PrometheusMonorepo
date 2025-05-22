import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

class StarFollowAssignedInfo {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: true })
  public githubUsername!: string;

  @prop({ required: true })
  public assignedAt!: Date;
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
class StarFollow {
  @prop({ required: true })
  public repoOwner!: string;

  @prop({ required: true })
  public repoName!: string;

  @prop({ type: () => [StarFollowAssignedInfo], default: [] })
  public assignedTo!: StarFollowAssignedInfo[];

  @prop({ required: false })
  public status?: string; // Could be used to track if the repo is still active/valid
}

const StarFollowModel = getModelForClass(StarFollow);
export { StarFollow, StarFollowModel, StarFollowAssignedInfo };
