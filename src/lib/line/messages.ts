import type { LineMessage } from "@/lib/line/types";

export function buildTopicConfirmationMessage(text: string): LineMessage {
  return {
    type: "text",
    text,
    quickReply: {
      items: [
        {
          type: "action",
          action: {
            type: "postback",
            label: "เปิดหัวข้อใหม่",
            data: "action=new_topic",
            displayText: "เปิดหัวข้อใหม่"
          }
        },
        {
          type: "action",
          action: {
            type: "postback",
            label: "คุยต่อเรื่องเดิม",
            data: "action=continue_topic",
            displayText: "คุยต่อเรื่องเดิม"
          }
        }
      ]
    }
  };
}

export function buildMainMenuQuickReply(text: string): LineMessage {
  return {
    type: "text",
    text,
    quickReply: {
      items: [
        {
          type: "action",
          action: {
            type: "message",
            label: "เริ่มเรื่องใหม่",
            text: "เริ่มเรื่องใหม่"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "เช็กอารมณ์วันนี้",
            text: "เช็กอารมณ์วันนี้"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "แบบฝึกหายใจ 3 นาที",
            text: "แบบฝึกหายใจ 3 นาที"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "ขอคุยกับคนจริง",
            text: "ขอคุยกับคนจริง"
          }
        }
      ]
    }
  };
}
