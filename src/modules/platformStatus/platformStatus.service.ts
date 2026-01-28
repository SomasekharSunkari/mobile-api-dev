import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  IPlatformStatus,
  PlatformServiceKey,
  PlatformStatusEnum,
} from '../../database/models/platformStatus/platformStatus.interface';
import { PlatformStatusModel } from '../../database/models/platformStatus/platformStatus.model';
import { PlatformStatusTriggeredBy } from '../../database/models/platformStatusLog/platformStatusLog.interface';
import { PlatformStatusLogRepository } from '../platformStatusLog/platformStatusLog.repository';
import { GetPlatformStatusDto } from './dto/getPlatformStatus.dto';
import { UpdatePlatformStatusDto } from './dto/updatePlatformStatus.dto';
import { PlatformStatusRepository } from './platformStatus.repository';

/**
 * Service names mapping for display purposes
 */
const SERVICE_NAMES: Record<PlatformServiceKey, string> = {
  [PlatformServiceKey.AUTHENTICATION]: 'Authentication',
  [PlatformServiceKey.EMAIL_SERVICE]: 'Email Service',
  [PlatformServiceKey.REDIS]: 'Redis Cache',
  [PlatformServiceKey.PUSH_NOTIFICATION]: 'Push Notifications',
  [PlatformServiceKey.KYC_SERVICE]: 'KYC Verification',
  [PlatformServiceKey.DATABASE]: 'Database',
  [PlatformServiceKey.NGN_TRANSFER]: 'NGN Transfer',
  [PlatformServiceKey.USD_TRANSFER]: 'USD Transfer',
  [PlatformServiceKey.CURRENCY_EXCHANGE]: 'Currency Exchange',
  [PlatformServiceKey.RATE_GENERATION]: 'Rate Generation',
  [PlatformServiceKey.USD_WITHDRAWAL]: 'USD Withdrawal',
  [PlatformServiceKey.NGN_TRANSFER_OUT]: 'NGN Transfer Out',
  [PlatformServiceKey.CARD_SERVICE]: 'Card Service',
};

@Injectable()
export class PlatformStatusService {
  private readonly logger = new Logger(PlatformStatusService.name);

  @Inject(PlatformStatusRepository)
  private readonly platformStatusRepository: PlatformStatusRepository;

  @Inject(PlatformStatusLogRepository)
  private readonly platformStatusLogRepository: PlatformStatusLogRepository;

  /**
   * Get all platform statuses or filter by service key
   */
  public async getPlatformStatus(
    query: GetPlatformStatusDto,
  ): Promise<{ services: PlatformStatusModel[]; overall_status: PlatformStatusEnum }> {
    this.logger.log(`getPlatformStatus: service_key=${query.service_key || 'all'}`);

    const filter: Partial<IPlatformStatus> = {};
    if (query.service_key) {
      filter.service_key = query.service_key;
    }

    const services = await this.platformStatusRepository.findSync(filter, {
      limit: 100,
      orderBy: 'service_name',
      order: 'asc',
    });

    const overallStatus = this.calculateOverallStatus(services);

    return {
      services,
      overall_status: overallStatus,
    };
  }

  /**
   * Update platform status (admin action)
   */
  public async updatePlatformStatus(
    serviceKey: string,
    dto: UpdatePlatformStatusDto,
    adminUserId: string,
  ): Promise<PlatformStatusModel> {
    this.logger.log(`updatePlatformStatus: serviceKey=${serviceKey}, status=${dto.status}, adminUserId=${adminUserId}`);

    const platformStatus = await this.platformStatusRepository.findOne({
      service_key: serviceKey,
    });

    if (!platformStatus) {
      throw new NotFoundException(`Service with key '${serviceKey}' not found`);
    }

    const previousStatus = platformStatus.status;

    const updatedStatus = await this.platformStatusRepository.update(platformStatus.id, {
      status: dto.status,
      custom_message: dto.custom_message || null,
      is_manually_set: true,
      last_checked_at: new Date(),
      failure_reason: dto.status !== PlatformStatusEnum.OPERATIONAL ? dto.reason || 'Manually set by admin' : null,
      last_failure_at: dto.status !== PlatformStatusEnum.OPERATIONAL ? new Date() : platformStatus.last_failure_at,
    });

    await this.createStatusLog(
      platformStatus.id,
      previousStatus,
      dto.status,
      dto.reason || 'Manually updated by admin',
      PlatformStatusTriggeredBy.ADMIN,
      adminUserId,
    );

    return updatedStatus;
  }

  /**
   * Update service status based on system events
   */
  public async updateServiceStatus(
    serviceKey: PlatformServiceKey,
    status: PlatformStatusEnum,
    reason?: string,
  ): Promise<PlatformStatusModel> {
    this.logger.log(`updateServiceStatus: serviceKey=${serviceKey}, status=${status}, reason=${reason}`);

    let platformStatus = await this.platformStatusRepository.findOne({
      service_key: serviceKey,
    });

    if (!platformStatus) {
      platformStatus = await this.initializeServiceStatus(serviceKey);
    }

    // If status is manually set by admin, don't override unless it's a system recovery
    if (platformStatus.is_manually_set && status !== PlatformStatusEnum.OPERATIONAL) {
      this.logger.log(`Skipping update for ${serviceKey} - status is manually set by admin`);
      return platformStatus;
    }

    const previousStatus = platformStatus.status;

    // Only update if status has changed
    if (previousStatus === status) {
      await this.platformStatusRepository.update(platformStatus.id, {
        last_checked_at: new Date(),
      });
      return platformStatus;
    }

    const updatedStatus = await this.platformStatusRepository.update(platformStatus.id, {
      status,
      last_checked_at: new Date(),
      failure_reason: status !== PlatformStatusEnum.OPERATIONAL ? reason : null,
      last_failure_at: status !== PlatformStatusEnum.OPERATIONAL ? new Date() : platformStatus.last_failure_at,
      is_manually_set: false,
      custom_message: status === PlatformStatusEnum.OPERATIONAL ? null : platformStatus.custom_message,
    });

    await this.createStatusLog(platformStatus.id, previousStatus, status, reason, PlatformStatusTriggeredBy.SYSTEM);

    return updatedStatus;
  }

  /**
   * Report service success (sets status to operational)
   */
  public async reportServiceSuccess(serviceKey: PlatformServiceKey): Promise<void> {
    await this.updateServiceStatus(serviceKey, PlatformStatusEnum.OPERATIONAL);
  }

  /**
   * Report service failure (sets status to down)
   */
  public async reportServiceFailure(serviceKey: PlatformServiceKey, reason: string): Promise<void> {
    await this.updateServiceStatus(serviceKey, PlatformStatusEnum.DOWN, reason);
  }

  /**
   * Report service degradation
   */
  public async reportServiceDegraded(serviceKey: PlatformServiceKey, reason: string): Promise<void> {
    await this.updateServiceStatus(serviceKey, PlatformStatusEnum.DEGRADED, reason);
  }

  /**
   * Initialize all service statuses on application startup
   */
  public async initializeAllServiceStatuses(): Promise<void> {
    this.logger.log('Initializing all service statuses');

    const serviceKeys = Object.values(PlatformServiceKey);

    for (const serviceKey of serviceKeys) {
      const existing = await this.platformStatusRepository.findOne({
        service_key: serviceKey,
      });

      if (!existing) {
        await this.initializeServiceStatus(serviceKey);
      }
    }

    this.logger.log('All service statuses initialized');
  }

  /**
   * Initialize a single service status
   */
  private async initializeServiceStatus(serviceKey: PlatformServiceKey): Promise<PlatformStatusModel> {
    const serviceName = SERVICE_NAMES[serviceKey] || serviceKey;

    return this.platformStatusRepository.create({
      service_key: serviceKey,
      service_name: serviceName,
      status: PlatformStatusEnum.OPERATIONAL,
      is_manually_set: false,
      last_checked_at: new Date().toISOString() as unknown as Date,
    });
  }

  /**
   * Create a status change log entry
   */
  private async createStatusLog(
    platformStatusId: string,
    previousStatus: PlatformStatusEnum | undefined,
    newStatus: PlatformStatusEnum,
    reason?: string,
    triggeredBy: PlatformStatusTriggeredBy = PlatformStatusTriggeredBy.SYSTEM,
    adminUserId?: string,
  ): Promise<void> {
    await this.platformStatusLogRepository.create({
      platform_status_id: platformStatusId,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
      triggered_by: triggeredBy,
      admin_user_id: adminUserId,
    });
  }

  /**
   * Calculate overall platform status based on individual services
   */
  private calculateOverallStatus(services: PlatformStatusModel[]): PlatformStatusEnum {
    if (services.length === 0) {
      return PlatformStatusEnum.OPERATIONAL;
    }

    const hasDown = services.some((s) => s.status === PlatformStatusEnum.DOWN);
    if (hasDown) {
      return PlatformStatusEnum.DOWN;
    }

    const hasDegraded = services.some((s) => s.status === PlatformStatusEnum.DEGRADED);
    if (hasDegraded) {
      return PlatformStatusEnum.DEGRADED;
    }

    return PlatformStatusEnum.OPERATIONAL;
  }
}
