import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionMonitoringAdapter } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { LoginDeviceModel } from '../../../database/models/loginDevice/loginDevice.model';
import { LoginEventRepository } from '../loginEvent/loginEvent.repository';
import { LoginDeviceRepository } from './loginDevice.repository';

@Injectable()
export class LoginDeviceService {
  private readonly logger = new Logger(LoginDeviceService.name);
  constructor(
    @Inject(LoginDeviceRepository)
    private readonly loginDeviceRepo: LoginDeviceRepository,

    @Inject(LoginEventRepository)
    private readonly loginEventRepo: LoginEventRepository,

    @Inject(TransactionMonitoringAdapter)
    private readonly transactionMonitoringAdapter: TransactionMonitoringAdapter,
  ) {}

  async log(userId: string, ipAddress: string, deviceFingerprint: string, trx?: any) {
    // Simple device tracking using device fingerprint as unique identifier
    let device = await this.loginDeviceRepo.findOne({
      user_id: userId,
      device_fingerprint: deviceFingerprint,
    });

    if (!device) {
      device = await this.loginDeviceRepo.create(
        {
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          is_trusted: false,
          last_login: new Date().toISOString(),
        },
        trx,
      );
    } else {
      await this.loginDeviceRepo.update(device.id, {
        last_login: new Date().toISOString(),
      });
    }

    await this.loginEventRepo.create(
      {
        user_id: userId,
        device_id: device.id,
        ip_address: ipAddress,
        login_time: new Date().toISOString(),
      },
      trx,
    );
  }

  /**
   * Registers a device using Sumsub IP check for verification
   */
  async registerDevice(userId: string, ipAddress: string, deviceFingerprint: string, trx?: any): Promise<void> {
    try {
      // Call Sumsub IP check to get geo location data
      const ipCheckResult = await this.transactionMonitoringAdapter.ipCheck({
        ipAddress,
        userId,
      });

      const geoData = ipCheckResult;

      // Create trusted device with geo data
      const device = await this.loginDeviceRepo.create(
        {
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          is_trusted: true,
          last_verified_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        },
        trx,
      );

      // Create login event with geo data
      await this.loginEventRepo.create(
        {
          user_id: userId,
          device_id: device.id,
          ip_address: ipAddress,
          login_time: new Date().toISOString(),
          city: geoData.city,
          region: geoData.region,
          country: geoData.country,
        },
        trx,
      );

      this.logger.log(`Device registered with trust verification for user ${userId}`, 'LoginDeviceService');
    } catch (error) {
      this.logger.error(
        `Failed to verify device during registration for user ${userId}: ${error.message}`,
        'LoginDeviceService',
      );

      // Fallback: create unverified device
      const device = await this.loginDeviceRepo.create(
        {
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          is_trusted: false,
          last_login: new Date().toISOString(),
        },
        trx,
      );

      // Create login event without geo data
      await this.loginEventRepo.create(
        {
          user_id: userId,
          device_id: device.id,
          ip_address: ipAddress,
          login_time: new Date().toISOString(),
        },
        trx,
      );

      this.logger.log(`Device registered without verification (fallback) for user ${userId}`, 'LoginDeviceService');
    }
  }

  /**
   * Find existing device by user ID and device fingerprint
   */
  async findDeviceByUserAndFingerprint(userId: string, deviceFingerprint: string) {
    return await this.loginDeviceRepo.findOne({
      user_id: userId,
      device_fingerprint: deviceFingerprint,
    });
  }

  /**
   * Get the latest login device for a user
   */
  async getLastLoginDevice(userId: string): Promise<LoginDeviceModel | null> {
    try {
      return (await this.loginDeviceRepo
        .query()
        .where({ user_id: userId })
        .orderBy('last_login', 'desc')
        .first()) as LoginDeviceModel;
    } catch (error) {
      Logger.error(`Failed to get latest device for user ${userId}: ${error.message}`, 'LoginDeviceService');
      return null;
    }
  }
}
