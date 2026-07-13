# Behavioral Rules

- **CRITICAL**: ห้ามทำการทดสอบยิง Push Notification (LINE Push Message หรือการแจ้งเตือนใดๆ) ไปยังกลุ่มผู้ใช้งานภายนอกหรือผู้ใช้ทดสอบโดยไม่ได้รับคำสั่งอย่างชัดเจนจากผู้ใช้ (Developer) เด็ดขาด
- **DEPLOYMENT**: โปรเจกต์นี้ไม่มีสคริปต์ deploy (เช่น deploy.sh) ให้ใช้วิธี git push ขึ้น origin main เพื่อทำการ deploy อย่างเดียว ห้ามมองหาสคริปต์ deploy

