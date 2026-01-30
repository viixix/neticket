#!/bin/bash

# 변경 감지 스크립트
# main 브랜치와 비교하여 변경된 서비스를 감지합니다.

set -e

BASE_BRANCH="${1:-origin/main}"
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD)

echo "📂 Changed files list:"
echo "$CHANGED_FILES"
echo "---------------------------------------"

# 변경된 서비스 추적
CHANGED_SERVICES=()

# 전역 파일(Lockfile, Workflow 등)이 바뀌면 전체 서비스 빌드
GLOBAL_FILES="pnpm-lock.yaml|pnpm-workspace.yaml|package.json|.github/workflows/ci.yml"
if echo "$CHANGED_FILES" | grep -E -q "$GLOBAL_FILES"; then
  echo "🚨 Global config changed! Triggering CI for all services."
  CHANGED_SERVICES=("frontend" "api-server" "ticket-server" "queue-backend")
else

  # 각 서비스별 변경 감지
  check_service_change() {
    local service_name=$1
    local service_path=$2

    if echo "$CHANGED_FILES" | grep -q "^${service_path}/"; then
      CHANGED_SERVICES+=("$service_name")
    fi
  }

  # 공통 패키지 변경 감지 및 의존 서비스 추가
  check_package_dependencies() {
    local package_name=$1
    shift
    local dependent_services=("$@")

    if echo "$CHANGED_FILES" | grep -q "^packages/${package_name}/"; then
      echo "📦 Package ${package_name} changed, adding dependent services..."
      for service in "${dependent_services[@]}"; do
        if [[ ! " ${CHANGED_SERVICES[@]} " =~ " ${service} " ]]; then
          CHANGED_SERVICES+=("$service")
        fi
      done
    fi
  }

  # 서비스별 변경 감지
  check_service_change "frontend" "frontend" || true
  check_service_change "api-server" "backend/api-server" || true
  check_service_change "ticket-server" "backend/ticket-server" || true
  check_service_change "queue-backend" "queue-backend" || true

  # 공통 패키지 변경 시 의존 서비스 추가
  check_package_dependencies "shared-types" "api-server" "ticket-server" "queue-backend"
  check_package_dependencies "backend-config" "ticket-server" "queue-backend" 
  check_package_dependencies "shared-constants" "ticket-server" "queue-backend"
fi

# 결과 출력
if [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
  echo "✅ No services changed. Skipping CI."
  echo "changed_services=[]" >> $GITHUB_OUTPUT
  echo "has_changes=false" >> $GITHUB_OUTPUT
else
  echo "🚀 Changed services: ${CHANGED_SERVICES[*]}"

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

  echo "changed_services=$SERVICES_JSON" >> $GITHUB_OUTPUT
  echo "has_changes=true" >> $GITHUB_OUTPUT
fi

# 개별 서비스 플래그 설정 (변경 여부와 관계없이 항상 설정)
for service in "frontend" "api-server" "ticket-server" "queue-backend"; do
  VAR_NAME="${service//-/_}_changed"
  if [[ " ${CHANGED_SERVICES[@]} " =~ " ${service} " ]]; then
    echo "${VAR_NAME}=true" >> "$GITHUB_OUTPUT"
  else
    echo "${VAR_NAME}=false" >> "$GITHUB_OUTPUT"
  fi
done
