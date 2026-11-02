import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { markOrderPaid, cancelOrder } from '@/lib/orders';

/**
 * Notification URL Midtrans: https://<domain>/api/webhooks/midtrans
 * Diset di Dashboard Midtrans (Sandbox) > Settings > Payment > Notification URL.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type } = body;

  // 1. Verifikasi signature: SHA512(order_id + status_code + gross_amount + ServerKey)
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const expected = crypto.createHash('sha512').update(`${order_id}${status_code}${gross_amount}${serverKey}`).digest('hex');
  const valid =
    typeof signature_key === 'string' &&
    signature_key.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature_key), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: 'Invalid signature key' }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { orderNumber: order_id } });
  // Midtrans "Test notification" dari dashboard memakai order_id acak -> balas 200 agar tidak di-retry.
  if (!order) return NextResponse.json({ message: 'Order not found (ignored)' }, { status: 200 });

  // 2. Pastikan nominal sesuai dengan order di database
  if (Math.round(parseFloat(gross_amount)) !== order.finalAmount) {
    await prisma.activityLog
      .create({ data: { action: 'WEBHOOK_AMOUNT_MISMATCH', entity: 'Order', entityId: order.id, details: JSON.stringify(body) } })
      .catch(() => {});
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  try {
    if ((transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement') {
      await markOrderPaid(order_id, { paymentType: payment_type, source: 'webhook' });
    } else if (transaction_status === 'pending') {
      if (!order.stockDeducted) {
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING', paymentType: payment_type } });
      }
    } else if (['deny', 'cancel', 'expire', 'failure'].includes(transaction_status)) {
      if (order.status !== 'CANCELLED' && order.status !== 'EXPIRED') {
        await cancelOrder(order_id, {
          reason: `Midtrans: ${transaction_status}`,
          paymentStatus: transaction_status === 'expire' ? 'EXPIRE' : transaction_status === 'deny' ? 'DENY' : 'CANCEL',
          expired: transaction_status === 'expire',
        });
      }
    } else if (transaction_status === 'refund' || transaction_status === 'partial_refund') {
      await cancelOrder(order_id, { reason: `Refund Midtrans (${transaction_status})`, paymentStatus: 'REFUND' });
    }

    await prisma.activityLog
      .create({
        data: {
          userId: order.userId,
          action: `MIDTRANS_${String(transaction_status).toUpperCase()}`,
          entity: 'Order',
          entityId: order.id,
          details: JSON.stringify({ transaction_status, payment_type, gross_amount }),
        },
      })
      .catch(() => {});
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Midtrans webhook error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
