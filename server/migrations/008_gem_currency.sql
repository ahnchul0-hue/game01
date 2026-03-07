-- Add gem (premium currency) column to inventories
ALTER TABLE inventories ADD COLUMN gem INTEGER NOT NULL DEFAULT 0;
