import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

function signPayload(payload: any, privateKey: string, eventType: string): void {
  const payloadString = JSON.stringify(payload);
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payloadString, 'utf8'), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  });

  console.log('\n Paste this in Postman Body (raw JSON):\n');
  console.log(payloadString);

  console.log('\n Add this to the x-zh-hook-rsa-signature-256 header:\n');
  console.log(signature.toString('hex'));

  console.log(`\n Set this in the x-zh-hook-payload-type header:\n${eventType}`);
}

async function main() {
  const [, , flag] = process.argv;
  const userId = await prompt('Enter the USER ID to generate webhook signature for: ');

  if (!userId || userId.trim() === '') {
    console.error('Invalid user ID provided.');
    process.exit(1);
  }

  const privateKeyPath = path.resolve(__dirname, '../../certs/zerohash/zerohash-webhook-private.test.pem');
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  let eventType: string;
  let payload: any;

  switch (flag) {
    case 'p':
      eventType = 'participant_status_updated';
      payload = {
        event_type: eventType,
        data: {
          partner_user_id: userId,
          participant_status: 'rejected',
          status_at: new Date().toISOString(),
          status_reason: null,
        },
      };
      break;

    case 'po':
      eventType = 'participant_onboarding_status_updated';
      payload = {
        event_type: eventType,
        data: {
          partner_user_id: userId,
          onboarding_status: 'pending_documents',
          onboarding_updated_at: new Date().toISOString(),
          rejection_reason: null,
        },
      };
      break;

    case 'o':
      eventType = 'onboarding_status_updated';
      payload = {
        event_type: eventType,
        data: {
          partner_user_id: userId,
          onboarding_status: 'approved',
          onboarding_updated_at: new Date().toISOString(),
          rejection_reason: null,
        },
      };
      break;

    default:
      console.error('Invalid flag. Use "o", "p", or "po".');
      process.exit(1);
  }

  signPayload(payload, privateKey, eventType);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
