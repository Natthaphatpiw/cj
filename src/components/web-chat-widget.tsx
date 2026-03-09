"use client";

import Image from "next/image";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Locale = "th" | "en";
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type SessionGateResponse = {
  ok: boolean;
  allowed: boolean;
  limit: number;
  usedConversations: number;
};

type WebChatWidgetProps = {
  locale: Locale;
  lineOaUrl: string;
};

type PersistedWidgetState = {
  visitorId: string;
  conversationId: string;
  isOpen: boolean;
  isLimitReached: boolean;
  messages: ChatMessage[];
  usedConversations: number;
  conversationLimit: number;
};

const STORAGE_KEY = "chordjai-web-chat-v1";

const copy = {
  th: {
    title: "คุยกับ ChordJai",
    subtitle: "ทดลองได้ 2 บทสนทนา",
    newChat: "แชทใหม่",
    close: "ปิด",
    open: "เปิดแชท",
    placeholder: "พิมพ์ความรู้สึกหรือสิ่งที่อยากคุยได้เลย",
    send: "ส่ง",
    typing: "ChordJai กำลังพิมพ์...",
    welcome: "สวัสดีครับ ผมอยู่ตรงนี้เพื่อรับฟังคุณ ลองพิมพ์สิ่งที่อยู่ในใจได้เลย",
    secondSession: "เริ่มบทสนทนาใหม่ได้เลยครับ ผมพร้อมฟังคุณเสมอ",
    limited:
      "คุณทดลองครบ 2 บทสนทนาแล้วครับ หากอยากคุยต่อแบบเต็มรูปแบบ เชิญมาเจอกันใน LINE OA ได้เลย",
    lineHeading: "คุยต่อใน LINE OA",
    lineBody: "สแกน QR หรือกดปุ่มด้านล่างเพื่อเพิ่มเพื่อนและคุยต่อได้ทันที",
    lineButton: "เพิ่มเพื่อน LINE OA",
    notes: "สำหรับทดลองใช้งานบนเว็บไซต์เท่านั้น",
    remaining: (count: number) => `บทสนทนาที่เหลือ: ${count}`
  },
  en: {
    title: "Chat with ChordJai",
    subtitle: "2 trial conversations",
    newChat: "New Chat",
    close: "Close",
    open: "Open chat",
    placeholder: "Share what you are feeling right now",
    send: "Send",
    typing: "ChordJai is typing...",
    welcome: "Hi, I am here with you. You can start by sharing what is on your mind.",
    secondSession: "Your new chat is ready. I am here to listen.",
    limited:
      "You have used all 2 trial conversations. Continue in LINE OA for full support and ongoing chat.",
    lineHeading: "Continue in LINE OA",
    lineBody: "Scan the QR code or tap the button below to continue your conversation.",
    lineButton: "Add LINE OA",
    notes: "Website chat is for trial only",
    remaining: (count: number) => `Conversations left: ${count}`
  }
} as const;

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function makeWelcomeMessage(locale: Locale, useSecondSessionCopy = false): ChatMessage {
  return {
    id: createId("msg"),
    role: "assistant",
    text: useSecondSessionCopy ? copy[locale].secondSession : copy[locale].welcome
  };
}

function makeLimitedMessage(locale: Locale): ChatMessage {
  return {
    id: createId("msg"),
    role: "assistant",
    text: copy[locale].limited
  };
}

function parseStoredState(raw: string | null): PersistedWidgetState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedWidgetState;
    if (!parsed.visitorId || !parsed.conversationId || !Array.isArray(parsed.messages)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fetchTrialStatus(visitorId: string) {
  const response = await fetch("/api/web-chat/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visitorId
    })
  });

  if (!response.ok) {
    throw new Error(`session_register_failed_${response.status}`);
  }

  const data = (await response.json()) as SessionGateResponse;
  if (!data.ok) {
    throw new Error("session_register_invalid_response");
  }
  return data;
}

export default function WebChatWidget(props: WebChatWidgetProps) {
  const { locale, lineOaUrl } = props;
  const t = copy[locale];

  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [visitorId, setVisitorId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [usedConversations, setUsedConversations] = useState(0);
  const [conversationLimit, setConversationLimit] = useState(2);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const remainingConversations = useMemo(
    () => Math.max(0, conversationLimit - usedConversations),
    [conversationLimit, usedConversations]
  );

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
      const nextVisitorId = stored?.visitorId ?? createId("visitor");
      const nextConversationId = stored?.conversationId ?? createId("conversation");

      if (!mounted) {
        return;
      }

      setVisitorId(nextVisitorId);
      setConversationId(nextConversationId);
      setIsOpen(stored?.isOpen ?? true);
      setMessages(stored?.messages?.length ? stored.messages : [makeWelcomeMessage(locale)]);
      setUsedConversations(stored?.usedConversations ?? 0);
      setConversationLimit(stored?.conversationLimit ?? 2);
      setIsLimitReached(stored?.isLimitReached ?? false);

      try {
        const gate = await fetchTrialStatus(nextVisitorId);
        if (!mounted) {
          return;
        }

        setUsedConversations(gate.usedConversations);
        setConversationLimit(gate.limit);
        if (!gate.allowed) {
          setIsLimitReached(true);
          setMessages([makeLimitedMessage(locale)]);
        }
      } catch {
        if (!mounted) {
          return;
        }
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    }

    void initialize();
    return () => {
      mounted = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const payload: PersistedWidgetState = {
      visitorId,
      conversationId,
      isOpen,
      isLimitReached,
      messages,
      usedConversations,
      conversationLimit
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [conversationId, conversationLimit, isLimitReached, isOpen, isReady, messages, usedConversations, visitorId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending, isLimitReached, isOpen]);

  async function handleSendMessage() {
    const content = draft.trim();
    if (!content || isSending || !visitorId || !conversationId || isLimitReached) {
      return;
    }

    const outgoing: ChatMessage = {
      id: createId("msg"),
      role: "user",
      text: content
    };

    setDraft("");
    setMessages((prev) => [...prev, outgoing]);
    setIsSending(true);

    try {
      const response = await fetch("/api/web-chat/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId,
          conversationId,
          locale,
          message: content
        })
      });

      const data = (await response.json()) as {
        ok: boolean;
        limited?: boolean;
        reply?: string;
        message?: string;
        usedConversations?: number;
        conversationLimit?: number;
      };

      if (!response.ok || !data.ok) {
        const fallback = data.message ?? (locale === "en" ? "Temporary error. Please try again." : "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ");
        setMessages((prev) => [
          ...prev,
          {
            id: createId("msg"),
            role: "assistant",
            text: fallback
          }
        ]);
        return;
      }

      if (data.limited) {
        setIsLimitReached(true);
        setMessages((prev) => [...prev, makeLimitedMessage(locale)]);
        return;
      }

      if (typeof data.usedConversations === "number") {
        setUsedConversations(data.usedConversations);
      }
      if (typeof data.conversationLimit === "number") {
        setConversationLimit(data.conversationLimit);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createId("msg"),
          role: "assistant",
          text: data.reply ?? (locale === "en" ? "I am here with you." : "ผมอยู่ตรงนี้กับคุณเสมอ")
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createId("msg"),
          role: "assistant",
          text: locale === "en" ? "Temporary error. Please try again." : "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ"
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleStartNewChat() {
    if (isSending || !visitorId) {
      return;
    }

    const nextConversationId = createId("conversation");

    try {
      const gate = await fetchTrialStatus(visitorId);
      setConversationLimit(gate.limit);
      setUsedConversations(gate.usedConversations);

      if (!gate.allowed) {
        setIsLimitReached(true);
        setMessages([makeLimitedMessage(locale)]);
        setDraft("");
        return;
      }

      setConversationId(nextConversationId);
      setIsLimitReached(false);
      setDraft("");
      setMessages([makeWelcomeMessage(locale, true)]);
      setIsOpen(true);
    } catch {
      setConversationId(nextConversationId);
      setIsLimitReached(false);
      setDraft("");
      setMessages([makeWelcomeMessage(locale, true)]);
      setIsOpen(true);
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  if (!isReady) {
    return null;
  }

  return (
    <div className="web-chat-widget" aria-live="polite">
      {isOpen ? (
        <section className="web-chat-panel" role="dialog" aria-label={t.title}>
          <header className="web-chat-head">
            <div className="web-chat-brand">
              <Image src="/assets/logo.png" alt="ChordJai" width={28} height={28} />
              <div>
                <p>{t.title}</p>
                <span>{t.subtitle}</span>
              </div>
            </div>
            <div className="web-chat-actions">
              <button type="button" className="web-chat-new-btn" onClick={() => void handleStartNewChat()}>
                {t.newChat}
              </button>
              <button type="button" className="web-chat-close-btn" onClick={() => setIsOpen(false)} aria-label={t.close}>
                ×
              </button>
            </div>
          </header>

          <div className="web-chat-meta">{t.remaining(remainingConversations)}</div>

          <div className="web-chat-body">
            {messages.map((message) => (
              <article key={message.id} className={`web-chat-bubble ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                <p>{message.text}</p>
              </article>
            ))}

            {isSending ? (
              <div className="web-chat-typing" role="status" aria-live="polite" aria-label={t.typing}>
                <span className="web-chat-typing-dot" />
                <span className="web-chat-typing-dot" />
                <span className="web-chat-typing-dot" />
              </div>
            ) : null}

            {isLimitReached ? (
              <aside className="web-chat-line-card">
                <h4>{t.lineHeading}</h4>
                <p>{t.lineBody}</p>
                <Image src="/assets/line-oa-qr.png" alt="LINE OA QR code" width={132} height={132} />
                <a href={lineOaUrl} target="_blank" rel="noreferrer">
                  {t.lineButton}
                </a>
                <p className="web-chat-line-url">{lineOaUrl}</p>
              </aside>
            ) : null}

            <div ref={endRef} />
          </div>

          <footer className="web-chat-compose">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t.placeholder}
              disabled={isSending || isLimitReached}
              rows={2}
            />
            <button type="button" onClick={() => void handleSendMessage()} disabled={isSending || isLimitReached || !draft.trim()}>
              {t.send}
            </button>
          </footer>
          <p className="web-chat-note">{t.notes}</p>
        </section>
      ) : null}

      <button
        type="button"
        className={`web-chat-fab ${isOpen ? "is-hidden" : ""}`}
        onClick={() => setIsOpen(true)}
        aria-label={t.open}
      >
        <Image src="/assets/logo.png" alt="Open chat" width={30} height={30} />
      </button>
    </div>
  );
}
