#!/bin/bash

# 로컬 테스트용 변경 감지 스크립트
# GitHub Actions 없이 로컬에서 테스트할 수 있습니다.

set -e

BASE_BRANCH="${1:-origin/main}"
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD)

echo "=== 변경 감지 테스트 ==="
echo ""
echo "비교 대상: $BASE_BRANCH vs HEAD"
echo ""
echo "Changed files:"
echo "$CHANGED_FILES"
echo ""

# 변경된 서비스 추적
CHANGED_SERVICES=()

# 각 서비스별 변경 감지
check_service_change() {
  local service_name=$1
  local service_path=$2

  if echo "$CHANGED_FILES" | grep -q "^${service_path}/"; then
    CHANGED_SERVICES+=("$service_name")
    echo "✅ $service_name: 변경 감지됨 (경로: $service_path/)"
    return 0
  else
    echo "⏭️  $service_name: 변경 없음 (경로: $service_path/)"
    return 1
  fi
}

# 공통 패키지 변경 감지 및 의존 서비스 추가
check_package_dependencies() {
  local package_name=$1
  shift
  local dependent_services=("$@")

  if echo "$CHANGED_FILES" | grep -q "^packages/${package_name}/"; then
    echo "📦 Package ${package_name} changed, adding dependent services:"
    for service in "${dependent_services[@]}"; do
      if [[ ! " ${CHANGED_SERVICES[@]} " =~ " ${service} " ]]; then
        CHANGED_SERVICES+=("$service")
        echo "   → $service (의존성)"
      fi
    done
  fi
}

echo "=== 서비스별 변경 감지 ==="
# 서비스별 변경 감지
check_service_change "frontend" "frontend" || true
check_service_change "show" "backend/show" || true
check_service_change "booking" "backend/booking" || true
check_service_change "queue" "queue" || true

echo ""
echo "=== 공통 패키지 의존성 체크 ==="
# 공통 패키지 변경 시 의존 서비스 추가
check_package_dependencies "shared-types" "show" "booking" "queue"
check_package_dependencies "shared-nestjs" "show" "booking" "queue"
check_package_dependencies "shared-constants" "queue" "booking"

echo ""
echo "=== 최종 결과 ==="

# 결과 출력
if [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
  echo "❌ No services changed"
  echo ""
  echo "has_changes=false"
  echo "changed_services=[]"
else
  echo "✅ Changed services:"
  printf '   - %s\n' "${CHANGED_SERVICES[@]}"

  # JSON 배열 생성 (jq 없이)
  SERVICES_JSON="["
  FIRST=true
  for service in "${CHANGED_SERVICES[@]}"; do
    if [ "$FIRST" = true ]; then
      SERVICES_JSON+="\"$service\""
      FIRST=false
    else
      SERVICES_JSON+=",\"$service\""
    fi
  done
  SERVICES_JSON+="]"

  echo ""
  echo "has_changes=true"
  echo "changed_services=$SERVICES_JSON"
  echo ""
  echo "개별 서비스 플래그:"

  # 개별 서비스 플래그 설정
  for service in "frontend" "show" "booking" "queue"; do
    if [[ " ${CHANGED_SERVICES[@]} " =~ " ${service} " ]]; then
      echo "   ${service//-/_}_changed=true"
    else
      echo "   ${service//-/_}_changed=false"
    fi
  done
fi

echo ""
echo "=== 테스트 완료 ==="
