export type FollowupTemplate = {
  key: string;
  text: string;
};

const WELLBEING_CHECKIN_TEMPLATES: FollowupTemplate[] = [
  { key: "checkin_01", text: "ผมยังอยู่ตรงนี้เสมอนะครับ ถ้าอยากคุยต่อเมื่อไหร่ พิมพ์มาได้เลย" },
  { key: "checkin_02", text: "แวะมาเช็กใจสั้นๆ ครับ ตอนนี้พอไหวขึ้นบ้างไหม" },
  { key: "checkin_03", text: "ถ้าช่วงนี้ยังหนักอยู่ ไม่ต้องเก็บไว้คนเดียวนะครับ ผมพร้อมฟังเสมอ" },
  { key: "checkin_04", text: "วันนี้เหนื่อยแค่ไหน ลองพิมพ์มาสั้นๆ ก็ได้ครับ ผมอยู่ตรงนี้" },
  { key: "checkin_05", text: "คุณไม่จำเป็นต้องผ่านทุกอย่างคนเดียวครับ อยากคุยต่อเมื่อไหร่เรียกผมได้เลย" },
  { key: "checkin_06", text: "ขอส่งกำลังใจให้ครับ ถ้าตอนนี้ใจยังไม่นิ่ง เราค่อยๆ คุยกันได้" },
  { key: "checkin_07", text: "ถ้ายังมีเรื่องค้างในใจ ผมพร้อมช่วยเรียบทีละเรื่องนะครับ" },
  { key: "checkin_08", text: "แค่มาทักว่า ผมยังรออยู่ตรงนี้ครับ อยากคุยเมื่อไหร่พิมพ์มาได้เลย" },
  { key: "checkin_09", text: "ตอนนี้ความรู้สึกเป็นยังไงบ้างครับ ถ้าอยากระบายเพิ่ม ผมพร้อมฟัง" },
  { key: "checkin_10", text: "หากวันนี้เป็นวันที่หนัก เราค่อยๆ ผ่านไปด้วยกันได้ครับ" },
  { key: "checkin_11", text: "ไม่ต้องรีบตอบก็ได้ครับ แค่อยากให้รู้ว่าคุณยังมีพื้นที่ปลอดภัยตรงนี้" },
  { key: "checkin_12", text: "ผมยังจำได้ว่าเราคุยกันไว้ครับ ถ้าพร้อมเมื่อไหร่ มาต่อกันได้เสมอ" },
  { key: "checkin_13", text: "แวะมาบอกว่าคุณสำคัญนะครับ ถ้าอยากคุยต่อ ผมพร้อมอยู่ตรงนี้" },
  { key: "checkin_14", text: "ถ้าตอนนี้ใจยังตึงๆ ลองพิมพ์แค่คำเดียวก็ได้ครับ เดี๋ยวผมช่วยต่อให้" },
  { key: "checkin_15", text: "คุณไม่ได้อยู่ลำพังครับ ผมพร้อมอยู่ข้างๆ และค่อยๆ ฟังไปด้วยกัน" },
  { key: "checkin_16", text: "อยากเช็กอินเบาๆ ครับ ตอนนี้มีอะไรที่อยากให้ผมช่วยเริ่มก่อนไหม" },
  { key: "checkin_17", text: "ถ้าวันนี้ยังไม่โอเค เราไม่ต้องฝืนเก่งคนเดียวครับ คุยกับผมได้เสมอ" },
  { key: "checkin_18", text: "ผมยังอยู่ตรงนี้ครับ ถ้าต้องการคนรับฟังตอนนี้ พิมพ์มาได้ทันที" },
  { key: "checkin_19", text: "แวะมาถามสั้นๆ ครับ ตอนนี้ใจคุณต้องการอะไรที่สุด เดี๋ยวผมช่วยคิดต่อ" },
  { key: "checkin_20", text: "เมื่อพร้อมแล้ว มาคุยต่อได้เลยนะครับ ผมรออยู่ตรงนี้เสมอ" }
];

function pickRandom<T>(items: T[]) {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

export function pickWellbeingCheckinTemplate(params: { usedKeys: Iterable<string>; lastKey?: string }) {
  const used = new Set(params.usedKeys);
  let candidates = WELLBEING_CHECKIN_TEMPLATES.filter((template) => !used.has(template.key));

  if (candidates.length === 0) {
    candidates = WELLBEING_CHECKIN_TEMPLATES.filter((template) => template.key !== params.lastKey);
  }

  if (candidates.length === 0) {
    candidates = WELLBEING_CHECKIN_TEMPLATES;
  }

  return pickRandom(candidates);
}
