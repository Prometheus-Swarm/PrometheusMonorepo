import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

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

  @prop({ type: () => [AssignedInfo], default: [] })
  public assignedTo!: AssignedInfo[];
}

class AssignedInfo {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: false })
  public githubUsername?: string;
}

const StarFollowModel = getModelForClass(StarFollow);
export { StarFollow, StarFollowModel };
