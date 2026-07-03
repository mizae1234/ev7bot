'use client'

export default function GuideTab() {
  return (
    <div className="space-y-4 animate-fade-in-up pb-8">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 text-7xl opacity-10">📖</div>
        <h3 className="text-sm font-black flex items-center gap-1.5">
          <span>📖</span> คู่มือการใช้งานระบบ EV7 LIFF
        </h3>
        <p className="text-[10px] text-indigo-100 mt-1 leading-relaxed">
          เรียนรู้ขั้นตอนการแจ้งซ่อมรถยนต์และการอัปเดตข้อมูลความคืบหน้าอย่างถูกต้องใน 3 นาทีค่ะ!
        </p>
      </div>

      {/* Section 1: How to Report */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <span className="text-indigo-650 text-sm">1️⃣</span> ขั้นตอนการเปิดใบแจ้งซ่อมใหม่
        </h4>
        
        <div className="space-y-3">
          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ค้นหาเลขทะเบียนรถ</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">พิมพ์เลขทะเบียนรถ (เช่น ทอ-4522) หรือ VIN ในช่องค้นหาที่หน้าแรก แล้วกดเลือกรถจากรายการ</p>
            </div>
          </div>

          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ระบุชื่อและสถานะ</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">กรอกชื่อคนขับ, วันเวลาที่เกิดเหตุ และเลือกสถานะใบแจ้งซ่อม (เช่น &quot;เข้าซ่อม&quot; เพื่อนำรถเข้าศูนย์)</p>
            </div>
          </div>

          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ระบุอาการเสียและรูปถ่าย</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">พิมพ์รายละเอียดอาการเสีย (หรือกดปุ่มไมโครโฟนเพื่อพูดแทนการพิมพ์) พร้อมแนบรูปถ่ายจุดที่เสียหาย</p>
            </div>
          </div>

          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">บันทึกข้อมูล</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">ตรวจสอบความถูกต้อง แล้วกดปุ่ม &quot;บันทึกข้อมูลแจ้งเหตุ&quot; สีเขียวเพื่อส่งข้อมูลเข้าสู่ระบบ</p>
            </div>
          </div>
        </div>
      </div>
      {/* Section 1.5: Quick Action Buttons */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <span className="text-indigo-650 text-sm">🔘</span> ปุ่มลัดเปลี่ยนสถานะ (3 ปุ่มด้านบนของการ์ด)
        </h4>
        <p className="text-[9px] text-slate-500 leading-relaxed">
          ในแท็บ &quot;ติดตามงาน&quot; ด้านบนจะมี <strong>3 ปุ่มลัด</strong> ใช้เพื่อเปลี่ยนสถานะรวดเร็ว:
        </p>

        <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100/50">
          <p className="text-[8.5px] text-amber-800 leading-relaxed">
            <strong>⚠️ เงื่อนไข:</strong> ปุ่มทั้ง 3 จะกดได้ <strong>เฉพาะเมื่อมีใบแจ้งซ่อมค้างอยู่</strong> ที่ยังไม่ถูกปิด (สถานะไม่ใช่ &quot;Ready to Pickup&quot; หรือ &quot;Completed&quot;) ถ้าไม่มีใบค้าง ปุ่มจะไม่แสดงค่ะ
          </p>
        </div>

        <div className="space-y-3">
          {/* Button 1: เข้าซ่อม */}
          <div className="flex items-start gap-3 text-[10px]">
            <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">เข้าซ่อม</span>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">นำรถเข้าอู่/ศูนย์ซ่อม</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">กดปุ่มนี้เมื่อรถถูกส่งเข้าอู่หรือศูนย์ซ่อมแล้ว ระบบจะเปลี่ยนสถานะเป็น &quot;เข้าซ่อม&quot; และอัปเดตสถานะตัวรถเป็น &quot;ซ่อม&quot; พร้อมทั้งเปลี่ยนใบแจ้งซ่อมอื่นๆ ของรถคันเดียวกันให้เป็น &quot;เข้าซ่อม&quot; อัตโนมัติ</p>
            </div>
          </div>

          {/* Button 2: เริ่มซ่อม */}
          <div className="flex items-start gap-3 text-[10px]">
            <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mt-0.5">เริ่มซ่อม</span>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ช่างเริ่มดำเนินการซ่อม</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">กดปุ่มนี้เมื่อช่างเริ่มลงมือซ่อมแล้ว ระบบจะเปลี่ยนสถานะใบแจ้งซ่อมเป็น &quot;กำลังซ่อม&quot; เพื่อบอกให้ทีมทราบว่างานกำลังดำเนินการอยู่</p>
            </div>
          </div>

          {/* Button 3: ซ่อมเสร็จ */}
          <div className="flex items-start gap-3 text-[10px]">
            <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 mt-0.5">ซ่อมเสร็จ</span>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ซ่อมเรียบร้อยพร้อมใช้งาน</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">กดปุ่มนี้เมื่อซ่อมเสร็จสิ้น ระบบจะเปลี่ยนสถานะเป็น &quot;ซ่อมเสร็จสิ้น&quot; และอัปเดตสถานะรถกลับเป็น &quot;ใช้งาน&quot; อัตโนมัติ ถ้าไม่มีใบแจ้งซ่อมอื่นค้างอยู่</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 mt-2">
          <p className="text-[8.5px] text-blue-700 leading-relaxed">
            <strong>💡 หมายเหตุ:</strong> ระบบจะถามยืนยันก่อนเปลี่ยนสถานะทุกครั้ง เพื่อป้องกันการกดผิดพลาดค่ะ
          </p>
        </div>
      </div>

      {/* Section 2: How to Update */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <span className="text-indigo-650 text-sm">2️⃣</span> ขั้นตอนการอัปเดตติดตามความคืบหน้า
        </h4>
        
        <div className="space-y-3">
          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ไปที่แท็บ &quot;ติดตามงาน&quot;</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">กดปุ่มเมนูด้านล่าง &quot;ติดตามงาน&quot; (📋) ระบบจะแสดงใบงานซ่อมที่ค้างอยู่ทั้งหมด</p>
            </div>
          </div>

          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">เลือกใบงานที่ต้องการอัปเดต</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">กดเลือกใบงานที่ต้องการ เพื่อพิมพ์ข้อความบันทึกการติดตามย่อย เช่น &quot;อู่แจ้งว่าอยู่ระหว่างรออะไหล่พัดลม&quot;</p>
            </div>
          </div>

          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
            <div className="space-y-0.5">
              <p className="font-bold text-slate-700">ติ๊กเช็คลิสต์รายการซ่อม</p>
              <p className="text-slate-500 leading-relaxed text-[9px]">ในหน้าดีเทลของใบงาน คุณสามารถติ๊กกล่อง Checkbox สำหรับความเสียหายแต่ละรายการย่อยเมื่อซ่อมเสร็จ</p>
            </div>
          </div>

          <div className="flex gap-3 text-[10px]">
            <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 mt-0.5">💡</div>
            <div className="bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/50 space-y-0.5">
              <p className="font-bold text-indigo-800 text-[9px]">ระบบปิดงานอัตโนมัติ (Auto Complete)</p>
              <p className="text-indigo-700 leading-relaxed text-[8.5px]">เมื่อใดที่ติ๊กเช็คลิสต์จนครบทุกช่องและไม่มีรายการเสียหายค้าง ระบบจะปรับสถานะของใบแจ้งซ่อมนั้นเป็น &quot;ซ่อมเสร็จสิ้น&quot; และอัปเดตสถานะของตัวรถในระบบให้ใช้งานได้โดยอัตโนมัติทันทีค่ะ!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Status Flow Explanation */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
          <span className="text-indigo-650 text-sm">3️⃣</span> สถานะใบแจ้งซ่อม มีอะไรบ้าง?
        </h4>
        
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 text-[10px]">
            <span className="text-base shrink-0">🔴</span>
            <div>
              <p className="font-bold text-slate-700">แจ้งเหตุ (รอดำเนินการ)</p>
              <p className="text-slate-500 text-[9px]">เพิ่งเปิดเคสเข้ามา ยังไม่ได้นำรถเข้าอู่หรือศูนย์ซ่อม</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-[10px]">
            <span className="text-base shrink-0">🟡</span>
            <div>
              <p className="font-bold text-slate-700">เข้าซ่อม (รอเข้าซ่อม)</p>
              <p className="text-slate-500 text-[9px]">รถถูกนำส่งอู่/ศูนย์ซ่อมเรียบร้อยแล้ว อยู่ระหว่างรอช่างประเมิน</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-[10px]">
            <span className="text-base shrink-0">🔵</span>
            <div>
              <p className="font-bold text-slate-700">กำลังซ่อม (อยู่ระหว่างดำเนินการ)</p>
              <p className="text-slate-500 text-[9px]">ช่างเริ่มซ่อมแซมแล้ว มีการอัปเดตความคืบหน้าสม่ำเสมอ</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-[10px]">
            <span className="text-base shrink-0">🟢</span>
            <div>
              <p className="font-bold text-slate-700">ซ่อมเสร็จสิ้น</p>
              <p className="text-slate-500 text-[9px]">ซ่อมเสร็จแล้ว พร้อมส่งมอบรถคืน (ระบบสามารถปิดให้อัตโนมัติเมื่อติ๊กเช็คลิสต์ครบ)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Tips */}
      <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-100 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
          <span>💡</span> เคล็ดลับการใช้งาน
        </h4>
        <ul className="space-y-2 text-[9px] text-amber-800 leading-relaxed">
          <li className="flex gap-2">
            <span className="shrink-0">🎤</span>
            <span>กดปุ่มไมโครโฟน 🎙️ เพื่อพูดอธิบายอาการเสียแทนการพิมพ์ ระบบจะแปลงเสียงเป็นข้อความให้อัตโนมัติ</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">📸</span>
            <span>แนบรูปถ่ายจุดที่เสียหายทุกครั้ง เพื่อให้อู่/ศูนย์ซ่อมประเมินความเสียหายได้แม่นยำ</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">📋</span>
            <span>อัปเดตความคืบหน้าบ่อยๆ จะช่วยให้ทีมสามารถติดตามสถานะงานซ่อมได้แบบเรียลไทม์</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">🚗</span>
            <span>เมื่อเลือก &quot;เข้าซ่อม&quot; ระบบจะอัปเดตสถานะใบงานอื่นๆ ของรถคันเดียวกันให้อัตโนมัติ</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
