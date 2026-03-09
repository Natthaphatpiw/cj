# ChordJai Product Blueprint: Engagement + Trust/Safety + Distribution

เอกสารนี้เป็น operating blueprint สำหรับทำให้ ChordJai ไม่ใช่แค่ chatbot แต่เป็นระบบธุรกิจ 3 ชั้นที่ขยายได้จริง

## 1) Business Stack ที่ต้องชนะพร้อมกัน

### ธุรกิจที่ 1: Engagement Business
- เป้าหมาย: ให้ผู้ใช้เริ่มคุยไว กลับมาคุยต่อ และคุยนานพอจนเกิดประโยชน์จริง
- North Star: `weekly emotionally-helped users` (ผู้ใช้ที่มีอย่างน้อย 1 turn แล้ว self-reported ดีขึ้น)
- ตัวชี้วัดหลัก:
- `Activation`: user ใหม่ที่ส่งข้อความแรกภายใน 60 วินาทีหลัง add OA
- `Early Retention`: D1 / D7 return rate
- `Habit Depth`: จำนวนวันใช้งานต่อสัปดาห์ และ session depth ต่อวัน
- `Module Completion`: completion rate ของ breathing / grounding / reframing / journaling

### ธุรกิจที่ 2: Trust & Safety Business
- เป้าหมาย: ปลอดภัยพอให้ผู้ใช้กล้าเล่า และพาร์ตเนอร์กล้าร่วม
- North Star: `safe resolution rate` (เคสเสี่ยงที่ระบบพาไป safe action ได้)
- ตัวชี้วัดหลัก:
- `Crisis Detection Recall` (จับ high/imminent ได้ครบ)
- `False Escalation Rate` (ไม่ยิงเกินความจำเป็น)
- `Time-to-safe-response` (เวลาตั้งแต่ user ส่งถึง response ปลอดภัย)
- `Handoff SLA` (เวลาจากเคสเสี่ยงถึงการรับต่อโดยคนจริงในอนาคต)
- `Audit Coverage` (ทุกจุดสำคัญมี trace ย้อนหลังได้)

### ธุรกิจที่ 3: Distribution Business
- เป้าหมาย: โตโดยไม่เผาเงิน ผ่าน conversion loop จาก web -> LINE OA -> retention
- North Star: `efficient retained users` (retained users ต่อค่าใช้จ่าย acquisition)
- ตัวชี้วัดหลัก:
- `Web Trial -> LINE OA Conversion`
- `LINE OA Invite Acceptance Rate`
- `Referral/Organic Share Rate`
- `Partner Channel Contribution` (องค์กร/คลินิก/community)
- `CAC Payback Window`

## 2) Product System 3 ชั้น

### ชั้นที่ 1: Core Chat (สิ่งที่ user เห็น)
- คุยระบาย
- เช็กอารมณ์
- เริ่มเรื่องใหม่
- Follow-up

### ชั้นที่ 2: Structured Modules (ตัวคูณ retention)
- Breathing 3 นาที
- Grounding 5-4-3-2-1
- Thought Reframing
- Sleep/Stress Check-in
- Mini Journaling

### ชั้นที่ 3: Safety + Escalation (ตัวทำให้ product อยู่รอด)
- Crisis detection
- Safe response templates
- Urgent help flow
- Human referral / counselor handoff (roadmap)

## 3) Engagement Mechanics ที่ต้องมี

- First-session design:
- เป้าหมายข้อความแรกภายใน 60 วินาที
- ใช้ quick-reply ชัดเจน 4 ปุ่ม (ระบาย / เช็กอารมณ์ / แบบฝึก / คุยกับคนจริง)

- Session continuity:
- ใช้ session summary + memory gate เพื่อไม่ให้ user ต้องเริ่มใหม่ทุกครั้ง

- Structured module nudges:
- เมื่อเจอ intent ที่ตรง module ให้เสิร์ฟ flow สำเร็จรูปทันที
- วัด completion ราย module และ loop กลับเข้าคุยต่อ

- Daily open check-in (18:00):
- ใช้ข้อความปลายเปิดแบบ personalized
- ต้องมีกติกา anti-spam: ส่งเมื่อ user inactive ตามเกณฑ์, จำกัด gap ระหว่างครั้ง, หยุดส่งเมื่อเจอสัญญาณเสี่ยงสูง

## 4) Trust & Safety Guardrails

- Precheck risk ที่ deterministic ก่อน LLM
- Postcheck text sanitizer ก่อนส่งจริง
- Crisis mode แยกจาก normal mode อย่างชัดเจน
- Open risk case + audit trail สำหรับ compliance
- Policy:
- ไม่ให้คำวินิจฉัยโรค
- ไม่ให้คำรับประกันผลลัพธ์
- มีข้อความฉุกเฉินที่ชัดเจน (เบอร์โทร/ช่องทางช่วยเหลือ)

## 5) Distribution Architecture

- Web widget = trial channel ไม่ใช่ destination หลัก
- จำกัด trial แล้วชวนต่อ LINE OA ด้วย:
- CTA ปุ่ม add friend
- URL โดยตรง
- QR code

- Conversion playbook:
- หลังจบ trial ให้เสนอ reason-based CTA (เช่น continuity, check-in, private support)
- ทำ partner-friendly metrics dashboard: safety rate, engagement depth, escalation SLA

## 6) Data & Personalization Model

- Event layer (`product_events`):
- เก็บ activation, module usage, followup delivery, conversion events

- Profile layer (`user_engagement_profiles`):
- preferred modules
- check-in preference / opt-out
- trust score / engagement score

- Context layer:
- recent messages
- session summaries
- user memories (consent-aware)

- Personalization rules:
- ปรับข้อความ check-in จากบริบทล่าสุด
- หลีกเลี่ยงข้อความซ้ำ
- ปรับ module ที่แนะนำตาม history การใช้งานจริง

## 7) Execution Plan 30/60/90 วัน

### 0-30 วัน
- เปิดใช้ structured modules เต็มชุด
- เปิด event tracking + dashboard พื้นฐาน
- เปิด daily check-in แบบ conservative (small cohort)

### 31-60 วัน
- ปรับ personalization ranking สำหรับ module suggestion
- ปรับ anti-spam policy ตาม opt-out / response rate
- ตั้ง partner pilot และวัด safety KPI ร่วม

### 61-90 วัน
- เปิด human handoff queue (SLA-based)
- เพิ่ม quality review workflow สำหรับ high-risk sessions
- scale distribution loop ผ่าน partner + referral

## 8) KPI Dashboard ขั้นต่ำที่ต้องดูทุกสัปดาห์

- Engagement:
- activation rate
- D1/D7 retention
- avg turns per active user
- module completion rate

- Trust/Safety:
- high/imminent detection count
- safe-response latency
- escalation rate
- open risk case aging

- Distribution:
- web->line conversion
- retained users per channel
- CAC vs retained users

