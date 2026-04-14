---@diagnostic disable: deprecated
-- KEYS: 예약하려는 좌석 키 목록
-- ARGV[1]: 유저 ID (좌석의 value로 사용)
-- ARGV[2]: 순위 키 (rank key)
-- ARGV[3]: 유저 예약 확인 키 (reserved:session:{id}:user:{userId})

local userId = ARGV[1]
local rankKey = ARGV[2]
local userReservedKey = ARGV[3]

-- 1. 중복 예약 체크
if redis.call('EXISTS', userReservedKey) == 1 then
    return {-1, 0}
end

-- 2. 좌석 선점 준비 (MSETNX 인자 구성)
local msetnxArgs = {}
for _, key in ipairs(KEYS) do
    table.insert(msetnxArgs, key)
    table.insert(msetnxArgs, userId)
end

-- 3. 좌석 선점 실행
local success = redis.call('MSETNX', unpack(msetnxArgs))

if success == 0 then
    -- 하나라도 이미 선점된 좌석이 있으면 실패 반환
    return {0, 0}
end

-- 4. 유저 예약 완료 마킹
redis.call('SET', userReservedKey, '1')

-- 5. 순위 증가
local rank = redis.call('INCR', rankKey)

-- 성공 결과 반환 (성공 여부 1, 산정된 순위)
return {1, rank}
