import midtransClient from 'midtrans-client';

// Sandbox = MIDTRANS_IS_PRODUCTION="false" + key berawalan "SB-Mid-..."
export const isMidtransProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

export const snap = new midtransClient.Snap({
  isProduction: isMidtransProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
});

export const coreApi = new midtransClient.CoreApi({
  isProduction: isMidtransProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '',
});
