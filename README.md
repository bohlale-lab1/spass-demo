# spass-demo

# UL Safe-Pass (S-PASS) Demo

## 5 Core Functions Demonstrated:

1. **Barcode-Based Asset Scanning** - Verify asset ownership
2. **Guard Login with JWT** - Secure authentication
3. **Audit Logging** - Immutable records with CSV export
4. **Decision Display** - Green/Amber/Red visual indicators
5. **Offline Queue** - Network failure fallback with auto-sync

## How to Use:

1. Login: `G001` / `1234` or `G002` / `1234`
2. Click "SCAN ASSET"
3. Select barcode from dropdown
4. Click "Simulate Scan"
5. See coloured result screen

## Test Barcodes:
- BAR001 → Green (Authorised)
- BAR002 → Green + Voice Guidance
- BAR999 → Amber (Flagged)
- UNKNOWN → Red (Denied)

## Offline Test:
1. Turn off WiFi
2. Scan a barcode → "Offline Mode"
3. Turn WiFi on
4. Click "Sync Offline Scans"
