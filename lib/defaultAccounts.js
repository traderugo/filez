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
