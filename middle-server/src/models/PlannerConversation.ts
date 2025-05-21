import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class PlannerConversation {
  @prop({ required: true, index: true })
  public bounty_id!: string;

  @prop()
  public content?: string;

  @prop({ type: () => [String], default: [] })
  public tools?: string[];
}

export const PlannerConversationModel = getModelForClass(PlannerConversation, {
  existingConnection: builder247DB,
});
