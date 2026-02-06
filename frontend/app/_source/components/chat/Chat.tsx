"use client";

import { MessageCircle, Send, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useChatMessagesQuery,
  useSendMessageMutation,
  useNicknameQuery,
} from "@/app/_source/queries/chat";
import { useSessionStore } from "@/stores/sessionStore";

export default function Chat() {
  const { sessionId } = useSessionStore();
  const { data: nickname } = useNicknameQuery(sessionId);
  const [inputValue, setInputValue] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch, isRefetching } = useChatMessagesQuery();
  const { mutate: sendMessage, isPending } = useSendMessageMutation();

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    if (!nickname) {
      alert("닉네임을 먼저 설정해주세요!");
      return;
    }
    if (!sessionId) {
      alert("세션을 초기화하는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    sendMessage(
      {
        sessionId,
        message: inputValue.trim(),
      },
      {
        onSuccess: () => {
          setInputValue("");
        },
        onError: (error) => {
          alert(error.message || "메시지 전송에 실패했습니다.");
        },
      },
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 새 메시지 시 스크롤 하단으로 (채팅 영역 내에서만)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[600px]">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">방명록 </h2>
                <p className="text-sm text-purple-100">
                  서비스 이용 후기를 남겨주세요!
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="메시지 새로고침"
            >
              <RefreshCw
                className={`w-5 h-5 text-white ${isRefetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* 메시지 목록 */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>아직 메시지가 없습니다.</p>
                <p className="text-sm">첫 메시지를 남겨보세요!</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-3 bg-white border border-gray-200 shadow-sm">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-purple-600">
                      {msg.nickname}
                    </span>
                  </div>
                  <p className="text-sm break-words text-gray-800">
                    {msg.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-gray-200 p-4 bg-white">
          {!nickname ? (
            <div className="text-center text-gray-500 text-sm py-2">
              채팅을 시작하려면 오른쪽 상단에서 닉네임을 설정해주세요
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="메시지를 입력하세요..."
                maxLength={500}
                disabled={isPending}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
              />
              <button
                onClick={handleSendMessage}
                disabled={isPending || !inputValue.trim()}
                className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>전송</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
