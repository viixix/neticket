import { getServerUrl, type ServerType } from "@/constants/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequestOptions extends Omit<
  RequestInit,
  "method" | "body"
> {
  params?: Record<string, string | number | boolean>;

  serverType?: ServerType; // 요청을 보낼 서버 타입
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildUrl(
  url: string,
  params?: Record<string, string | number | boolean>,
): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${searchParams.toString()}`;
}

async function request<T = unknown>(
  method: HttpMethod,
  endpoint: string,
  data?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { params, headers = {}, serverType = "show", ...restOptions } = options;

  let isMockMode = false;

  // 1. Server Side: cookies() 확인 (Dynamic Import)
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      isMockMode = cookieStore.get("EXPERIENCE_MODE")?.value === "true";
    } catch {}
  } else {
    // 2. Client Side: document.cookie 확인 (가장 확실)

    isMockMode = document.cookie.includes("EXPERIENCE_MODE=true");
  }

  let baseUrl = getServerUrl(serverType, isMockMode);

  // 서버 사이드에서 상대 경로인 경우 절대 URL로 변환
  if (typeof window === "undefined" && baseUrl.startsWith("/")) {
    baseUrl = `${process.env.NEXT_PUBLIC_NEXT_SERVER_URL || "http://localhost:3000"}${baseUrl}`;
  }

  const url = buildUrl(`${baseUrl}${endpoint}`, params);

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...restOptions,
  };

  if (data && method !== "GET" && method !== "DELETE") {
    requestOptions.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      let errorData: unknown;
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        // 응답이 json일 수도 아닐 수도 있음
        errorData = await response.json();

        // NestJS BadRequestException 응답 형식: { message: string, statusCode: number, error: string }
        if (errorData && typeof errorData === 'object' && 'message' in errorData) {
          errorMessage = String(errorData.message);
        }
      } catch {
        errorData = await response.text();
        if (typeof errorData === 'string' && errorData) {
          errorMessage = errorData;
        }
      }

      throw new ApiError(
        errorMessage,
        response.status,
        response.statusText,
        errorData,
      );
    }

    if (
      // 혹시 트래픽 테스트를 위해 응답이 비어있는 경우가 있을 수 있다고 생각함
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    ) {
      return undefined as T;
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json(); // 응답이 json일 경우
    }

    return (await response.text()) as T; // 응답이 json이 아닐 경우
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ApiError(error.message, 0, "네트워크 오류");
    }

    throw new ApiError("알 수 없는 오류가 발생했습니다", 0, "알수없는 에러");
  }
}

export async function get<T = unknown>(
  endpoint: string,
  options?: ApiRequestOptions,
): Promise<T> {
  return request<T>("GET", endpoint, undefined, options);
}

export async function post<T = unknown>(
  endpoint: string,
  data?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  return request<T>("POST", endpoint, data, options);
}

export async function put<T = unknown>(
  endpoint: string,
  data?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  return request<T>("PUT", endpoint, data, options);
}

export async function del<T = unknown>(
  endpoint: string,
  options?: ApiRequestOptions,
): Promise<T> {
  return request<T>("DELETE", endpoint, undefined, options);
}

export const api = {
  get,
  post,
  put,
  delete: del,
};
