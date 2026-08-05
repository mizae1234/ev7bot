-- 1. Update BATTERY_HV LEVEL label to 'แบต 12 volt (%)'
UPDATE dbo.EV_InspectionItemMaster
SET Label = N'แบต 12 volt (%)'
WHERE Category = 'BATTERY_HV' AND ItemCode = 'LEVEL';

-- 2. Insert/Update Wheel Rim and Window Film
MERGE dbo.EV_InspectionItemMaster AS target
USING (
  SELECT 'BODY' AS Category, 'WHEEL_RIM' AS ItemCode, N'สภาพล้อแม็ก' AS Label, 'three_way' AS InputType, 157 AS SortOrder, 1 AS IsActive
  UNION ALL
  SELECT 'BODY' AS Category, 'WINDOW_FILM' AS ItemCode, N'ฟิล์มกรองแสง' AS Label, 'boolean' AS InputType, 158 AS SortOrder, 1 AS IsActive
) AS source
ON (target.Category = source.Category AND target.ItemCode = source.ItemCode)
WHEN MATCHED THEN
  UPDATE SET Label = source.Label, InputType = source.InputType, SortOrder = source.SortOrder, IsActive = source.IsActive
WHEN NOT MATCHED THEN
  INSERT (Category, ItemCode, Label, InputType, SortOrder, IsActive)
  VALUES (source.Category, source.ItemCode, source.Label, source.InputType, source.SortOrder, source.IsActive);
