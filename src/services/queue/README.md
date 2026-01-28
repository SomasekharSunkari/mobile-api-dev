# Queue Service for OneDosh

This module provides a queue management system for handling asynchronous tasks in the OneDosh application. It uses BullMQ to manage queues and workers, leveraging the existing Redis connection.

## Getting Started

1. First, install the BullMQ package:

```bash
yarn add bullmq --save
```

2. Import the QueueModule in your application module:

```typescript
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    // ...other modules
    QueueModule,
  ],
})
export class AppModule {}
```

## Creating a Job Processor

Create a new processor class that will handle specific jobs:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService } from '../queue/queue.service';

interface MyJobData {
  // Define your job data structure
}

@Injectable()
export class MyProcessor implements OnModuleInit {
  private readonly queueName = 'my-queue';

  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    // Register job processors when the module initializes
    this.queueService.processJobs<MyJobData>(
      this.queueName,
      'my-job-name',
      this.processMyJob.bind(this),
      3, // Process 3 jobs concurrently
    );
  }

  private async processMyJob(job: Job<MyJobData>): Promise<any> {
    // Process your job
    const data = job.data;

    // Update progress if needed
    await job.updateProgress(50);

    // Perform your task
    // ...

    return { success: true };
  }

  // Helper method to queue jobs
  async queueMyJob(data: MyJobData, options?: any): Promise<Job<MyJobData>> {
    return this.queueService.addJob(this.queueName, 'my-job-name', data, options);
  }
}
```

## Adding Jobs to a Queue

Inject the QueueService or your processor into your service:

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { MyProcessor } from './my.processor';

@Injectable()
export class MyService {
  constructor(
    private readonly queueService: QueueService,
    private readonly myProcessor: MyProcessor,
  ) {}

  async doSomething(): Promise<void> {
    // Using the processor helper method
    await this.myProcessor.queueMyJob({
      // your job data
    });

    // Or directly using the queue service
    await this.queueService.addJob(
      'my-queue',
      'my-job-name',
      {
        // your job data
      },
      {
        delay: 5000, // 5 seconds delay
        attempts: 3, // Retry 3 times on failure
      },
    );
  }
}
```

## Job Options

You can provide options when adding jobs:

- `delay`: Milliseconds to wait before processing the job
- `priority`: Priority value (lower is higher priority)
- `attempts`: Number of retry attempts on failure
- `backoff`: Backoff strategy for retries
- `removeOnComplete`: Whether to remove the job on completion
- `removeOnFail`: Whether to remove the job on final failure

## Error Handling

Jobs will automatically retry on failure based on the attempts option. You can handle errors in your processor by:

```typescript
private async processMyJob(job: Job<MyJobData>): Promise<any> {
  try {
    // Process job
    return result;
  } catch (error) {
    // Log the error
    console.error(`Failed to process job ${job.id}:`, error);

    // Rethrow the error to trigger retry mechanism
    throw error;
  }
}
```

## Monitoring Jobs

You can use the QueueController to view job status through the API:

- `POST /queue/job` - Add a new job
- `GET /queue/job/:queueName/:jobId` - Get job details

## Best Practices

1. Always ensure your job processors are idempotent (can be run multiple times safely)
2. Use appropriate concurrency limits based on the resource requirements of your jobs
3. Set reasonable retry attempts and backoff strategies
4. Implement proper error handling within job processors
5. Consider implementing job result storage for important operations
