import { Injectable, Logger } from '@nestjs/common';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { RedisService } from '../redis/redis.service';

/**
 * Interface representing a job processor function
 */
export type JobProcessor<T = any, R = any> = (job: Job<T>) => Promise<R>;

/**
 * Interface for queue configuration
 */
export interface QueueConfig {
  name: string;
  options?: JobsOptions;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private _connection: IORedis;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get the Redis connection, initializing it if necessary
   * This ensures the connection is available regardless of module init order
   */
  private getConnection(): IORedis {
    if (!this._connection) {
      this.logger.log('Initializing queue connection');
      this._connection = this.redisService.getClient();
      this._connection.options.keyPrefix = undefined;
      this._connection.options.maxRetriesPerRequest = null;
    }
    return this._connection;
  }

  /**
   * Get or create a queue instance
   * @param name The name of the queue
   * @returns A Queue instance
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.logger.log(`Creating queue: ${name}`);
      const queue = new Queue(name, {
        connection: this.getConnection(),
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name);
  }

  /**
   * Add a job to the queue
   * @param queueName The name of the queue
   * @param jobName The name of the job
   * @param data The data for the job
   * @param options Job options
   * @returns The created job
   */
  async addJob<T = any>(queueName: string, jobName: string, data: T, options?: JobsOptions): Promise<Job<T>> {
    const queue = this.getQueue(queueName);

    // Add timeout to prevent indefinite hanging
    const timeout = 10000; // 10 seconds
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Queue addJob timeout after ${timeout}ms for queue ${queueName}, job ${jobName}`)),
        timeout,
      );
    });

    try {
      this.logger.debug(`Adding job ${jobName} to queue ${queueName}`);
      const jobPromise = queue.add(jobName, data, options);
      const job = await Promise.race([jobPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      this.logger.debug(`Job ${jobName} added to queue ${queueName} with ID: ${job.id}`);
      return job;
    } catch (error) {
      clearTimeout(timeoutId);
      this.logger.error(`Failed to add job ${jobName} to queue ${queueName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process jobs from a queue
   * @param queueName The name of the queue
   * @param jobName The name of the job to process
   * @param processor The processor function
   * @param concurrency Number of concurrent jobs (default: 1)
   */
  processJobs<T = any, R = any>(
    queueName: string,
    jobName: string,
    processor: JobProcessor<T, R>,
    concurrency = 5,
  ): Worker<T, R> {
    const workerKey = `${queueName}:${jobName}`;

    if (!this.workers.has(workerKey)) {
      this.logger.log(`Creating worker for ${workerKey} with concurrency ${concurrency}`);

      const worker = new Worker<T, R>(
        queueName,
        async (job) => {
          if (job.name === jobName) {
            return await processor(job);
          }
          return null;
        },
        {
          connection: this.getConnection(),
          concurrency,
        },
      );

      // Set up event handlers
      worker.on('completed', (job) => {
        this.logger.debug(`Job ${job.id} completed in queue ${queueName}`);
      });

      worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} failed in queue ${queueName}: ${err.message}`, err.stack);
      });

      this.workers.set(workerKey, worker);
    }

    return this.workers.get(workerKey);
  }

  /**
   * Process jobs from a queue with a custom router function
   * @param queueName The name of the queue
   * @param processor The processor function that handles all job types
   * @param concurrency Number of concurrent jobs (default: 5)
   */
  processJobsWithRouter<T = any, R = any>(
    queueName: string,
    processor: JobProcessor<T, R>,
    concurrency = 5,
  ): Worker<T, R> {
    const workerKey = `${queueName}:router`;

    if (!this.workers.has(workerKey)) {
      this.logger.log(`Creating router worker for ${queueName} with concurrency ${concurrency}`);

      const worker = new Worker<T, R>(queueName, processor, {
        connection: this.getConnection(),
        concurrency,
      });

      // Set up event handlers
      worker.on('completed', (job) => {
        this.logger.debug(`Job ${job.id} (${job.name}) completed in queue ${queueName}`);
      });

      worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} (${job?.name}) failed in queue ${queueName}: ${err.message}`, err.stack);
      });

      this.workers.set(workerKey, worker);
    }

    return this.workers.get(workerKey);
  }

  /**
   * Add multiple jobs to the queue in bulk
   * @param queueName The name of the queue
   * @param jobs Array of jobs with name, data, and optional options
   * @returns Array of created jobs
   */
  async addBulkJobs<T = any>(
    queueName: string,
    jobs: Array<{ name: string; data: T; opts?: JobsOptions }>,
  ): Promise<Job<T>[]> {
    const queue = this.getQueue(queueName);

    const timeout = 30000; // 30 seconds for bulk operations
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Queue addBulkJobs timeout after ${timeout}ms for queue ${queueName}`)),
        timeout,
      );
    });

    try {
      this.logger.debug(`Adding ${jobs.length} jobs in bulk to queue ${queueName}`);
      const jobPromise = queue.addBulk(jobs);
      const createdJobs = await Promise.race([jobPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      this.logger.debug(`Added ${createdJobs.length} jobs to queue ${queueName}`);
      return createdJobs;
    } catch (error) {
      clearTimeout(timeoutId);
      this.logger.error(`Failed to add bulk jobs to queue ${queueName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a job by ID
   * @param queueName The name of the queue
   * @param jobId The job ID
   * @returns The job instance
   */
  async getJob<T = any>(queueName: string, jobId: string): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return await queue.getJob(jobId);
  }

  /**
   * Remove a job from the queue
   * @param queueName The name of the queue
   * @param jobId The job ID
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.logger.debug(`Job ${jobId} removed from queue ${queueName}`);
    }
  }

  /**
   * Close all queues and workers
   * This should be called when the application is shutting down
   */
  async closeAll(): Promise<void> {
    this.logger.log('Closing all queues and workers');

    // Close workers
    await Promise.all(Array.from(this.workers.values()).map((worker) => worker.close()));

    // Close queues
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));

    this.logger.log('All queues and workers closed');
  }
}
