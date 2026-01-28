import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// Mock firebase-admin to prevent Firebase initialization in tests
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(() => ({})),
  credential: {
    cert: jest.fn(() => ({})),
  },
  messaging: jest.fn(() => ({
    sendEachForMulticast: jest.fn().mockResolvedValue({
      responses: [{ success: true }],
    }),
  })),
}));

// Mock the Firebase service specifically
jest.mock('../src/services/pushNotification/firebase/firebase.service', () => ({
  FirebaseService: jest.fn().mockImplementation(() => ({
    app: {},
    sendPushNotification: jest.fn().mockResolvedValue([]),
  })),
}));

// Set test environment
process.env.NODE_ENV = 'test';

// Set shorter timeouts for tests
jest.setTimeout(30000);

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    moduleRef = moduleFixture;
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    // Close the application and all connections
    if (app) {
      await app.close();
    }

    // Close the module and all providers
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('/healthz (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');

    if (response.status !== 200) {
      console.error('Response status:', response.status);
      console.error('Response body:', response.body);
      console.error('Response text:', response.text);
    }

    expect(response.status).toBe(200);
  });
});
