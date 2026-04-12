import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

export function useExitPage() {
  const { setToken } = useAuth();
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // StrictMode에서는 cleanup 후 즉시 리마운트되므로
      // microtask로 지연시켜 진짜 언마운트인지 확인
      queueMicrotask(() => {
        if (!mountedRef.current) {
          setToken(null);
        }
      });
    };
  }, [setToken]);
}
