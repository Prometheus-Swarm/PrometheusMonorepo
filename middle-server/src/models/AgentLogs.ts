import { prop, getModelForClass, modelOptions, Severity } from "@typegoose/typegoose";
import { builder247DB } from "../services/database/database";

class LogEntry {
  @prop({ required: true })
  public level!: string; // e.g., "info", "error", "warning"

  @prop({ required: true })
  public message!: string;

  @prop({ required: true, default: () => new Date() })
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
class AgentLogs {
  @prop({ required: true })
  public stakingKey!: string;

  @prop({ required: true })
  public swarmBountyId!: string;

  @prop({ required: true })
  public todoUUID!: string;

  @prop({ type: () => [LogEntry], default: [] })
  public logs!: LogEntry[];
}

const AgentLogsModel = getModelForClass(AgentLogs);
export { AgentLogs, AgentLogsModel};
