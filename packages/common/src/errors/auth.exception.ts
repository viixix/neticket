import { BaseException } from "./base.exception";

export class AuthException extends BaseException {
  constructor(errorCode: string, message: string, statusCode = 401) {
    super(errorCode, message, statusCode);
  }
}
