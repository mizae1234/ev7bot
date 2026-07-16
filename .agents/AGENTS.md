# Behavioral Rules

- **CRITICAL**: ห้ามทำการทดสอบยิง Push Notification (LINE Push Message หรือการแจ้งเตือนใดๆ) ไปยังกลุ่มผู้ใช้งานภายนอกหรือผู้ใช้ทดสอบโดยไม่ได้รับคำสั่งอย่างชัดเจนจากผู้ใช้ (Developer) เด็ดขาด
- **DEPLOYMENT**: โปรเจกต์นี้ไม่มีสคริปต์ deploy (เช่น deploy.sh) ให้ใช้วิธี git push ขึ้น origin main เพื่อทำการ deploy อย่างเดียว ห้ามมองหาสคริปต์ deploy
- **TIMEZONE**: ข้อมูลวันและเวลาที่บันทึกใน SQL Server ถูกบันทึกเป็นเวลาประเทศไทย (Bangkok Time) ตรงๆ แต่ mssql driver จะแปลงส่งออกมาโดยเติม Z (UTC) มาด้วยเสมอ ส่งผลให้ฟังก์ชัน `new Date()` บน Client ของผู้ใช้ในไทยจะแปลงเวลาบวกเพิ่มอีก 7 ชั่วโมง (Double offset) ดังนั้น เมื่อจะแสดงเวลาในหน้าเว็บ ให้จัดรูปแบบเวลา (Format Date/Time) ด้วย `timeZone: 'UTC'` หรือใช้ฟังก์ชันดึงค่า UTC โดยตรง (เช่น `getUTCDate()`, `getUTCHours()`) เท่านั้น ห้ามลืมเด็ดขาด!

