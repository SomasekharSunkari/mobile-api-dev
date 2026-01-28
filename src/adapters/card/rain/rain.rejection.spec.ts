import {
  compareAlphabetically,
  getRejectionLabelDetails,
  getRejectionRollup,
  listDispositionsForLabel,
  listFineGrainedFieldsForLabel,
  resolveDisposition,
  toUserChecklistFromRollup,
  formatUserFacingMessage,
  assertNever,
  REJECTION_LABEL_REGISTRY,
} from './rain.rejection';
import type { RejectionLabelDetails, RejectionRollup, RejectionSource } from './rain.rejection';

describe('rain.rejection', () => {
  describe('compareAlphabetically', () => {
    it('should compare strings alphabetically', () => {
      expect(compareAlphabetically('a', 'b')).toBeLessThan(0);
      expect(compareAlphabetically('b', 'a')).toBeGreaterThan(0);
      expect(compareAlphabetically('a', 'a')).toBe(0);
    });

    it('should handle numeric strings', () => {
      expect(compareAlphabetically('1', '2')).toBeLessThan(0);
      expect(compareAlphabetically('10', '2')).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      expect(compareAlphabetically('A', 'a')).toBe(0);
      expect(compareAlphabetically('B', 'a')).toBeGreaterThan(0);
    });
  });

  describe('getRejectionLabelDetails', () => {
    it('should return label details for valid label', () => {
      const details = getRejectionLabelDetails('CHECK_UNAVAILABLE');
      expect(details).toBeDefined();
      expect(details?.label).toBe('CHECK_UNAVAILABLE');
      expect(details?.sources).toBeInstanceOf(Array);
      expect(details?.sources.length).toBeGreaterThan(0);
    });

    it('should return undefined for invalid label', () => {
      const details = getRejectionLabelDetails('INVALID_LABEL');
      expect(details).toBeUndefined();
    });

    it('should return details for temporary rejection label', () => {
      const details = getRejectionLabelDetails('BAD_PROOF_OF_PAYMENT');
      expect(details).toBeDefined();
      expect(details?.sources.some((s) => s.disposition === 'temporary')).toBe(true);
    });

    it('should return details for final rejection label', () => {
      const details = getRejectionLabelDetails('ADVERSE_MEDIA');
      expect(details).toBeDefined();
      expect(details?.sources.every((s) => s.disposition === 'final')).toBe(true);
    });
  });

  describe('listDispositionsForLabel', () => {
    it('should return dispositions for label with multiple sources', () => {
      const dispositions = listDispositionsForLabel('BAD_PROOF_OF_PAYMENT');
      expect(dispositions).toContain('temporary');
      expect(dispositions).toContain('final');
    });

    it('should return single disposition for label with one disposition type', () => {
      const dispositions = listDispositionsForLabel('ADVERSE_MEDIA');
      expect(dispositions).toEqual(['final']);
    });

    it('should return empty array for invalid label', () => {
      const dispositions = listDispositionsForLabel('INVALID_LABEL');
      expect(dispositions).toEqual([]);
    });

    it('should return unique dispositions', () => {
      const dispositions = listDispositionsForLabel('RESTRICTED_PERSON');
      const uniqueDispositions = [...new Set(dispositions)];
      expect(dispositions.length).toBe(uniqueDispositions.length);
    });
  });

  describe('resolveDisposition', () => {
    it('should return final when any source is final', () => {
      const disposition = resolveDisposition('BAD_PROOF_OF_PAYMENT');
      expect(disposition).toBe('final');
    });

    it('should return temporary when all sources are temporary', () => {
      const disposition = resolveDisposition('CHECK_UNAVAILABLE');
      expect(disposition).toBe('temporary');
    });

    it('should return temporary for invalid label', () => {
      const disposition = resolveDisposition('INVALID_LABEL');
      expect(disposition).toBe('temporary');
    });
  });

  describe('listFineGrainedFieldsForLabel', () => {
    it('should return fine-grained fields for valid label', () => {
      const fields = listFineGrainedFieldsForLabel('BAD_PROOF_OF_PAYMENT');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields).toContain('payment.bankCard.name');
    });

    it('should return unique fields', () => {
      const fields = listFineGrainedFieldsForLabel('BAD_PROOF_OF_PAYMENT');
      const uniqueFields = [...new Set(fields)];
      expect(fields.length).toBe(uniqueFields.length);
    });

    it('should return empty array for invalid label', () => {
      const fields = listFineGrainedFieldsForLabel('INVALID_LABEL');
      expect(fields).toEqual([]);
    });
  });

  describe('getRejectionRollup', () => {
    it('should return rollup for valid label', () => {
      const rollup = getRejectionRollup('BAD_PROOF_OF_PAYMENT');
      expect(rollup).toBeDefined();
      expect(rollup?.label).toBe('BAD_PROOF_OF_PAYMENT');
      expect(rollup?.disposition).toBe('final');
      expect(rollup?.kycFields).toBeInstanceOf(Array);
      expect(rollup?.subFields).toBeDefined();
      expect(rollup?.sources).toBeInstanceOf(Array);
    });

    it('should return undefined for invalid label', () => {
      const rollup = getRejectionRollup('INVALID_LABEL');
      expect(rollup).toBeUndefined();
    });

    it('should categorize sources into coarse fields', () => {
      const rollup = getRejectionRollup('BAD_PROOF_OF_PAYMENT');
      expect(rollup?.kycFields).toContain('payment');
    });

    it('should sort subFields alphabetically', () => {
      const rollup = getRejectionRollup('BAD_PROOF_OF_PAYMENT');
      if (rollup && rollup.subFields.payment) {
        const fields = rollup.subFields.payment;
        for (let i = 1; i < fields.length; i++) {
          expect(compareAlphabetically(fields[i - 1], fields[i])).toBeLessThanOrEqual(0);
        }
      }
    });

    it('should handle label with temporary disposition', () => {
      const rollup = getRejectionRollup('CHECK_UNAVAILABLE');
      expect(rollup?.disposition).toBe('temporary');
    });
  });

  describe('toUserChecklistFromRollup', () => {
    it('should generate checklist for document fields', () => {
      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: ['document'],
        subFields: {
          document: ['document.pages', 'document.image'],
          profile: [],
          database: [],
          payment: [],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const checklist = toUserChecklistFromRollup(rollup);
      expect(checklist.length).toBe(2);
      expect(checklist).toContain('Upload all pages/sides (front/back/biodata/expiry) with no cropping.');
      expect(checklist).toContain('Ensure document image is clear, well-lit, and shows all text clearly.');
    });

    it('should generate checklist for profile fields', () => {
      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: ['profile'],
        subFields: {
          document: [],
          profile: ['profile.fullName', 'profile.dateOfBirth'],
          database: [],
          payment: [],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const checklist = toUserChecklistFromRollup(rollup);
      expect(checklist.length).toBe(2);
      expect(checklist).toContain('Ensure your full name matches exactly across all documents.');
      expect(checklist).toContain('Date of birth must match exactly across all documents and profile.');
    });

    it('should generate checklist for payment fields', () => {
      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: ['payment'],
        subFields: {
          document: [],
          profile: [],
          database: [],
          payment: ['payment.bankCard.number', 'payment.bankCard.name'],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const checklist = toUserChecklistFromRollup(rollup);
      expect(checklist.length).toBe(2);
      expect(checklist).toContain('Bank card number is missing or incorrect. Please provide a valid card number.');
      expect(checklist).toContain("Name on bank card is missing or doesn't match your profile.");
    });

    it('should remove duplicate checklist items', () => {
      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: ['document'],
        subFields: {
          document: ['document.image', 'document.image'],
          profile: [],
          database: [],
          payment: [],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const checklist = toUserChecklistFromRollup(rollup);
      expect(checklist.length).toBe(1);
    });

    it('should handle all field types', () => {
      const allFields = [
        'document.pages',
        'document.image',
        'document.type',
        'document.number',
        'document.expirationDate',
        'document.issueDate',
        'document.language',
        'document.nfc',
        'document.signatureOrStamp',
        'document.facePhoto',
        'document.country',
        'profile.fullName',
        'profile.dateOfBirth',
        'profile.gender',
        'profile.address',
        'profile.country',
        'database.availability',
        'database.match',
        'database.name',
        'database.dob',
        'database.gender',
        'database.address',
        'database.presence',
        'socialNumber.bvn',
        'socialNumber.ssn',
        'socialNumber.tin',
        'payment.bankCard.number',
        'payment.bankCard.name',
        'payment.bankCard.expiry',
        'payment.bankStatement.fullName',
        'payment.bankStatement.accountOrCardNumber',
        'payment.wireTransfer.proof',
        'payment.ewallet.proof',
        'wallet.address',
        'wallet.signature',
        'wallet.riskScore',
        'selfie.image',
        'selfie.liveness',
        'selfie.video',
        'videoIdent.connection',
        'videoIdent.visibility',
        'videoIdent.alone',
        'videoIdent.requiredDocs',
        'fraud.riskScore',
        'fraud.livenessBypass',
        'fraud.deepfake',
        'fraud.multiDevice',
        'fraud.thirdPartyInvolvement',
        'fraud.serialNetwork',
        'fraud.templateTampering',
        'system.duplicateAccount',
        'regulation.ageRequirement',
        'regulation.residencyRegion',
        'regulation.cardVsResidenceCountry',
        'media.adverse',
        'watchlists.sanctions',
        'watchlists.pep',
        'watchlists.criminalRecords',
        'watchlists.fitnessProbity',
        'uploads.spam',
      ];

      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: [
          'document',
          'profile',
          'payment',
          'database',
          'wallet',
          'selfie',
          'videoIdent',
          'fraud',
          'system',
          'regulation',
          'media',
          'watchlists',
          'uploads',
        ],
        subFields: {
          document: allFields.filter((f) => f.startsWith('document.')),
          profile: allFields.filter((f) => f.startsWith('profile.')),
          database: allFields.filter((f) => f.startsWith('database.')),
          payment: allFields.filter((f) => f.startsWith('payment.')),
          proofOfAddress: [],
          wallet: allFields.filter((f) => f.startsWith('wallet.')),
          selfie: allFields.filter((f) => f.startsWith('selfie.')),
          videoIdent: allFields.filter((f) => f.startsWith('videoIdent.')),
          fraud: allFields.filter((f) => f.startsWith('fraud.')),
          system: allFields.filter((f) => f.startsWith('system.')),
          regulation: allFields.filter((f) => f.startsWith('regulation.')),
          media: allFields.filter((f) => f.startsWith('media.')),
          watchlists: allFields.filter((f) => f.startsWith('watchlists.')),
          uploads: allFields.filter((f) => f.startsWith('uploads.')),
        },
        sources: [],
      };

      const checklist = toUserChecklistFromRollup(rollup);
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist.every((item) => typeof item === 'string')).toBe(true);
    });

    it('should handle unknown field with fallback message', () => {
      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: ['document'],
        subFields: {
          document: ['document.unknownField' as any],
          profile: [],
          database: [],
          payment: [],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const checklist = toUserChecklistFromRollup(rollup);
      expect(checklist.length).toBe(1);
      expect(checklist[0]).toContain('document unknownField');
    });
  });

  describe('formatUserFacingMessage', () => {
    it('should format message for final disposition', () => {
      const rollup: RejectionRollup = {
        label: 'ADVERSE_MEDIA',
        disposition: 'final',
        kycFields: ['media'],
        subFields: {
          document: [],
          profile: [],
          database: [],
          payment: [],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: ['media.adverse'],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const message = formatUserFacingMessage(rollup);
      expect(message).toContain('rejected');
      expect(message).toContain('final');
      expect(message).toContain('cannot be appealed');
    });

    it('should format message for temporary disposition with checklist', () => {
      const rollup: RejectionRollup = {
        label: 'BAD_PROOF_OF_PAYMENT',
        disposition: 'temporary',
        kycFields: ['payment'],
        subFields: {
          document: [],
          profile: [],
          database: [],
          payment: ['payment.bankCard.name'],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const message = formatUserFacingMessage(rollup);
      expect(message).toContain('requires additional information');
      expect(message).toContain('Please address the following issues');
      expect(message).toContain('•');
    });

    it('should format message for temporary disposition without checklist', () => {
      const rollup: RejectionRollup = {
        label: 'TEST',
        disposition: 'temporary',
        kycFields: [],
        subFields: {
          document: [],
          profile: [],
          database: [],
          payment: [],
          proofOfAddress: [],
          wallet: [],
          selfie: [],
          videoIdent: [],
          fraud: [],
          system: [],
          regulation: [],
          media: [],
          watchlists: [],
          uploads: [],
        },
        sources: [],
      };

      const message = formatUserFacingMessage(rollup);
      expect(message).toContain('requires additional information');
      expect(message).not.toContain('Please address the following issues');
    });
  });

  describe('assertNever', () => {
    it('should throw error when called', () => {
      expect(() => assertNever('test' as never)).toThrow('Unexpected value: test');
    });
  });

  describe('REJECTION_LABEL_REGISTRY', () => {
    it('should contain all expected rejection labels', () => {
      const expectedLabels = [
        'CHECK_UNAVAILABLE',
        'RESTRICTED_PERSON',
        'INCORRECT_SOCIAL_NUMBER',
        'DOCUMENT_PAGE_MISSING',
        'BAD_PROOF_OF_PAYMENT',
        'BAD_PROOF_OF_IDENTITY',
        'DOCUMENT_DAMAGED',
        'REQUESTED_DATA_MISMATCH',
        'DIGITAL_DOCUMENT',
        'INCOMPATIBLE_LANGUAGE',
        'EXPIRATION_DATE',
        'ID_INVALID',
        'INCOMPLETE_DOCUMENT',
        'UNSATISFACTORY_PHOTOS',
        'GRAPHIC_EDITOR',
        'SCREENSHOTS',
        'WRONG_ADDRESS',
        'PROBLEMATIC_APPLICANT_DATA',
        'DB_DATA_MISMATCH',
        'DB_DATA_NOT_FOUND',
        'GPS_AS_POA_SKIPPED',
        'BAD_PROOF_OF_ADDRESS',
        'BAD_FACE_MATCHING',
        'BAD_SELFIE',
        'BAD_VIDEO_SELFIE',
        'UNSUITABLE_ENV',
        'CONNECTION_INTERRUPTED',
        'APPLICANT_INTERRUPTED_INTERVIEW',
        'DOCUMENT_MISSING',
        'ADVERSE_MEDIA',
        'CRIMINAL',
        'COMPROMISED_PERSONS',
        'PEP',
        'SANCTIONS',
        'INCONSISTENT_PROFILE',
        'FORGERY',
        'FRAUDULENT_PATTERNS',
        'NOT_DOCUMENT',
        'FRAUDULENT_LIVENESS',
        'THIRD_PARTY_INVOLVED',
        'SELFIE_MISMATCH',
        'COMPANY_PROBLEMATIC_STRUCTURE',
        'AGE_REQUIREMENT_MISMATCH',
        'REGULATIONS_VIOLATIONS',
        'DUPLICATE',
        'WRONG_USER_REGION',
        'SPAM',
        'UNSUPPORTED_LANGUAGE',
      ];

      expectedLabels.forEach((label) => {
        expect(REJECTION_LABEL_REGISTRY[label]).toBeDefined();
        expect(REJECTION_LABEL_REGISTRY[label].label).toBe(label);
        expect(REJECTION_LABEL_REGISTRY[label].sources).toBeInstanceOf(Array);
        expect(REJECTION_LABEL_REGISTRY[label].sources.length).toBeGreaterThan(0);
      });
    });

    it('should have valid source structure for all labels', () => {
      Object.values(REJECTION_LABEL_REGISTRY).forEach((details: RejectionLabelDetails) => {
        details.sources.forEach((source: RejectionSource) => {
          expect(source.groupId).toBeDefined();
          expect(source.reasonId).toBeDefined();
          expect(source.reason).toBeDefined();
          expect(source.description).toBeDefined();
          expect(['temporary', 'final']).toContain(source.disposition);
          expect(source.fineGrainedFields).toBeInstanceOf(Array);
        });
      });
    });
  });

  describe('Integration tests', () => {
    it('should handle complete flow for a rejection label', () => {
      const label = 'BAD_PROOF_OF_PAYMENT';

      const details = getRejectionLabelDetails(label);
      expect(details).toBeDefined();

      const dispositions = listDispositionsForLabel(label);
      expect(dispositions.length).toBeGreaterThan(0);

      const disposition = resolveDisposition(label);
      expect(['temporary', 'final']).toContain(disposition);

      const fields = listFineGrainedFieldsForLabel(label);
      expect(fields.length).toBeGreaterThan(0);

      const rollup = getRejectionRollup(label);
      expect(rollup).toBeDefined();
      expect(rollup?.disposition).toBe(disposition);

      const checklist = toUserChecklistFromRollup(rollup!);
      expect(checklist.length).toBeGreaterThan(0);

      const message = formatUserFacingMessage(rollup!);
      expect(message.length).toBeGreaterThan(0);
    });
  });
});
