/**
 * AYAMAJA Core Business Logic & AI Helper Services
 * Platform Asisten Belanja Cerdas Ayam Segar - Minahasa Utara
 */

export interface PricingCalculation {
  pricePerKg: number;
  requestedKg: number;
  actualKg: number;
  estimatedPrice: number;
  actualPrice: number;
  weightDifferenceKg: number;
  priceDifference: number;
  adjustmentNote: string;
}

export interface DeliverySlotInfo {
  slotName: string;
  timeRange: string;
  fee: number;
  isPopular: boolean;
}

export interface B2bQuotationResult {
  quotationNumber: string;
  requestedKg: number;
  basePricePerKg: number;
  discountPerKg: number;
  finalPricePerKg: number;
  estimatedSubtotal: number;
  tierLabel: string;
  aiRecommendation: string;
}

// Fixed base price per kg for Minahasa Utara Fresh Chicken market
export const BASE_PRICE_PER_KG = 36000; // Rp 36.000 / kg

/**
 * 1. Flexible Weight & Smart Pricing Logic
 * Calculate price estimate vs actual weight upon seller verification
 */
export function calculateDynamicPricing(
  pricePerKg: number = BASE_PRICE_PER_KG,
  requestedKg: number,
  actualKg?: number
): PricingCalculation {
  const finalActualKg = actualKg ?? requestedKg;
  const estimatedPrice = Math.round(pricePerKg * requestedKg);
  const actualPrice = Math.round(pricePerKg * finalActualKg);
  const weightDifferenceKg = Number((finalActualKg - requestedKg).toFixed(2));
  const priceDifference = actualPrice - estimatedPrice;

  let adjustmentNote = 'Berat sesuai dengan estimasi awal pesanan.';
  if (weightDifferenceKg > 0) {
    adjustmentNote = `Berat aktual lebih ${weightDifferenceKg} kg (Tambahan biaya Rp ${priceDifference.toLocaleString('id-ID')}).`;
  } else if (weightDifferenceKg < 0) {
    adjustmentNote = `Berat aktual kurang ${Math.abs(weightDifferenceKg)} kg (Kembalian saldo Rp ${Math.abs(priceDifference).toLocaleString('id-ID')}).`;
  }

  return {
    pricePerKg,
    requestedKg,
    actualKg: finalActualKg,
    estimatedPrice,
    actualPrice,
    weightDifferenceKg,
    priceDifference,
    adjustmentNote,
  };
}

/**
 * 2. Smart Delivery Fee Calculator (Minahasa Utara Areas)
 */
export function calculateDeliveryFee(distanceKm: number, slotName: string): { fee: number; zone: string } {
  const baseFee = 6000;
  const perKmFee = 2000;
  const calculated = Math.round(baseFee + Math.max(0, distanceKm - 2) * perKmFee);

  let zone = 'Airmadidi / Kalawat (Dekat)';
  if (distanceKm > 10) zone = 'Likupang / Dimembe Outer (Jauh)';
  else if (distanceKm > 5) zone = 'Kauditan / Sukur (Sedang)';

  // Morning rush hour discount promo
  const isMorning = slotName.toLowerCase().includes('pagi') || slotName.toLowerCase().includes('06:00');
  const finalFee = isMorning ? Math.max(4000, calculated - 2000) : calculated;

  return { fee: finalFee, zone };
}

/**
 * Available Delivery Slots in Minahasa Utara
 */
export const DELIVERY_SLOTS: DeliverySlotInfo[] = [
  { slotName: 'Pagi Subuh (Ayam Baru Potong)', timeRange: '06:00 - 08:00 WITA', fee: 4000, isPopular: true },
  { slotName: 'Pagi Reguler', timeRange: '08:00 - 10:00 WITA', fee: 6000, isPopular: false },
  { slotName: 'Siang (Persiapan Masak)', timeRange: '11:00 - 13:00 WITA', fee: 6000, isPopular: false },
  { slotName: 'Sore (Stok Segar)', timeRange: '16:00 - 18:00 WITA', fee: 5000, isPopular: false },
];

/**
 * 3. Smart B2B Bulk Order Quotation Generator (UMKM / Warung / Resto)
 */
export function generateB2bQuotation(requestedKg: number, businessName: string): B2bQuotationResult {
  const basePrice = BASE_PRICE_PER_KG;
  let discountPerKg = 0;
  let tierLabel = 'Paket Grosir Dasar (Min. 10 kg)';

  if (requestedKg >= 100) {
    discountPerKg = 4000; // Rp 32.000 / kg
    tierLabel = 'Tier B2B Super Bulk (100+ kg)';
  } else if (requestedKg >= 50) {
    discountPerKg = 3000; // Rp 33.000 / kg
    tierLabel = 'Tier B2B UMKM Besar (50+ kg)';
  } else if (requestedKg >= 20) {
    discountPerKg = 2000; // Rp 34.000 / kg
    tierLabel = 'Tier B2B Warung Makan (20+ kg)';
  } else if (requestedKg >= 10) {
    discountPerKg = 1000;
    tierLabel = 'Tier B2B Starter (10+ kg)';
  }

  const finalPricePerKg = basePrice - discountPerKg;
  const estimatedSubtotal = Math.round(requestedKg * finalPricePerKg);
  const quotationNumber = `QUO-AYM-${Date.now().toString().slice(-6)}`;

  const aiRecommendation = `Rekomendasi AI untuk ${businessName || 'Usaha Kuliner'}: Untuk kebutuhan pesanan ${requestedKg} kg/minggu, Anda hemat Rp ${(discountPerKg * requestedKg).toLocaleString('id-ID')} per pengiriman. Kami rekomendasikan jadwal pasokan setiap Senin & Kamis jam 06.00 WITA.`;

  return {
    quotationNumber,
    requestedKg,
    basePricePerKg: basePrice,
    discountPerKg,
    finalPricePerKg,
    estimatedSubtotal,
    tierLabel,
    aiRecommendation,
  };
}

/**
 * 4. Cut Options Guide
 */
export const CUT_OPTIONS_LIST = [
  { type: 'POTONG_8', name: 'Potong 8 Standard', desc: 'Cocok untuk masakan rumah & goreng', icon: '🍗' },
  { type: 'POTONG_10', name: 'Potong 10 Porsi', desc: 'Ukuran pas untuk warung makan & prasmanan', icon: '🍖' },
  { type: 'POTONG_4', name: 'Potong 4 Besar', desc: 'Cocok untuk Ayam Bakar & Ayam Lalapan', icon: '🔥' },
  { type: 'UTUH', name: 'Ayam Utuh (Bersih)', desc: 'Tanpa bulu & jeroan, cocok untuk ungkep utuh', icon: '🐓' },
  { type: 'DADA_ONLY', name: 'Dada Ayam Fillet', desc: 'Tinggi protein, bebas lemak', icon: '🥩' },
  { type: 'PAHA_ONLY', name: 'Paha Ayam Segar', desc: 'Juicy & lembut', icon: '🍗' },
  { type: 'GEPREK', name: 'Potongan Khusus Geprek', desc: 'Ketebalan pas untuk digeprek krispi', icon: '🌶️' },
  { type: 'JEROAN_AMPELA', name: 'Tambahan Hati Ampela', desc: 'Tambahan jeroan segar per pasang', icon: '🫀' },
];
