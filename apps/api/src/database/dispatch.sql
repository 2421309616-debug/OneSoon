-- 派单相关的表结构。
--
-- 只放「派单」这一个领域的东西：司机位置、服务分、上下线状态、推送记录。
-- 订单本身在 passenger.sql 的 trip_order 里，这里只通过外键引用。

-- 司机的位置、服务分、上下线状态：派单算法的三个输入。
-- 位置由司机端心跳上报（出车后每 10 秒），服务分第一期固定 4.80。
ALTER TABLE driver ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS service_score numeric(2, 1) NOT NULL DEFAULT 4.8;
ALTER TABLE driver ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'offline';

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_service_score_range;
ALTER TABLE driver
  ADD CONSTRAINT driver_service_score_range
  CHECK (service_score >= 0 AND service_score <= 5);

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_status_known;
ALTER TABLE driver
  ADD CONSTRAINT driver_status_known
  CHECK (status IN ('offline', 'online'));

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_location_pair;
ALTER TABLE driver
  ADD CONSTRAINT driver_location_pair
  CHECK ((longitude IS NULL) = (latitude IS NULL));

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_longitude_range;
ALTER TABLE driver
  ADD CONSTRAINT driver_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE driver DROP CONSTRAINT IF EXISTS driver_latitude_range;
ALTER TABLE driver
  ADD CONSTRAINT driver_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

-- 在线且有新鲜位置的司机才参与派单，这个索引让候选查询走索引
CREATE INDEX IF NOT EXISTS driver_dispatchable_idx
  ON driver (status, location_updated_at DESC)
  WHERE status = 'online';

-- 推送记录：一个订单推给一个司机就是一行。
--
-- 唯一约束 (order_id, driver_id) 保证「一个订单对同一个司机只推一次」——
-- 拒绝了、超时没看见，都算推过，不再二次推送。
CREATE TABLE IF NOT EXISTS dispatch_offer (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL,
  driver_id text NOT NULL,
  wave integer NOT NULL,
  bucket text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  CONSTRAINT dispatch_offer_order_fk
    FOREIGN KEY (order_id) REFERENCES trip_order (id) ON DELETE CASCADE,
  CONSTRAINT dispatch_offer_driver_fk
    FOREIGN KEY (driver_id) REFERENCES driver (id) ON DELETE CASCADE,
  CONSTRAINT dispatch_offer_unique UNIQUE (order_id, driver_id),
  CONSTRAINT dispatch_offer_wave_positive CHECK (wave >= 1),
  CONSTRAINT dispatch_offer_bucket_known CHECK (bucket IN ('A', 'B', 'C', 'D')),
  CONSTRAINT dispatch_offer_status_known
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  CONSTRAINT dispatch_offer_responded_matches
    CHECK ((status IN ('accepted', 'rejected')) = (responded_at IS NOT NULL)),
  CONSTRAINT dispatch_offer_expires_after_created CHECK (expires_at > created_at)
);

-- 司机端轮询「有没有新推送」：只查 pending 且未过期
CREATE INDEX IF NOT EXISTS dispatch_offer_pending_idx
  ON dispatch_offer (driver_id, created_at DESC)
  WHERE status = 'pending';

-- 调度器查「这个订单推过谁」
CREATE INDEX IF NOT EXISTS dispatch_offer_order_idx
  ON dispatch_offer (order_id, created_at DESC);
