-- KEYS[1]: 대기 큐 (WAITING_QUEUE)
-- KEYS[2]: 활성 큐 (ACTIVE_QUEUE)
-- KEYS[3]: 하트비트 큐 (HEARTBEAT_QUEUE)
-- KEYS[4]: 가상 유저 작업 큐 (VIRTUAL_ACTIVE_QUEUE)

-- ARGV[1]: 최대 수용 인원 (MAX_CAPACITY)
-- ARGV[2]: 현재 타임스탬프 ms (NOW)
-- ARGV[3]: 대기열 이탈 판단 기준 ms (HEARTBEAT_TIMEOUT_MS)
-- ARGV[4]: 활성 세션 유지 시간 ms (ACTIVE_TTL_MS)
-- ARGV[5]: 활성 유저 키 접두사 (ACTIVE_USER_PREFIX) -- "queue:active:user:"
-- ARGV[6]: 하트비트 기능 활성 여부 (IS_HEARTBEAT_ENABLED)

-- [[ KEYS 및 ARGV 매핑 ]]
local WAITING_QUEUE = KEYS[1]
local ACTIVE_QUEUE = KEYS[2]
local HEARTBEAT_QUEUE = KEYS[3]
local VIRTUAL_ACTIVE_QUEUE = KEYS[4]

local MAX_CAPACITY = tonumber(ARGV[1])
local NOW = tonumber(ARGV[2])
local HEARTBEAT_TIMEOUT_MS = tonumber(ARGV[3])
local ACTIVE_TTL_MS = tonumber(ARGV[4])
local ACTIVE_USER_PREFIX = ARGV[5]
local IS_HEARTBEAT_ENABLED = ARGV[6]

-- [[ Active Queue 청소 (정원 확보) ]]
-- 현재 시간보다 score(만료시간)가 작은 유저들을 제거
redis.call('ZREMRANGEBYSCORE', ACTIVE_QUEUE, '-inf', NOW)

-- [[ Waiting Queue 청소 (이탈자 정리) ]]
-- (현재 시간 - 허용 간격)보다 이전에 마지막 하트비트를 찍은 유저 제거
if IS_HEARTBEAT_ENABLED then
    local waiting_deadline = NOW - HEARTBEAT_TIMEOUT_MS
    local expired_waiters = redis.call('ZRANGEBYSCORE', HEARTBEAT_QUEUE, '-inf', waiting_deadline)

    for _, user_id in ipairs(expired_waiters) do
        redis.call('ZREM', WAITING_QUEUE, user_id)
        redis.call('ZREM', HEARTBEAT_QUEUE, user_id)
    end
end

-- [[ 유저 승격 로직 ]]
-- 1. 현재 활성 큐에 몇 명이 있는지 확인 (ZCARD)
local active_count = redis.call('ZCARD', ACTIVE_QUEUE)

-- 2. 입장 가능한 빈 자리 계산
local available = MAX_CAPACITY - active_count

local moved_ids = {}

-- 3. 빈 자리가 있는 경우에만 로직 수행
if available > 0 then
    -- 4. 대기 큐에서 가장 오래 기다린 유저를 빈 자리 수만큼 조회 (제거하지 않음)
    -- 반환 형태: {유저ID1, 유저ID2, ...}
    local waiting_users = redis.call('ZRANGE', WAITING_QUEUE, 0, available - 1)

    -- 5. 조회된 유저들을 순회
    for _, user_id in ipairs(waiting_users) do
        -- 5-1. 활성 큐로 승격 (Score = 만료 시각)
        redis.call('ZADD', ACTIVE_QUEUE, NOW + ACTIVE_TTL_MS, user_id)
        
        -- 5-2. 권한 체크용 키 생성
        local heartbeat_score = redis.call('ZSCORE', HEARTBEAT_QUEUE, user_id)
        local user_type = heartbeat_score and 'REAL' or 'VIRTUAL'
        redis.call('SET', ACTIVE_USER_PREFIX .. user_id, user_type, 'PX', ACTIVE_TTL_MS)
        
        -- 5-3. 대기열 정보 삭제
        redis.call('ZREM', WAITING_QUEUE, user_id)
        redis.call('ZREM', HEARTBEAT_QUEUE, user_id)

        if user_type == 'VIRTUAL' then
            redis.call('LPUSH', VIRTUAL_ACTIVE_QUEUE, user_id)
        end
        
        table.insert(moved_ids, user_id)
    end
end

-- 최종 입장된 유저 ID 리스트 반환
return moved_ids