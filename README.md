<details>
<summary>포크 후 변경 사항</summary>

## 포크 후 변경 사항

- **서비스명 변경**: beastcamp → neticket, api-server → show, ticket-server → booking, queue-backend → queue
- **인프라 전환**: NCP(Naver Cloud Platform) → GCP(Google Cloud Platform)
- **대기열 개선**: ZADD+ZRANK Lua 원자화로 race condition 제거, nginx 글로벌 rate limit + thundering herd 완충, docker compose scale 지원
- **부하 테스트 도구**: [neticket-agent](https://github.com/viixix/neticket-agent) — 가상 유저 대량 투입 CLI (3종 페르소나 모델링)

</details>

<img src="https://github.com/user-attachments/assets/c83574ef-a460-4e06-9490-2c34d056ac81" width="1000"/>

<div align="center">

### 🎟️ 내티켓 - 티켓팅 시뮬레이터 (Ticketing Simulator)

수십만명이 참여하는 경쟁이 치열한 티켓팅을 시도해보신적이 있으신가요? 기회는 단 한번 뿐, 티켓팅 성공률은 매우 낮고, 원하는 시간과 좌석을 선택하기 어렵습니다.
하지만, 지정된 시각에만 오픈되는 티켓팅을 사전에 연습하기는 어렵고, 실패하면 다시 기회가 오지 않습니다.

> 실전과 가장 유사한 티켓팅 연습 환경을 제공하는 티켓팅 시뮬레이터

이에 저희는 경쟁이 치열한 공연 티켓팅을 앞둔 사람들을 위한 실전 연습 서비스인 **티켓팅 시뮬레이터** 를 기획하고 개발하게 되었습니다.

 <br />
  </p>
    <p>
        <a href="https://web10.site" target="_blank"><s>지금 바로 접속하기</s></a>
    </p>
    <a href="https://chaegang.notion.site/WEB_10-TEAM_PROJECT-2c4748edda9b801ba43cc3708bf1fd54?source=copy_link" target="_blank">개발팀노션</a> &nbsp; &nbsp; |&nbsp; &nbsp; 
    <a href="https://github.com/boostcampwm2025/web10-beastcamp/wiki" target="_blank">Wiki</a> &nbsp; &nbsp; |&nbsp; &nbsp;
 <a href="" target="_blank">Github Project </a> &nbsp; &nbsp; 
</div>

<br/><br/>

https://github.com/user-attachments/assets/c9067dfb-ec05-43ac-81c4-6cd4ca82cf3f

## 팀원 소개

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/de6d9fe8-09df-4320-a688-4bdb42ac0470" width="120"><br>
      <b>Jerry</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/9a4c1b24-6dba-4146-925d-1ca42fc9e148" width="120"><br>
      <b>Parrot</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/eee30aa1-ecf8-46c8-8591-dc65ab354287" width="120"><br>
      <b>Happy</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/ac219718-515d-4183-b938-9eab324dfd28" width="120"><br>
      <b>Jude</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/0d5ac7dc-6fb4-4c1a-b9a4-057f09bcf186" width="120"><br>
      <b>Chad</b>
    </td>
  </tr>

  <!-- 캠퍼 ID (sub 전용 행) -->
  <tr>
    <td align="center"><a href="https://github.com/viixix">J285_함형민</a></td>
    <td align="center"><a href="https://github.com/flowersayo">J042_김서연</a></td>
    <td align="center"><a href="https://github.com/ParkTjgus">J110_박서현</a></td>
    <td align="center"><a href="https://github.com/JichanPark12">J124_박지찬</a></td>
    <td align="center"><a href="https://github.com/shininghyunho">J277_최현호</a></td>
  </tr>
</table>

## 📌 주요 기능

### 모의 티켓팅 시뮬레이션

- 실제 티켓팅 환경과 동일한 환경에서 단계별 티켓팅 프로세스 제공
- 공연 정보에 따라 플랫폼 별 UI/UX 제공 ( 인터파크, Yes24, 티켓링크, 멜론티켓 )

<div align="center">
<b>날짜/회차 선택 → 대기열 진입 → 보안문자 입력 → 구역 및 좌석 선택 → 예매 완료 -> 피드백</b>
 <br/><br/>
 
</div>

<table>
    <tr>
      <td align="center">공연 상세 화면 조회(인터파크)</td>
      <td align="center">공연 상세 화면 조회(Yes24)</td>
    </tr>
    <tr>
      <td align="center"><img src="https://github.com/user-attachments/assets/46b1b1c8-bcbc-429b-a9d3-de27c9d871bb" width="500"/></td>
      <td align="center"><img src="https://github.com/user-attachments/assets/dc790156-7f70-4ac6-b204-7420baeb7006" width="500"/></td>
    </tr>
 </table>

 <table>
    <tr>
      <td align="center">대기열 진입</td>
      <td align="center">보안문자 입력</td>
      <td align="center">구역 및 회차 선택</td>
    </tr>
    <tr>
       <td align="center"><img src="https://github.com/user-attachments/assets/dced16f4-56e0-42eb-9919-4e736f668feb" /></td>
      <td align="center"><img src="https://github.com/user-attachments/assets/26d82d0d-8ab6-435d-a5c9-e782808a91f1" /></td>
      <td align="center"><img src="https://github.com/user-attachments/assets/efb192ad-313f-4cd7-8e0c-f1bae154a00a" /></td>
    </tr>
 </table>

### 봇 트래픽 발생

- 봇을 활용해 실제 상황과 유사한 수준의 가상 트래픽을 생성
- 실존 트래픽 경쟁에 가까운 환경을 제공

### 티켓팅 결과 피드백 & 랭킹 제공

- 각 단계별 소요 시간 측정(접속, 대기열, 보안문자, 좌석선택)
- 전체 소요 시간, 전체 사용자 대비 순위를 제공하여 피드백
- 각 티켓팅(예매) 진행 이후 랭킹(순위) 제공

 <table>
    <tr>
      <td align="center">예매 피드백</td>
      <td align="center">랭킹 시스템</td>
    </tr>
    <tr>
      <td align="center"><img src="https://github.com/user-attachments/assets/2f77ed74-4616-4776-848c-3ce65dd98f98"/></td>
      <td align="center"><img src="https://github.com/user-attachments/assets/26d82d0d-8ab6-435d-a5c9-e782808a91f1" /></td>
    </tr>
 </table>

### 실제 티켓팅 정보 연동

- 실제 티켓팅 정보를 받아와 예정된 티켓팅 일정을 제공

 <table>
    <tr>
      <td align="center">메인화면</td>
      <td align="center">다가오는 티켓팅 공연 정보 제공</td>
    </tr>
    <tr>
      <td align="center"><img src="https://github.com/user-attachments/assets/8896d09e-1738-4b9b-8342-4dce5aa4a199" width="500" /></td>
      <td align="center"><img src="https://github.com/user-attachments/assets/deb12085-e788-4479-ad17-892d37770b14" /></td>
    </tr>

</table>
   
### 네트워크 환경 점검

- 현재 환경의 네트워크 속도·ping 값을 확인
- 성공률에 중요한 네트워크 상태 정보를 표시

### 플랫폼 별 티켓팅 개인 연습

- 각 플랫폼 (인터파크·YES24·멜론티켓) 별로 실제 예매 사이트 UI/UX 를 기준으로 최적화된 연습을 진행

## 시스템 아키텍처

> 수십만명 트래픽을 감당할 수 있는 대규모 시스템 설계를 목적으로 안정성, 가용성을 중시한 아키텍처를 설계했습니다.
> 더 자세한 기술적 설계 여정은 Wiki ADR 문서를 참고해주세요.

<img width="814" height="682" alt="image" src="https://github.com/user-attachments/assets/d307d74f-38c3-45a2-b2a0-f94bb660cabd" />

<img width="869" height="512" alt="Screenshot 2026-01-30 at 2 12 26 AM" src="https://github.com/user-attachments/assets/3778af0f-333d-465d-886e-e440ed3f159d" />

- [기술 스택 선정 이유]()
- [모노레포 pnpm을 도입한 이유]()
- [공연장 좌석 렌더링 방식]()
- [티켓팅 중복 예매 방지]()
- [모의 트래픽(봇) 발생 원리]()
- [티켓팅 대기열 시스템 동작 알고리즘]()
- [티켓팅 스케쥴링 방식]()
- [대규모 트래픽을 감당하는 예매 시스템 아키텍처 확장](https://github.com/boostcampwm2025/web10-beastcamp/wiki/%EB%8C%80%EA%B7%9C%EB%AA%A8-%EC%8B%9C%EC%8A%A4%ED%85%9C-%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98-%EC%84%A4%EA%B3%84-%EB%B0%8F-%ED%99%95%EC%9E%A5-%EB%B0%A9%EC%95%88)

---

## 프로젝트 구조

본 프로젝트는 MSA 환경에서의 모노레포 아키텍처로 구성되어 있습니다.

```
ticketing-system/
├── pnpm-workspace.yaml          # 모노레포 workspace 설정
├── package.json                 # 루트 package.json (모노레포 스크립트)
├── pnpm-lock.yaml              # 전역 lock file
│
├── frontend/                    # 프론트엔드 (Next.js)
│   ├── src/
│   └── package.json
│
├── backend/                     # 백엔드 서버들
│   ├── api-server/             # 일반 API 서버
│   │   ├── src/
│   │   └── package.json
│   │
│   └── ticket-server/          # 티켓 예매 전용 서버
│       ├── src/
│       └── package.json
│
├── queue-backend/              # 대기열 큐 서버
│   ├── src/
│   └── package.json
│
└── packages/                   # 공유 패키지
    └── shared-types/           # 공통 타입 정의
        ├── src/
        │   ├── booking.ts
        │   ├── queue.ts
        │   └── events.ts
        └── package.json
```

---

## 시작하기 ( How to Start )

### 1. 패키지 설치

프로젝트 루트에서 다음 명령어를 실행하여 모든 workspace의 의존성을 설치합니다.

```bash
pnpm install
```

모노레포 구조이므로 루트에서 한 번만 실행하면 모든 하위 프로젝트의 의존성이 자동으로 설치됩니다.

### 2. 개발 서버 실행

각 서버를 개별적으로 실행할 수 있습니다.

```bash
# API 서버 실행
pnpm dev:api

# 티켓 서버 실행
pnpm dev:ticket

# 대기열 큐 서버 실행
pnpm dev:queue

# 프론트엔드 실행
pnpm dev:frontend
```

## 🛠️기술 스택

<div>

### Frontend

<div>
  <img src="https://img.shields.io/badge/next.js-16.1.1-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/react-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/typescript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/tailwindcss-4.1.18-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
</div>
<div>
  <img src="https://img.shields.io/badge/tanstack%20query-5.90.12-FF4154?style=for-the-badge&logo=reactquery&logoColor=white" alt="TanStack Query"/>
</div>

### Backend

<div>
  <img src="https://img.shields.io/badge/nestjs-11.0.1-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS"/>
  <img src="https://img.shields.io/badge/typescript-5.7.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/typeorm-0.3.28-FE0803?style=for-the-badge&logo=typeorm&logoColor=white" alt="TypeORM"/>
</div>

### Database

<div>
  <img src="https://img.shields.io/badge/mysql-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL"/>
  <img src="https://img.shields.io/badge/redis-7.2-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"/>
</div>

### DevOps

<div>
  <img src="https://img.shields.io/badge/docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/naver%20cloud%20platform-03C75A?style=for-the-badge&logo=naver&logoColor=white" alt="NCP"/>
</div>

</div>

##
