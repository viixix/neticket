import { HttpException } from "@nestjs/common";

export interface BaseExceptionResponse {
  errorCode: string;
  message: string;
}

export class BaseException extends HttpException {
  constructor(
    readonly errorCode: string,
    message: string,
    statusCode: number = 400
  ) {
    super(
      {
        errorCode,
        message,
      },
      statusCode
    );
    this.message = message;
  }

  getErrorCode(): string {
    return this.errorCode;
  }
}
