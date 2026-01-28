import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import * as fs from 'fs/promises';
import { ConfigService } from '../../../config/core/config.service';
import { EventEmitterService } from '../../eventEmitter/eventEmitter.service';
import { QueueService } from '../queue.service';
import { EmailProcessor } from './email.processor';

jest.mock('fs/promises');
jest.mock('resend');

describe('EmailProcessor', () => {
  let emailProcessor: EmailProcessor;
  let queueService: jest.Mocked<QueueService>;
  let mockResend: any;

  const mockJob = {
    id: 'test-job-id',
    data: {},
    updateProgress: jest.fn(),
  } as unknown as Job;

  beforeAll(() => {
    // Mock ConfigService.get before creating the EmailProcessor instance
    jest.spyOn(ConfigService, 'get').mockReturnValue({
      apiKey: 'test-api-key',
      from: 'test@example.com',
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    mockResend = {
      emails: {
        send: jest.fn().mockResolvedValue({ error: null }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: EventEmitterService,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    emailProcessor = module.get<EmailProcessor>(EmailProcessor);
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;

    // Mock the resend instance
    (emailProcessor as any).resend = mockResend;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize and register processors', async () => {
      jest.spyOn(emailProcessor, 'registerProcessors');
      await emailProcessor.onModuleInit();
      expect(emailProcessor.registerProcessors).toHaveBeenCalled();
    });
  });

  describe('registerProcessors', () => {
    it('should register email processors with queue service', () => {
      emailProcessor.registerProcessors();
      expect(queueService.processJobs).toHaveBeenCalledWith('email', 'send-email', expect.any(Function), 5);
    });
  });

  describe('processSendEmail', () => {
    it('should process email with body successfully', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: '<h1>Test Body</h1>',
      };

      mockJob.data = jobData;

      const result = await (emailProcessor as any).processSendEmail(mockJob);

      expect(result).toBe(true);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: expect.any(String),
        to: jobData.to,
        subject: jobData.subject,
        html: jobData.body,
      });
    });

    it('should process email with template successfully', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'welcome',
        data: { name: 'John Doe' },
      };

      mockJob.data = jobData;

      const mockTemplate = '<h1>Welcome {{name}}</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await (emailProcessor as any).processSendEmail(mockJob);

      expect(result).toBe(true);
      expect(mockResend.emails.send).toHaveBeenCalled();
    });

    it('should handle error when no content is available', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Subject',
      };

      mockJob.data = jobData;

      const result = await (emailProcessor as any).processSendEmail(mockJob);

      expect(result).toBeUndefined();
      expect(mockResend.emails.send).not.toHaveBeenCalled();
    });

    it('should handle error during email sending', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: '<h1>Test</h1>',
      };

      mockJob.data = jobData;
      mockResend.emails.send.mockResolvedValue({ error: new Error('Send failed') });

      const result = await (emailProcessor as any).processSendEmail(mockJob);

      expect(result).toBeUndefined();
    });
  });

  describe('performProviderSend', () => {
    it('should send email successfully', async () => {
      await (emailProcessor as any).performProviderSend('test@example.com', 'Subject', '<h1>Body</h1>');

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'test@example.com',
        subject: 'Subject',
        html: '<h1>Body</h1>',
      });
    });

    it('should throw error if send fails', async () => {
      mockResend.emails.send.mockResolvedValue({ error: new Error('Send failed') });

      await expect(
        (emailProcessor as any).performProviderSend('test@example.com', 'Subject', '<h1>Body</h1>'),
      ).rejects.toThrow('Send failed');
    });

    it('should handle array of recipients', async () => {
      const recipients = ['test1@example.com', 'test2@example.com'];
      await (emailProcessor as any).performProviderSend(recipients, 'Subject', '<h1>Body</h1>');

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: expect.any(String),
        to: recipients,
        subject: 'Subject',
        html: '<h1>Body</h1>',
      });
    });
  });

  describe('renderTemplate', () => {
    it('should render template with data', async () => {
      const mockTemplate = '<h1>Hello {{name}}</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await (emailProcessor as any).renderTemplate('welcome', { name: 'John' });

      expect(result).toContain('Hello John');
    });

    it('should use cached template in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockTemplate = '<h1>Hello {{name}}</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      // First call - should read from file
      await (emailProcessor as any).renderTemplate('welcome', { name: 'John' });
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await (emailProcessor as any).renderTemplate('welcome', { name: 'Jane' });
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle template rendering errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect((emailProcessor as any).renderTemplate('nonexistent', {})).rejects.toThrow(
        'Failed to render email template',
      );
    });

    it('should add default title to data', async () => {
      const mockTemplate = '<title>{{title}}</title>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await (emailProcessor as any).renderTemplate('welcome_email', {});

      expect(result).toContain('OneDosh - Welcome email');
    });

    it('should process includes in template', async () => {
      const mockTemplate = '@include("header")<h1>Hello</h1>';
      const mockHeader = '<header>Header</header>';
      (fs.readFile as jest.Mock).mockResolvedValueOnce(mockTemplate).mockResolvedValueOnce(mockHeader);

      const result = await (emailProcessor as any).renderTemplate('welcome', {});

      expect(result).toContain('Header');
    });

    it('should process if statements in template', async () => {
      const mockTemplate = '@if(name)Hello {{name}}@elseHello Guest@endif';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await (emailProcessor as any).renderTemplate('welcome', { name: 'John' });

      expect(result).toContain('Hello John');
      expect(result).not.toContain('Hello Guest');
    });
  });

  describe('processIncludes', () => {
    it('should process include directives', async () => {
      const content = '@include("header")';
      const includedContent = '<header>Header Content</header>';
      (fs.readFile as jest.Mock).mockResolvedValue(includedContent);

      const result = await (emailProcessor as any).processIncludes(content);

      expect(result).toContain('Header Content');
    });

    it('should block malicious include paths with ..', async () => {
      const content = '@include("../malicious")';

      const result = await (emailProcessor as any).processIncludes(content);

      expect(result).toBe('');
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should block absolute paths', async () => {
      const content = '@include("/etc/passwd")';

      const result = await (emailProcessor as any).processIncludes(content);

      expect(result).toBe('');
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should handle missing include files', async () => {
      const content = '@include("missing")';
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await (emailProcessor as any).processIncludes(content);

      expect(result).toBe('');
    });

    it('should process multiple includes', async () => {
      const content = '@include("header")@include("footer")';
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('<header>Header</header>')
        .mockResolvedValueOnce('<footer>Footer</footer>');

      const result = await (emailProcessor as any).processIncludes(content);

      expect(result).toContain('Header');
      expect(result).toContain('Footer');
    });
  });

  describe('replaceVariables', () => {
    it('should replace simple variables', () => {
      const content = 'Hello {{name}}';
      const data = { name: 'John' };

      const result = (emailProcessor as any).replaceVariables(content, data);

      expect(result).toBe('Hello John');
    });

    it('should replace nested variables', () => {
      const content = 'Hello {{user.name}}';
      const data = { user: { name: 'John' } };

      const result = (emailProcessor as any).replaceVariables(content, data);

      expect(result).toBe('Hello John');
    });

    it('should handle conditional with || operator', () => {
      const content = 'Hello {{name || "Guest"}}';
      const data = {};

      const result = (emailProcessor as any).replaceVariables(content, data);

      expect(result).toBe('Hello Guest');
    });

    it('should use primary value when available in conditional', () => {
      const content = 'Hello {{name || "Guest"}}';
      const data = { name: 'John' };

      const result = (emailProcessor as any).replaceVariables(content, data);

      expect(result).toBe('Hello John');
    });

    it('should replace multiple variables', () => {
      const content = 'Hello {{firstName}} {{lastName}}';
      const data = { firstName: 'John', lastName: 'Doe' };

      const result = (emailProcessor as any).replaceVariables(content, data);

      expect(result).toBe('Hello John Doe');
    });

    it('should handle missing variables', () => {
      const content = 'Hello {{name}}';
      const data = {};

      const result = (emailProcessor as any).replaceVariables(content, data);

      expect(result).toBe('Hello ');
    });
  });

  describe('getNestedValue', () => {
    it('should get simple property', () => {
      const obj = { name: 'John' };
      const result = (emailProcessor as any).getNestedValue(obj, 'name');
      expect(result).toBe('John');
    });

    it('should get nested property', () => {
      const obj = { user: { name: 'John' } };
      const result = (emailProcessor as any).getNestedValue(obj, 'user.name');
      expect(result).toBe('John');
    });

    it('should return undefined for missing property', () => {
      const obj = { name: 'John' };
      const result = (emailProcessor as any).getNestedValue(obj, 'missing');
      expect(result).toBeUndefined();
    });

    it('should handle empty path', () => {
      const obj = { name: 'John' };
      const result = (emailProcessor as any).getNestedValue(obj, '');
      expect(result).toBeUndefined();
    });

    it('should handle undefined object', () => {
      const result = (emailProcessor as any).getNestedValue(undefined, 'name');
      expect(result).toBeUndefined();
    });

    it('should remove quotes from path', () => {
      const obj = { name: 'John' };
      const result = (emailProcessor as any).getNestedValue(obj, '"name"');
      expect(result).toBe('John');
    });

    it('should handle null in nested path', () => {
      const obj = { user: null };
      const result = (emailProcessor as any).getNestedValue(obj, 'user.name');
      expect(result).toBeUndefined();
    });

    it('should handle deeply nested properties', () => {
      const obj = { level1: { level2: { level3: 'value' } } };
      const result = (emailProcessor as any).getNestedValue(obj, 'level1.level2.level3');
      expect(result).toBe('value');
    });
  });

  describe('evaluateVariable', () => {
    it('should return string literal with single quotes', () => {
      const result = (emailProcessor as any).evaluateVariable("'Hello'", {});
      expect(result).toBe('Hello');
    });

    it('should return string literal with double quotes', () => {
      const result = (emailProcessor as any).evaluateVariable('"Hello"', {});
      expect(result).toBe('Hello');
    });

    it('should evaluate new Date().getFullYear()', () => {
      const result = (emailProcessor as any).evaluateVariable('new Date().getFullYear()', {});
      expect(result).toBe(new Date().getFullYear());
    });

    it('should get value from data object', () => {
      const data = { name: 'John' };
      const result = (emailProcessor as any).evaluateVariable('name', data);
      expect(result).toBe('John');
    });

    it('should handle nested properties', () => {
      const data = { user: { name: 'John' } };
      const result = (emailProcessor as any).evaluateVariable('user.name', data);
      expect(result).toBe('John');
    });
  });

  describe('sendTemplatedEmail', () => {
    it('should queue email with template', async () => {
      const to = 'test@example.com';
      const subject = 'Test Subject';
      const template = 'welcome';
      const data = { name: 'John' };

      await emailProcessor.sendTemplatedEmail(to, subject, template, data);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'email',
        'send-email',
        { to, subject, template, data },
        { delay: undefined, attempts: 3 },
      );
    });

    it('should queue email with delay', async () => {
      const to = 'test@example.com';
      const subject = 'Test Subject';
      const template = 'welcome';
      const data = { name: 'John' };
      const delay = 5000;

      await emailProcessor.sendTemplatedEmail(to, subject, template, data, delay);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'email',
        'send-email',
        { to, subject, template, data },
        { delay, attempts: 3 },
      );
    });

    it('should handle array of recipients', async () => {
      const to = ['test1@example.com', 'test2@example.com'];
      const subject = 'Test Subject';
      const template = 'welcome';

      await emailProcessor.sendTemplatedEmail(to, subject, template);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'email',
        'send-email',
        { to, subject, template, data: {} },
        { delay: undefined, attempts: 3 },
      );
    });
  });

  describe('sendEmail', () => {
    it('should queue email with body', async () => {
      const to = 'test@example.com';
      const subject = 'Test Subject';
      const body = '<h1>Test</h1>';

      await emailProcessor.sendEmail(to, subject, body);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'email',
        'send-email',
        { to, subject, body },
        { delay: undefined, attempts: 3 },
      );
    });

    it('should queue email with delay', async () => {
      const to = 'test@example.com';
      const subject = 'Test Subject';
      const body = '<h1>Test</h1>';
      const delay = 3000;

      await emailProcessor.sendEmail(to, subject, body, delay);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'email',
        'send-email',
        { to, subject, body },
        { delay, attempts: 3 },
      );
    });
  });

  describe('setView', () => {
    it('should set view and return instance', () => {
      const result = emailProcessor.setView('welcome');

      expect(result).toBe(emailProcessor);
      expect((emailProcessor as any).view).toBe('welcome');
    });

    it('should allow chaining', async () => {
      const mockTemplate = '<h1>Hello</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await emailProcessor.setView('welcome').renderView('test');

      expect(result).toBeDefined();
    });
  });

  describe('renderView', () => {
    it('should render view directly without queuing', async () => {
      const mockTemplate = '<h1>Hello {{name}}</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await emailProcessor.renderView('welcome', { name: 'John' });

      expect(result).toContain('Hello John');
    });

    it('should handle empty data', async () => {
      const mockTemplate = '<h1>Hello</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await emailProcessor.renderView('welcome');

      expect(result).toContain('Hello');
    });
  });

  describe('processSendEmail with view', () => {
    it('should process email with view set', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        data: { name: 'John' },
      };

      mockJob.data = jobData;
      emailProcessor.setView('welcome');

      const mockTemplate = '<h1>Welcome {{name}}</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await (emailProcessor as any).processSendEmail(mockJob);

      expect(result).toBe(true);
      expect(mockResend.emails.send).toHaveBeenCalled();
    });

    it('should prioritize template over view', async () => {
      const jobData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'custom',
        data: { name: 'John' },
      };

      mockJob.data = jobData;
      emailProcessor.setView('welcome');

      const mockTemplate = '<h1>Custom {{name}}</h1>';
      (fs.readFile as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await (emailProcessor as any).processSendEmail(mockJob);

      expect(result).toBe(true);
      expect(mockResend.emails.send).toHaveBeenCalled();
    });
  });

  describe('processIfStatement', () => {
    it('should process simple if statement with true condition', () => {
      const content = '@if(name)Hello {{name}}@endif';
      const data = { name: 'John' };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Hello {{name}}');
      expect(result).not.toContain('@if');
    });

    it('should process simple if statement with false condition', () => {
      const content = '@if(name)Hello {{name}}@endif';
      const data = {};

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).not.toContain('Hello');
      expect(result).not.toContain('@if');
    });

    it('should process if-else statement', () => {
      const content = '@if(name)Hello {{name}}@elseHello Guest@endif';
      const data = {};

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Hello Guest');
      expect(result).not.toContain('@if');
      expect(result).not.toContain('@else');
    });

    it('should process nested if statements', () => {
      const content = '@if(user)@if(user.name)Hello {{user.name}}@endif@endif';
      const data = { user: { name: 'John' } };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Hello {{user.name}}');
      expect(result).not.toContain('@if');
    });

    it('should handle comparison operators', () => {
      const content = '@if(age >= 18)Adult@elseMinor@endif';
      const data = { age: 20 };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Adult');
      expect(result).not.toContain('Minor');
    });

    it('should handle logical AND operator', () => {
      const content = '@if(age >= 18 && verified)Verified Adult@endif';
      const data = { age: 20, verified: true };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Verified Adult');
    });

    it('should handle logical OR operator', () => {
      const content = '@if(admin || moderator)Has Access@endif';
      const data = { admin: false, moderator: true };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Has Access');
    });

    it('should handle negation', () => {
      const content = '@if(!disabled)Enabled@endif';
      const data = { disabled: false };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Enabled');
    });

    it('should handle parentheses', () => {
      const content = '@if((age >= 18) && verified)Verified Adult@endif';
      const data = { age: 20, verified: true };

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toContain('Verified Adult');
    });

    it('should prevent infinite loops with max iterations', () => {
      const content = '@if(true)@if(true)@if(true)Test@endif@endif@endif';
      const data = {};

      const result = (emailProcessor as any).processIfStatement(content, data);

      expect(result).toBeDefined();
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate simple truthy condition', () => {
      const data = { name: 'John' };
      const result = (emailProcessor as any).evaluateCondition('name', data);
      expect(result).toBe(true);
    });

    it('should evaluate simple falsy condition', () => {
      const data = {};
      const result = (emailProcessor as any).evaluateCondition('name', data);
      expect(result).toBe(false);
    });

    it('should handle negation', () => {
      const data = { disabled: false };
      const result = (emailProcessor as any).evaluateCondition('!disabled', data);
      expect(result).toBe(true);
    });

    it('should handle parentheses', () => {
      const data = { age: 20 };
      const result = (emailProcessor as any).evaluateCondition('(age)', data);
      expect(result).toBe(true);
    });

    it('should handle equality comparison', () => {
      const data = { status: 'active' };
      const result = (emailProcessor as any).evaluateCondition('status == "active"', data);
      expect(result).toBe(true);
    });

    it('should handle inequality comparison', () => {
      const data = { status: 'active' };
      const result = (emailProcessor as any).evaluateCondition('status != "inactive"', data);
      expect(result).toBe(true);
    });

    it('should handle less than comparison', () => {
      const data = { age: 17 };
      const result = (emailProcessor as any).evaluateCondition('age < 18', data);
      expect(result).toBe(true);
    });

    it('should handle greater than comparison', () => {
      const data = { age: 20 };
      const result = (emailProcessor as any).evaluateCondition('age > 18', data);
      expect(result).toBe(true);
    });

    it('should handle less than or equal comparison', () => {
      const data = { age: 18 };
      const result = (emailProcessor as any).evaluateCondition('age <= 18', data);
      expect(result).toBe(true);
    });

    it('should handle greater than or equal comparison', () => {
      const data = { age: 18 };
      const result = (emailProcessor as any).evaluateCondition('age >= 18', data);
      expect(result).toBe(true);
    });

    it('should handle logical AND', () => {
      const data = { age: 20, verified: true };
      const result = (emailProcessor as any).evaluateCondition('age >= 18 && verified', data);
      expect(result).toBe(true);
    });

    it('should handle logical OR', () => {
      const data = { admin: false, moderator: true };
      const result = (emailProcessor as any).evaluateCondition('admin || moderator', data);
      expect(result).toBe(true);
    });

    it('should handle complex condition with parentheses and operators', () => {
      const data = { age: 20, verified: true, premium: false };
      const result = (emailProcessor as any).evaluateCondition('(age >= 18 && verified) || premium', data);
      expect(result).toBe(true);
    });
  });

  describe('splitByOperator', () => {
    it('should split simple condition by OR operator', () => {
      const condition = 'a || b';
      const result = (emailProcessor as any).splitByOperator(condition, '||');
      expect(result).toEqual(['a', 'b']);
    });

    it('should split simple condition by AND operator', () => {
      const condition = 'a && b';
      const result = (emailProcessor as any).splitByOperator(condition, '&&');
      expect(result).toEqual(['a', 'b']);
    });

    it('should respect parentheses when splitting', () => {
      const condition = '(a || b) && c';
      const result = (emailProcessor as any).splitByOperator(condition, '&&');
      expect(result).toEqual(['(a || b)', 'c']);
    });

    it('should handle nested parentheses', () => {
      const condition = '((a || b) && c) || d';
      const result = (emailProcessor as any).splitByOperator(condition, '||');
      expect(result).toEqual(['((a || b) && c)', 'd']);
    });

    it('should handle multiple operators', () => {
      const condition = 'a || b || c';
      const result = (emailProcessor as any).splitByOperator(condition, '||');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty parts', () => {
      const condition = 'a ||';
      const result = (emailProcessor as any).splitByOperator(condition, '||');
      expect(result).toEqual(['a', '']);
    });
  });
});
