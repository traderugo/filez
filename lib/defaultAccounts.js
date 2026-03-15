/**
 * Default consumption/pour-back accounts.
 * These are auto-created for every station and cannot be deleted.
 * Identified by phone = 'DEFAULT'.
 */
export const DEFAULT_ACCOUNTS = [
  'Police',
  'Manager Car',
  'DSS OFFICIALS',
  'Army',
  'EDSTMA',
  'Weight and Measures',
  'Vigilante',
  'Security Agents',
  'Regional Manager Car',
  'Area Manager Car',
  'LOGISTICS',
  'Pour Back After Pump Repairs',
  'Generator',
  'MDS Logistics Truck',
  'Logistics Truck',
  'Police/Army',
  'DPR',
  'Others',
  'Pour Back',
]

/** Phone value used to mark default/system accounts */
export const DEFAULT_PHONE = 'DEFAULT'

/** Check if a customer is a default account */
export function isDefaultAccount(customer) {
  return customer?.phone === DEFAULT_PHONE
}

/**
 * Default lube products pre-populated for every station.
 * Names match the Excel template column C.
 * Duplicates have litre appended to distinguish them.
 */
export const DEFAULT_LUBE_PRODUCTS = [
  'RAINOIL SUPREME 4L',
  'RAINOIL UNIVERSAL SAE 40 4L',
  'RAINOIL UNIVERSAL SAE 40 25L',
  'MAGNATEC 10W-40 4L',
  'INJECTOR CLEANER',
  'MAGNATEC 5W-30 1L',
  'MAGNATEC 5W-30 4L',
  'MAGNATEC 5W-30 A5',
  'RAINOIL SUPREME 1L',
  'RADICOOL',
  'BRAKE FLUID DOT 4 0.2L',
  'BRAKE FLUID DOT 4 0.5L',
  'GT X ESSENTIAL 20W-50 1L',
  'GT X ESSENTIAL 20W-50 4L',
  'POWER RACING 40 10W-50',
  'MOTOR OIL SAE 40',
  'EDGE PROFESSIONAL',
  'GT X ESSENTIAL 15W-40 4L',
  'GT X ESSENTIAL 15W-40 5L',
  'POWER MAX HD-40 (RETAIL OIL)',
  'ATF DEX II',
]
