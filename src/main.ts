import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { Request, Response, static as staticFiles } from 'express';
import { existsSync } from 'fs';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { join } from 'path';
import { AllExceptionFilters } from './app.error';
import { DecodeAndDecompressAuthHeader } from './app.middleware';
import { AppModule } from './app.module';
import { EnvironmentService } from './config';
import { App } from './constants/app';

/**
 *
 * Server Boot
 */
export class Server {
  private static readonly logger = new Logger(Server.name);
  public static async start() {
    this.registerSentry();
    // Initialize BaseEnv async methods before starting the app

    // Set default timezone
    process.env.TZ = 'America/New_York';

    const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(AppModule, {
      rawBody: true,
      bufferLogs: true,
    });

    // Use Winston as the global Nest logger
    const disableWinstonLogs = EnvironmentService.getValue('DISABLE_WINSTON_LOGS');
    if (!disableWinstonLogs) {
      app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    }

    // Configure CORS with allowed origins
    const corsOriginsEnv = EnvironmentService.getValue('CORS_ORIGINS');
    const allowedOrigins =
      corsOriginsEnv === '*'
        ? true // Allow all origins (sets Access-Control-Allow-Origin to request origin)
        : corsOriginsEnv?.split(',').map((origin) => origin.trim()) || ['*'];
    // Security headers using Helmet
    app.use(
      helmet(
        EnvironmentService.isDevelopment()
          ? {
              contentSecurityPolicy: {
                directives: {
                  defaultSrc: ["'self'"],
                  scriptSrc: ["'self'", "'unsafe-inline'", 'https://api.sumsub.com', 'https://cdn.plaid.com'],
                  styleSrc: ["'self'", "'unsafe-inline'"],
                  imgSrc: ["'self'", 'data:', 'https:'],
                  connectSrc: ["'self'", 'https://api.sumsub.com', 'https://cdn.plaid.com'],
                  frameSrc: ["'self'", 'https://api.sumsub.com', 'https://cdn.plaid.com'],
                },
              },
            }
          : undefined,
      ),
    );

    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
    });

    // --- Static files (keep route as /public) ---
    const publicCandidates = [
      join(__dirname, '..', 'public'), // when running from dist/
      join(__dirname, 'public'), // when running from src/
      join(process.cwd(), 'public'), // fallback to cwd/public
    ];
    const publicRoot = publicCandidates.find((p) => existsSync(p)) ?? publicCandidates[0];

    app.use(
      '/public',
      staticFiles(publicRoot, {
        index: false, // don't auto-serve index.html
        fallthrough: true, // let other routes continue if not found
        maxAge: '1d',
        setHeaders: (res) => res.setHeader('x-static', '1'),
      }),
    );

    // Skip auth/decompress middleware for static file requests
    app.use((req, res, next) => {
      if (req.path.startsWith('/public')) return next();

      return DecodeAndDecompressAuthHeader.handle(req, res, next);
    });

    Server.attachMiddleware(app);
    Server.globalException(app);

    // NOTE: Do not re-register DecodeAndDecompressAuthHeader globally without the /public guard,
    // otherwise static assets could be interfered with.

    Server.bootSwaggerDocs(app);
    app.setBaseViewsDir(join(__dirname, '..', 'resources'));
    app.setViewEngine('hbs');

    // Start server and listen to port
    await app.listen(App.port, () => {
      this.logger.log(`Server started and running on port ${App.port}`, 'Server');
      this.logger.log(`Serving static files from: ${publicRoot} at /public`, 'Static');
    });
  }

  public static async attachMiddleware(app: NestExpressApplication) {
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
  }

  public static async bootSwaggerDocs(app: NestExpressApplication) {
    const config = new DocumentBuilder()
      .setTitle('OneDosh App API Service')
      .setDescription('OneDosh App API Specification')
      .setVersion('1.0')
      .addTag('one-dosh')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Setup route to serve Swagger JSON
    app.getHttpAdapter().get('/docs-json', (_req: Request, res: Response) => {
      res.json(document);
    });

    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  //  global exception
  public static globalException(app: NestExpressApplication) {
    app.useGlobalFilters(new AllExceptionFilters());
  }

  public static registerSentry() {
    Sentry.init({
      dsn: 'https://83ba0dd4e193d57abdbb1aa178fe04d9@o4510227128713216.ingest.us.sentry.io/4510273374912512',
      // Tracing
      tracesSampleRate: 0.4, //  Capture 100% of the transactions
      sendDefaultPii: true,
      environment: EnvironmentService.getValue('NODE_ENV'),
    });
  }
}

Server.start().catch((e) => {
  // Use console.error for startup errors since logger might not be initialized
  console.error('Failed to start server:', e.message);
  console.error(e.stack);
  process.exit(1);
});
