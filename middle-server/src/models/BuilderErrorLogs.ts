import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

class ErrorEntry {
  @prop({ required: true })
  public message!: string;

  @prop({ required: false, default: () => new Date() })
  public timestamp!: Date;
}
@modelOptions({
  schemaOptions: {
    timestamps: true,
    expireAfterSeconds: 86400, // 24 hours in seconds
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
  existingConnection: builder247DB,
})
class BuilderErrorLogs {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: false })
  public swarmBountyId?: string;

  @prop({ required: true })
  public taskId!: string;

  @prop({ required: true })
  public todoUUID!: string;

  @prop({ type: () => [ErrorEntry], default: [] })
  public errors!: ErrorEntry[];
}

const BuilderErrorLogsModel = getModelForClass(BuilderErrorLogs);
export { BuilderErrorLogs, BuilderErrorLogsModel };
