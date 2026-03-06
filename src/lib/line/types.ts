export type LineWebhookPayload = {
  destination: string;
  events: LineWebhookEvent[];
};

export type LineWebhookEvent = {
  type: string;
  mode?: string;
  timestamp: number;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery?: boolean;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: "text" | "image" | "video" | "audio" | "file" | "sticker" | "location";
    text?: string;
  };
  postback?: {
    data: string;
  };
};

export type LineTextMessage = {
  type: "text";
  text: string;
  quickReply?: {
    items: Array<{
      type: "action";
      action:
        | {
            type: "message";
            label: string;
            text: string;
          }
        | {
            type: "postback";
            label: string;
            data: string;
            displayText?: string;
          };
    }>;
  };
};

export type LineMessage = LineTextMessage;
