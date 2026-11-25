import type { SampleDatasetInfo } from '../src/types/audit.ts';

export interface SampleDatasetEntry {
  info: SampleDatasetInfo;
  csvContent: string;
}

const Q4_ANOMALIES_CSV = `transaction_id,product_name,quantity,unit_price,total_amount,date
TXN-1001,Wireless Barcode Scanner,2,129.50,259.00,2026-10-01
TXN-1002,Thermal Receipt Paper (10-Pack),5,18.00,90.00,2026-10-01
TXN-1003,USB-C POS Terminal Cable,4,14.25,57.00,2026-10-02
TXN-1004,Stainless Steel Cash Drawer,1,165.00,165.00,2026-10-02
TXN-1005,Bluetooth Label Printer,,89.00,178.00,2026-10-03
TXN-1006,Countertop Display Stand,3,42.00,126.00,2026-10-03
TXN-1007,RFID Inventory Tags (50-Pack),-4,24.00,-96.00,2026-10-04
TXN-1008,Heavy-Duty Shopping Basket,6,19.50,117.00,2026-10-04
TXN-1009,Acrylic Price Sign Holder,180,4.50,810.00,2026-10-05
TXN-1010,LED Shelf Strip Light,3,34.00,120.00,2026-10-05
TXN-1011,Magnetic Security Tag Remover,2,49.99,99.98,10/06/2026
TXN-1012,Handheld Price Gun,2,27.50,55.00,2026-10-06
TXN-1012,Handheld Price Gun,2,27.50,55.00,2026-10-06
TXN-1013,Anti-Fatigue Floor Mat,4,52.00,208.00,2026-10-07
TXN-1014,,3,15.00,45.00,2026-10-07
TXN-1015,Cardboard Shipping Boxes (25ct),8,22.00,176.00,2026-02-30
TXN-1016,Poly Mailer Bags (100ct),4,16.00,64.00,2026-10-08
TXN-1017,Counter Acrylic Sneeze Guard,2,N/A,150.00,2026-10-08
TXN-1018,Digital Postal Scale,1,74.00,74.00,2026-10-09
TXN-1019,Wire Merchandising Rack,2,115.00,230.00,2026-10-09
TXN-1018,Portable NFC Card Reader,3,59.00,177.00,2026-10-10
TXN-1020,Canvas Tote Bags (Wholesale),320,6.25,2000.00,2026-10-10
TXN-1021,Tamper-Evident Security Seals,7,11.00,77.00,2026-10-11
TXN-1022,Drawer Coin Tray Insert,2,-18.50,-37.00,2026-10-11
TXN-1023,Storefront Open/Closed LED Sign,1,68.00,68.00,2026-10-12
,Packing Tape Dispenser,5,13.50,67.50,2026-10-12
TXN-1025,Double-Sided Foam Tape,6,8.00,48.00,2026-10-13
TXN-1026,Pegboard Hook Assortment,5,21.00,105.00,2026-10-13
TXN-1027,Retail Hanger Pack (50ct),4,29.00,116.00,2026-10-14
TXN-1028,Clothing Size Dividers,9,9.50,85.50,2026-10-14
TXN-1029,Garment Steamer Commercial,1,195.00,210.00,2026-10-15
TXN-1030,Mannequin Torso Stand,2,88.00,176.00,2026-10-15
TXN-1031,Gift Card Display Sleeve,10,5.00,50.00,2026-10-16
TXN-1032,Countertop Tip Jar Lockbox,2,32.00,64.00,2026-10-16
TXN-1033,Microfiber Cleaning Cloths,6,12.00,72.00,2026-10-17
TXN-1034,Heavy Duty Utility Cart,1,145.00,145.00,2026-10-17
`;

const CLEAN_BASELINE_CSV = `transaction_id,product_name,quantity,unit_price,total_amount,date
TXN-2001,Organic Arabica Coffee Beans 1kg,3,24.00,72.00,2026-11-01
TXN-2002,Ceramic Pour-Over Dripper,2,32.50,65.00,2026-11-01
TXN-2003,Unbleached Paper Filters (100ct),4,7.50,30.00,2026-11-02
TXN-2004,Double-Wall Espresso Cups,2,28.00,56.00,2026-11-02
TXN-2005,Stainless Milk Frothing Pitcher,1,21.00,21.00,2026-11-03
TXN-2006,Digital Coffee Scale,1,48.00,48.00,2026-11-03
TXN-2007,Matcha Ceremonial Tin 50g,3,29.00,87.00,2026-11-04
TXN-2008,Bamboo Matcha Whisk,2,16.50,33.00,2026-11-04
TXN-2009,Cold Brew Glass Carafe,2,34.00,68.00,2026-11-05
TXN-2010,Airtight Coffee Canister,3,26.00,78.00,2026-11-05
TXN-2011,Reusable Silicone Coffee Sleeve,5,6.00,30.00,2026-11-06
TXN-2012,Gooseneck Stovetop Kettle,1,64.00,64.00,2026-11-06
TXN-2013,Espresso Tamper 58mm,2,38.00,76.00,2026-11-07
TXN-2014,Vanilla Bean Syrup 750ml,4,14.00,56.00,2026-11-07
TXN-2015,Hazelnut Syrup 750ml,3,14.00,42.00,2026-11-08
`;

const SCHEMA_ERROR_CSV = `transaction_id,product_name,qty,unit_price,store_region,date
TXN-3001,Winter Wool Scarf,2,35.00,Northeast,2026-11-10
TXN-3002,Leather Work Gloves,1,58.00,Midwest,2026-11-10
TXN-3003,Insulated Travel Mug,4,22.50,West,2026-11-11
`;

export const SAMPLE_DATASETS: Record<string, SampleDatasetEntry> = {
  q4_anomalies: {
    info: {
      id: 'q4_anomalies',
      name: 'Q4 POS Export (Mixed Anomalies)',
      fileName: 'retail_q4_pos_export.csv',
      description:
        '36 retail transactions containing blank fields, an exact duplicate row, repeated IDs, negative values, invalid dates, arithmetic mismatches, and 2 large bulk-sale quantity outliers.',
      rowCount: 36,
    },
    csvContent: Q4_ANOMALIES_CSV,
  },
  clean_baseline: {
    info: {
      id: 'clean_baseline',
      name: 'Specialty Coffee Store (Clean Batch)',
      fileName: 'specialty_coffee_verified.csv',
      description:
        '15 verified retail transactions passing all schema, arithmetic, date, and statistical distribution checks.',
      rowCount: 15,
    },
    csvContent: CLEAN_BASELINE_CSV,
  },
  schema_mismatch: {
    info: {
      id: 'schema_mismatch',
      name: 'Incomplete Schema Export',
      fileName: 'incomplete_pos_schema.csv',
      description:
        'Demonstrates Step 2 Format Validation when required columns (quantity, total_amount) are missing or renamed and unexpected columns appear.',
      rowCount: 3,
    },
    csvContent: SCHEMA_ERROR_CSV,
  },
};
