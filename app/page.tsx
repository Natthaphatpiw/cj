"use client";

import Image from "next/image";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

type Locale = "th" | "en";

type Review = {
  topic: string;
  quote: string;
  author: string;
  meta: string;
};

const lineOaUrl = "https://lin.ee/szxBokM";

const content = {
  th: {
    languageButton: "EN",
    nav: ["บริการ", "รีวิว", "รีซอร์ส", "เกี่ยวกับเรา"],
    hero: {
      title: "ChordJai - กอดใจ\nเซฟโซนที่อยู่ข้างคุณ 24 ชั่วโมง",
      description:
        "เพื่อนคุยดูแลใจบน LINE OA ที่รับฟังทุกเรื่องอย่างอ่อนโยน ปลอดภัย และต่อเนื่องในทุกวันของคุณ",
      quote: "วันที่ใจไม่ไหว คุณไม่ต้องอยู่คนเดียว",
      primaryButton: "เริ่มคุยตอนนี้",
      secondaryButton: "ดูบริการ"
    },
    tickerMessages: [
      "วันนี้เหนื่อยมาก แต่อยากมีคนรับฟังสักคน",
      "นอนไม่หลับหลายคืนแล้ว ขอมาคุยหน่อย",
      "รู้สึกกังวลจนหายใจไม่ทั่วท้อง",
      "วันนี้รู้สึกดีขึ้น ขอบคุณที่อยู่ข้างๆ",
      "อยากได้กำลังใจเบาๆ ก่อนเริ่มวันใหม่",
      "มีเรื่องในใจเยอะมาก ขอคุยต่อได้ไหม",
      "ไม่รู้จะเริ่มเล่าตรงไหน แต่ขอเริ่มจากตรงนี้",
      "วันนี้แค่ได้คุยก็รู้สึกอุ่นใจขึ้น",
      "อยากให้มีคนคอยเช็กใจแบบพอดี",
      "ขอบคุณที่ไม่ตัดสินและฟังกันจริงๆ"
    ],
    impact: {
      title: "ไม่ต้องเก่งตลอดเวลา",
      subtitle: "ChordJai ออกแบบมาเพื่อคนที่อยากมีพื้นที่ปลอดภัยในการคุย ระบาย และค่อยๆ กลับมาดูแลใจตัวเอง",
      bullets: [
        "คุยได้ทุกเวลาแบบเป็นส่วนตัว",
        "ภาษาธรรมชาติ ไม่แข็ง ไม่ตัดสิน",
        "เช็กอินพอดี ช่วยต่อบทสนทนาได้จริง"
      ],
      button: "เพิ่มเพื่อน LINE OA"
    },
    solutions: {
      title: "ดูแลใจครบทั้งระบบ",
      subtitle: "ตั้งแต่รับฟังความรู้สึก ไปจนถึงช่วยวางแผนก้าวแรกที่ทำได้ทันที",
      cards: [
        {
          symbol: "24",
          title: "เพื่อนคุยตลอด 24 ชั่วโมง",
          description: "พร้อมรับฟังเสมอเมื่อใจแกว่งหรืออยากมีคนอยู่ข้างๆ",
          points: ["ตอบกลับเร็ว", "คุยได้ทันทีบน LINE", "ไม่ต้องเริ่มใหม่ทุกครั้ง"]
        },
        {
          symbol: "AI",
          title: "AI ที่คุยแล้วรู้สึกเป็นมนุษย์",
          description: "โทนการตอบอ่อนโยน ชวนคุยต่ออย่างพอดี และช่วยลดกำแพงใจ",
          points: ["ถามต่อแบบเข้าใจ", "ไม่ตัดสิน", "ช่วยจัดความคิดทีละขั้น"]
        },
        {
          symbol: "SAFE",
          title: "Safe Layer ในทุกข้อความ",
          description: "ทุกคำตอบผ่านกติกาความปลอดภัยก่อนส่งถึงผู้ใช้",
          points: ["คัดกรองความเสี่ยง", "มีแนวทางช่วยเหลือฉุกเฉิน", "พร้อมส่งต่อเมื่อจำเป็น"]
        }
      ]
    },
    proof: {
      title: "ผลลัพธ์ที่ผู้ใช้รู้สึกได้จริง",
      subtitle: "โฟกัสที่ประสบการณ์ B2C เพื่อให้ผู้ใช้รู้สึกดีขึ้นและกลับมาดูแลใจได้ต่อเนื่อง",
      stats: [
        { value: "90%", label: "ผู้ใช้กลับมาคุยต่อหลังครั้งแรก" },
        { value: "89%", label: "ผู้ใช้รู้สึกว่าเครียดลดลง" },
        { value: "4.9/5", label: "คะแนนความพึงพอใจโดยรวม" }
      ],
      highlightsTitle: "จุดเด่นที่ผู้ใช้ชอบมากที่สุด",
      highlights: [
        "ตอบกลับไวในช่วงที่ใจหนัก",
        "เช็กอินพอดี ไม่รบกวนซ้ำ",
        "คำตอบช่วยให้ค่อยๆ สงบและมองทางออกได้"
      ]
    },
    testimonials: {
      title: "เสียงจากผู้ใช้งานจริง",
      subtitle: "รีวิวจากผู้ใช้งานรายบุคคลที่ใช้ ChordJai เป็นเพื่อนคุยในชีวิตประจำวัน",
      items: [
        {
          topic: "ความเครียด",
          quote:
            "ตอนงานกดดันมากๆ ฉันพิมพ์หา ChordJai ได้ทันที มันช่วยให้ใจค่อยๆ นิ่งลงและกลับมาจัดลำดับสิ่งที่ต้องทำได้",
          author: "ผู้ใช้งานจริง",
          meta: "อายุ 27 ปี"
        },
        {
          topic: "ความสัมพันธ์",
          quote:
            "วันที่ทะเลาะกับแฟนและไม่อยากคุยกับใคร แค่ได้คุยกับ ChordJai ก็รู้สึกว่าไม่โดดเดี่ยว และกล้ากลับไปคุยอย่างใจเย็นขึ้น",
          author: "ผู้ใช้งานจริง",
          meta: "อายุ 24 ปี"
        },
        {
          topic: "นอนไม่หลับ",
          quote:
            "ช่วงที่นอนไม่หลับติดต่อกันหลายคืน ระบบตอบแบบอ่อนโยนมากและมีเทคนิคที่ทำตามได้จริง ทำให้ฉันรู้สึกปลอดภัยขึ้นก่อนนอน",
          author: "ผู้ใช้งานจริง",
          meta: "อายุ 31 ปี"
        }
      ]
    },
    resources: {
      title: "Resource ที่ใช้ได้ทันที",
      subtitle: "เครื่องมือสั้นๆ ที่ช่วยดูแลใจในวันที่หนักและวันที่อยากพัฒนาใจตัวเอง",
      cards: [
        {
          title: "คลายใจใน 3 นาที",
          caption: "แนวทางหายใจและคืนความนิ่งอย่างอ่อนโยน"
        },
        {
          title: "เขียนความคิดให้ชัด",
          caption: "เทคนิคแยกความคิดวนซ้ำออกจากข้อเท็จจริง"
        },
        {
          title: "รีเซ็ตใจหลังวันหนัก",
          caption: "สคริปต์สั้นๆ สำหรับปลอบใจตัวเอง"
        },
        {
          title: "โหมดเริ่มต้นใหม่",
          caption: "แผนเล็กๆ ให้ใจเริ่มได้อีกครั้งในวันพรุ่งนี้"
        }
      ]
    },
    finalCta: {
      title: "มีเพื่อนอยู่ข้างกายในทุกวันกับ ChordJai",
      description: "สแกน QR หรือกดปุ่มด้านล่าง เพื่อเริ่มคุยกับ ChordJai - กอดใจ",
      button: "เพิ่มเพื่อน LINE OA"
    },
    about: {
      title: "About Me",
      name: "Natthaphat Toichatturat",
      description:
        "ผู้เชี่ยวชาญด้าน AI และ Data มุ่งเน้นการสร้าง product ที่เป็นการนำ AI ไปใช้ประโยชน์ได้จริง ทั้งในเชิงธุรกิจและสังคม โดยเฉพาะด้านสุขภาพ ที่เล็งเห็นว่าการนำ AI มาใช้นั้นมีผลดีภายใต้ความเหมาะสมที่ถูกต้อง"
    },
    footer: {
      copyright: "Copyright © Natthaphat Toichatturat. All rights reserved.",
      contact: "Toichatturat@outlook.com | 0626092941"
    }
  },
  en: {
    languageButton: "TH",
    nav: ["Services", "Reviews", "Resources", "About"],
    hero: {
      title: "ChordJai\nYour 24/7 safe zone companion",
      description:
        "A caring AI companion on LINE OA for anyone who needs support, calm conversations, and a trusted space every day.",
      quote: "You do not have to carry everything alone",
      primaryButton: "Start Chatting",
      secondaryButton: "Explore Services"
    },
    tickerMessages: [
      "I feel overwhelmed today and need someone to talk to",
      "I cannot sleep well this week, can we talk",
      "My anxiety is rising and I need grounding now",
      "Thank you, I feel better after our conversation",
      "I need a gentle check-in before starting my day",
      "My thoughts are messy, please help me sort them",
      "I do not know where to start, but I want to begin",
      "Just talking here makes me feel less alone",
      "I want support that is kind and not pushy",
      "Thanks for listening without judging me"
    ],
    impact: {
      title: "You do not have to be strong all the time",
      subtitle:
        "ChordJai is built for people who want a safe space to talk, process emotions, and recover gently at their own pace.",
      bullets: [
        "Private support whenever you need it",
        "Natural and human-feeling conversation",
        "Balanced check-ins that avoid spam"
      ],
      button: "Add LINE OA"
    },
    solutions: {
      title: "Complete emotional support flow",
      subtitle: "From daily listening to practical next steps you can actually follow",
      cards: [
        {
          symbol: "24",
          title: "24/7 Emotional Companion",
          description: "Always available when your mind feels heavy and you need a safe conversation.",
          points: ["Fast response", "Instant on LINE", "No need to restart context"]
        },
        {
          symbol: "AI",
          title: "Human-like AI Conversation",
          description: "Warm tone, thoughtful follow-up questions, and guidance without pressure.",
          points: ["Natural follow-up", "Non-judgmental tone", "Step-by-step thought clarity"]
        },
        {
          symbol: "SAFE",
          title: "Safety Layer by Design",
          description: "Every reply passes safety checks before it reaches users.",
          points: ["Risk detection", "Emergency guidance", "Escalation when needed"]
        }
      ]
    },
    proof: {
      title: "Outcomes users can feel",
      subtitle: "B2C-first focus to help users feel better and keep healthy conversation continuity",
      stats: [
        { value: "90%", label: "Users return after the first session" },
        { value: "89%", label: "Users report lower stress" },
        { value: "4.9/5", label: "Overall satisfaction score" }
      ],
      highlightsTitle: "Most loved experience points",
      highlights: [
        "Quick support when emotions spike",
        "Balanced follow-up with no repeated spam",
        "Replies that help users calm down and move forward"
      ]
    },
    testimonials: {
      title: "Real user stories",
      subtitle: "Personal stories from users who rely on ChordJai as a daily safe companion",
      items: [
        {
          topic: "Stress",
          quote:
            "When work pressure gets intense, I message ChordJai right away. It helps me calm down and prioritize what matters first.",
          author: "Real user",
          meta: "Age 27"
        },
        {
          topic: "Relationship",
          quote:
            "After a conflict with my partner, I did not want to talk to anyone. ChordJai helped me feel less alone and more grounded.",
          author: "Real user",
          meta: "Age 24"
        },
        {
          topic: "Sleep",
          quote:
            "During nights of poor sleep, the responses felt gentle and practical. I finally had a safe routine before bedtime.",
          author: "Real user",
          meta: "Age 31"
        }
      ]
    },
    resources: {
      title: "Ready-to-use resources",
      subtitle: "Short tools for hard days and everyday emotional growth",
      cards: [
        {
          title: "3-Minute Reset",
          caption: "Breathing and grounding routine for emotional stability"
        },
        {
          title: "Thought Clarity Note",
          caption: "Separate looping thoughts from facts in simple steps"
        },
        {
          title: "After-a-Hard-Day Script",
          caption: "Self-soothing prompts for emotional recovery"
        },
        {
          title: "Restart Plan",
          caption: "Small actions to help your mind restart tomorrow"
        }
      ]
    },
    finalCta: {
      title: "A trusted companion by your side every day",
      description: "Scan the QR code or click below to start with ChordJai",
      button: "Add LINE OA"
    },
    about: {
      title: "About Me",
      name: "Natthaphat Toichatturat",
      description:
        "AI and Data specialist focused on building practical products that create real impact for business and society, especially in healthcare where responsible AI matters."
    },
    footer: {
      copyright: "Copyright © Natthaphat Toichatturat. All rights reserved.",
      contact: "Toichatturat@outlook.com | 0626092941"
    }
  }
} as const;

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("th");
  const deferredLocale = useDeferredValue(locale);
  const t = content[deferredLocale];
  const [selectedReviewIndex, setSelectedReviewIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.lang = deferredLocale;
  }, [deferredLocale]);

  useEffect(() => {
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse || !cursorRef.current) {
      return;
    }

    const pointer = { x: window.innerWidth * 0.6, y: window.innerHeight * 0.35 };
    const current = { ...pointer };
    let rafId = 0;

    const onMove = (event: MouseEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    const animate = () => {
      current.x += (pointer.x - current.x) * 0.13;
      current.y += (pointer.y - current.y) * 0.13;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${current.x - 170}px, ${current.y - 170}px, 0)`;
      }
      rafId = window.requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll <= 0 ? 0 : Math.min(1, window.scrollY / maxScroll);
      setScrollProgress(progress);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    for (const node of nodes) {
      observer.observe(node);
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateProgress);
    };
  }, []);

  const activeReview: Review = t.testimonials.items[selectedReviewIndex] ?? t.testimonials.items[0];

  return (
    <main className="company-page">
      <div className="cursor-blob" ref={cursorRef} aria-hidden />
      <div className="scroll-line" style={{ transform: `scaleX(${scrollProgress})` }} />

      <header className="top-nav">
        <div className="top-nav-inner">
          <a href="#hero" className="nav-brand">
            <Image src="/assets/logo.png" alt="ChordJai logo" width={42} height={42} />
            <div>
              <p>ChordJai</p>
              <span>AI Mental Health</span>
            </div>
          </a>

          <nav className="nav-links">
            {t.nav.map((item) => (
              <a key={item} href="#services">
                {item}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <a href={lineOaUrl} target="_blank" rel="noreferrer" className="register-btn">
              Register
            </a>
            <button
              className="lang-switch"
              type="button"
              onClick={() => {
                startTransition(() => {
                  setLocale((prev) => (prev === "th" ? "en" : "th"));
                });
              }}
            >
              {t.languageButton}
            </button>
          </div>
        </div>
      </header>

      <section id="hero" className="hero-band">
        <div className="hero-container reveal" data-reveal>
          <div className="hero-copy">
            <h1>{t.hero.title}</h1>
            <p>{t.hero.description}</p>
            <blockquote>{t.hero.quote}</blockquote>
            <div className="hero-buttons">
              <a href={lineOaUrl} target="_blank" rel="noreferrer" className="primary-btn">
                {t.hero.primaryButton}
              </a>
              <a href="#services" className="ghost-btn">
                {t.hero.secondaryButton}
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-screen back">
              <Image src="/assets/preview-2.png" alt="Chat preview" width={768} height={1664} />
            </div>
            <div className="hero-screen front">
              <Image src="/assets/preview-1.png" alt="Chat preview follow up" width={768} height={1664} />
            </div>
            <div className="hero-notification">
              <Image src="/assets/notification.jpg" alt="Notification preview" width={1171} height={334} />
            </div>
            <div className="hero-avatar">
              <Image src="/assets/logo.png" alt="ChordJai badge" width={110} height={110} />
            </div>
          </div>
        </div>
      </section>

      <section className="partner-strip reveal" data-reveal>
        <div className="partner-track">
          {[...t.tickerMessages, ...t.tickerMessages].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="impact-section reveal" data-reveal>
        <article className="impact-preview">
          <Image src="/assets/preview-2.png" alt="Impact preview" width={768} height={1664} />
          <div className="floating-dot one" />
          <div className="floating-dot two" />
        </article>
        <article className="impact-content">
          <h2>{t.impact.title}</h2>
          <p>{t.impact.subtitle}</p>
          <ul>
            {t.impact.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a href={lineOaUrl} target="_blank" rel="noreferrer" className="primary-btn compact">
            {t.impact.button}
          </a>
        </article>
      </section>

      <section id="services" className="services-section reveal" data-reveal>
        <div className="section-heading">
          <h2>{t.solutions.title}</h2>
          <p>{t.solutions.subtitle}</p>
        </div>

        <div className="service-grid">
          {t.solutions.cards.map((card) => (
            <article key={card.title} className="service-card">
              <div className="service-visual">
                <span>{card.symbol}</span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <ul>
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="proof" className="proof-section reveal" data-reveal>
        <div className="section-heading">
          <h2>{t.proof.title}</h2>
          <p>{t.proof.subtitle}</p>
        </div>

        <div className="proof-stats proof-stats-3">
          {t.proof.stats.map((stat) => (
            <article key={stat.label}>
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </article>
          ))}
        </div>

        <div className="b2c-highlight">
          <h3>{t.proof.highlightsTitle}</h3>
          <div className="b2c-highlight-grid">
            {t.proof.highlights.map((item) => (
              <article key={item}>
                <span>✓</span>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="testimonials-section reveal" data-reveal>
        <div className="section-heading">
          <h2>{t.testimonials.title}</h2>
          <p>{t.testimonials.subtitle}</p>
        </div>

        <div className="company-tabs">
          {t.testimonials.items.map((item, index) => (
            <button
              key={item.topic}
              type="button"
              className={index === selectedReviewIndex ? "active" : ""}
              onClick={() => setSelectedReviewIndex(index)}
            >
              {item.topic}
            </button>
          ))}
        </div>

        <article className="testimonial-card">
          <div>
            <h3>{activeReview.topic}</h3>
            <p>{activeReview.quote}</p>
            <span>
              {activeReview.author} · {activeReview.meta}
            </span>
          </div>
          <Image src="/assets/logo.png" alt="User review badge" width={132} height={132} />
        </article>
      </section>

      <section className="resources-section reveal" data-reveal>
        <div className="section-heading">
          <h2>{t.resources.title}</h2>
          <p>{t.resources.subtitle}</p>
        </div>

        <div className="resource-grid">
          {t.resources.cards.map((item, index) => (
            <article key={item.title} className="resource-card">
              <Image
                src={index % 2 === 0 ? "/assets/preview-1.png" : "/assets/preview-2.png"}
                alt={item.title}
                width={768}
                height={1664}
              />
              <h3>{item.title}</h3>
              <p>{item.caption}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta reveal" data-reveal>
        <article className="final-panel">
          <div className="final-copy">
            <h2>{t.finalCta.title}</h2>
            <p>{t.finalCta.description}</p>
            <a href={lineOaUrl} target="_blank" rel="noreferrer" className="primary-btn">
              {t.finalCta.button}
            </a>
          </div>

          <div className="about-card">
            <h3>{t.about.title}</h3>
            <h4>{t.about.name}</h4>
            <p>{t.about.description}</p>
          </div>

          <div className="qr-card">
            <Image src="/assets/line-oa-qr.png" alt="LINE OA QR" width={180} height={180} />
          </div>
        </article>
      </section>

      <footer className="footer-area reveal" data-reveal>
        <div className="footer-brand">
          <Image src="/assets/logo.png" alt="ChordJai logo footer" width={56} height={56} />
          <div>
            <h4>ChordJai - กอดใจ</h4>
            <p>24/7 AI Safe Zone Companion on LINE OA</p>
          </div>
        </div>

        <div className="footer-links">
          <section>
            <h5>Product</h5>
            <a href="#services">AI Companion</a>
            <a href="#proof">Care Journey</a>
            <a href="#hero">Safety Layer</a>
          </section>
          <section>
            <h5>Resources</h5>
            <a href="#services">Guides</a>
            <a href="#proof">Stories</a>
            <a href="#hero">Help Center</a>
          </section>
          <section>
            <h5>Contact</h5>
            <a href="mailto:Toichatturat@outlook.com">Toichatturat@outlook.com</a>
            <a href="tel:0626092941">0626092941</a>
            <a href={lineOaUrl} target="_blank" rel="noreferrer">
              LINE OA
            </a>
          </section>
        </div>

        <div className="footer-bottom">
          <p>{t.footer.copyright}</p>
          <p>{t.footer.contact}</p>
        </div>
      </footer>
    </main>
  );
}
