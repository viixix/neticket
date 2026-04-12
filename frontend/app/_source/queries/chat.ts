import { api } from '@/lib/api/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  timestamp: string;
}

interface GetMessagesResponse {
  messages: ChatMessage[];
}

interface SendMessageRequest {
  sessionId: string;
  message: string;
}

interface RegisterNicknameRequest {
  sessionId: string;
  nickname: string;
}

interface GetNicknameResponse {
  nickname: string | null;
}

export const useNicknameQuery = (sessionId: string | undefined) => {
  return useQuery<string | null>({
    queryKey: ['user', 'nickname', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await api.get<GetNicknameResponse>(
        `/user/nickname?sessionId=${sessionId}`,
        {
          serverType: 'show',
        },
      );
      return res.nickname;
    },
    enabled: !!sessionId,
    staleTime: Infinity,
  });
};

export const useChatMessagesQuery = () => {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat', 'messages'],
    queryFn: async () => {
      const res = await api.get<GetMessagesResponse>('/chat/messages', {
        serverType: 'show',
      });
      return res.messages;
    },
    staleTime: Infinity, // 수동 새로고침만 사용
    gcTime: Infinity, // 캐시 유지
  });
};

export const useRegisterNicknameMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, RegisterNicknameRequest>({
    mutationFn: async (data: RegisterNicknameRequest) => {
      return await api.post<{ success: boolean }>('/chat/nickname', data, {
        serverType: 'show',
      });
    },
    onSuccess: (_, variables) => {
      // 닉네임 등록 성공 시 캐시 업데이트
      queryClient.invalidateQueries({
        queryKey: ['user', 'nickname', variables.sessionId],
      });
    },
  });
};

export const useSendMessageMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, SendMessageRequest>({
    mutationFn: async (data: SendMessageRequest) => {
      return await api.post<ChatMessage>('/chat/messages', data, {
        serverType: 'show',
      });
    },
    onSuccess: () => {
      // 메시지 전송 성공 시 목록 다시 가져오기
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
    },
  });
};
