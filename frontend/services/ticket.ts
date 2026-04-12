import { getServerUrl } from "@/constants/api";
import { createAuthenticatedApi } from "@/lib/api/authenticatedClient";

export interface CaptchaResponse {
  captchaId: string;
  imageUrl: string;
}

export interface VerifyCaptchaResponse {
  success: boolean;
  message: string;
}

/**
 * 보안 문자 이미지 요청
 *
 * Note: 이 함수는 api.ts의 유틸 함수를 사용하지 않습니다.
 * 이유:
 * 1. Response 객체에서 커스텀 헤더(X-Captcha-Id)를 추출해야 함
 * 2. 응답을 Blob으로 처리하여 이미지 URL을 생성해야 함
 * 3. api.ts는 JSON 응답 위주로 설계되어 이러한 특수 케이스에 적합하지 않음
 *
 * 대신 getServerUrl을 활용하여 서버 URL을 가져옵니다.
 */
export async function fetchCaptcha(token: string): Promise<CaptchaResponse> {
  const ticketServerUrl = getServerUrl("booking");

  const response = await fetch(`${ticketServerUrl}/captcha`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("보안 문자 이미지를 가져오는데 실패했습니다.");
  }

  // X-Captcha-Id 헤더에서 captchaId 가져오기
  const captchaId = response.headers.get("X-Captcha-Id");
  if (!captchaId) {
    throw new Error("보안 문자 ID를 찾을 수 없습니다.");
  }

  // 이미지 데이터를 Blob으로 받아서 URL 생성
  const imageBlob = await response.blob();
  const imageUrl = URL.createObjectURL(imageBlob);

  return {
    captchaId,
    imageUrl,
  };
}

/**
 * 보안 문자 검증
 * api.post 유틸 함수를 사용하여 티켓 서버에 검증 요청
 */
export async function verifyCaptcha(
  token: string,
  captchaId: string,
  userInput: string,
) {
  const authApi = createAuthenticatedApi(token);

  return authApi.post<VerifyCaptchaResponse>(
    "/captcha/verify",
    { captchaId, userInput },
    {
      serverType: "booking",
      credentials: "include",
    },
  );
}
