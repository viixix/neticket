/**
 * KOPIS API 응답 인터페이스
 */

export interface KopisApiResponse {
  dbs?: {
    db?: KopisPerformance | KopisPerformance[] | KopisPerformanceDetail;
  };
}

export interface KopisPerformance {
  mt20id: string; // 공연 ID
  prfnm: string; // 공연명
  prfpdfrom: string; // 공연 시작일 (YYYY.MM.DD)
  prfpdto: string; // 공연 종료일 (YYYY.MM.DD)
  fcltynm: string; // 공연장명
  poster: string; // 포스터 URL
  area: string; // 지역
  genrenm: string; // 장르명
  prfstate: '공연예정' | '공연중' | '공연완료'; //공연 상태
}

/**
 * 예매처 상세 정보
 */
export interface KopisRelateDetail {
  relatenm: string; // 예매처 이름 (예: 인터파크, 멜론티켓)
  relateurl: string; // 예매 페이지 URL
}

/**
 * 예매처 목록 래퍼
 */
export interface KopisRelates {
  relate?: KopisRelateDetail | KopisRelateDetail[];
}

/**
 * 소개 이미지 URL 목록 래퍼
 */
export interface KopisStyUrls {
  styurl?: string | string[];
}

/**
 * KOPIS 공연 상세 정보 인터페이스
 */
export interface KopisPerformanceDetail {
  mt20id: string; // 공연 ID (예: PF281772)
  mt10id: string; // 공연시설 ID (예: FC001837)
  prfnm: string; // 공연명
  prfpdfrom: string; // 공연 시작일 (YYYY.MM.DD)
  prfpdto: string; // 공연 종료일 (YYYY.MM.DD)
  fcltynm: string; // 공연 장소명

  pcseguidance: string; // 티켓 가격 정보
  poster: string; // 포스터 이미지 URL

  area: string; // 지역 (예: 서울특별시)
  genrenm: string; // 장르 (예: 대중음악)
  prfstate: string; // 공연 상태 (예: 공연예정, 공연완료)
  dtguidance: string; // 공연 시간 (예: 토요일(18:00))
  updatedate: string; // 최종 수정일시

  prfcast: string; // 공연 출연진
  prfruntime: string; // 공연 런타임 (예: 120분)
  prfage: string; // 관람 연령 제한 (예: 만 7세 이상)

  // Y/N 플래그 (문자열)
  openrun: 'Y' | 'N'; // 오픈런 여부
  visit: 'Y' | 'N'; // 내한 여부
  child: 'Y' | 'N'; // 아동 공연 여부
  daehakro: 'Y' | 'N'; // 대학로 여부
  festival: 'Y' | 'N'; // 페스티벌 여부
  musicallicense: 'Y' | 'N'; // 뮤지컬 라이선스 여부
  musicalcreate: 'Y' | 'N'; // 창작 뮤지컬 여부

  styurls?: KopisStyUrls;
  relates?: KopisRelates;
}
