import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

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
class DocumentationErrorLogs {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: true })
  public swarmBountyId!: string;

  @prop({ required: true })
  public error!: string[];
}

const DocumentationErrorLogsModel = getModelForClass(DocumentationErrorLogs);
export { DocumentationErrorLogs, DocumentationErrorLogsModel };
