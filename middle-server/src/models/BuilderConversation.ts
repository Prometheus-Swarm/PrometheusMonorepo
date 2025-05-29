import { prop, getModelForClass, modelOptions } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

@modelOptions({
  schemaOptions: {
    timestamps: true,
  },
})
export class BuilderConversation {
  @prop({ required: true, index: true })
  public bounty_id!: string;

  @prop()
  public content?: string;

  @prop({ type: () => [String], default: [] })
  public tools?: string[];

  @prop({ required: true })
  public githubUsername!: string;

  @prop({ required: true })
  public todoUUID!: string;

  @prop({ required: true, enum: ["todo", "issue"] })
  public taskType!: "todo" | "issue";

  @prop({ required: true, enum: ["task", "audit"] })
  public taskStage!: "task" | "audit";

  @prop({ required: false })
  public prUrl?: string;
}

export const BuilderConversationModel = getModelForClass(BuilderConversation, {
  existingConnection: builder247DB,
});
