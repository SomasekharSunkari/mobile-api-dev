import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SystemConfigModel } from '../../database/models/systemConfig/systemConfig.model';
import { GetSystemConfigsDto } from './dto/getSystemConfigs.dto';
import { SystemConfigRepository } from './systemConfig.repository';

export enum SystemConfigKey {
  MINIMUM_APP_VERSION = 'minimum_app_version',
}
@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  @Inject(SystemConfigRepository)
  private readonly systemConfigRepository: SystemConfigRepository;

  public async getSystemConfigs(query: GetSystemConfigsDto): Promise<SystemConfigModel[]> {
    this.logger.log(`getSystemConfigs: type=${query.type}`, 'SystemConfigService');

    try {
      const queryBuilder = this.systemConfigRepository.query().limit(100);

      if (query.type) {
        queryBuilder.where('type', query.type);
      }

      if (query.key) {
        queryBuilder.where('key', query.key);
      }

      return (await queryBuilder) as unknown as SystemConfigModel[];
    } catch (error) {
      this.logger.error(error.message, 'SystemConfigService');
      throw new InternalServerErrorException('Something went wrong while fetching system configs');
    }
  }
}
