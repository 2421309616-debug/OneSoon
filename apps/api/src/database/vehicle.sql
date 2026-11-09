CREATE TABLE IF NOT EXISTS vehicle_option (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand text NOT NULL,
  model text NOT NULL,
  model_year integer NOT NULL,
  color_name text NOT NULL,
  color_key text NOT NULL,
  view text NOT NULL DEFAULT 'front-3-4',
  image_file text NOT NULL,
  source_vehicle_id text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_option_brand_present CHECK (btrim(brand) <> ''),
  CONSTRAINT vehicle_option_model_present CHECK (btrim(model) <> ''),
  CONSTRAINT vehicle_option_color_present CHECK (btrim(color_name) <> ''),
  CONSTRAINT vehicle_option_color_key_present CHECK (btrim(color_key) <> ''),
  CONSTRAINT vehicle_option_view_present CHECK (btrim(view) <> ''),
  CONSTRAINT vehicle_option_image_present CHECK (btrim(image_file) <> ''),
  CONSTRAINT vehicle_option_year_range CHECK (model_year BETWEEN 1990 AND 2027),
  CONSTRAINT vehicle_option_source_format CHECK (source_vehicle_id ~ '^veh_[0-9a-z]+$'),
  CONSTRAINT vehicle_option_unique UNIQUE (source_vehicle_id, color_key, view),
  CONSTRAINT vehicle_option_image_unique UNIQUE (image_file),
  CONSTRAINT vehicle_option_category_present CHECK (category IS NULL OR category IN ('跑车', '轿车'))
);

ALTER TABLE vehicle_option ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE vehicle_option DROP CONSTRAINT IF EXISTS vehicle_option_category_present;
ALTER TABLE vehicle_option ADD CONSTRAINT vehicle_option_category_present
  CHECK (category IS NULL OR category IN ('跑车', '轿车'));

UPDATE vehicle_option
SET category = '跑车'
WHERE source_vehicle_id = 'veh_84639mgkp4a26' AND color_key = 'black' AND view = 'front-3-4';
