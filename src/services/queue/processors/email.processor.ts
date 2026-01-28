import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs/promises';
import { join } from 'path';
import { Resend } from 'resend';
import { EnvironmentService } from '../../../config';
import { ConfigService } from '../../../config/core/config.service';
import { ResendConfig } from '../../../config/resend.config';
import { PlatformServiceKey } from '../../../database/models/platformStatus/platformStatus.interface';
import { EventEmitterEventsEnum } from '../../eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../eventEmitter/eventEmitter.service';
import { QueueService } from '../queue.service';

interface SendEmailData {
  to: string | string[];
  subject: string;
  data?: Record<string, any>;
  template?: string;
  body?: string;
}

@Injectable()
export class EmailProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly queueName = 'email';
  private readonly CONCURRENT_EMAIL_PROCESSORS = 5;
  private readonly viewsPath: string;
  private templateCache: Map<string, string> = new Map();

  @Inject(QueueService)
  private readonly queueService: QueueService;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  private readonly resend: Resend;
  private readonly resendConfig: ResendConfig;
  private view: string;

  constructor() {
    this.resendConfig = ConfigService.get<ResendConfig>('resend');
    this.resend = new Resend(this.resendConfig.apiKey);

    // Define the views directory path
    this.viewsPath = join(process.cwd(), 'src', 'resources', 'views');

    this.logger.log(`Email templates directory: ${this.viewsPath}`);
  }

  /**
   * Register job processors when the module initializes
   */
  async onModuleInit() {
    this.logger.log(`Initializing email processor for queue: ${this.queueName}`);
    this.registerProcessors();
  }

  /**
   * Register all job processors for this queue
   */
  registerProcessors() {
    // Register the send-email job processor
    this.queueService.processJobs<SendEmailData>(
      this.queueName,
      'send-email',
      this.processSendEmail.bind(this),
      this.CONCURRENT_EMAIL_PROCESSORS,
    );

    this.logger.log(`Registered email processors for queue: ${this.queueName}`);
  }

  /**
   * Process a send-email job
   */
  private async processSendEmail(job: Job<SendEmailData>): Promise<boolean> {
    const { to, subject, data, template, body } = job.data;

    try {
      this.logger.log(`Processing email job ${job.id}: sending email to ${this.maskEmail(to)}`);

      // Update job progress
      await job.updateProgress(10);

      // Render template if template is provided, otherwise use raw body
      const htmlContent = template || this.view ? await this.renderTemplate(template || this.view, data || {}) : body;

      if (!htmlContent) {
        throw new Error('No email content available. Provide either a template, view, or body.');
      }

      // Send the email
      await this.performProviderSend(to, subject, htmlContent);

      // Update job progress to complete
      await job.updateProgress(100);

      this.logger.log(`Email sent successfully to ${this.maskEmail(to)}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.EMAIL_SERVICE,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${this.maskEmail(to)}: ${error.message}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.EMAIL_SERVICE,
        reason: error.message,
      });
      // to avoid the job being retried, we avoid rethrowing the error
      // throw error;
    }
  }

  /**
   * Sending an email
   */
  private async performProviderSend(to: string | string[], subject: string, body: string): Promise<void> {
    this.logger.debug(`Sending email to: ${this.maskEmail(to)}, subject: ${subject}`);

    const { error } = await this.resend.emails.send({
      from: this.resendConfig.from,
      to: to,
      subject: subject,
      html: body,
    });

    if (error) {
      throw error;
    }
  }

  /**
   * Render an email template by reading file from disk
   * and replacing variables with data
   */
  private async renderTemplate(templateName: string, data: Record<string, any> = {}): Promise<string> {
    try {
      let templateContent: string;

      // Check if template is in cache
      if (this.templateCache.has(templateName) && process.env.NODE_ENV === 'production') {
        templateContent = this.templateCache.get(templateName);
      } else {
        // Read the main template file
        const templatePath = join(this.viewsPath, 'mail', `${templateName}.edge`);
        templateContent = await fs.readFile(templatePath, 'utf8');

        // Process includes to handle header and footer
        templateContent = await this.processIncludes(templateContent);

        // Store in cache if in production
        if (process.env.NODE_ENV === 'production') {
          this.templateCache.set(templateName, templateContent);
        }
      }

      const templateData = {
        title: 'OneDosh - ' + templateName.charAt(0).toUpperCase() + templateName.slice(1).replaceAll('_', ' '),
        currentYear: new Date().getFullYear(),
        ...data,
      };

      // Process loops first (loops handle their own variable replacement)
      let renderedContent = this.processLoops(templateContent, templateData);

      // Process if statements (if statements handle their own variable replacement)
      renderedContent = this.processIfStatement(renderedContent, templateData);

      // Replace remaining variables that are not inside loops or if statements
      renderedContent = this.replaceVariables(renderedContent, templateData);

      return renderedContent;
    } catch (error) {
      this.logger.error(`Failed to render email template ${templateName}: ${error.message}`);
      throw new Error(`Failed to render email template: ${error.message}`);
    }
  }

  /**
   * Process @include directives in templates
   */
  private async processIncludes(content: string): Promise<string> {
    // Regular expression to find @include statements
    const includeRegex = /@include\(['"]([^'"]+)['"]\)/g;
    let match;
    let processedContent = content;

    // Process all @include directives
    while ((match = includeRegex.exec(content)) !== null) {
      const includePath = match[1];

      // Security: Prevent path traversal by rejecting paths with '..'
      if (includePath.includes('..') || includePath.startsWith('/')) {
        this.logger.warn(`Blocked potentially malicious include path: ${includePath}`);
        processedContent = processedContent.replace(match[0], '');
        continue;
      }

      const fullIncludePath = join(this.viewsPath, `${includePath}.edge`);

      try {
        // Read the included file
        const includedContent = await fs.readFile(fullIncludePath, 'utf8');

        // Replace the @include with the file contents
        processedContent = processedContent.replace(match[0], includedContent);
      } catch (error) {
        this.logger.error(`Failed to include file ${includePath}: ${error.message}`);
        // Replace with empty string if file not found
        processedContent = processedContent.replace(match[0], '');
      }
    }

    return processedContent;
  }

  /**
   * Process @each loops in templates
   */
  private processLoops(content: string, data: Record<string, any>): string {
    let processedContent = content;

    // Process from innermost to outermost by repeatedly finding and processing @each blocks
    // until no more @each statements remain
    let hasLoops = true;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    while (hasLoops && iterations < maxIterations) {
      iterations++;
      hasLoops = false;

      // Find @each blocks by manually parsing to handle balanced parentheses
      // Create a new regex each iteration to avoid state issues
      const eachStartPattern = /@each\s*\(/g;
      let match;
      let foundMatch = false;

      // Reset regex lastIndex to ensure we start from the beginning
      eachStartPattern.lastIndex = 0;

      while ((match = eachStartPattern.exec(processedContent)) !== null) {
        const startPos = match.index;
        const conditionStart = match.index + match[0].length;
        let depth = 1;
        let i = conditionStart;
        let conditionEnd = -1;

        // Find the matching closing parenthesis
        while (i < processedContent.length && depth > 0) {
          if (processedContent[i] === '(') {
            depth++;
          } else if (processedContent[i] === ')') {
            depth--;
            if (depth === 0) {
              conditionEnd = i;
              break;
            }
          }
          i++;
        }

        if (conditionEnd === -1) {
          continue; // Invalid syntax, skip
        }

        const loopCondition = processedContent.substring(conditionStart, conditionEnd).trim();
        const afterCondition = processedContent.substring(conditionEnd + 1);

        // Find @endeach
        const endeachRegex = /@endeach/;
        const endeachMatch = endeachRegex.exec(afterCondition);

        if (!endeachMatch) {
          continue; // Invalid syntax, skip
        }

        const loopContent = afterCondition.substring(0, endeachMatch.index);
        const fullMatchStart = startPos;
        const fullMatchEnd = conditionEnd + 1 + endeachMatch.index + '@endeach'.length;

        // Parse loop condition: "item in items" or "item, index in items"
        const loopResult = this.parseLoopCondition(loopCondition, data);
        if (loopResult) {
          const { items, itemVar, indexVar } = loopResult;
          let loopOutput = '';

          if (Array.isArray(items)) {
            for (let index = 0; index < items.length; index++) {
              const item = items[index];
              const loopData = { ...data };
              loopData[itemVar] = item;
              if (indexVar) {
                loopData[indexVar] = index;
              }

              // Process loop content: replace variables, process nested loops and if statements
              let itemContent = this.replaceVariables(loopContent, loopData);
              itemContent = this.processLoops(itemContent, loopData);
              itemContent = this.processIfStatement(itemContent, loopData);
              loopOutput += itemContent;
            }
          }

          // Replace using substring to avoid regex special character issues
          processedContent =
            processedContent.substring(0, fullMatchStart) + loopOutput + processedContent.substring(fullMatchEnd);
          hasLoops = true;
          foundMatch = true;
          break; // Process one at a time
        } else {
          // Log warning if loop condition couldn't be parsed
          this.logger.warn(
            `Failed to parse loop condition: "${loopCondition}". Available data keys: ${Object.keys(data).join(', ')}`,
          );
        }
      }

      // If no match was found and processed, break to avoid infinite loop
      if (!foundMatch && !hasLoops) {
        break;
      }
    }

    if (iterations >= maxIterations) {
      this.logger.warn(
        'Maximum iterations reached while processing @each loops. Some loops may not have been processed.',
      );
    }

    return processedContent;
  }

  /**
   * Parse loop condition and return loop variables
   * Supports: "item in items", "item, index in items", "item in nested.items"
   */
  private parseLoopCondition(
    condition: string,
    data: Record<string, any>,
  ): {
    items: any[];
    itemVar: string;
    indexVar?: string;
  } | null {
    // Normalize condition: remove extra whitespace and newlines
    const normalizedCondition = condition.replace(/\s+/g, ' ').trim();

    // Match patterns like "item in items" or "item, index in items" or "item in nested.items"
    // Allow word characters and dots for nested paths
    const loopPattern = /^(\w+)(?:\s*,\s*(\w+))?\s+in\s+([\w.]+)$/;
    const match = loopPattern.exec(normalizedCondition);

    if (!match) {
      this.logger.debug(`Loop pattern did not match condition: "${normalizedCondition}"`);
      return null;
    }

    const itemVar = match[1];
    const indexVar = match[2];
    const itemsPath = match[3];

    // Get the items array from data (supports nested paths like "user.items")
    const items = this.getNestedValue(data, itemsPath);

    if (items === undefined || items === null) {
      this.logger.debug(
        `Items not found at path "${itemsPath}" in data. Available keys: ${Object.keys(data).join(', ')}`,
      );
      return null;
    }

    if (!Array.isArray(items)) {
      this.logger.debug(
        `Value at path "${itemsPath}" is not an array. Type: ${typeof items}, Value: ${JSON.stringify(items)}`,
      );
      return null;
    }

    return { items, itemVar, indexVar };
  }

  /**
   * Process @if statements in templates
   */
  private processIfStatement(content: string, data: Record<string, any>): string {
    let processedContent = content;

    // Process from innermost to outermost by repeatedly finding and processing @if blocks
    // until no more @if statements remain
    let hasIfStatements = true;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    while (hasIfStatements && iterations < maxIterations) {
      iterations++;
      hasIfStatements = false;

      // Find @if blocks by manually parsing to handle balanced parentheses
      const ifStartPattern = /@if\s*\(/g;
      let match;

      while ((match = ifStartPattern.exec(processedContent)) !== null) {
        const startPos = match.index;
        const conditionStart = match.index + match[0].length;
        let depth = 1;
        let i = conditionStart;
        let conditionEnd = -1;

        // Find the matching closing parenthesis
        while (i < processedContent.length && depth > 0) {
          if (processedContent[i] === '(') {
            depth++;
          } else if (processedContent[i] === ')') {
            depth--;
            if (depth === 0) {
              conditionEnd = i;
              break;
            }
          }
          i++;
        }

        if (conditionEnd === -1) {
          continue; // Invalid syntax, skip
        }

        const condition = processedContent.substring(conditionStart, conditionEnd).trim();
        const afterCondition = processedContent.substring(conditionEnd + 1);

        // Find @else and @endif
        const elseRegex = /@else\s*/;
        const endifRegex = /@endif/;
        const elseMatch = elseRegex.exec(afterCondition);
        const endifMatch = endifRegex.exec(afterCondition);

        if (!endifMatch) {
          continue; // Invalid syntax, skip
        }

        let ifContent = '';
        let elseContent = '';
        const contentEnd = endifMatch.index;

        if (elseMatch && elseMatch.index < contentEnd) {
          // @else exists and is before @endif
          ifContent = afterCondition.substring(0, elseMatch.index).trim();
          const elseContentStart = elseMatch.index + elseMatch[0].length;
          elseContent = afterCondition.substring(elseContentStart, contentEnd).trim();
        } else {
          // No @else clause
          ifContent = afterCondition.substring(0, contentEnd).trim();
        }

        const conditionResult = this.evaluateCondition(condition, data);
        const replacement = conditionResult ? ifContent : elseContent;
        const fullMatch = processedContent.substring(startPos, conditionEnd + 1 + endifMatch.index + '@endif'.length);

        processedContent = processedContent.replace(fullMatch, replacement);
        hasIfStatements = true;
        break; // Process one at a time
      }
    }

    if (iterations >= maxIterations) {
      this.logger.warn(
        'Maximum iterations reached while processing @if statements. Some statements may not have been processed.',
      );
    }

    return processedContent;
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, data: Record<string, any>): boolean {
    // Remove extra whitespace
    condition = condition.trim();

    // Handle negation
    if (condition.startsWith('!')) {
      return !this.evaluateCondition(condition.substring(1).trim(), data);
    }

    // Handle parentheses for grouping
    if (condition.startsWith('(') && condition.endsWith(')')) {
      return this.evaluateCondition(condition.slice(1, -1).trim(), data);
    }

    // Handle logical operators (process && before || due to precedence)
    if (condition.includes('||')) {
      const parts = this.splitByOperator(condition, '||');
      return parts.some((part) => this.evaluateCondition(part.trim(), data));
    }

    if (condition.includes('&&')) {
      const parts = this.splitByOperator(condition, '&&');
      return parts.every((part) => this.evaluateCondition(part.trim(), data));
    }

    // Handle comparison operators (check longer operators first to avoid partial matches)
    const comparisonOperators = ['<=', '>=', '==', '!=', '<', '>'];
    for (const operator of comparisonOperators) {
      if (condition.includes(operator)) {
        const parts = condition.split(operator);
        if (parts.length === 2) {
          const left = parts[0].trim();
          const right = parts[1].trim();
          const leftValue = this.evaluateVariable(left, data);
          const rightValue = this.evaluateVariable(right, data);

          // Handle undefined values
          if (leftValue === undefined || rightValue === undefined) {
            return false;
          }

          switch (operator) {
            case '==':
              return leftValue == rightValue;
            case '!=':
              return leftValue != rightValue;
            case '<=':
              return Number(leftValue) <= Number(rightValue);
            case '>=':
              return Number(leftValue) >= Number(rightValue);
            case '<':
              return Number(leftValue) < Number(rightValue);
            case '>':
              return Number(leftValue) > Number(rightValue);
          }
        }
      }
    }

    // Handle simple truthiness check
    const value = this.evaluateVariable(condition, data);
    return Boolean(value);
  }

  /**
   * Split a condition by operator while respecting parentheses
   */
  private splitByOperator(condition: string, operator: string): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let depth = 0;
    let i = 0;

    while (i < condition.length) {
      const char = condition[i];
      const nextChars = condition.substring(i, i + operator.length);

      if (char === '(') {
        depth++;
        currentPart += char;
        i++;
      } else if (char === ')') {
        depth--;
        currentPart += char;
        i++;
      } else if (nextChars === operator && depth === 0) {
        parts.push(currentPart.trim());
        currentPart = '';
        i += operator.length;
      } else {
        currentPart += char;
        i++;
      }
    }

    // Always add the last part, even if it's empty
    parts.push(currentPart.trim());

    return parts;
  }

  /**
   * Replace variables in template with actual data
   */
  private replaceVariables(content: string, data: Record<string, any>): string {
    let processedContent = content;

    // Replace {{variable}} syntax
    const variableRegex = /\{\{([^{}]+)\}\}/g;
    processedContent = processedContent.replaceAll(variableRegex, (_match, variableName) => {
      const trimmedName = variableName.trim();

      // Handle conditionals with || operator
      if (trimmedName.includes('||')) {
        const [primaryVar, fallbackVar] = trimmedName.split('||').map((v) => v.trim());
        const primaryValue = this.getNestedValue(data, primaryVar);
        return primaryValue !== undefined ? primaryValue : this.evaluateVariable(fallbackVar, data);
      }

      return this.getNestedValue(data, trimmedName) || '';
    });

    return processedContent;
  }

  /**
   * Mask email address for logging
   */
  private maskEmail(email: string | string[]): string {
    if (!EnvironmentService.isProduction()) {
      return email as string;
    }

    const mask = (addr: string): string => {
      if (!addr || !addr.includes('@')) return '***';
      const [local, domain] = addr.split('@');
      if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
      }
      return `${local[0]}***${local[local.length - 1]}@${domain}`;
    };

    if (Array.isArray(email)) {
      return email.map(mask).join(', ');
    }
    return mask(email);
  }

  /**
   * Get nested object values using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    // Handle empty or undefined input
    if (!path || !obj) return undefined;

    // Remove any quotes if present
    const cleanPath = path.replaceAll(/['"]/g, '');

    // Handle dot notation for nested properties
    const parts = cleanPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Evaluate a variable or literal value
   */
  private evaluateVariable(value: string, data: Record<string, any>): any {
    // If it's a quoted string, return the string without quotes
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      return value.slice(1, -1);
    }

    // Check if it's a new Date() expression
    if (value === 'new Date().getFullYear()') {
      return new Date().getFullYear();
    }

    // Try to find it in the data object first
    const dataValue = this.getNestedValue(data, value);
    if (dataValue !== undefined) {
      return dataValue;
    }

    // If not found in data, try to parse as number
    const numValue = Number(value);
    if (!Number.isNaN(numValue) && value.trim() !== '') {
      return numValue;
    }

    // Return undefined if not found and not a number
    return undefined;
  }

  /**
   * Helper method to queue a new email with template
   */
  public async sendTemplatedEmail(
    to: string | string[],
    subject: string,
    template: string,
    data: Record<string, any> = {},
    delay?: number,
  ): Promise<Job<SendEmailData>> {
    const SEND_EMAIL_JOB_NAME = 'send-email';

    return this.queueService.addJob<SendEmailData>(
      this.queueName,
      SEND_EMAIL_JOB_NAME,
      { to, subject, template, data },
      { delay, attempts: 3 },
    );
  }

  /**
   * Helper method to queue a new email with raw HTML body
   */
  public async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    delay?: number,
  ): Promise<Job<SendEmailData>> {
    const SEND_EMAIL_JOB_NAME = 'send-email';

    return this.queueService.addJob<SendEmailData>(
      this.queueName,
      SEND_EMAIL_JOB_NAME,
      { to, subject, body },
      { delay, attempts: 3 },
    );
  }

  /**
   * Set the view template to be used for rendering emails
   */
  public setView(view: string) {
    this.view = view;
    return this;
  }

  /**
   * Render a view directly without queuing
   */
  public async renderView(viewName: string, data: Record<string, any> = {}): Promise<string> {
    return this.renderTemplate(viewName, data);
  }
}
