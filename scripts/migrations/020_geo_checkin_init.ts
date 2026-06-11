/**
 * Migration 020 — Geo check-in fields (Enterprise HR plan, P2).
 *
 * Adds Company.geoCheckInEnabled + Company.officeLocations (embedded),
 * PayrollProfile.attendanceMode, and the Attendance check-in audit fields
 * (checkInAt/Lat/Lng/Accuracy/Distance + withinGeofence). All optional or
 * defaulted, so existing rows stay valid with no data touch.
 *
 * Idempotent no-op, registered per the migration-ledger rule.
 */

import type { Migration } from './_runner';

export const migration: Migration = {
  name: '020_geo_checkin_init',

  async up() {
    return { note: 'no-op — new geo fields are optional/defaulted; existing rows compatible' };
  },
};
