import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

interface CaptchaSession {
  code: string;
  expiresAt: number;
}

@Injectable()
export class CaptchaService {
  // 메모리에 저장 (실제 운영환경에서는 Redis 등 사용)
  private sessions = new Map<string, CaptchaSession>();

  // 5분 후 만료
  private readonly EXPIRATION_TIME = 5 * 60 * 1000;

  // 보안 문자 생성
  generateCaptcha(): { captchaId: string; svgImage: string } {
    // 6자리 랜덤 영문 + 숫자
    const code = this.generateRandomCode(6);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const captchaId: string = uuidv4();

    // 세션에 저장
    this.sessions.set(captchaId, {
      code,
      expiresAt: Date.now() + this.EXPIRATION_TIME,
    });

    // SVG 이미지 생성
    const svgImage: string = this.createCaptchaSVG(code);

    return { captchaId, svgImage };
  }

  // 보안 문자 검증
  verifyCaptcha(captchaId: string, userInput: string): boolean {
    const session = this.sessions.get(captchaId);

    if (!session) {
      return false;
    }

    // 만료 체크
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(captchaId);
      return false;
    }

    // 대소문자 구분 없이 비교
    const isValid = session.code.toLowerCase() === userInput.toLowerCase();

    // 성공했을 때만 세션 삭제 (일회용)
    if (isValid) {
      this.sessions.delete(captchaId);
    }

    return isValid;
  }

  // 랜덤 코드 생성
  private generateRandomCode(length: number): string {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동되기 쉬운 문자 제외 (I, O, 0, 1)
    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    return result;
  }

  // SVG로 보안 문자 이미지 생성
  private createCaptchaSVG(code: string): string {
    const width = 200;
    const height = 80;

    // 노이즈 선 생성
    const noiseLines = Array.from({ length: 5 }, () => {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const color = this.getRandomColor();
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;
    }).join('');

    // 노이즈 점 생성
    const noiseCircles = Array.from({ length: 50 }, () => {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const color = this.getRandomColor();
      return `<circle cx="${cx}" cy="${cy}" r="1" fill="${color}"/>`;
    }).join('');

    // 텍스트 문자들 생성
    const charSpacing = width / (code.length + 1);
    const texts = Array.from(code)
      .map((char, i) => {
        const x = charSpacing * (i + 1);
        const y = height / 2;
        const angle = (Math.random() - 0.5) * 20; // -10 ~ 10 도
        const color = this.getRandomDarkColor();
        return `<text x="${x}" y="${y}"
                    font-size="40"
                    font-weight="bold"
                    font-family="Arial, sans-serif"
                    fill="${color}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    transform="rotate(${angle} ${x} ${y})">${char}</text>`;
      })
      .join('');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f0f0f0"/>
      ${noiseLines}
      ${noiseCircles}
      ${texts}
    </svg>`;
  }

  // 랜덤 색상 생성 (밝은 색)
  private getRandomColor(): string {
    const r = Math.floor(Math.random() * 100 + 155);
    const g = Math.floor(Math.random() * 100 + 155);
    const b = Math.floor(Math.random() * 100 + 155);
    return `rgb(${r},${g},${b})`;
  }

  // 랜덤 어두운 색상 생성 (텍스트용)
  private getRandomDarkColor(): string {
    const r = Math.floor(Math.random() * 100);
    const g = Math.floor(Math.random() * 100);
    const b = Math.floor(Math.random() * 100);
    return `rgb(${r},${g},${b})`;
  }

  // 주기적으로 만료된 세션 정리
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [captchaId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(captchaId);
      }
    }
  }
}
