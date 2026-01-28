import { Injectable, Logger } from '@nestjs/common';
import { RainOccupations } from './rain.occupations';
import { Occupation, SumSubMapping } from '../card.adapter.interface';

@Injectable()
export class RainOccupationMapperService {
  private readonly logger = new Logger(RainOccupationMapperService.name);

  // Hardcoded mapping based on your SumSub data
  private readonly hardcodedMappings: SumSubMapping = {
    // Exact matches from your sumsub.json
    'Accountant and auditor': '13-2011',
    'Registered nurse': '29-1141',
    'Elementary and middle school teacher': '25-2022',
    'Software developer': '15-1132',
    'Sales representatives, wholesale and manufacturing': '41-4012',
    Cashier: '41-2011',
    'Driver/sales worker and truck driver': '53-3032',
    Lawyer: '23-1011',
    'Customer service representative': '43-4051',
    'Secretary and administrative assistant, except legal, medical, and executive': '43-6014',
    'Bookkeeping, accounting, and auditing clerk': '43-3031',
    'Police officer': '33-3051',
    'Business operations specialist, other': '13-1199',
    'Computer occupation, other': '15-1199',
    'Counselor, other': '21-1019',
    'Engineer, other': '17-2199',
    'Entertainer and performer, sports and related worker, other': '27-2099',
    'Farmer, rancher, and other agricultural manager': '11-9013',
    'Healthcare diagnosing or treating practitioner, other': '29-1199',
    'Media and communication worker, other': '27-3099',
    'Religious worker, other': '21-2099',
    'Other designer': '27-1029',
    'Project management specialist': '13-1081',
  };

  private occupations: Map<string, Occupation>;

  constructor() {
    this.initializeOccupations();
  }

  private initializeOccupations() {
    this.occupations = new Map();
    RainOccupations.forEach((occ: Occupation) => {
      this.occupations.set(occ.code, occ);
    });
    this.logger.log(`Loaded ${this.occupations.size} occupations`);
  }

  /**
   * Maps an occupation string from SumSub to the appropriate Rain occupation code
   *
   * Uses hardcoded mapping first for known SumSub values, then falls back to
   * dynamic matching for new or unrecognized occupations.
   *
   * @param occupationInput - The occupation string from SumSub
   * @returns The mapped occupation code, or 'OTHERXX' if no match found
   */
  public mapOccupation(occupationInput: string): string {
    if (!occupationInput) {
      this.logger.warn('Empty occupation input provided');
      return 'OTHERXX'; // Default fallback
    }

    // Step 1: Try hardcoded mapping first
    const hardcodedResult = this.tryHardcodedMapping(occupationInput);
    if (hardcodedResult) {
      this.logger.debug(`Hardcoded mapping found: ${occupationInput} -> ${hardcodedResult}`);
      return hardcodedResult;
    }

    // Step 2: Try dynamic matching
    const dynamicResult = this.tryDynamicMatching(occupationInput);
    if (dynamicResult) {
      this.logger.debug(`Dynamic mapping found: ${occupationInput} -> ${dynamicResult}`);
      return dynamicResult;
    }

    // Step 3: Final fallback
    this.logger.warn(`No occupation mapping found for: ${occupationInput}, using OTHERXX`);
    return 'OTHERXX';
  }

  private tryHardcodedMapping(input: string): string | null {
    const normalizedInput = this.normalizeText(input);

    // Exact match
    if (this.hardcodedMappings[input]) {
      return this.hardcodedMappings[input];
    }

    // Normalized key match
    for (const [key, value] of Object.entries(this.hardcodedMappings)) {
      if (this.normalizeText(key) === normalizedInput) {
        return value;
      }
    }

    return null;
  }

  private tryDynamicMatching(input: string): string | null {
    const normalizedInput = this.normalizeText(input);

    // Try to find the closest match in occupation names
    let bestMatch: { code: string; score: number } | null = null;

    for (const [code, occupation] of this.occupations) {
      const normalizedName = this.normalizeText(occupation.name);
      const score = this.calculateMatchScore(normalizedInput, normalizedName);

      if (score > 0.7) {
        // Threshold for decent match
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { code, score };
        }
      }
    }

    return bestMatch?.code || null;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateMatchScore(input: string, target: string): number {
    if (input === target) return 1.0;

    const inputWords = input.split(' ');
    const targetWords = target.split(' ');

    let matchCount = 0;
    for (const inputWord of inputWords) {
      if (targetWords.some((targetWord) => targetWord.includes(inputWord) || inputWord.includes(targetWord))) {
        matchCount++;
      }
    }

    return matchCount / Math.max(inputWords.length, targetWords.length);
  }

  /**
   * Gets the occupation name by code
   *
   * @param code - The occupation code to look up
   * @returns The occupation name, or null if not found
   */
  public getOccupationName(code: string): string | null {
    return this.occupations.get(code)?.name || null;
  }

  /**
   * Gets all available occupations
   *
   * @returns Array of all occupations
   */
  public getAllOccupations(): Occupation[] {
    return Array.from(this.occupations.values());
  }
}
