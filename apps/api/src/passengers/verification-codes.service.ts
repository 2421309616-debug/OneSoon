import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';

export const VERIFICATION_CODE_GENERATOR = Symbol(
  'VERIFICATION_CODE_GENERATOR',
);
export const CLOCK = Symbol('CLOCK');

const CODE_TTL_MS = 5 * 60 * 1000;

type PendingCode = {
  code: string;
  expiresAt: number;
};

export function createVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

@Injectable()
export class VerificationCodesService {
  private readonly logger = new Logger(VerificationCodesService.name);
  private readonly pending = new Map<string, PendingCode>();

  constructor(
    @Inject(VERIFICATION_CODE_GENERATOR)
    private readonly generateCode: () => string,
    @Inject(CLOCK) private readonly now: () => number,
  ) {}

  issue(phone: string): void {
    const code = this.generateCode();
    this.pending.set(phone, {
      code,
      expiresAt: this.now() + CODE_TTL_MS,
    });
    this.logger.log(`手机号 ${phone} 的验证码是 ${code}`);
  }

  verify(phone: string, code: string): void {
    const pending = this.pending.get(phone);
    if (!pending) {
      throw new BadRequestException('请先获取验证码');
    }
    if (this.now() >= pending.expiresAt) {
      this.pending.delete(phone);
      throw new BadRequestException('验证码已过期');
    }
    if (pending.code !== code) {
      throw new BadRequestException('验证码错误');
    }
    this.pending.delete(phone);
  }
}
