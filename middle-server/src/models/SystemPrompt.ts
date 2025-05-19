import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";
import { SwarmBountyType } from "../config/constant";
@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
  existingConnection: builder247DB,
})
class SystemPrompt {
  @prop({ required: true, unique: true })
  public bountyId!: string;

  @prop({ required: false, enum: SwarmBountyType })
  public bountyType?: SwarmBountyType;

  @prop({ required: true })
  public prompt!: string;
}

const SystemPromptModel = getModelForClass(SystemPrompt);
export { SystemPrompt, SystemPromptModel };
