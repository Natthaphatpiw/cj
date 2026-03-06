export type RiskLevel = "low" | "medium" | "high" | "imminent";

export type SessionStatus =
  | "active"
  | "dormant"
  | "closed"
  | "escalated"
  | "crisis_locked";

export type Role = "user" | "assistant" | "system";

export type ResponseMode =
  | "gentle_short"
  | "reflective_listener"
  | "grounding_coach"
  | "psychoeducation_light"
  | "crisis_mode";

export type TopicDecision = {
  isNewTopic: boolean;
  confidence: number;
  topicLabel: string;
  relationToPrevious: "same" | "shift" | "reopen";
  shouldOpenNewSession: boolean;
  shouldReopenPriorSessionId?: string;
  needsUserConfirmation: boolean;
  reason: string;
};

export type SafetyPrecheckResult = {
  riskLevel: RiskLevel;
  confidence: number;
  reasonCodes: string[];
  requiresCrisisProtocol: boolean;
  requiresHumanHandoff: boolean;
};

export type ResponsePlan = {
  mode: ResponseMode;
  riskLevel: RiskLevel;
  topic: string;
  needsHandoff: boolean;
  shouldScheduleFollowup: boolean;
  followupDelayHours?: number;
  memoryCandidate?: {
    type: "preference" | "stable_fact" | "support_pattern";
    content: string;
    sensitivity: "low" | "medium" | "high";
  };
  messageDraft: string;
};

export type MemoryWriteDecision = {
  shouldWrite: boolean;
  memoryType?: string;
  content?: string;
  sensitivity?: "low" | "medium" | "high";
  retentionDays?: number;
  reason: string;
};
