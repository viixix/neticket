-- KEYS[1]: 대기 큐 (WAITING_QUEUE)
-- KEYS[2]: 하트비트 큐 (HEARTBEAT_QUEUE)
-- ARGV[1]: 진입 타임스탬프 ms (score)
-- ARGV[2]: 유저 ID

-- ZADD NX: 이미 존재하면 추가하지 않고 넘어감 (idempotent)
redis.call('ZADD', KEYS[1], 'NX', ARGV[1], ARGV[2])
redis.call('ZADD', KEYS[2], 'NX', ARGV[1], ARGV[2])

-- ZADD 직후 ZRANK이므로 null 반환 논리적 불가
return redis.call('ZRANK', KEYS[1], ARGV[2])
