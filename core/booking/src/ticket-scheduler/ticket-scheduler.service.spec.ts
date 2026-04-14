/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TraceService } from '@neticket/common';
import { TicketSchedulerService } from './ticket-scheduler.service';
import { TicketSetupService } from '../ticket-setup/ticket-setup.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

// CronJob 모킹: 실제 타이머가 돌지 않게 함
jest.mock('cron', () => {
  return {
    CronJob: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
    })),
  };
});

describe('TicketSchedulerService', () => {
  let service: TicketSchedulerService;
  let setupService: jest.Mocked<TicketSetupService>;
  let module: TestingModule | undefined;

  const schedulerRegistryMock = {
    addCronJob: jest.fn(),
    getCronJob: jest.fn().mockReturnValue({ stop: jest.fn() }),
  };

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => defaultValue),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        TicketSchedulerService,
        {
          provide: TicketSetupService,
          useValue: {
            setup: jest.fn(),
            openTicketing: jest.fn(),
            tearDown: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: schedulerRegistryMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: TraceService,
          useValue: {
            generateTraceId: jest.fn().mockReturnValue('trace-id'),
            runWithTraceId: jest
              .fn()
              .mockImplementation((_id: string, fn: () => unknown) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get<TicketSchedulerService>(TicketSchedulerService);
    setupService = module.get(TicketSetupService);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('onModuleInit', () => {
    it('3개의 크론 잡(setup, open, close)을 등록해야 한다', () => {
      service.onModuleInit();
      expect(schedulerRegistryMock.addCronJob).toHaveBeenCalledTimes(3);
    });
  });

  describe('상태 머신 흐름 제어', () => {
    it('정상적인 순서(setup -> open -> close)로 상태가 전이되어야 한다', async () => {
      // 1. Setup 실행
      await (service as any).runSetup();
      expect(setupService.setup).toHaveBeenCalled();
      expect((service as any).status).toBe('SETUP');

      // 2. Open 실행
      await (service as any).runOpen();
      expect(setupService.openTicketing).toHaveBeenCalled();
      expect((service as any).status).toBe('OPEN');

      // 3. Close 실행
      await (service as any).runClose();
      expect(setupService.tearDown).toHaveBeenCalled();
      expect((service as any).status).toBe('CLOSE');
    });

    it('SETUP 상태가 아니면 Open 단계를 건너뛰어야 한다', async () => {
      // 초기 상태(CLOSE)에서 Open 시도
      await (service as any).runOpen();
      expect(setupService.openTicketing).not.toHaveBeenCalled();
      expect((service as any).status).toBe('CLOSE');
    });

    it('OPEN 상태가 아니면 Close 단계를 건너뛰어야 한다', async () => {
      // 초기 상태(CLOSE)에서 Close 시도
      await (service as any).runClose();
      expect(setupService.tearDown).not.toHaveBeenCalled();
    });

    it('단계 도중 에러가 발생하면 ERROR 상태가 되고 다음 단계가 차단되어야 한다', async () => {
      // Setup에서 에러 발생
      jest
        .mocked(setupService.setup)
        .mockRejectedValue(new Error('Setup Fail'));

      await (service as any).runSetup();
      expect((service as any).status).toBe('ERROR');

      // ERROR 상태에서 Open 시도 -> 실행되지 않아야 함
      await (service as any).runOpen();
      expect(setupService.openTicketing).not.toHaveBeenCalled();
      expect((service as any).status).toBe('ERROR');
    });

    it('ERROR 상태에서 Setup은 다시 실행 가능해야 한다', async () => {
      (service as any).status = 'ERROR';

      await (service as any).runSetup();
      expect(setupService.setup).toHaveBeenCalled();
      expect((service as any).status).toBe('SETUP');
    });
  });
});
