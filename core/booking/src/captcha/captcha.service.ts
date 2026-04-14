import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { REDIS_KEY_PREFIXES, REDIS_TTL_SEC } from '@neticket/contracts';
import { RedisService } from '../redis/redis.service';

const captchaKey = (id: string) => `${REDIS_KEY_PREFIXES.CAPTCHA}${id}`;

@Injectable()
export class CaptchaService {
  constructor(private readonly redisService: RedisService) {}

  async generateCaptcha(): Promise<{ captchaId: string; svgImage: string }> {
    const code = this.generateRandomCode(6);
    const captchaId = randomUUID();

    await this.redisService.setWithTtl(
      captchaKey(captchaId),
      code,
      REDIS_TTL_SEC.CAPTCHA,
    );

    return { captchaId, svgImage: this.createCaptchaSVG(code) };
  }

  async verifyCaptcha(captchaId: string, userInput: string): Promise<boolean> {
    const key = captchaKey(captchaId);
    const code = await this.redisService.get(key);

    if (!code) {
      return false;
    }

    const isValid = code.toLowerCase() === userInput.toLowerCase();

    if (isValid) {
      await this.redisService.del(key);
    }

    return isValid;
  }

  private generateRandomCode(length: number): string {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  }

  private createCaptchaSVG(code: string): string {
    const width = 200;
    const height = 80;

    const noiseLines = Array.from({ length: 5 }, () => {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const color = this.getRandomColor();
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;
    }).join('');

    const noiseCircles = Array.from({ length: 50 }, () => {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const color = this.getRandomColor();
      return `<circle cx="${cx}" cy="${cy}" r="1" fill="${color}"/>`;
    }).join('');

    const charSpacing = width / (code.length + 1);
    const texts = Array.from(code)
      .map((char, i) => {
        const x = charSpacing * (i + 1);
        const y = height / 2;
        const angle = (Math.random() - 0.5) * 20;
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

  private getRandomColor(): string {
    const r = Math.floor(Math.random() * 100 + 155);
    const g = Math.floor(Math.random() * 100 + 155);
    const b = Math.floor(Math.random() * 100 + 155);
    return `rgb(${r},${g},${b})`;
  }

  private getRandomDarkColor(): string {
    const r = Math.floor(Math.random() * 100);
    const g = Math.floor(Math.random() * 100);
    const b = Math.floor(Math.random() * 100);
    return `rgb(${r},${g},${b})`;
  }
}
