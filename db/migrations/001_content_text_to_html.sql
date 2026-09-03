-- Migrasi kolom content: text[] → text (HTML string).
-- Data lama: tiap elemen array menjadi paragraf <p>.

ALTER TABLE content ALTER COLUMN content TYPE text
  USING CASE
    WHEN content = '{}' THEN ''
    ELSE '<p>' || array_to_string(content, '</p><p>') || '</p>'
  END;

ALTER TABLE content ALTER COLUMN content SET DEFAULT '';
