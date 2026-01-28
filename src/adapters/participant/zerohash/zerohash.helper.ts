import { ZerohashEmploymentStatus, ZerohashSourceOfFunds, ZerohashIndustry } from './zerohash.interface';

/**
 * ZeroHash Helper Class
 *
 * Provides utility methods for mapping Sumsub values to ZeroHash format.
 * Follows OOP patterns by encapsulating mapping logic in a dedicated helper class.
 */
export class ZerohashHelper {
  /**
   * Maps Sumsub employment status values to ZeroHash employment status format
   */
  static mapEmploymentStatusToZeroHash(sumsubValue: string): ZerohashEmploymentStatus | undefined {
    const mappings: Record<string, ZerohashEmploymentStatus> = {
      employed: 'full_time',
      self_employed: 'self_employed',
      homemaker: 'unemployed',
      unemployed: 'unemployed',
      student: 'student',
      retired: 'retired',
    };
    return mappings[sumsubValue];
  }

  /**
   * Maps Sumsub source of funds values to ZeroHash source of funds format
   */
  static mapSourceOfFundsToZeroHash(sumsubValue: string): ZerohashSourceOfFunds | undefined {
    const mappings: Record<string, ZerohashSourceOfFunds> = {
      salary: 'salary',
      savings: 'savings',
      pension_retirement: 'pension_retirement',
      inheritance: 'inheritance',
      investment: 'investment',
      loan: 'loan',
      gift: 'gift',
      company_funds: 'other',
      ecommerce_reseller: 'other',
      gambling_proceeds: 'other',
      gifts: 'gift',
      government_benefits: 'other',
      investments_loans: 'investment',
      sale_of_assets_real_estate: 'other',
      someone_elses_funds: 'other',
    };
    return mappings[sumsubValue];
  }

  /**
   * Maps occupation display names to ZeroHash industry categories
   * Comprehensive mapping covering more ZeroHash industry types
   */
  static mapOccupationToIndustry(occupationDisplayName: string): ZerohashIndustry {
    const mappings: Record<string, ZerohashIndustry> = {
      // Financial Services
      'Accountant and auditor': 'financial_services',
      'Financial analyst': 'financial_services',
      'Bank teller': 'financial_services',
      'Investment advisor': 'financial_services',
      'Insurance agent': 'insurance',
      'Insurance broker': 'insurance',

      // Healthcare & Pharmaceuticals
      Doctor: 'pharmaceuticals',
      Nurse: 'pharmaceuticals',
      Pharmacist: 'pharmaceuticals',
      'Medical technician': 'pharmaceuticals',
      Dentist: 'pharmaceuticals',
      Veterinarian: 'pharmaceuticals',

      // Education
      Teacher: 'education',
      Professor: 'education',
      'School administrator': 'education',
      Tutor: 'education',
      Librarian: 'education',

      // Legal Services
      Lawyer: 'legal_services',
      Attorney: 'legal_services',
      Paralegal: 'legal_services',
      Judge: 'legal_services',
      'Legal assistant': 'legal_services',

      // Construction & Manufacturing
      'Construction worker': 'construction_manufacturing',
      Architect: 'construction_manufacturing',
      'Manufacturing worker': 'construction_manufacturing',
      Electrician: 'construction_manufacturing',
      Plumber: 'construction_manufacturing',
      Carpenter: 'construction_manufacturing',

      // Retail & Sales
      'Retail worker': 'retail_wholesale',
      Cashier: 'retail_wholesale',
      'Store manager': 'retail_wholesale',
      'Sales manager': 'retail_wholesale',

      // Marketing & Media
      'Marketing specialist': 'advertising_media_marketing',
      'Marketing manager': 'advertising_media_marketing',
      'Advertising executive': 'advertising_media_marketing',
      'Content creator': 'advertising_media_marketing',
      Journalist: 'advertising_media_marketing',
      'Graphic designer': 'advertising_media_marketing',

      // Government & Law Enforcement
      'Police officer': 'law_enforcement',
      'Government employee': 'government_agency',
      'Civil servant': 'government_agency',
      'Military personnel': 'government_agency',
      Firefighter: 'government_agency',

      // Transportation
      Driver: 'transportation',
      Pilot: 'transportation',
      'Truck driver': 'transportation',
      'Delivery driver': 'transportation',
      'Logistics coordinator': 'transportation',

      // Food & Hospitality
      Chef: 'food_beverages',
      'Restaurant worker': 'food_beverages',
      Bartender: 'food_beverages',
      'Hotel manager': 'food_beverages',
      'Travel agent': 'travel_car_hire',

      // Real Estate
      'Real estate agent': 'property_real_estate',
      'Property manager': 'property_real_estate',
      'Real estate broker': 'property_real_estate',

      // Arts & Entertainment
      Artist: 'arts_entertainment',
      Musician: 'arts_entertainment',
      Actor: 'arts_entertainment',
      Photographer: 'arts_entertainment',
      Writer: 'arts_entertainment',

      // Agriculture
      Farmer: 'agriculture',
      'Agricultural worker': 'agriculture',
      Rancher: 'agriculture',

      // Fashion
      'Fashion designer': 'fashion',
      Stylist: 'fashion',
      Model: 'fashion',

      // Non-profit & Charity
      'Social worker': 'charity',
      'Non-profit worker': 'charity',
      'Volunteer coordinator': 'charity',
    };
    return mappings[occupationDisplayName] || 'other';
  }
}
