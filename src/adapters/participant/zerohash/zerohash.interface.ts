/**
 * Nigerian State Subdivision Codes based on ISO 3166-2:NG
 * Maps Nigerian cities and regions to their proper state subdivision codes
 */
export enum NigerianStateCode {
  // Federal Capital Territory
  FC = 'FC', // Abuja Federal Capital Territory

  // States (alphabetical by code)
  AB = 'AB', // Abia
  AD = 'AD', // Adamawa
  AK = 'AK', // Akwa Ibom
  AN = 'AN', // Anambra
  BA = 'BA', // Bauchi
  BY = 'BY', // Bayelsa
  BE = 'BE', // Benue
  BO = 'BO', // Borno
  CR = 'CR', // Cross River
  DE = 'DE', // Delta
  EB = 'EB', // Ebonyi
  ED = 'ED', // Edo
  EK = 'EK', // Ekiti
  EN = 'EN', // Enugu
  GO = 'GO', // Gombe
  IM = 'IM', // Imo
  JI = 'JI', // Jigawa
  KD = 'KD', // Kaduna
  KN = 'KN', // Kano
  KT = 'KT', // Katsina
  KE = 'KE', // Kebbi
  KO = 'KO', // Kogi
  KW = 'KW', // Kwara
  LA = 'LA', // Lagos
  NA = 'NA', // Nasarawa
  NI = 'NI', // Niger
  OG = 'OG', // Ogun
  ON = 'ON', // Ondo
  OS = 'OS', // Osun
  OY = 'OY', // Oyo
  PL = 'PL', // Plateau
  RI = 'RI', // Rivers
  SO = 'SO', // Sokoto
  TA = 'TA', // Taraba
  YO = 'YO', // Yobe
  ZA = 'ZA', // Zamfara
}

/**
 * Interface for Nigerian city to state code mapping
 */
export interface NigerianCityStateMapping {
  readonly [city: string]: NigerianStateCode;
}

/**
 * Comprehensive mapping of Nigerian cities and regions to their state subdivision codes
 * Based on ISO 3166-2:NG standard
 */
export const NIGERIAN_CITY_TO_STATE_MAPPING: NigerianCityStateMapping = {
  // State names (for direct state name lookups)
  abia: NigerianStateCode.AB,
  adamawa: NigerianStateCode.AD,
  akwa: NigerianStateCode.AN,
  akwaibom: NigerianStateCode.AK,
  bayelsa: NigerianStateCode.BY,
  benue: NigerianStateCode.BE,
  borno: NigerianStateCode.BO,
  crossriver: NigerianStateCode.CR,
  delta: NigerianStateCode.DE,
  ebonyi: NigerianStateCode.EB,
  edo: NigerianStateCode.ED,
  ekiti: NigerianStateCode.EK,
  imo: NigerianStateCode.IM,
  jigawa: NigerianStateCode.JI,
  kebbi: NigerianStateCode.KE,
  kogi: NigerianStateCode.KO,
  kwara: NigerianStateCode.KW,
  nasarawa: NigerianStateCode.NA,
  niger: NigerianStateCode.NI,
  ogun: NigerianStateCode.OG,
  ondo: NigerianStateCode.ON,
  osun: NigerianStateCode.OS,
  oyo: NigerianStateCode.OY,
  plateau: NigerianStateCode.PL,
  rivers: NigerianStateCode.RI,
  taraba: NigerianStateCode.TA,
  yobe: NigerianStateCode.YO,
  zamfara: NigerianStateCode.ZA,
  federalcapitalterritory: NigerianStateCode.FC,
  abujafederalcapitalterritory: NigerianStateCode.FC,
  fct: NigerianStateCode.FC, // FCT abbreviation

  // Lagos State cities and areas
  lagos: NigerianStateCode.LA,
  ikeja: NigerianStateCode.LA,
  lekki: NigerianStateCode.LA,
  'victoria island': NigerianStateCode.LA,
  ikoyi: NigerianStateCode.LA,
  surulere: NigerianStateCode.LA,
  yaba: NigerianStateCode.LA,
  agege: NigerianStateCode.LA,
  alimosho: NigerianStateCode.LA,
  mushin: NigerianStateCode.LA,
  oshodi: NigerianStateCode.LA,
  apapa: NigerianStateCode.LA,
  badagry: NigerianStateCode.LA,
  epe: NigerianStateCode.LA,
  ikorodu: NigerianStateCode.LA,
  ojo: NigerianStateCode.LA,
  'ifako-ijaiye': NigerianStateCode.LA,
  kosofe: NigerianStateCode.LA,
  shomolu: NigerianStateCode.LA,
  'ajeromi-ifelodun': NigerianStateCode.LA,
  'amuwo-odofin': NigerianStateCode.LA,
  'eti-osa': NigerianStateCode.LA,
  'ibeju-lekki': NigerianStateCode.LA,
  'lagos mainland': NigerianStateCode.LA,
  'lagos island': NigerianStateCode.LA,

  // Federal Capital Territory
  abuja: NigerianStateCode.FC,
  garki: NigerianStateCode.FC,
  wuse: NigerianStateCode.FC,
  maitama: NigerianStateCode.FC,
  asokoro: NigerianStateCode.FC,

  // Other major cities and their states
  kano: NigerianStateCode.KN,
  kaduna: NigerianStateCode.KD,
  kadunastate: NigerianStateCode.KD,
  ibadan: NigerianStateCode.OY, // Oyo State
  'port harcourt': NigerianStateCode.RI, // Rivers State
  'benin city': NigerianStateCode.ED, // Edo State
  jos: NigerianStateCode.PL, // Plateau State
  ilorin: NigerianStateCode.KW, // Kwara State
  owerri: NigerianStateCode.IM, // Imo State
  abeokuta: NigerianStateCode.OG, // Ogun State
  enugu: NigerianStateCode.EN,
  calabar: NigerianStateCode.CR, // Cross River State
  akure: NigerianStateCode.ON, // Ondo State
  osogbo: NigerianStateCode.OS, // Osun State
  warri: NigerianStateCode.DE, // Delta State
  uyo: NigerianStateCode.AK, // Akwa Ibom State
  anambra: NigerianStateCode.AN, // Anambra State
  awka: NigerianStateCode.AN, // Anambra State capital
  abakaliki: NigerianStateCode.EB, // Ebonyi State
  asaba: NigerianStateCode.DE, // Delta State
  bauchi: NigerianStateCode.BA,
  makurdi: NigerianStateCode.BE, // Benue State
  maiduguri: NigerianStateCode.BO, // Borno State
  yenagoa: NigerianStateCode.BY, // Bayelsa State
  gombe: NigerianStateCode.GO,
  dutse: NigerianStateCode.JI, // Jigawa State
  katsina: NigerianStateCode.KT,
  'birnin kebbi': NigerianStateCode.KE, // Kebbi State
  lokoja: NigerianStateCode.KO, // Kogi State
  lafia: NigerianStateCode.NA, // Nasarawa State
  minna: NigerianStateCode.NI, // Niger State
  'ado-ekiti': NigerianStateCode.EK, // Ekiti State
  sokoto: NigerianStateCode.SO,
  jalingo: NigerianStateCode.TA, // Taraba State
  damaturu: NigerianStateCode.YO, // Yobe State
  gusau: NigerianStateCode.ZA, // Zamfara State
} as const;

export interface ZerohashParticipantCreateRequest {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone_number?: string;
  address_one: string;
  address_two?: string;
  city: string;
  zip?: string;
  postal_code?: string;
  jurisdiction_code: string;
  citizenship_code: string;
  date_of_birth: string;
  tax_id?: string;
  id_number_type?: ZerohashIdNumberType;
  id_number?: string;
  non_us_other_type?: string;
  id_issuing_authority?: string;

  risk_rating?: string;
  kyc: string;
  kyc_timestamp: number;
  onboarded_location?: string;
  sanction_screening: string;
  sanction_screening_timestamp: number;
  idv?: 'pass' | 'fail';
  liveness_check?: 'pass' | 'fail';

  employment_status?: ZerohashEmploymentStatus;
  industry?: ZerohashIndustry;
  salary?: ZerohashSalary;
  source_of_funds?: ZerohashSourceOfFunds;
  savings_and_investments?: ZerohashSavingsAndInvestments;
  signed_timestamp: number;
  is_clob_enabled?: boolean;
  prefunded?: boolean;

  signed_agreements?: ZerohashSignedAgreement[];
  place_of_birth?: ZerohashPlaceOfBirth;

  id_expiration_date?: string; // YYYY-MM-DD
  id_issuing_date?: string; // YYYY-MM-DD
  id_issuing_locality?: string;

  tx_equivalent_annual_volume?: ZerohashTxAnnualVolume;
  tx_frequency_of_use?: ZerohashTxFrequencyOfUse;
  gross_annual_income_amount?: ZerohashGrossAnnualIncome;

  tx_type_of_service?: ZerohashTxTypeOfService[];
  tx_relationship_term_with_service?: ZerohashTxRelationshipTerm;
  tx_relationship_term_with_service_other_explanation?: string;
}
export interface ZerohashParticipantCreateWrappedResponse {
  message: ZerohashParticipantCreateResponse;
}
export interface ZerohashParticipantCreateResponse {
  first_name: string;
  middle_name?: string;
  last_name: string;
  former_name?: string;
  gender?: string;
  email: string;
  address_one: string;
  address_two?: string;
  jurisdiction_code: string;
  city: string;
  zip?: string;
  postal_code?: string;
  date_of_birth: string;
  id_number_type?: ZerohashIdNumberType;
  id_number?: string;
  non_us_other_type?: string | null;
  id_issuing_authority?: string | null;
  signed_timestamp: number;
  risk_rating?: string | null;
  metadata?: any;
  platform_code: string;
  participant_code: string;
  onboarded_location?: string;
  tax_id?: string;
  citizenship_code?: string;
  kyc?: string;
  kyc_timestamp?: number;
  sanction_screening?: string;
  sanction_screening_timestamp?: number;
  idv?: 'pass' | 'fail';
  liveness_check?: 'pass' | 'fail';
  phone_number?: string;
  employment_status?: ZerohashEmploymentStatus;
  industry?: ZerohashIndustry;
  source_of_funds?: ZerohashSourceOfFunds;
  salary?: ZerohashSalary;
  savings_and_investments?: ZerohashSavingsAndInvestments;
  signed_agreements?: ZerohashSignedAgreement[];
  place_of_birth?: ZerohashPlaceOfBirth;
  id_expiration_date?: string;
  id_issuing_date?: string;
  id_issuing_locality?: string;
  purpose_of_transactions?: string;
  purpose_of_transactions_other_explanation?: string;
  expected_monthly_transaction_count?: string;
  expected_usd_equivalent_daily_volume?: string;
  tx_equivalent_annual_volume?: ZerohashTxAnnualVolume;
  tx_frequency_of_use?: ZerohashTxFrequencyOfUse;
  gross_annual_income_amount?: ZerohashGrossAnnualIncome;
  tx_type_of_service?: ZerohashTxTypeOfService[];
  tx_relationship_term_with_service?: ZerohashTxRelationshipTerm;
  tx_relationship_term_with_service_other_explanation?: string;
}

export interface ZerohashSignedAgreement {
  type: ZerohashAgreementType;
  region: ZerohashAgreementRegion;
  signed_timestamp: number;
}

export interface ZerohashPlaceOfBirth {
  country_code: string;
  place_name: string;
}

export type ZerohashIdNumberType =
  | 'us_drivers_license'
  | 'us_passport'
  | 'us_passport_card'
  | 'us_permanent_resident_card'
  | 'us_border_crossing_card'
  | 'us_alien_card'
  | 'us_id_card'
  | 'non_us_passport'
  | 'non_us_other'
  | 'passport'
  | 'eu_drivers_license';

export type ZerohashEmploymentStatus =
  | 'full_time'
  | 'part_time'
  | 'self_employed'
  | 'unemployed'
  | 'retired'
  | 'student';

export type ZerohashIndustry =
  | 'adult_entertainment'
  | 'advertising_media_marketing'
  | 'agriculture'
  | 'arts_entertainment'
  | 'charity'
  | 'construction_manufacturing'
  | 'consulting'
  | 'consumer_products_services'
  | 'crypto_mining'
  | 'ecommerce'
  | 'education'
  | 'electronics'
  | 'fashion'
  | 'financial_services'
  | 'food_beverages'
  | 'government_agency'
  | 'insurance'
  | 'jewelry_gemstones'
  | 'law_enforcement'
  | 'legal_services'
  | 'mining_energy_chemicals'
  | 'online_gaming_gambling'
  | 'pharmaceuticals'
  | 'property_real_estate'
  | 'retail_wholesale'
  | 'transportation'
  | 'travel_car_hire'
  | 'weapons_defense_aerospace'
  | 'other';

export type ZerohashSalary =
  | 'under_3500'
  | 'between_35001_and_75000'
  | 'between_75001_and_125000'
  | 'between_125001_and_200000'
  | 'over_200000';

export type ZerohashSourceOfFunds =
  | 'salary'
  | 'savings'
  | 'pension_retirement'
  | 'inheritance'
  | 'investment'
  | 'loan'
  | 'gift'
  | 'other';

export type ZerohashSavingsAndInvestments =
  | 'under_10000'
  | 'between_10001_and_25000'
  | 'between_25001_and_50000'
  | 'between_50001_and_100000'
  | 'between_100001_and_250000'
  | 'over_250000';

export type ZerohashAgreementType =
  | 'fund_auto_convert'
  | 'payment_services_terms'
  | 'account_link'
  | 'account_funding_payouts'
  | 'account_funding_general';

export type ZerohashAgreementRegion = 'worldwide' | 'us' | 'brazil' | 'uk' | 'eu';

export type ZerohashTxAnnualVolume = 'up_to_5k' | '5k_to_25k' | '25k_to_100k' | '100k_and_up';

export type ZerohashTxFrequencyOfUse = 'up_to_12' | '12_to_53' | '53_to_365' | '365_and_up';

export type ZerohashGrossAnnualIncome = 'up_to_5k' | '5k_to_25k' | '25k_to_100k' | '100k_and_up';

export type ZerohashTxTypeOfService =
  | 'unknown'
  | 'buy_crypto'
  | 'sell_crypto'
  | 'swap_crypto'
  | 'buy_crypto_fiat'
  | 'sell_crypto_fiat'
  | 'trade_crypto_crypto'
  | 'peer_to_peer';

export type ZerohashTxRelationshipTerm = 'long_term' | 'short_term' | 'other';

// Document Upload Interfaces
export interface ZerohashDocumentUploadRequest {
  document_type: string;
  document: string;
  mime: string;
  file_name: string;
  participant_code: string;
  id_front: boolean;
}

export interface ZerohashDocumentUploadResponse {
  success: boolean;
  message?: string;
}

// Participant Update Interfaces
export interface ZerohashParticipantUpdateRequest {
  platform_updated_at: number;
  id_number: string;
  id_number_type: string;
  liveness_check: string;
  idv: string;
  tax_id: string;
  citizenship_code: string;
  employment_status?: ZerohashEmploymentStatus;
  source_of_funds?: ZerohashSourceOfFunds;
  industry?: ZerohashIndustry;
}

export interface ZerohashParticipantUpdateResponse {
  success: boolean;
  message?: string;
  participant_code?: string;
}

// ZeroHash specific interfaces for deposit address operations
export interface ZerohashDepositAddressCreateRequest {
  participant_code: string;
  asset: string;
}

export interface ZerohashDepositAddressCreateResponse {
  address: string;
  asset: string;
  participant_code: string;
  account_label: string;
  platform_code: string;
  created_at: number;
}

export interface ZerohashDepositAddressCreateWrappedResponse {
  message: ZerohashDepositAddressCreateResponse;
}

// ZeroHash GET deposit address response interfaces
export interface ZerohashDepositAddressFetchResponseItem {
  address: string;
  asset: string;
  participant_code: string;
  account_label: string;
  platform_code: string;
  created_at: number;
}

export interface ZerohashDepositAddressFetchWrappedResponse {
  message: ZerohashDepositAddressFetchResponseItem[];
}

export interface GetParticipantRequest {
  email: string;
}

export interface GetParticipantResponseData {
  participant_code: string;
  email: string;
}

export interface GetParticipantResponse {
  message: GetParticipantResponseData;
}

export interface ZerohashKycStatusResponseData {
  participant_code: string;
  idv: 'unknown' | 'pass' | 'fail' | 'not_applicable';
  liveness_check: 'unknown' | 'pass' | 'fail' | 'not_applicable';
  tax_id: boolean;
  edd: boolean;
  tags: string[];
  participant_status: string;
  kyc_attempts: number;
  edd_required: boolean;
}

export interface ZerohashKycStatusResponse {
  message: ZerohashKycStatusResponseData;
}
