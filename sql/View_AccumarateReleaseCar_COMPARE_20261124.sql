-- รันก่อน ALTER: อ่านอย่างเดียว คำนวณ RentType ตามตรรกะใหม่แล้วเทียบกับ view ปัจจุบัน
-- แสดงเฉพาะแถวที่ผลเปลี่ยน
;WITH r AS (
    SELECT RentItemID, VinNo, ContractNo, ContractType, ReleaseDate, CreateDate
    FROM dbo.EV_RentItem
    WHERE ReleaseDate IS NOT NULL AND RentStatusID = 2
),
newcalc AS (
    SELECT r.*,
      CASE WHEN EXISTS (
        SELECT 1 FROM dbo.EV_RentItem prev
        WHERE prev.VinNo = r.VinNo AND prev.RentItemID <> r.RentItemID AND prev.RentStatusID = 2
          AND (COALESCE(prev.ReleaseDate, prev.CreateDate) < r.ReleaseDate
            OR (COALESCE(prev.ReleaseDate, prev.CreateDate) = r.ReleaseDate AND prev.RentItemID < r.RentItemID))
      ) OR EXISTS (
        SELECT 1 FROM dbo.EV_RentItemLinemanHistory prev
        WHERE prev.VinNo = r.VinNo AND prev.RentStatusID = 2
          AND (prev.RentItemID < r.RentItemID OR prev.ContractNo <> r.ContractNo)
      ) THEN 'ONRENT_USE' ELSE 'ONRENT_NEW' END AS NewRentType
    FROM r
)
SELECT n.VinNo, n.RentItemID, n.ContractNo, n.ContractType, n.ReleaseDate, n.CreateDate,
       v.RentType AS OldRentType, n.NewRentType
FROM newcalc n
JOIN dbo.View_AccumarateReleaseCar v ON v.RentItemID = n.RentItemID AND v.VinNo = n.VinNo
WHERE v.RentType <> n.NewRentType
ORDER BY n.VinNo, n.ReleaseDate;

-- สรุปจำนวนที่เปลี่ยน (ถ้าอยากดูภาพรวม ให้เปลี่ยน SELECT สุดท้ายเป็น GROUP BY OldRentType, NewRentType)
