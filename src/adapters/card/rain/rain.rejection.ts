/**
 * KYC Rejection Label Normalizer
 *
 * A tree-shakeable module that normalizes KYC rejection labels from Rain into actionable data
 * for product, support, and automation systems.
 *
 * @example
 * ```typescript
 * import {
 *   getRejectionRollup,
 *   resolveDisposition,
 *   listFineGrainedFieldsForLabel,
 *   REJECTION_LABEL_REGISTRY,
 * } from "./rain-rejection-normalizer";
 *
 * const label = "BAD_PROOF_OF_PAYMENT";
 * const rollup = getRejectionRollup(label);
 * if (rollup) {
 *   console.log(rollup.disposition);     // "temporary" or "final"
 *   console.log(rollup.kycFields);       // e.g., ["payment"]
 *   console.log(rollup.subFields.payment); // e.g., ["payment.bankCard.name", "payment.bankCard.expiry", ...]
 * }
 *
 * console.log(resolveDisposition(label));              // same as rollup.disposition
 * console.log(listFineGrainedFieldsForLabel(label));   // flat list of fine-grained fields
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Disposition of a rejection - whether it's temporary (can be resubmitted) or final
 */
export type RejectionDisposition = 'temporary' | 'final';

/**
 * Coarse KYC field buckets for high-level categorization
 */
export type CoarseKycField =
  | 'document'
  | 'profile'
  | 'database'
  | 'payment'
  | 'proofOfAddress'
  | 'wallet'
  | 'selfie'
  | 'videoIdent'
  | 'fraud'
  | 'system'
  | 'regulation'
  | 'media'
  | 'watchlists'
  | 'uploads';

/**
 * Fine-grained KYC data fields for detailed tracking
 */
export type FineGrainedKycField =
  | 'document.image'
  | 'document.pages'
  | 'document.type'
  | 'document.number'
  | 'document.expirationDate'
  | 'document.issueDate'
  | 'document.language'
  | 'document.nfc'
  | 'document.signatureOrStamp'
  | 'document.facePhoto'
  | 'document.country'
  | 'profile.fullName'
  | 'profile.dateOfBirth'
  | 'profile.gender'
  | 'profile.address'
  | 'profile.country'
  | 'database.availability'
  | 'database.match'
  | 'database.name'
  | 'database.dob'
  | 'database.gender'
  | 'database.address'
  | 'database.presence'
  | 'socialNumber.bvn'
  | 'socialNumber.ssn'
  | 'socialNumber.tin'
  | 'payment.bankCard.number'
  | 'payment.bankCard.name'
  | 'payment.bankCard.expiry'
  | 'payment.bankStatement.fullName'
  | 'payment.bankStatement.accountOrCardNumber'
  | 'payment.wireTransfer.proof'
  | 'payment.ewallet.proof'
  | 'wallet.address'
  | 'wallet.signature'
  | 'wallet.riskScore'
  | 'selfie.image'
  | 'selfie.liveness'
  | 'selfie.video'
  | 'videoIdent.connection'
  | 'videoIdent.visibility'
  | 'videoIdent.alone'
  | 'videoIdent.requiredDocs'
  | 'fraud.riskScore'
  | 'fraud.livenessBypass'
  | 'fraud.deepfake'
  | 'fraud.multiDevice'
  | 'fraud.thirdPartyInvolvement'
  | 'fraud.serialNetwork'
  | 'fraud.templateTampering'
  | 'system.duplicateAccount'
  | 'regulation.ageRequirement'
  | 'regulation.residencyRegion'
  | 'regulation.cardVsResidenceCountry'
  | 'media.adverse'
  | 'watchlists.sanctions'
  | 'watchlists.pep'
  | 'watchlists.criminalRecords'
  | 'watchlists.fitnessProbity'
  | 'uploads.spam';

/**
 * Source of a rejection with provenance information
 */
export interface RejectionSource {
  groupId: string;
  reasonId: string;
  reason: string;
  description: string;
  disposition: RejectionDisposition;
  fineGrainedFields: FineGrainedKycField[];
}

/**
 * Details for a rejection label including all sources
 */
export interface RejectionLabelDetails {
  label: string;
  sources: RejectionSource[];
}

/**
 * Registry mapping rejection labels to their details
 */
export type RejectionLabelRegistry = Record<string, RejectionLabelDetails>;

/**
 * Rollup object containing normalized rejection data
 */
export interface RejectionRollup {
  label: string;
  disposition: RejectionDisposition;
  kycFields: CoarseKycField[];
  subFields: Record<CoarseKycField, string[]>;
  sources: RejectionSource[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compare function for reliable alphabetical sorting using localeCompare
 * @param a First string to compare
 * @param b Second string to compare
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareAlphabetically(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Helper for creating rejection sources with proper typing
 */
function createSource(
  groupId: string,
  reasonId: string,
  reason: string,
  description: string,
  disposition: RejectionDisposition,
  fineGrainedFields: FineGrainedKycField[],
): RejectionSource {
  return { groupId, reasonId, reason, description, disposition, fineGrainedFields };
}

/**
 * Categorizes a rejection source into a high-level KYC field bucket
 */
function categorizeRejectionSource(source: RejectionSource): CoarseKycField {
  const g = source.groupId;

  // Primary classification by group
  if (g === 'proofOfAddress') return 'proofOfAddress';
  if (
    g === 'bankCard' ||
    g === 'bankStatement' ||
    g === 'proofOfPayment' ||
    g === 'blackCrypto' ||
    g === 'walletSignatureMismatch' ||
    g === 'redCrypto'
  )
    return 'payment';
  if (g === 'badDocument' || g === 'additionalPages' || g === 'badPhoto') return 'document';
  if (g === 'dataMismatch') return 'profile';
  if (g === 'dbNetChecks' || g === 'dbNetRetry' || g === 'dbNetReject' || g === 'ekycRetry' || g === 'ekycReject')
    return 'database';
  if (g === 'selfie') return 'selfie';
  if (g === 'videoIdent' || g === 'videoIdentFinalRejection') return 'videoIdent';
  if (g === 'fraudulentPatterns' || g === 'fake' || g === 'compromisedStructure') return 'fraud';
  if (g === 'regulationsViolations') return 'regulation';
  if (g === 'spam') return 'uploads';

  // Special handling for compromisedPersons
  if (g === 'compromisedPersons') {
    if (source.reasonId === 'adverseMedia') return 'media';
    if (['pep', 'sanctionList', 'criminalRecords', 'fitnessProbity'].includes(source.reasonId)) return 'watchlists';
    return 'fraud'; // fallback
  }

  return 'document'; // conservative default
}

/**
 * Exhaustiveness helper for TypeScript
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

// ============================================================================
// REJECTION LABEL REGISTRY
// ============================================================================

/**
 * KYC Rejection Labels → Normalized Map
 * Keyed by Associated Rejection Label (API-facing),
 * each entry aggregates all sources (groups/reasons) that can emit that label
 * and standardizes which KYC data fields are implicated.
 */
export const REJECTION_LABEL_REGISTRY: RejectionLabelRegistry = {
  // ───────────────────────────── TEMPORARY ─────────────────────────────
  CHECK_UNAVAILABLE: {
    label: 'CHECK_UNAVAILABLE',
    sources: [
      createSource(
        'dbNetChecks',
        'checkUnavailable',
        'Check Unavailable',
        'The government database is currently unavailable. We could not validate the user identity document.',
        'temporary',
        ['database.availability'],
      ),
      createSource(
        'ekycRetry',
        'checkUnavailable',
        'Check unavailable',
        'The government database is currently unavailable. We could not verify user data with this method.',
        'temporary',
        ['database.availability'],
      ),
      createSource(
        'dbNetRetry',
        'checkUnavailable',
        'Check Unavailable',
        'The government database is currently unavailable. We could not verify user data with this method.',
        'temporary',
        ['database.availability'],
      ),
    ],
  },

  RESTRICTED_PERSON: {
    label: 'RESTRICTED_PERSON',
    sources: [
      createSource(
        'dbNetChecks',
        'drivingRestrictions',
        'Driving Restrictions',
        'The applicant is subject to driving restrictions.',
        'temporary',
        ['watchlists.fitnessProbity'],
      ),
      createSource('dbNetReject', 'restrictedPerson', 'Restricted Person', 'Found on a restricted list.', 'final', [
        'watchlists.fitnessProbity',
      ]),
    ],
  },

  INCORRECT_SOCIAL_NUMBER: {
    label: 'INCORRECT_SOCIAL_NUMBER',
    sources: [
      createSource(
        'dbNetChecks',
        'incorrectBvn',
        'Incorrect BVN',
        'The BVN number provided by the applicant is incorrect. A new BVN has been requested.',
        'temporary',
        ['socialNumber.bvn', 'database.match'],
      ),
      createSource(
        'dbNetChecks',
        'incorrectSsn',
        'Incorrect SSN',
        'The SSN number provided by the applicant is incorrect. A new SSN has been requested.',
        'temporary',
        ['socialNumber.ssn', 'database.match'],
      ),
      createSource(
        'dbNetChecks',
        'incorrectTin',
        'Incorrect TIN',
        'The tax number provided by the applicant is incorrect. A new tax number has been requested.',
        'temporary',
        ['socialNumber.tin', 'database.match'],
      ),
    ],
  },

  DOCUMENT_PAGE_MISSING: {
    label: 'DOCUMENT_PAGE_MISSING',
    sources: [
      createSource(
        'additionalPages',
        'registrationStamp',
        'Address page',
        'The uploaded document is missing the address page.',
        'temporary',
        ['document.pages', 'document.image'],
      ),
      createSource(
        'additionalPages',
        'anotherSide',
        'Another side',
        'The uploaded document is double-sided and only one side was uploaded.',
        'temporary',
        ['document.pages', 'document.image'],
      ),
      createSource(
        'additionalPages',
        'expirationPage',
        'Expiration date page',
        'The uploaded document is missing the expiration date page.',
        'temporary',
        ['document.pages', 'document.expirationDate', 'document.image'],
      ),
      createSource(
        'additionalPages',
        'mainPageId',
        'Main page of the document',
        'The uploaded document is missing the biodata page.',
        'temporary',
        ['document.pages', 'document.image'],
      ),
      createSource(
        'additionalPages',
        'nextPage',
        'Next page',
        'The document page with expiration date has been requested.',
        'temporary',
        ['document.pages', 'document.expirationDate', 'document.image'],
      ),
    ],
  },

  BAD_PROOF_OF_PAYMENT: {
    label: 'BAD_PROOF_OF_PAYMENT',
    sources: [
      // bankCard (temp)
      createSource(
        'bankCard',
        'fullNameIssue',
        'Bank card without name',
        'The name on the bank card is missing.',
        'temporary',
        ['payment.bankCard.name', 'document.image'],
      ),
      createSource(
        'bankCard',
        'expirationDate',
        'Expired bank card',
        'The provided bank card has expired or expires soon.',
        'temporary',
        ['payment.bankCard.expiry'],
      ),
      // bankStatement (temp)
      createSource(
        'bankStatement',
        'notEnoughData',
        'Account/Card number',
        'The account/card number on the bank statement is missing or cannot be read.',
        'temporary',
        ['payment.bankStatement.accountOrCardNumber', 'document.image'],
      ),
      createSource(
        'bankStatement',
        'fullNameIssue',
        'Full name (bank statement)',
        'The full name on the bank statement is missing or cannot be read.',
        'temporary',
        ['payment.bankStatement.fullName', 'document.image'],
      ),
      // dataMismatch (temp)
      createSource(
        'dataMismatch',
        'dataMismatch',
        'Data mismatch (payments)',
        'The filled-in data does not match the information on the uploaded image.',
        'temporary',
        [
          'payment.bankCard.number',
          'payment.bankCard.name',
          'payment.bankStatement.accountOrCardNumber',
          'payment.bankStatement.fullName',
        ],
      ),
      // blackCrypto (temp)
      createSource('blackCrypto', 'blackCrypto', 'Black crypto', 'Wallet address is incorrect.', 'temporary', [
        'wallet.address',
      ]),
      createSource(
        'blackCrypto',
        'blackCrypto',
        'Black crypto',
        'Wallet address does not participate in outputs of transaction.',
        'temporary',
        ['wallet.address'],
      ),
      // proofOfPayment (temp)
      createSource(
        'proofOfPayment',
        'bankCard',
        'Bank card',
        'Bank card details are missing or not visible.',
        'temporary',
        ['payment.bankCard.number', 'payment.bankCard.name', 'payment.bankCard.expiry', 'document.image'],
      ),
      createSource(
        'proofOfPayment',
        'fullName',
        'Bank statement',
        'Bank statement details are missing or not visible.',
        'temporary',
        ['payment.bankStatement.fullName', 'payment.bankStatement.accountOrCardNumber', 'document.image'],
      ),
      createSource(
        'proofOfPayment',
        'proofOfPayment',
        'Decline payment',
        'According to the documents provided, the payment has not been completed.',
        'temporary',
        ['payment.bankStatement.accountOrCardNumber', 'payment.wireTransfer.proof', 'payment.ewallet.proof'],
      ),
      createSource(
        'proofOfPayment',
        'issueDate',
        'E-wallet',
        'The confirmation of the electronic wallet has been requested.',
        'temporary',
        ['payment.ewallet.proof'],
      ),
      createSource(
        'proofOfPayment',
        'listOfDocs',
        'Wire transfer',
        'The confirmation of the wire transfer has been requested.',
        'temporary',
        ['payment.wireTransfer.proof'],
      ),
      // wallet signature mismatch (temp)
      createSource(
        'walletSignatureMismatch',
        'walletSignatureMismatch',
        'Wallet Signature mismatch',
        'Signature of the wallet has been mismatched.',
        'temporary',
        ['wallet.signature'],
      ),
      // differentDocs (final as well)
      createSource(
        'differentDocs',
        'differentDocs',
        'Different Bank cards',
        'The submitted bank cards belong to different people.',
        'final',
        ['payment.bankCard.number', 'profile.fullName'],
      ),
      // redCrypto (final)
      createSource('redCrypto', 'redCrypto', 'Red crypto', 'Wallet has a high risk score.', 'final', [
        'wallet.address',
        'wallet.riskScore',
      ]),
      // regulationsViolations (final)
      createSource(
        'regulationsViolations',
        'riskBankCard',
        'High risk Bank card',
        'High risk bank card detected.',
        'final',
        ['payment.bankCard.number'],
      ),
      createSource(
        'regulationsViolations',
        'inconsistency',
        'Name mismatch',
        'Name mismatch between card and ID.',
        'final',
        ['payment.bankCard.name', 'profile.fullName'],
      ),
      createSource(
        'regulationsViolations',
        'countriesMismatch',
        'Countries mismatch',
        'Country mismatch between residence and card.',
        'final',
        ['regulation.cardVsResidenceCountry', 'profile.country'],
      ),
    ],
  },

  BAD_PROOF_OF_IDENTITY: {
    label: 'BAD_PROOF_OF_IDENTITY',
    sources: [
      createSource(
        'badDocument',
        'copyOfIdDoc',
        'Copy of ID doc',
        'Uploaded a photo of a paper copy instead of the original.',
        'temporary',
        ['document.image', 'document.type'],
      ),
      createSource(
        'badDocument',
        'notFullDob',
        'Not a full DoB',
        'Applicant date of birth is not present.',
        'temporary',
        ['document.number', 'profile.dateOfBirth'],
      ),
      createSource(
        'badDocument',
        'notFullName',
        'Not a full name',
        'Applicant full name is not present.',
        'temporary',
        ['document.number', 'profile.fullName'],
      ),
      createSource(
        'badDocument',
        'suspiciousDocument',
        'Suspicious document',
        'A new document requested to minimize fraud risk.',
        'temporary',
        ['document.image'],
      ),
      createSource(
        'badDocument',
        'unsigned',
        'Unsigned document',
        'Document without relevant signatures and stamps.',
        'temporary',
        ['document.signatureOrStamp'],
      ),
      createSource(
        'badDocument',
        'withoutFace',
        'Without face',
        'Face on the document is poorly visible.',
        'temporary',
        ['document.facePhoto', 'document.image'],
      ),
      createSource('badDocument', 'wrongType', 'Wrong type', 'Uploaded document is not supported.', 'temporary', [
        'document.type',
      ]),
    ],
  },

  DOCUMENT_DAMAGED: {
    label: 'DOCUMENT_DAMAGED',
    sources: [
      createSource(
        'badDocument',
        'damagedId',
        'Damaged ID',
        'The document is either damaged or unreadable.',
        'temporary',
        ['document.image'],
      ),
    ],
  },

  REQUESTED_DATA_MISMATCH: {
    label: 'REQUESTED_DATA_MISMATCH',
    sources: [
      createSource(
        'badDocument',
        'dataMismatch',
        'Data mismatch',
        'The details in this document do not match with the information provided.',
        'temporary',
        ['profile.fullName', 'profile.dateOfBirth', 'profile.address', 'document.number'],
      ),
    ],
  },

  DIGITAL_DOCUMENT: {
    label: 'DIGITAL_DOCUMENT',
    sources: [
      createSource(
        'badDocument',
        'digitalId',
        'Digital ID',
        'The applicant uploaded a digital version of the document.',
        'temporary',
        ['document.type', 'document.image'],
      ),
    ],
  },

  INCOMPATIBLE_LANGUAGE: {
    label: 'INCOMPATIBLE_LANGUAGE',
    sources: [
      createSource(
        'badDocument',
        'needTranslation',
        'English translation',
        'Document in a language not supported; notarized English translation requested.',
        'temporary',
        ['document.language'],
      ),
    ],
  },

  EXPIRATION_DATE: {
    label: 'EXPIRATION_DATE',
    sources: [
      createSource(
        'badDocument',
        'expiredId',
        'Expired ID',
        'The provided identity document has expired.',
        'temporary',
        ['document.expirationDate'],
      ),
      createSource(
        'badDocument',
        'expirationDate',
        'ID expiration date',
        'Identity document expires in less than one month.',
        'temporary',
        ['document.expirationDate'],
      ),
    ],
  },

  ID_INVALID: {
    label: 'ID_INVALID',
    sources: [
      createSource(
        'badDocument',
        'invalidId',
        'Invalid ID',
        'The provided identity document is invalid.',
        'temporary',
        ['document.number', 'document.type'],
      ),
    ],
  },

  INCOMPLETE_DOCUMENT: {
    label: 'INCOMPLETE_DOCUMENT',
    sources: [
      createSource('badDocument', 'missedNfc', 'Missed NFC', 'NFC scanning is required.', 'temporary', [
        'document.nfc',
      ]),
    ],
  },

  UNSATISFACTORY_PHOTOS: {
    label: 'UNSATISFACTORY_PHOTOS',
    sources: [
      createSource(
        'badPhoto',
        'dataNotVisible',
        'Data not readable',
        'Required fields are not readable or visible.',
        'temporary',
        ['document.image'],
      ),
      createSource('badPhoto', 'imageEditor', 'Photoshop', 'Image editors detected.', 'temporary', ['document.image']),
      createSource('badPhoto', 'screenshot', 'Screenshots', 'The applicant uploaded screenshots.', 'temporary', [
        'document.image',
      ]),
    ],
  },

  GRAPHIC_EDITOR: {
    label: 'GRAPHIC_EDITOR',
    sources: [
      createSource('badPhoto', 'imageEditor', 'Photoshop', 'Image editors have been detected.', 'temporary', [
        'document.image',
      ]),
    ],
  },

  SCREENSHOTS: {
    label: 'SCREENSHOTS',
    sources: [
      createSource('badPhoto', 'screenshot', 'Screenshots', 'The applicant uploaded screenshots.', 'temporary', [
        'document.image',
      ]),
    ],
  },

  WRONG_ADDRESS: {
    label: 'WRONG_ADDRESS',
    sources: [
      createSource(
        'dataMismatch',
        'address',
        'Address issue',
        'Profile address does not match document data.',
        'temporary',
        ['profile.address', 'document.pages'],
      ),
      createSource(
        'dbNetReject',
        'addressMismatch',
        'Address mismatch',
        'Address mismatch with government records.',
        'final',
        ['database.address', 'profile.address'],
      ),
    ],
  },

  PROBLEMATIC_APPLICANT_DATA: {
    label: 'PROBLEMATIC_APPLICANT_DATA',
    sources: [
      createSource(
        'dataMismatch',
        'dateOfBirth',
        'Date of birth issue',
        'Profile DoB does not match document data.',
        'temporary',
        ['profile.dateOfBirth', 'document.number'],
      ),
      createSource(
        'dataMismatch',
        'fullName',
        'Full name issue',
        'Profile name does not match document data.',
        'temporary',
        ['profile.fullName', 'document.number'],
      ),
      createSource(
        'dataMismatch',
        'gender',
        'Gender mismatch',
        'Profile gender does not match document data.',
        'temporary',
        ['profile.gender', 'document.number'],
      ),
      createSource(
        'ekycRetry',
        'dataMismatch',
        'Data mismatch',
        'Provided data does not match the government database.',
        'temporary',
        ['database.match', 'profile.fullName', 'profile.dateOfBirth', 'profile.gender', 'profile.address'],
      ),
      createSource(
        'ekycRetry',
        'notEnoughDataInSource',
        'Not enough data in source',
        'Could not find applicant data in the government database.',
        'temporary',
        ['database.presence'],
      ),
      createSource(
        'ekycReject',
        'dataMismatch',
        'Data mismatch',
        "Data doesn't match the government database.",
        'final',
        ['database.match'],
      ),
      createSource('ekycReject', 'skip', 'E-KYC skipped', 'E-KYC step has been skipped.', 'final', [
        'database.presence',
      ]),
      createSource(
        'ekycReject',
        'notEnoughDataInSource',
        'Not enough data in source',
        'Data not found in the government database.',
        'final',
        ['database.presence'],
      ),
    ],
  },

  DB_DATA_MISMATCH: {
    label: 'DB_DATA_MISMATCH',
    sources: [
      createSource(
        'dbNetRetry',
        'dataMismatch',
        'Data mismatch',
        'Provided data does not match the database.',
        'temporary',
        ['database.match', 'database.name', 'database.dob', 'database.gender', 'database.address'],
      ),
      createSource(
        'dbNetRetry',
        'dobMismatch',
        'Date of birth mismatch',
        'Provided date of birth does not match the database.',
        'temporary',
        ['database.dob'],
      ),
      createSource(
        'dbNetRetry',
        'genderMismatch',
        'Gender mismatch',
        'Provided gender does not match the database.',
        'temporary',
        ['database.gender'],
      ),
      createSource(
        'dbNetRetry',
        'nameMismatch',
        'Name mismatch',
        'Provided name does not match the database.',
        'temporary',
        ['database.name'],
      ),
      createSource('dbNetReject', 'dataMismatch', 'Data mismatch', 'Data mismatch with government records.', 'final', [
        'database.match',
      ]),
      createSource(
        'dbNetReject',
        'dobMismatch',
        'Date of birth mismatch',
        'DOB mismatch with government records.',
        'final',
        ['database.dob'],
      ),
      createSource('dbNetReject', 'nameMismatch', 'Name mismatch', 'Name mismatch with government records.', 'final', [
        'database.name',
      ]),
    ],
  },

  DB_DATA_NOT_FOUND: {
    label: 'DB_DATA_NOT_FOUND',
    sources: [
      createSource(
        'dbNetRetry',
        'dataNotFound',
        'Data not found',
        'Could not find applicant data in the database.',
        'temporary',
        ['database.presence'],
      ),
      createSource('dbNetReject', 'dataNotFound', 'Data not found', 'No data found in government records.', 'final', [
        'database.presence',
      ]),
    ],
  },

  GPS_AS_POA_SKIPPED: {
    label: 'GPS_AS_POA_SKIPPED',
    sources: [
      createSource(
        'gpsAsPoaSkipped',
        'gpsAsPoaSkipped',
        'GPS as POA skipped',
        'Verification completed but insufficient address details.',
        'temporary',
        ['profile.address'],
      ),
    ],
  },

  BAD_PROOF_OF_ADDRESS: {
    label: 'BAD_PROOF_OF_ADDRESS',
    sources: [
      createSource(
        'proofOfAddress',
        'fullAddress',
        'Full address',
        'The full address has not been provided or cannot be read.',
        'temporary',
        ['profile.address', 'document.image'],
      ),
      createSource(
        'proofOfAddress',
        'fullName',
        'Full name',
        'The full name has not been provided or cannot be read.',
        'temporary',
        ['profile.fullName', 'document.image'],
      ),
      createSource(
        'proofOfAddress',
        'poiPoaCountryMismatch',
        'ID country mismatch',
        'ID country does not match country entered by applicant.',
        'temporary',
        ['document.country', 'profile.country'],
      ),
      createSource(
        'proofOfAddress',
        'issueDate',
        'Issue date',
        'Document is expired according to PoA validity settings.',
        'temporary',
        ['document.issueDate'],
      ),
      createSource(
        'proofOfAddress',
        'listOfDocs',
        'List of documents',
        'Document type is not supported.',
        'temporary',
        ['document.type'],
      ),
      createSource(
        'proofOfAddress',
        'notEnoughData',
        'Passport without number',
        'No number on the document (passport).',
        'temporary',
        ['document.number'],
      ),
      createSource(
        'proofOfAddress',
        'dataMismatch',
        'Provided address mismatch',
        'Document address does not match entered address.',
        'temporary',
        ['profile.address', 'document.pages'],
      ),
      createSource(
        'proofOfAddress',
        'sameDoc',
        'Submit the same document',
        'Same document used as PoA and PoI.',
        'temporary',
        ['document.type'],
      ),
      createSource(
        'proofOfAddress',
        'unAcceptableLanguage',
        'Unsupported language',
        'Document language not supported.',
        'temporary',
        ['document.language'],
      ),
    ],
  },

  BAD_FACE_MATCHING: {
    label: 'BAD_FACE_MATCHING',
    sources: [
      createSource(
        'selfie',
        'badFaceComparison',
        'Compare with ID mismatch',
        'Selfie face not clearly visible/matchable with ID.',
        'temporary',
        ['selfie.image', 'document.facePhoto'],
      ),
    ],
  },

  BAD_SELFIE: {
    label: 'BAD_SELFIE',
    sources: [
      createSource(
        'selfie',
        'livenessWatermark',
        'Liveness with watermark',
        'Watermark/text present on liveness record.',
        'temporary',
        ['selfie.liveness'],
      ),
      createSource('selfie', 'selfieLiveness', 'Selfie Liveness', 'Failed liveness check.', 'temporary', [
        'selfie.liveness',
      ]),
      createSource(
        'selfie',
        'selfieWithId',
        'Selfie with ID',
        'Selfie without ID; selfie with ID requested.',
        'temporary',
        ['selfie.image', 'document.image'],
      ),
      createSource('selfie', 'webcamSelfie', 'Webcam selfie', 'Applicant selfie requested.', 'temporary', [
        'selfie.image',
      ]),
    ],
  },

  BAD_VIDEO_SELFIE: {
    label: 'BAD_VIDEO_SELFIE',
    sources: [
      createSource('selfie', 'videoSelfie', 'Video Selfie', 'Failed to pass the video selfie check.', 'temporary', [
        'selfie.video',
      ]),
    ],
  },

  UNSUITABLE_ENV: {
    label: 'UNSUITABLE_ENV',
    sources: [
      createSource(
        'videoIdent',
        'notSeen',
        'Applicant can not be seen',
        'On the Video Ident call, the applicant was not visible.',
        'temporary',
        ['videoIdent.visibility'],
      ),
      createSource(
        'videoIdent',
        'notAlone',
        'Not alone',
        'On the Video Ident call, the applicant was not alone.',
        'temporary',
        ['videoIdent.alone'],
      ),
    ],
  },

  CONNECTION_INTERRUPTED: {
    label: 'CONNECTION_INTERRUPTED',
    sources: [
      createSource(
        'videoIdent',
        'badConnection',
        'Bad connection',
        'The Video Ident call connection was interrupted.',
        'temporary',
        ['videoIdent.connection'],
      ),
    ],
  },

  APPLICANT_INTERRUPTED_INTERVIEW: {
    label: 'APPLICANT_INTERRUPTED_INTERVIEW',
    sources: [
      createSource(
        'videoIdent',
        'applicantInterruptedInterview',
        'Interrupted interview',
        'The applicant did not finish the interview.',
        'temporary',
        ['videoIdent.connection'],
      ),
    ],
  },

  DOCUMENT_MISSING: {
    label: 'DOCUMENT_MISSING',
    sources: [
      createSource(
        'videoIdent',
        'noSuitableDocs',
        'No docs',
        'The applicant failed to provide the required documents on the Video Ident call.',
        'temporary',
        ['videoIdent.requiredDocs'],
      ),
    ],
  },

  // ───────────────────────────── FINAL ─────────────────────────────
  ADVERSE_MEDIA: {
    label: 'ADVERSE_MEDIA',
    sources: [
      createSource(
        'compromisedPersons',
        'adverseMedia',
        'Adverse media',
        'The applicant is mentioned in adverse media.',
        'final',
        ['media.adverse'],
      ),
    ],
  },

  CRIMINAL: {
    label: 'CRIMINAL',
    sources: [
      createSource(
        'compromisedPersons',
        'criminalRecords',
        'Criminal records',
        'The applicant is a convicted criminal.',
        'final',
        ['watchlists.criminalRecords'],
      ),
    ],
  },

  COMPROMISED_PERSONS: {
    label: 'COMPROMISED_PERSONS',
    sources: [
      createSource(
        'compromisedPersons',
        'fitnessProbity',
        'Fitness probity',
        'Applicant found on fitness and probity lists.',
        'final',
        ['watchlists.fitnessProbity'],
      ),
      createSource(
        'compromisedStructure',
        'compromisedStructure',
        'Problematic company structure',
        'Officials in ownership/control structure were rejected.',
        'final',
        ['watchlists.fitnessProbity'],
      ),
      createSource(
        'compromisedPersons',
        'incompleteName',
        'Incomplete data',
        'The name entered is incomplete; watchlist matching impaired.',
        'final',
        ['profile.fullName'],
      ),
      createSource(
        'compromisedPersons',
        'warning',
        'Warning',
        'Found on most-wanted lists (Interpol/EU/US).',
        'final',
        ['watchlists.fitnessProbity'],
      ),
    ],
  },

  PEP: {
    label: 'PEP',
    sources: [
      createSource('compromisedPersons', 'pep', 'PEP', 'Applicant is a politically exposed person.', 'final', [
        'watchlists.pep',
      ]),
    ],
  },

  SANCTIONS: {
    label: 'SANCTIONS',
    sources: [
      createSource(
        'compromisedPersons',
        'sanctionList',
        'Sanction lists',
        'Applicant mentioned on sanctions lists.',
        'final',
        ['watchlists.sanctions'],
      ),
    ],
  },

  INCONSISTENT_PROFILE: {
    label: 'INCONSISTENT_PROFILE',
    sources: [
      createSource(
        'differentDocs',
        'differentDocs',
        'Different docs',
        'Submitted documents/payment methods belong to different people.',
        'final',
        ['profile.fullName', 'document.number', 'payment.bankCard.number'],
      ),
    ],
  },

  FORGERY: {
    label: 'FORGERY',
    sources: [
      createSource('fake', 'editedId', 'Edited ID data', 'Edited data detected in ID document.', 'final', [
        'document.image',
        'fraud.templateTampering',
      ]),
      createSource('fake', 'fake', 'Fake', 'Suspected fraudulent account.', 'final', ['fraud.templateTampering']),
      createSource('fake', 'fakePoa', 'Fake PoA', 'Inconsistent information in PoA.', 'final', [
        'document.image',
        'profile.address',
      ]),
      createSource('fake', 'nfcMismatch', 'NFC data mismatch', 'Document chip data mismatch.', 'final', [
        'document.nfc',
      ]),
      createSource('fake', 'forgedId', 'Physical forgery', 'Physically tampered document.', 'final', [
        'document.image',
      ]),
      createSource('fraudulentPatterns', 'template', 'Template', 'Tampered data suspected.', 'final', [
        'fraud.templateTampering',
      ]),
    ],
  },

  FRAUDULENT_PATTERNS: {
    label: 'FRAUDULENT_PATTERNS',
    sources: [
      createSource('fake', 'fakeSelfie', 'Fake selfie', 'Forgery detected in selfie.', 'final', ['selfie.image']),
      createSource('fake', 'fake', 'Fake', 'Suspected fraudulent account.', 'final', ['fraud.riskScore']),
      createSource('fraudulentPatterns', 'serial', 'Fraud network', 'Suspected fraud network.', 'final', [
        'fraud.serialNetwork',
      ]),
      createSource(
        'videoIdentFinalRejection',
        'forcedVerification',
        '3rd Force Involvement',
        'Suspected involuntary verification.',
        'final',
        ['fraud.thirdPartyInvolvement'],
      ),
    ],
  },

  NOT_DOCUMENT: {
    label: 'NOT_DOCUMENT',
    sources: [
      createSource(
        'fraudulentPatterns',
        'printedIdCopy',
        'Printed copy of ID',
        'Submitted a printed document copy.',
        'final',
        ['document.type'],
      ),
    ],
  },

  FRAUDULENT_LIVENESS: {
    label: 'FRAUDULENT_LIVENESS',
    sources: [
      createSource('fraudulentPatterns', 'livenessBypass', 'Bypass attempts', 'Attempt to deceive liveness.', 'final', [
        'fraud.livenessBypass',
      ]),
      createSource('fraudulentPatterns', 'deepFake', 'Deepfake', 'Liveness bypass with deepfake.', 'final', [
        'fraud.deepfake',
      ]),
      createSource(
        'fraudulentPatterns',
        'livenessDifferentPeople',
        'Different people',
        'Liveness by multiple people/devices.',
        'final',
        ['fraud.multiDevice'],
      ),
    ],
  },

  THIRD_PARTY_INVOLVED: {
    label: 'THIRD_PARTY_INVOLVED',
    sources: [
      createSource(
        'fraudulentPatterns',
        'livenessWithPhone',
        'Liveness with phone',
        'Phone present during liveness test.',
        'final',
        ['fraud.thirdPartyInvolvement'],
      ),
      createSource(
        'videoIdentFinalRejection',
        '3rdPartyInvolvement',
        'Sponsored registration',
        'Applicant possibly paid for account creation.',
        'final',
        ['fraud.thirdPartyInvolvement'],
      ),
    ],
  },

  SELFIE_MISMATCH: {
    label: 'SELFIE_MISMATCH',
    sources: [
      createSource(
        'fraudulentPatterns',
        'selfieMismatch',
        'Selfie mismatch',
        "Selfie doesn't match document photo.",
        'final',
        ['selfie.image', 'document.facePhoto'],
      ),
    ],
  },

  COMPANY_PROBLEMATIC_STRUCTURE: {
    label: 'COMPANY_PROBLEMATIC_STRUCTURE',
    sources: [
      createSource(
        'compromisedStructure',
        'compromisedStructure',
        'Problematic company structure',
        'Officials in ownership/control structure were rejected.',
        'final',
        ['watchlists.fitnessProbity'],
      ),
    ],
  },

  AGE_REQUIREMENT_MISMATCH: {
    label: 'AGE_REQUIREMENT_MISMATCH',
    sources: [
      createSource('regulationsViolations', 'age', 'Age', 'Applicant does not meet age requirements.', 'final', [
        'regulation.ageRequirement',
        'profile.dateOfBirth',
      ]),
    ],
  },

  REGULATIONS_VIOLATIONS: {
    label: 'REGULATIONS_VIOLATIONS',
    sources: [
      createSource('regulationsViolations', 'age', 'Age', 'Applicant does not meet age requirements.', 'final', [
        'regulation.ageRequirement',
      ]),
      createSource(
        'regulationsViolations',
        'countriesMismatch',
        'Countries mismatch',
        'Country mismatch between residence and card.',
        'final',
        ['regulation.cardVsResidenceCountry', 'profile.country'],
      ),
      createSource('regulationsViolations', 'duplicate', 'Duplicate', 'Only one active account allowed.', 'final', [
        'system.duplicateAccount',
      ]),
      createSource(
        'regulationsViolations',
        'wrongRegion',
        'Wrong region',
        'Applicant from unsupported region.',
        'final',
        ['regulation.residencyRegion'],
      ),
      createSource(
        'regulationsViolations',
        'wrongResidency',
        'Wrong residency',
        'Residency not supported by client.',
        'final',
        ['regulation.residencyRegion'],
      ),
      createSource(
        'regulationsViolations',
        'riskBankCard',
        'High risk Bank card',
        'High risk bank card detected.',
        'final',
        ['payment.bankCard.number'],
      ),
      createSource(
        'regulationsViolations',
        'inconsistency',
        'Name mismatch',
        'Name mismatch between card and ID.',
        'final',
        ['payment.bankCard.name', 'profile.fullName'],
      ),
    ],
  },

  DUPLICATE: {
    label: 'DUPLICATE',
    sources: [
      createSource('regulationsViolations', 'duplicate', 'Duplicate', 'Only one active account allowed.', 'final', [
        'system.duplicateAccount',
      ]),
    ],
  },

  WRONG_USER_REGION: {
    label: 'WRONG_USER_REGION',
    sources: [
      createSource(
        'regulationsViolations',
        'wrongRegion',
        'Wrong region',
        'Applicant from unsupported region.',
        'final',
        ['regulation.residencyRegion'],
      ),
      createSource(
        'regulationsViolations',
        'wrongResidency',
        'Wrong residency',
        'Residency not supported by client.',
        'final',
        ['regulation.residencyRegion'],
      ),
    ],
  },

  SPAM: {
    label: 'SPAM',
    sources: [createSource('spam', 'spam', 'Spam', 'Excessive file uploads.', 'final', ['uploads.spam'])],
  },

  UNSUPPORTED_LANGUAGE: {
    label: 'UNSUPPORTED_LANGUAGE',
    sources: [
      createSource(
        'videoIdentFinalRejection',
        'unsupportedLanguage',
        'Unsupported language',
        'Applicant does not speak supported languages.',
        'final',
        ['document.language'],
      ),
    ],
  },
} as const;

// ============================================================================
// MAIN API FUNCTIONS
// ============================================================================

/**
 * Gets detailed information for a rejection label
 * @param label The rejection label to look up
 * @returns Label details or undefined if not found
 */
export function getRejectionLabelDetails(label: string): RejectionLabelDetails | undefined {
  return REJECTION_LABEL_REGISTRY[label];
}

/**
 * Lists all dispositions for a given rejection label
 * @param label The rejection label to check
 * @returns Array of unique dispositions
 */
export function listDispositionsForLabel(label: string): RejectionDisposition[] {
  const details = getRejectionLabelDetails(label);
  if (!details) return [];

  const dispositions = new Set<RejectionDisposition>();
  for (const source of details.sources) {
    dispositions.add(source.disposition);
  }
  return Array.from(dispositions);
}

/**
 * Resolves the final disposition for a rejection label using escalation rules
 * @param label The rejection label to check
 * @returns "final" if any source is final, otherwise "temporary"
 */
export function resolveDisposition(label: string): RejectionDisposition {
  const dispositions = listDispositionsForLabel(label);
  return dispositions.includes('final') ? 'final' : 'temporary';
}

/**
 * Lists all fine-grained fields for a given rejection label
 * @param label The rejection label to check
 * @returns Flat array of all fine-grained fields
 */
export function listFineGrainedFieldsForLabel(label: string): FineGrainedKycField[] {
  const details = getRejectionLabelDetails(label);
  if (!details) return [];

  const fields = new Set<FineGrainedKycField>();
  for (const source of details.sources) {
    for (const field of source.fineGrainedFields) {
      fields.add(field);
    }
  }
  return Array.from(fields);
}

/**
 * Gets a complete rollup for a rejection label
 * @param label The rejection label to process
 * @returns Complete rollup object or undefined if not found
 */
export function getRejectionRollup(label: string): RejectionRollup | undefined {
  const details = getRejectionLabelDetails(label);
  if (!details) return undefined;

  const disposition = resolveDisposition(label);
  const subFields: Record<CoarseKycField, Set<string>> = Object.create(null);
  const coarseSet = new Set<CoarseKycField>();

  // Process each source
  for (const source of details.sources) {
    const bucket = categorizeRejectionSource(source);
    coarseSet.add(bucket);

    if (!subFields[bucket]) {
      subFields[bucket] = new Set<string>();
    }

    for (const field of source.fineGrainedFields) {
      subFields[bucket].add(field);
    }
  }

  // Convert sets to sorted arrays
  const subFieldsOut: Record<CoarseKycField, string[]> = Object.create(null);
  for (const bucket of coarseSet) {
    subFieldsOut[bucket] = Array.from(subFields[bucket]).sort(compareAlphabetically);
  }

  return {
    label,
    disposition,
    kycFields: Array.from(coarseSet),
    subFields: subFieldsOut,
    sources: details.sources,
  };
}

// ============================================================================
// USER-FACING UTILITY FUNCTIONS
// ============================================================================

/**
 * Maps fine-grained fields to user-friendly checklist items
 * @param rollup The rejection rollup to process
 * @returns Array of actionable checklist items
 */
export function toUserChecklistFromRollup(rollup: RejectionRollup): string[] {
  const checklist: string[] = [];

  for (const fineFields of Object.values(rollup.subFields)) {
    for (const field of fineFields) {
      switch (field) {
        case 'document.pages':
          checklist.push('Upload all pages/sides (front/back/biodata/expiry) with no cropping.');
          break;
        case 'document.image':
          checklist.push('Ensure document image is clear, well-lit, and shows all text clearly.');
          break;
        case 'document.type':
          checklist.push("Upload a supported document type (passport, driver's license, national ID).");
          break;
        case 'document.number':
          checklist.push('Ensure document number is clearly visible and matches your profile.');
          break;
        case 'document.expirationDate':
          checklist.push('Document must be valid and not expired (or expiring within 30 days).');
          break;
        case 'document.issueDate':
          checklist.push('Document must be recent enough to meet address verification requirements.');
          break;
        case 'document.language':
          checklist.push('Document must be in English or include a notarized English translation.');
          break;
        case 'document.nfc':
          checklist.push('Use NFC scanning feature if available on your device.');
          break;
        case 'document.signatureOrStamp':
          checklist.push('Ensure all required signatures and stamps are visible.');
          break;
        case 'document.facePhoto':
          checklist.push('Ensure your face photo on the document is clearly visible.');
          break;
        case 'document.country':
          checklist.push('Document country must match your residence country.');
          break;
        case 'profile.fullName':
          checklist.push('Ensure your full name matches exactly across all documents.');
          break;
        case 'profile.dateOfBirth':
          checklist.push('Date of birth must match exactly across all documents and profile.');
          break;
        case 'profile.gender':
          checklist.push('Gender must match exactly across all documents and profile.');
          break;
        case 'profile.address':
          checklist.push('Address must match exactly across all documents and profile.');
          break;
        case 'profile.country':
          checklist.push('Country must match exactly across all documents and profile.');
          break;
        case 'database.availability':
          checklist.push('Government database is temporarily unavailable. Please try again later.');
          break;
        case 'database.match':
          checklist.push("Your information doesn't match government records. Please verify your details.");
          break;
        case 'database.name':
          checklist.push("Your name doesn't match government records. Please verify your full legal name.");
          break;
        case 'database.dob':
          checklist.push("Your date of birth doesn't match government records. Please verify your DOB.");
          break;
        case 'database.gender':
          checklist.push("Your gender doesn't match government records. Please verify your gender.");
          break;
        case 'database.address':
          checklist.push("Your address doesn't match government records. Please verify your address.");
          break;
        case 'database.presence':
          checklist.push('No records found in government database. Please contact support.');
          break;
        case 'socialNumber.bvn':
          checklist.push('BVN number is incorrect. Please provide the correct BVN.');
          break;
        case 'socialNumber.ssn':
          checklist.push('SSN number is incorrect. Please provide the correct SSN.');
          break;
        case 'socialNumber.tin':
          checklist.push('Tax number is incorrect. Please provide the correct TIN.');
          break;
        case 'payment.bankCard.number':
          checklist.push('Bank card number is missing or incorrect. Please provide a valid card number.');
          break;
        case 'payment.bankCard.name':
          checklist.push("Name on bank card is missing or doesn't match your profile.");
          break;
        case 'payment.bankCard.expiry':
          checklist.push('Bank card has expired or expires soon. Please provide a valid card.');
          break;
        case 'payment.bankStatement.fullName':
          checklist.push('Full name on bank statement is missing or unreadable.');
          break;
        case 'payment.bankStatement.accountOrCardNumber':
          checklist.push('Account/card number on bank statement is missing or unreadable.');
          break;
        case 'payment.wireTransfer.proof':
          checklist.push('Wire transfer confirmation is required. Please provide proof of transfer.');
          break;
        case 'payment.ewallet.proof':
          checklist.push('E-wallet confirmation is required. Please provide proof of transaction.');
          break;
        case 'wallet.address':
          checklist.push("Wallet address is incorrect or doesn't match transaction records.");
          break;
        case 'wallet.signature':
          checklist.push("Wallet signature doesn't match. Please verify your wallet access.");
          break;
        case 'wallet.riskScore':
          checklist.push('Wallet has high risk score. Please contact support for assistance.');
          break;
        case 'selfie.image':
          checklist.push('Take a clear selfie with good lighting and neutral expression.');
          break;
        case 'selfie.liveness':
          checklist.push('Complete the liveness check by following the on-screen instructions.');
          break;
        case 'selfie.video':
          checklist.push('Record a clear video selfie following the provided instructions.');
          break;
        case 'videoIdent.connection':
          checklist.push('Ensure stable internet connection for video identification call.');
          break;
        case 'videoIdent.visibility':
          checklist.push('Ensure you are clearly visible during the video identification call.');
          break;
        case 'videoIdent.alone':
          checklist.push('You must be alone during the video identification call.');
          break;
        case 'videoIdent.requiredDocs':
          checklist.push('Have all required documents ready for the video identification call.');
          break;
        case 'fraud.riskScore':
          checklist.push('Account flagged for high risk. Please contact support.');
          break;
        case 'fraud.livenessBypass':
          checklist.push('Liveness verification failed. Please complete the check properly.');
          break;
        case 'fraud.deepfake':
          checklist.push('Deepfake detection triggered. Please contact support.');
          break;
        case 'fraud.multiDevice':
          checklist.push('Multiple devices detected. Please use only one device.');
          break;
        case 'fraud.thirdPartyInvolvement':
          checklist.push('Third party involvement detected. Please complete verification yourself.');
          break;
        case 'fraud.serialNetwork':
          checklist.push('Fraud network detected. Please contact support.');
          break;
        case 'fraud.templateTampering':
          checklist.push('Document tampering detected. Please provide original documents.');
          break;
        case 'system.duplicateAccount':
          checklist.push('Duplicate account detected. Only one account per person is allowed.');
          break;
        case 'regulation.ageRequirement':
          checklist.push('Age requirement not met. Please verify you meet the minimum age.');
          break;
        case 'regulation.residencyRegion':
          checklist.push('Your region is not supported. Please contact support.');
          break;
        case 'regulation.cardVsResidenceCountry':
          checklist.push('Card country must match your residence country.');
          break;
        case 'media.adverse':
          checklist.push('Adverse media found. Please contact support for review.');
          break;
        case 'watchlists.sanctions':
          checklist.push('Sanctions list match found. Please contact support.');
          break;
        case 'watchlists.pep':
          checklist.push('PEP (Politically Exposed Person) status detected. Please contact support.');
          break;
        case 'watchlists.criminalRecords':
          checklist.push('Criminal records found. Please contact support.');
          break;
        case 'watchlists.fitnessProbity':
          checklist.push('Fitness and probity issues found. Please contact support.');
          break;
        case 'uploads.spam':
          checklist.push('Excessive file uploads detected. Please contact support.');
          break;
        default:
          // Fallback for any unmapped fields
          checklist.push(`Please address the issue with ${field.replace(/\./g, ' ')}.`);
      }
    }
  }

  return [...new Set(checklist)]; // Remove duplicates
}

/**
 * Formats a user-facing message for a rejection rollup
 * @param rollup The rejection rollup to format
 * @returns User-friendly message with appropriate tone and action items
 */
export function formatUserFacingMessage(rollup: RejectionRollup): string {
  if (rollup.disposition === 'final') {
    return `Your verification has been rejected due to compliance requirements. This decision is final and cannot be appealed. Please contact our support team for more information.`;
  }

  const checklist = toUserChecklistFromRollup(rollup);
  const checklistText =
    checklist.length > 0
      ? `\n\nPlease address the following issues:\n${checklist.map((item) => `• ${item}`).join('\n')}`
      : '';

  return `Your verification requires additional information. Please review and resubmit your documents with the requested corrections.${checklistText}`;
}
