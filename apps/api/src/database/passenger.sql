CREATE SEQUENCE IF NOT EXISTS passenger_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

CREATE TABLE IF NOT EXISTS passenger (
  id text PRIMARY KEY DEFAULT lpad(nextval('passenger_id_seq')::text, 5, '0'),
  phone text NOT NULL,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT passenger_phone_unique UNIQUE (phone),
  CONSTRAINT passenger_id_format CHECK (id ~ '^[0-9]{5}$'),
  CONSTRAINT passenger_phone_present CHECK (btrim(phone) <> ''),
  CONSTRAINT passenger_nickname_present CHECK (btrim(nickname) <> '')
);

ALTER SEQUENCE passenger_id_seq OWNED BY passenger.id;

CREATE TABLE IF NOT EXISTS passenger_place_search (
  passenger_id text NOT NULL,
  place_id text NOT NULL,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  longitude double precision NOT NULL,
  latitude double precision NOT NULL,
  search_count integer NOT NULL DEFAULT 1,
  last_searched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (passenger_id, place_id),
  CONSTRAINT passenger_place_search_passenger_fk
    FOREIGN KEY (passenger_id) REFERENCES passenger (id) ON DELETE CASCADE,
  CONSTRAINT passenger_place_search_place_id_present CHECK (btrim(place_id) <> ''),
  CONSTRAINT passenger_place_search_name_present CHECK (btrim(name) <> ''),
  CONSTRAINT passenger_place_search_count_positive CHECK (search_count >= 1),
  CONSTRAINT passenger_place_search_longitude_range CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT passenger_place_search_latitude_range CHECK (latitude >= -90 AND latitude <= 90)
);

CREATE TABLE IF NOT EXISTS trip_order (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  passenger_id text NOT NULL,
  pickup_name text NOT NULL,
  pickup_longitude double precision NOT NULL,
  pickup_latitude double precision NOT NULL,
  destination_name text NOT NULL,
  destination_longitude double precision NOT NULL,
  destination_latitude double precision NOT NULL,
  distance_meters integer NOT NULL,
  duration_seconds integer NOT NULL,
  fare_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT trip_order_passenger_fk
    FOREIGN KEY (passenger_id) REFERENCES passenger (id) ON DELETE CASCADE,
  CONSTRAINT trip_order_status_known CHECK (status IN ('waiting', 'cancelled')),
  CONSTRAINT trip_order_cancelled_at_matches CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT trip_order_route_positive CHECK (distance_meters > 0 AND duration_seconds > 0),
  CONSTRAINT trip_order_fare_positive CHECK (fare_cents > 0)
);

ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS driver_id text;
ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS is_reservation boolean NOT NULL DEFAULT false;
ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS rider_name text;
ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS rider_phone text;
ALTER TABLE trip_order ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE trip_order DROP CONSTRAINT IF EXISTS trip_order_status_known;
ALTER TABLE trip_order ADD CONSTRAINT trip_order_status_known
  CHECK (status IN ('waiting', 'accepted', 'cancelled'));

ALTER TABLE trip_order DROP CONSTRAINT IF EXISTS trip_order_accepted_matches;
ALTER TABLE trip_order ADD CONSTRAINT trip_order_accepted_matches
  CHECK ((status = 'accepted') = (driver_id IS NOT NULL AND accepted_at IS NOT NULL));

DROP INDEX IF EXISTS trip_order_one_waiting_per_passenger;

DROP INDEX IF EXISTS trip_order_one_active_per_passenger;
CREATE UNIQUE INDEX IF NOT EXISTS trip_order_one_active_per_passenger
  ON trip_order (passenger_id)
  WHERE status = 'accepted' OR (status = 'waiting' AND is_reservation = false);

CREATE UNIQUE INDEX IF NOT EXISTS trip_order_one_accepted_per_driver
  ON trip_order (driver_id) WHERE status = 'accepted';
