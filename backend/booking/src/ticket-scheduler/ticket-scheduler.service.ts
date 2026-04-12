import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { TicketSetupService } from '../ticket-setup/ticket-setup.service';
import { TraceService } from '@neticket/shared-nestjs';

enum CycleStatus {
  SETUP = 'SETUP',
  OPEN = 'OPEN',
  CLOSE = 'CLOSE',
  ERROR = 'ERROR',
}

@Injectable()
export class TicketSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketSchedulerService.name);
  private status: CycleStatus = CycleStatus.CLOSE;

  constructor(
    private readonly setupService: TicketSetupService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly traceService: TraceService,
  ) {}

  onModuleInit() {
    this.scheduleSetup();
    this.scheduleOpen();
    this.scheduleClose();
  }

  onModuleDestroy() {
    ['setupJob', 'openJob', 'closeJob'].forEach((name) => {
      try {
        const job = this.schedulerRegistry.getCronJob(name);

        void job.stop();
      } catch (e) {
        this.logger.error('스케줄 중단 실패', (e as Error).stack, {
          jobName: name,
        });
      }
    });
  }

  private scheduleSetup() {
    const cron = this.config.get<string>('SETUP_INTERVAL', '0 4/5 * * * *');
    this.addJob('setupJob', cron, () => this.runSetup());
  }

  private scheduleOpen() {
    const cron = this.config.get<string>(
      'TICKETING_OPEN_INTERVAL',
      '0 0/5 * * * *',
    );
    this.addJob('openJob', cron, () => this.runOpen());
  }

  private scheduleClose() {
    const cron = this.config.get<string>(
      'TICKETING_CLOSE_INTERVAL',
      '0 3/5 * * * *',
    );
    this.addJob('closeJob', cron, () => this.runClose());
  }

  private addJob(name: string, cron: string, cb: () => Promise<void>) {
    const job = new CronJob(cron, async () => {
      await this.traceService.runWithTraceId(
        this.traceService.generateTraceId(),
        () => cb(),
      );
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.schedulerRegistry.addCronJob(name, job as any);
    job.start();
    this.logger.log('스케줄 등록 완료', { jobName: name, cron });
  }

  private async runSetup() {
    if (
      this.status !== CycleStatus.CLOSE &&
      this.status !== CycleStatus.ERROR
    ) {
      this.logger.warn('Setup 단계 진입 스킵', { currentStatus: this.status });
      return;
    }

    try {
      this.logger.log('티켓팅 Setup 시작!');
      await this.setupService.setup();
      this.status = CycleStatus.SETUP;
    } catch (e) {
      this.handleErr('Setup', e);
    }
  }

  private async runOpen() {
    if (this.status !== CycleStatus.SETUP) {
      this.logger.warn('Open 단계 진입 스킵', { currentStatus: this.status });
      return;
    }

    try {
      this.logger.log('티켓팅 Open 시작!');
      await this.setupService.openTicketing();
      this.status = CycleStatus.OPEN;
    } catch (e) {
      this.handleErr('Open', e);
    }
  }

  private async runClose() {
    if (this.status !== CycleStatus.OPEN) {
      this.logger.warn('Close 단계 진입 스킵', { currentStatus: this.status });
      return;
    }

    try {
      this.logger.log('티켓팅 Close 시작!');
      await this.setupService.tearDown();
      this.status = CycleStatus.CLOSE;
    } catch (e) {
      this.handleErr('Close', e);
    }
  }

  private handleErr(stage: string, e: unknown) {
    const err = e as Error;
    this.status = CycleStatus.ERROR;
    this.logger.error('스케줄러 단계 처리 실패', err.stack, { stage });
  }
}
