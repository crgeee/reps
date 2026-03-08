-- Fix seed UUIDs: the original 016 seed used UUIDs with version digit '0'
-- which fail Zod v4's stricter UUID validation. Replace with valid v4 UUIDs.

-- Update child tables first (exercises, user_progress reference modules)
UPDATE exercises SET module_id = '23917f1a-d096-4566-9ffa-c9a818b52e16' WHERE module_id = 'b0000000-0000-0000-0000-000000000001';
UPDATE exercises SET module_id = 'f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd' WHERE module_id = 'b0000000-0000-0000-0000-000000000002';
UPDATE exercises SET module_id = 'b50ab13a-a4a5-46ba-b530-889ee4c6888f' WHERE module_id = 'b0000000-0000-0000-0000-000000000003';
UPDATE exercises SET module_id = '6c193324-940f-4a41-be1a-8c9fbaeb1af9' WHERE module_id = 'b0000000-0000-0000-0000-000000000004';
UPDATE exercises SET module_id = '16ae8c80-e713-45c5-a7eb-18557b3c5506' WHERE module_id = 'b0000000-0000-0000-0000-000000000005';
UPDATE exercises SET module_id = 'd2db4b55-436a-49d0-af20-0761d1f48310' WHERE module_id = 'b0000000-0000-0000-0000-000000000006';
UPDATE exercises SET module_id = '3f78c323-f967-4e58-9dbc-6148293a6810' WHERE module_id = 'b0000000-0000-0000-0000-000000000007';
UPDATE exercises SET module_id = 'fead7162-fdeb-49af-9b5c-87c233e00887' WHERE module_id = 'b0000000-0000-0000-0000-000000000008';
UPDATE exercises SET module_id = 'a208b5cf-3a34-4a98-baf4-bc7c67ef6673' WHERE module_id = 'b0000000-0000-0000-0000-000000000009';
UPDATE exercises SET module_id = 'c93358b8-1ce6-4911-a1e5-e54bfc7a2600' WHERE module_id = 'b0000000-0000-0000-0000-00000000000a';

UPDATE user_progress SET module_id = '23917f1a-d096-4566-9ffa-c9a818b52e16' WHERE module_id = 'b0000000-0000-0000-0000-000000000001';
UPDATE user_progress SET module_id = 'f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd' WHERE module_id = 'b0000000-0000-0000-0000-000000000002';
UPDATE user_progress SET module_id = 'b50ab13a-a4a5-46ba-b530-889ee4c6888f' WHERE module_id = 'b0000000-0000-0000-0000-000000000003';
UPDATE user_progress SET module_id = '6c193324-940f-4a41-be1a-8c9fbaeb1af9' WHERE module_id = 'b0000000-0000-0000-0000-000000000004';
UPDATE user_progress SET module_id = '16ae8c80-e713-45c5-a7eb-18557b3c5506' WHERE module_id = 'b0000000-0000-0000-0000-000000000005';
UPDATE user_progress SET module_id = 'd2db4b55-436a-49d0-af20-0761d1f48310' WHERE module_id = 'b0000000-0000-0000-0000-000000000006';
UPDATE user_progress SET module_id = '3f78c323-f967-4e58-9dbc-6148293a6810' WHERE module_id = 'b0000000-0000-0000-0000-000000000007';
UPDATE user_progress SET module_id = 'fead7162-fdeb-49af-9b5c-87c233e00887' WHERE module_id = 'b0000000-0000-0000-0000-000000000008';
UPDATE user_progress SET module_id = 'a208b5cf-3a34-4a98-baf4-bc7c67ef6673' WHERE module_id = 'b0000000-0000-0000-0000-000000000009';
UPDATE user_progress SET module_id = 'c93358b8-1ce6-4911-a1e5-e54bfc7a2600' WHERE module_id = 'b0000000-0000-0000-0000-00000000000a';

-- Update modules (track_id FK + primary key)
UPDATE modules SET track_id = '499c7806-4197-4df6-8e7a-172acaad381f' WHERE track_id = 'a0000000-0000-0000-0000-000000000001';

UPDATE modules SET id = '23917f1a-d096-4566-9ffa-c9a818b52e16' WHERE id = 'b0000000-0000-0000-0000-000000000001';
UPDATE modules SET id = 'f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd' WHERE id = 'b0000000-0000-0000-0000-000000000002';
UPDATE modules SET id = 'b50ab13a-a4a5-46ba-b530-889ee4c6888f' WHERE id = 'b0000000-0000-0000-0000-000000000003';
UPDATE modules SET id = '6c193324-940f-4a41-be1a-8c9fbaeb1af9' WHERE id = 'b0000000-0000-0000-0000-000000000004';
UPDATE modules SET id = '16ae8c80-e713-45c5-a7eb-18557b3c5506' WHERE id = 'b0000000-0000-0000-0000-000000000005';
UPDATE modules SET id = 'd2db4b55-436a-49d0-af20-0761d1f48310' WHERE id = 'b0000000-0000-0000-0000-000000000006';
UPDATE modules SET id = '3f78c323-f967-4e58-9dbc-6148293a6810' WHERE id = 'b0000000-0000-0000-0000-000000000007';
UPDATE modules SET id = 'fead7162-fdeb-49af-9b5c-87c233e00887' WHERE id = 'b0000000-0000-0000-0000-000000000008';
UPDATE modules SET id = 'a208b5cf-3a34-4a98-baf4-bc7c67ef6673' WHERE id = 'b0000000-0000-0000-0000-000000000009';
UPDATE modules SET id = 'c93358b8-1ce6-4911-a1e5-e54bfc7a2600' WHERE id = 'b0000000-0000-0000-0000-00000000000a';

-- Update track primary key last
UPDATE tracks SET id = '499c7806-4197-4df6-8e7a-172acaad381f' WHERE id = 'a0000000-0000-0000-0000-000000000001';
