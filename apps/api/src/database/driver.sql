CREATE SEQUENCE IF NOT EXISTS driver_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

CREATE TABLE IF NOT EXISTS driver (
  id text PRIMARY KEY DEFAULT lpad(nextval('driver_id_seq')::text, 5, '0'),
  phone text NOT NULL,
  name text,
  vehicle_model text,
  plate text,
  photo text,
  id_card text,
  id_number text,
  driver_license text,
  vehicle_license text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_phone_unique UNIQUE (phone),
  CONSTRAINT driver_id_format CHECK (id ~ '^[0-9]{5}$'),
  CONSTRAINT driver_phone_present CHECK (btrim(phone) <> ''),
  CONSTRAINT driver_name_present CHECK (name IS NULL OR btrim(name) <> ''),
  CONSTRAINT driver_vehicle_model_present CHECK (vehicle_model IS NULL OR btrim(vehicle_model) <> ''),
  CONSTRAINT driver_plate_present CHECK (plate IS NULL OR btrim(plate) <> ''),
  CONSTRAINT driver_photo_present CHECK (photo IS NULL OR btrim(photo) <> ''),
  CONSTRAINT driver_id_card_present CHECK (id_card IS NULL OR btrim(id_card) <> ''),
  CONSTRAINT driver_license_present CHECK (driver_license IS NULL OR btrim(driver_license) <> ''),
  CONSTRAINT driver_id_number_present CHECK (id_number IS NULL OR id_number ~ '^[0-9]{17}[0-9X]$'),
  CONSTRAINT driver_vehicle_license_present CHECK (vehicle_license IS NULL OR btrim(vehicle_license) <> '')
);

ALTER SEQUENCE driver_id_seq OWNED BY driver.id;

ALTER TABLE driver ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS vehicle_license text;

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_id_number_present;
ALTER TABLE driver ADD CONSTRAINT driver_id_number_present
  CHECK (id_number IS NULL OR id_number ~ '^[0-9]{17}[0-9X]$');

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_vehicle_license_present;
ALTER TABLE driver ADD CONSTRAINT driver_vehicle_license_present
  CHECK (vehicle_license IS NULL OR btrim(vehicle_license) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS driver_id_number_unique
  ON driver (id_number) WHERE id_number IS NOT NULL;

ALTER TABLE trip_order DROP CONSTRAINT IF EXISTS trip_order_driver_fk;
ALTER TABLE trip_order ADD CONSTRAINT trip_order_driver_fk
  FOREIGN KEY (driver_id) REFERENCES driver (id);
