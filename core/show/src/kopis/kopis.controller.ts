import { Controller, Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { KopisScheduler } from './kopis.scheduler';
import { ApiOperation, ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ManualSyncDto } from './dto/manual-sync.dto';
import { TraceService } from '@neticket/common';

@ApiTags('KOPIS')
@Controller('kopis')
export class KopisController {
  constructor(
    private readonly kopisScheduler: KopisScheduler,
    private readonly traceService: TraceService,
  ) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'KOPIS 공연 데이터 수동 동기화' })
  @ApiBody({ type: ManualSyncDto })
  @ApiResponse({
    status: 200,
    description: '동기화 작업이 시작되었습니다. (로그 확인 필요)',
  })
  async syncManual(@Body() body: ManualSyncDto) {
    const startDate = body.start_date ? new Date(body.start_date) : undefined;
    const endDate = body.end_date ? new Date(body.end_date) : undefined;
    await this.traceService.runWithTraceId(
      this.traceService.generateTraceId(),
      () => this.kopisScheduler.syncPerformances(startDate, endDate),
    );
    return { message: 'KOPIS data sync completed' };
  }
}
