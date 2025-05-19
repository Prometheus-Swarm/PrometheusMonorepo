import { getModelForClass, prop, modelOptions, Severity } from "@typegoose/typegoose";
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
class TaskRoundTime {
  @prop({ required: true })
  public taskId!: string;

  @prop({ required: true })
  public roundTimeInMS!: number;
}

const TaskRoundTimeModel = getModelForClass(TaskRoundTime);
export { TaskRoundTime, TaskRoundTimeModel };
