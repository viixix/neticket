import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

type TraceContext = {
  traceId: string;
};

@Injectable()
export class TraceService {
  private readonly als = new AsyncLocalStorage<TraceContext>();

  generateTraceId(): string {
    return randomUUID();
  }

  runWithTraceId<T>(traceId: string, fn: () => T): T {
    return this.als.run({ traceId }, fn);
  }

  setTraceId(traceId: string): void {
    const store = this.als.getStore();
    if (store) {
      store.traceId = traceId;
      return;
    }
    this.als.enterWith({ traceId });
  }

  getTraceId(): string | undefined {
    return this.als.getStore()?.traceId;
  }

  getOrCreateTraceId(): string {
    const existing = this.getTraceId();
    if (existing) {
      return existing;
    }

    const traceId = this.generateTraceId();
    this.setTraceId(traceId);
    return traceId;
  }
}
