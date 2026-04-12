import { api } from './api/api';

const SESSION_STORAGE_KEY = 'chat_session_id';

interface GenerateSessionResponse {
  sessionId: string;
}

/**
 * 세션 ID를 localStorage에서 가져오거나, 없으면 서버에서 발급받아 저장합니다.
 */
export async function getOrCreateSessionId(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  // localStorage에서 세션 ID 확인
  const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existingSessionId) {
    return existingSessionId;
  }

  // 서버에서 새 세션 ID 발급
  try {
    const response = await api.post<GenerateSessionResponse>(
      '/user/session',
      {},
      { serverType: 'show' },
    );
    const sessionId = response.sessionId;

    // localStorage에 저장
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);

    return sessionId;
  } catch (error) {
    console.error('Failed to generate session ID:', error);
    throw error;
  }
}

/**
 * 현재 세션 ID를 가져옵니다 (없으면 빈 문자열 반환)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem(SESSION_STORAGE_KEY) || '';
}
