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
