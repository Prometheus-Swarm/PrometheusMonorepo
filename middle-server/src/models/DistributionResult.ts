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
class DistributionResult {
  @prop({ required: true })
  public taskId!: string;

  @prop({ required: true })
  public round!: number;

  @prop({ required: true })
  public positiveKeys!: string[];

  @prop({ required: true })
  public negativeKeys!: string[];
}

const DistributionResultModel = getModelForClass(DistributionResult);
export { DistributionResult, DistributionResultModel };
