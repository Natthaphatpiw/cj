"use client";

import Image from "next/image";
import { startTransition, useEffect, useRef, useState } from "react";

type Locale = "th" | "en";

const lineOaUrl = "https://lin.ee/szxBokM";

const content = {
  th: {
    languageLabel: "EN",
    nav: {
      product: "ผลิตภัณฑ์",
      reviews: "รีวิว",
      about: "About Me",
      contact: "ติดต่อ"
    },
    hero: {
      badge: "AI Mental Health Companion for LINE OA",
      title: "ChordJai กอดใจ\nเพื่อนดูแลใจที่เข้าถึงได้ทุกวัน",
      subtitle:
        "แพลตฟอร์มดูแลใจด้วย AI ที่ออกแบบมาเพื่อการใช้งานจริงบน LINE OA พร้อมระบบติดตามอย่างพอดี ปลอดภัย และเคารพผู้ใช้",
      ctaPrimary: "เริ่มใช้งานบน LINE OA",
      ctaSecondary: "สแกน QR เพื่อแอดเพื่อน"
    },
    stats: [
      { value: "24/7", label: "พร้อมรับฟังทุกเวลา" },
      { value: "TH/EN", label: "สลับภาษาได้ทันที" },
      { value: "Safety First", label: "ออกแบบด้วยหลักความปลอดภัย" }
    ],
    showcaseTitle: "ตัวอย่างประสบการณ์ใช้งานจริง",
    showcaseSubtitle:
      "จากการสนทนาแบบเอาใจใส่ ไปสู่ระบบแจ้งเตือนเช็กอินที่พอดี เพื่อให้ผู้ใช้รู้ว่ามีคนอยู่ข้างๆ โดยไม่รบกวนเกินจำเป็น",
    featuresTitle: "จุดเด่นของระบบ",
    features: [
      {
        title: "ต่อเนื่องบน LINE OA",
        description: "ผู้ใช้คุยต่อได้ทันทีในช่องทางเดิม ไม่ต้องเปลี่ยนแอป"
      },
      {
        title: "เช็กอินแบบไม่สแปม",
        description: "ส่ง follow-up หนึ่งครั้งต่อรอบเงียบ และหยุดทันทีเมื่อผู้ใช้ตอบกลับ"
      },
      {
        title: "แนวทางช่วยเหลืออย่างเหมาะสม",
        description: "คัดกรองความเสี่ยงและจัดการการตอบให้ปลอดภัยก่อนส่งทุกข้อความ"
      },
      {
        title: "ประสบการณ์ใช้งานที่เป็นมิตร",
        description: "ภาษาที่อบอุ่น เข้าใจง่าย และออกแบบให้ใช้งานได้จริงในชีวิตประจำวัน"
      }
    ],
    reviewTitle: "รีวิวผู้ใช้งาน",
    reviews: [
      {
        quote:
          "เรารู้สึกว่ามีที่ให้กลับมาคุยได้ทุกครั้งที่ใจแกว่ง ตัวระบบไม่กดดัน แต่คอยประคองให้ค่อยๆ ดีขึ้น",
        author: "ผู้ใช้งานจริง อายุ 29 ปี"
      },
      {
        quote:
          "ชอบที่คุยใน LINE ได้เลยและตอบเข้าใจมาก โดยเฉพาะตอนดึกที่ไม่รู้จะโทรหาใคร ระบบนี้ช่วยให้ใจนิ่งขึ้น",
        author: "ผู้ใช้งานจริง อายุ 34 ปี"
      },
      {
        quote:
          "เช็กอินหลังจากเราหายไปแบบพอดี ทำให้รู้สึกว่าเราไม่ได้ถูกลืม และกล้ากลับมาคุยต่อได้ง่ายขึ้น",
        author: "ผู้ใช้งานจริง อายุ 26 ปี"
      }
    ],
    aboutTitle: "About Me",
    aboutDescription:
      "Natthaphat Toichatturat เป็นผู้เชี่ยวชาญด้าน AI และ Data มุ่งเน้นการสร้าง product ที่นำ AI ไปใช้ประโยชน์ได้จริง ทั้งในเชิงธุรกิจและสังคม โดยเฉพาะด้านสุขภาพ ที่เล็งเห็นว่าการนำ AI มาใช้นั้นมีผลดีภายใต้ความเหมาะสมที่ถูกต้อง",
    finalCtaTitle: "พร้อมดูแลใจไปด้วยกันบน LINE OA",
    finalCtaDescription: "สแกน QR Code หรือกดปุ่มด้านล่างเพื่อเริ่มใช้งาน ChordJai ได้ทันที",
    footerText: "Copyright © Natthaphat Toichatturat. All rights reserved."
  },
  en: {
    languageLabel: "TH",
    nav: {
      product: "Product",
      reviews: "Reviews",
      about: "About Me",
      contact: "Contact"
    },
    hero: {
      badge: "AI Mental Health Companion for LINE OA",
      title: "ChordJai\nYour daily emotional support on LINE",
      subtitle:
        "A production-ready AI mental wellness experience built for LINE OA with balanced follow-ups, strong safety design, and trust-centered conversations.",
      ctaPrimary: "Start on LINE OA",
      ctaSecondary: "Scan QR to add friend"
    },
    stats: [
      { value: "24/7", label: "Always available" },
      { value: "TH/EN", label: "Instant language switch" },
      { value: "Safety First", label: "Built with safety layers" }
    ],
    showcaseTitle: "Real Product Experience",
    showcaseSubtitle:
      "From empathetic conversations to non-spam check-in notifications, designed to make users feel supported without feeling overwhelmed.",
    featuresTitle: "Core Capabilities",
    features: [
      {
        title: "Native to LINE OA",
        description: "Users continue in their familiar channel with no extra onboarding friction."
      },
      {
        title: "Balanced Follow-up",
        description: "One check-in per inactive cycle, and stop immediately after user response."
      },
      {
        title: "Safe by Design",
        description: "Risk-aware response flow with pre and post safety checks before delivery."
      },
      {
        title: "Human-centered Tone",
        description: "Warm, practical, and emotionally supportive language for everyday use."
      }
    ],
    reviewTitle: "User Reviews",
    reviews: [
      {
        quote:
          "I always have a safe place to come back to when my thoughts get heavy. It feels calm, not pushy.",
        author: "Real user, age 29"
      },
      {
        quote:
          "The fact that it works directly in LINE makes a huge difference. It helped me settle down during late-night anxiety.",
        author: "Real user, age 34"
      },
      {
        quote:
          "The check-in timing feels right. I never felt spammed, but I did feel cared for.",
        author: "Real user, age 26"
      }
    ],
    aboutTitle: "About Me",
    aboutDescription:
      "Natthaphat Toichatturat is an AI and Data specialist focused on building practical products that apply AI for real impact in business and society, especially in healthcare where responsible AI can create meaningful outcomes.",
    finalCtaTitle: "Start your ChordJai journey on LINE OA",
    finalCtaDescription: "Scan the QR code or tap the button below to start chatting now.",
    footerText: "Copyright © Natthaphat Toichatturat. All rights reserved."
  }
} as const;

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("th");
  const current = content[locale];
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const prefersTouch = window.matchMedia("(pointer: coarse)").matches;
    if (prefersTouch || !cursorRef.current) {
      return;
    }

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const currentPoint = { ...pointer };
    let raf = 0;

    const animate = () => {
      currentPoint.x += (pointer.x - currentPoint.x) * 0.15;
      currentPoint.y += (pointer.y - currentPoint.y) * 0.15;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${currentPoint.x - 140}px, ${currentPoint.y - 140}px, 0)`;
      }
      raf = window.requestAnimationFrame(animate);
    };

    const onMove = (event: MouseEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const value = maxScroll <= 0 ? 0 : Math.min(1, window.scrollY / maxScroll);
      setScrollProgress(value);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        }
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -12% 0px"
      }
    );

    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    for (const node of revealNodes) {
      observer.observe(node);
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateProgress);
    };
  }, []);

  const toggleLanguage = () => {
    startTransition(() => {
      setLocale((prev) => (prev === "th" ? "en" : "th"));
    });
  };

  return (
    <main className="landing">
      <div className="cursor-glow" ref={cursorRef} aria-hidden />
      <div className="scroll-progress" style={{ transform: `scaleX(${scrollProgress})` }} />

      <header className="topbar panel">
        <a className="brand" href="#top">
          <Image src="/assets/logo.png" alt="ChordJai logo" width={44} height={44} />
          <div>
            <p>ChordJai</p>
            <span>AI Mental Health</span>
          </div>
        </a>

        <nav className="nav-links">
          <a href="#product">{current.nav.product}</a>
          <a href="#reviews">{current.nav.reviews}</a>
          <a href="#about">{current.nav.about}</a>
          <a href="#contact">{current.nav.contact}</a>
        </nav>

        <button type="button" className="lang-btn" onClick={toggleLanguage}>
          {current.languageLabel}
        </button>
      </header>

      <section id="top" className="hero panel reveal" data-reveal>
        <div className="hero-copy">
          <p className="badge">{current.hero.badge}</p>
          <h1>{current.hero.title}</h1>
          <p>{current.hero.subtitle}</p>
          <div className="cta-row">
            <a className="btn btn-primary" href={lineOaUrl} target="_blank" rel="noreferrer">
              {current.hero.ctaPrimary}
            </a>
            <a className="btn btn-outline" href="#line-qr">
              {current.hero.ctaSecondary}
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            src="/assets/preview-1.png"
            alt="ChordJai chat preview"
            width={768}
            height={1664}
            className="phone-shot"
            priority
          />
        </div>
      </section>

      <section className="stats-grid reveal" data-reveal>
        {current.stats.map((item) => (
          <article className="stat-card panel" key={item.label}>
            <h3>{item.value}</h3>
            <p>{item.label}</p>
          </article>
        ))}
      </section>

      <section id="product" className="section reveal" data-reveal>
        <div className="section-head">
          <h2>{current.showcaseTitle}</h2>
          <p>{current.showcaseSubtitle}</p>
        </div>
        <div className="showcase-grid">
          <article className="panel showcase-card">
            <Image src="/assets/preview-1.png" alt="Conversation sample one" width={768} height={1664} />
          </article>
          <article className="panel showcase-card">
            <Image src="/assets/preview-2.png" alt="Conversation sample two" width={768} height={1664} />
          </article>
          <article className="panel showcase-card notification-card">
            <Image src="/assets/notification.jpg" alt="Follow-up notification sample" width={1171} height={334} />
          </article>
        </div>
      </section>

      <section className="section reveal" data-reveal>
        <div className="section-head">
          <h2>{current.featuresTitle}</h2>
        </div>
        <div className="feature-grid">
          {current.features.map((feature) => (
            <article className="panel feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="reviews" className="section reveal" data-reveal>
        <div className="section-head">
          <h2>{current.reviewTitle}</h2>
        </div>
        <div className="review-grid">
          {current.reviews.map((review) => (
            <article className="panel review-card" key={review.author}>
              <p>{review.quote}</p>
              <span>{review.author}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="section reveal" data-reveal>
        <div className="about-card panel">
          <div>
            <h2>{current.aboutTitle}</h2>
            <h3>Natthaphat Toichatturat</h3>
            <p>{current.aboutDescription}</p>
          </div>
          <Image src="/assets/logo.png" alt="ChordJai emblem" width={180} height={180} className="about-logo" />
        </div>
      </section>

      <section id="line-qr" className="section reveal" data-reveal>
        <div className="final-cta panel">
          <div>
            <h2>{current.finalCtaTitle}</h2>
            <p>{current.finalCtaDescription}</p>
            <a className="btn btn-primary" href={lineOaUrl} target="_blank" rel="noreferrer">
              {current.hero.ctaPrimary}
            </a>
          </div>
          <div className="qr-wrap">
            <Image src="/assets/line-oa-qr.png" alt="LINE OA QR code" width={210} height={210} />
          </div>
        </div>
      </section>

      <footer id="contact" className="footer panel reveal" data-reveal>
        <p>{current.footerText}</p>
        <p>
          Natthaphat Toichatturat | <a href="mailto:Toichatturat@outlook.com">Toichatturat@outlook.com</a> |{" "}
          <a href="tel:0626092941">0626092941</a>
        </p>
      </footer>
    </main>
  );
}
