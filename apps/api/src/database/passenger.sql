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
