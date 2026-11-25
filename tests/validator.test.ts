import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { runRetailAudit } from '../server/validator.ts';
import { SAMPLE_DATASETS } from '../server/sampleDatasets.ts';

test('preserves exact original CSV bytes and SHA-256 checksum', () => {
  const raw = SAMPLE_DATASETS.q4_anomalies.csvContent;
  const originalBytes = Buffer.from(raw, 'utf8');
  const expectedSha = crypto.createHash('sha256').update(originalBytes).digest('hex');

  const result = runRetailAudit(originalBytes, 'retail_q4_pos_export.csv');

  assert.equal(result.sha256, expectedSha);
  assert.equal(result.fileSizeBytes, originalBytes.byteLength);
  assert.equal(result.summary.totalDataRows, 36);
});

test('detects missing values, duplicates, negative values, invalid dates, mismatches, and bulk anomalies', () => {
  const raw = SAMPLE_DATASETS.q4_anomalies.csvContent;
  const result = runRetailAudit(Buffer.from(raw, 'utf8'), 'retail_q4_pos_export.csv');

  const byName = (name: string) => result.findings.filter((f) => f.issueName === name);

  assert.ok(byName('Missing Quantity').length >= 1, 'should flag blank quantity');
  assert.ok(byName('Missing Product Name').length >= 1, 'should flag blank product_name');
  assert.ok(byName('Missing Transaction ID').length >= 1, 'should flag blank transaction_id');
  assert.ok(byName('Negative Quantity').length >= 1, 'should flag negative quantity');
  assert.ok(byName('Negative Unit Price').length >= 1, 'should flag negative unit_price');
  assert.ok(byName('Exact Duplicate Row').length >= 1, 'should flag exact duplicate row');
  assert.ok(byName('Repeated Transaction ID').length >= 1, 'should flag repeated transaction_id');
  assert.ok(byName('Invalid Transaction Date').length >= 1, 'should flag impossible date 2026-02-30');
  assert.ok(byName('Inconsistent Date Format').length >= 1, 'should flag mixed MM/DD/YYYY date');
  assert.ok(byName('Invalid Numeric Unit Price').length >= 1, 'should flag N/A price');
  assert.ok(byName('Total Amount Mismatch').length >= 1, 'should flag arithmetic total mismatch');

  const bulkFindings = byName('Unusual Bulk Quantity');
  assert.equal(bulkFindings.length, 2, 'should flag both 180 and 320 bulk quantities');
  assert.ok(
    bulkFindings.every((f) => f.priority === 'Medium'),
    'bulk quantity anomalies must be Medium priority for human review'
  );
});

test('flags missing required columns and unexpected headers during Step 2 format validation', () => {
  const raw = SAMPLE_DATASETS.schema_mismatch.csvContent;
  const result = runRetailAudit(Buffer.from(raw, 'utf8'), 'incomplete_pos_schema.csv');

  assert.equal(result.formatValidation.isValidStructure, false);
  assert.deepEqual(result.formatValidation.missingRequiredColumns, [
    'quantity',
    'total_amount',
  ]);
  assert.deepEqual(result.formatValidation.unexpectedColumns, ['qty', 'store_region']);
});

test('clean baseline dataset produces zero findings', () => {
  const raw = SAMPLE_DATASETS.clean_baseline.csvContent;
  const result = runRetailAudit(Buffer.from(raw, 'utf8'), 'specialty_coffee_verified.csv');

  assert.equal(result.formatValidation.isValidStructure, true);
  assert.equal(result.findings.length, 0);
  assert.equal(result.summary.cleanRowsCount, 15);
});
