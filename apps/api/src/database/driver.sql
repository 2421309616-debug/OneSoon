CREATE SEQUENCE IF NOT EXISTS driver_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

CREATE TABLE IF NOT EXISTS driver (
  id text PRIMARY KEY DEFAULT 'D' || lpad(nextval('driver_id_seq')::text, 5, '0'),
  phone text NOT NULL,
  name text NOT NULL,
  plate text NOT NULL,
  car_model text NOT NULL,
  rating numeric(2, 1) NOT NULL DEFAULT 5.0,
  status text NOT NULL DEFAULT 'offline',
  online_seconds integer NOT NULL DEFAULT 0,
  stats_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_phone_unique UNIQUE (phone),
  CONSTRAINT driver_id_format CHECK (id ~ '^D[0-9]{5}$'),
  CONSTRAINT driver_phone_present CHECK (btrim(phone) <> ''),
  CONSTRAINT driver_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT driver_plate_present CHECK (btrim(plate) <> ''),
  CONSTRAINT driver_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT driver_status_valid CHECK (status IN ('offline', 'online')),
  CONSTRAINT driver_online_seconds_nonnegative CHECK (online_seconds >= 0)
);

ALTER SEQUENCE driver_id_seq OWNED BY driver.id;

CREATE SEQUENCE IF NOT EXISTS driver_order_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

CREATE TABLE IF NOT EXISTS driver_order (
  id text PRIMARY KEY DEFAULT 'O' || lpad(nextval('driver_order_id_seq')::text, 6, '0'),
  driver_id text,
  status text NOT NULL DEFAULT 'pool',
  passenger_name text NOT NULL,
  passenger_phone text NOT NULL,
  passenger_rating numeric(2, 1),
  from_name text NOT NULL,
  from_address text NOT NULL DEFAULT '',
  from_longitude double precision NOT NULL,
  from_latitude double precision NOT NULL,
  to_name text NOT NULL,
  to_address text NOT NULL DEFAULT '',
  to_longitude double precision NOT NULL,
  to_latitude double precision NOT NULL,
  pickup_km numeric(5, 2) NOT NULL,
  pickup_minutes integer NOT NULL,
  trip_km numeric(5, 2) NOT NULL,
  trip_minutes integer NOT NULL,
  fare numeric(8, 2) NOT NULL,
  note text NOT NULL DEFAULT '',
  accepted_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_order_driver_fk
    FOREIGN KEY (driver_id) REFERENCES driver (id) ON DELETE CASCADE,
  CONSTRAINT driver_order_status_valid
    CHECK (status IN ('pool', 'toPickup', 'waiting', 'inTrip', 'settling', 'completed', 'cancelled')),
  CONSTRAINT driver_order_passenger_name_present CHECK (btrim(passenger_name) <> ''),
  CONSTRAINT driver_order_from_name_present CHECK (btrim(from_name) <> ''),
  CONSTRAINT driver_order_to_name_present CHECK (btrim(to_name) <> ''),
  CONSTRAINT driver_order_fare_nonnegative CHECK (fare >= 0),
  CONSTRAINT driver_order_pickup_nonnegative CHECK (pickup_km >= 0 AND pickup_minutes >= 0),
  CONSTRAINT driver_order_trip_nonnegative CHECK (trip_km >= 0 AND trip_minutes >= 0),
  CONSTRAINT driver_order_from_longitude_range CHECK (from_longitude >= -180 AND from_longitude <= 180),
  CONSTRAINT driver_order_from_latitude_range CHECK (from_latitude >= -90 AND from_latitude <= 90),
  CONSTRAINT driver_order_to_longitude_range CHECK (to_longitude >= -180 AND to_longitude <= 180),
  CONSTRAINT driver_order_to_latitude_range CHECK (to_latitude >= -90 AND to_latitude <= 90)
);

ALTER SEQUENCE driver_order_id_seq OWNED BY driver_order.id;

CREATE INDEX IF NOT EXISTS driver_order_pool_idx ON driver_order (created_at DESC) WHERE status = 'pool';

CREATE INDEX IF NOT EXISTS driver_order_driver_idx ON driver_order (driver_id, status);
