import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { Job } from 'bullmq';
import { ConfigService } from '../../../config/core/config.service';
import { SinchConfig } from '../../../config/sinch.config';
import { QueueService } from '../queue.service';
import { SendSmsData, SendSmsResponse } from './sms/sms.interface';

@Injectable()
export class SmsProcessor implements OnModuleInit {
  private readonly logger = new Logger(SmsProcessor.name);
  private readonly queueName = 'sms';
  private readonly CONCURRENT_SMS_PROCESSORS = 5;

  @Inject(QueueService)
  private readonly queueService: QueueService;

  private readonly sinchConfig: SinchConfig;

  constructor() {
    this.sinchConfig = ConfigService.get<SinchConfig>('sinch');

    this.logger.log('Sinch SMS processor initialized');
  }

  /**
   * Register job processors when the module initializes
   */
  async onModuleInit() {
    this.logger.log(`Initializing SMS processor for queue: ${this.queueName}`);
    this.registerProcessors();
  }

  /**
   * Register all job processors for this queue
   */
  registerProcessors() {
    // Register the send-sms job processor
    this.queueService.processJobs<SendSmsData>(
      this.queueName,
      'send-sms',
      this.processSendSms.bind(this),
      this.CONCURRENT_SMS_PROCESSORS,
    );

    this.logger.log(`Registered SMS processors for queue: ${this.queueName}`);
  }

  /**
   * Process a send-sms job
   */
  private async processSendSms(job: Job<SendSmsData>): Promise<boolean> {
    const { to, body, from } = job.data;

    try {
      this.logger.log(`Processing SMS job ${job.id}: sending SMS to ${to}`);

      // Update job progress
      await job.updateProgress(10);

      // Prepare recipient list
      const recipients = Array.isArray(to) ? to : [to];

      // Send the SMS
      await this.performSendSms(recipients, body, from);

      // Update job progress to complete
      await job.updateProgress(100);

      this.logger.log(`SMS sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      // to avoid the job being retried, we avoid rethrowing the error
      // throw error;
      return false;
    }
  }

  /**
   * Send an SMS message using Sinch
   */
  private async performSendSms(to: string[], body: string, from?: string): Promise<void> {
    this.logger.debug(`Sending SMS to: ${to}, body: ${body}`);
    this.logger.log({
      to,
      body,
      from,
    });

    try {
      // Since we can't easily determine the correct SDK parameters without TypeScript types,
      // we'll implement a more manual approach using the REST API
      const region = this.sinchConfig.region || 'us';
      const url = `https://${region}.sms.api.sinch.com/xms/v1/${this.sinchConfig.servicePlanId}/batches`;

      const payload = {
        to: to,
        body: body,
      };

      payload['from'] = from || this.sinchConfig.sender;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sinchConfig.apiKey}`,
      };

      // Use the fetch API (available in Node.js since v18)
      const response = await axios<any, AxiosResponse<SendSmsResponse>>(url, {
        method: 'POST',
        headers: headers,
        data: payload,
      });

      if (response.status > 299) {
        throw new BadRequestException(`Failed to send SMS: ${response.status} ${response.statusText}`);
      }

      const result = response.data;

      if (!result.id) {
        throw new BadRequestException('Failed to send SMS: No batch ID returned');
      }

      this.logger.debug(`SMS batch sent with ID: ${result.id}`);
    } catch (error) {
      this.logger.error(error);

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        this.logger.error(`SMS request timed out: ${error.message}`);
      } else if (error.response) {
        // The server responded with a status code outside the 2xx range
        this.logger.error(`SMS API error: ${error.response.status} - ${error.response.data}`);
      } else if (error.request) {
        // The request was made but no response was received
        this.logger.error('SMS API did not respond');
      }
      throw error;
    }
  }

  /**
   * Helper method to queue a new SMS
   */
  public async sendSms(to: string | string[], body: string, from?: string, delay?: number): Promise<Job<SendSmsData>> {
    const SEND_SMS_JOB_NAME = 'send-sms';

    return this.queueService.addJob<SendSmsData>(
      this.queueName,
      SEND_SMS_JOB_NAME,
      { to, body, from },
      { delay, attempts: 3 },
    );
  }

  /**
   * Helper method to schedule an SMS for future delivery
   */
  public async scheduleSms(
    to: string | string[],
    body: string,
    scheduledTime: Date,
    from?: string,
  ): Promise<Job<SendSmsData>> {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      // If scheduled time is in the past, send immediately
      return this.sendSms(to, body, from);
    }

    return this.sendSms(to, body, from, delay);
  }
}
