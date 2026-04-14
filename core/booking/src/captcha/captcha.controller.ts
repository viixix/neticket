import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TICKET_ERROR_CODES, TicketException } from '@neticket/common';
import { CaptchaService } from './captcha.service';

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  // GET /captcha - 보안 문자 이미지 요청
  @Get()
  getCaptcha(@Res() res: Response) {
    const { captchaId, svgImage } = this.captchaService.generateCaptcha();

    // captchaId를 헤더에 담아서 전송
    res.setHeader('X-Captcha-Id', captchaId);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgImage);
  }

  // POST /captcha/verify - 보안 문자 검증
  @Post('verify')
  verifyCaptcha(@Body() body: { captchaId: string; userInput: string }) {
    const { captchaId, userInput } = body;

    if (!captchaId || !userInput) {
      throw new TicketException(
        TICKET_ERROR_CODES.CAPTCHA_PARAMS_REQUIRED,
        'captchaId와 userInput은 필수입니다.',
        400,
      );
    }

    const isValid = this.captchaService.verifyCaptcha(captchaId, userInput);

    if (!isValid) {
      return {
        success: false,
        message: '보안 문자가 일치하지 않습니다.',
      };
    }

    return {
      success: true,
      message: '보안 문자 검증 성공',
    };
  }
}
