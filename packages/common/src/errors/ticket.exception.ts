import { BaseException } from "./base.exception";

export class TicketException extends BaseException {
  constructor(errorCode: string, message: string, statusCode = 400) {
    super(errorCode, message, statusCode);
  }
}
