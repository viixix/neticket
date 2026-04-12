# --- Base ---
FROM node:24.12.0-alpine AS base

# pnpm 설치 및 작업 디렉토리 설정
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /usr/src/app
    
# 1. 오직 락파일만 복사
COPY pnpm-lock.yaml ./
    
# 2. 락파일의 정보를 바탕으로 모든 의존성을 전역 스토어에 미리 다운로드
RUN pnpm fetch
    
# 3. 이제 모든 소스 코드를 복사
COPY . .
    
# 4. 이미 다운로드된 스토어를 이용해 오프라인으로 설치
RUN pnpm install --offline --frozen-lockfile
    
# 5. 타겟 패키지와 그 하위 의존성을 순서대로 빌드
RUN pnpm --filter @neticket/queue... build

# 6. 배포를 위해 실행에 필요한 파일들만 별도 폴더(/usr/src/app/out)로 추출
RUN pnpm --filter @neticket/queue --prod deploy --legacy /usr/src/app/out
    
# --- Runner ---
FROM node:24.12.0-alpine AS runner
WORKDIR /usr/src/app
    
COPY --from=base /usr/src/app/out .
    
ENV NODE_ENV=production
EXPOSE 3003
    
CMD ["node", "dist/main.js"]