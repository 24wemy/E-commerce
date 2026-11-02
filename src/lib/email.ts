import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `Fresh Minut <${process.env.SMTP_USER ?? 'no-reply@localhost'}>`;

// Create Nodemailer Transporter
const createTransporter = () => {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const isSecure = SMTP_PORT === 465;
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: isSecure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  return null;
};

const formatIDR = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

/**
 * Send Welcome Email on New User Registration
 */
export async function sendRegistrationWelcomeEmail(userEmail: string, userName: string) {
  const transporter = createTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fcfcfc; color: #1e293b; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background-color: #ea580c; padding: 30px 20px; text-align: center; color: #ffffff; }
          .header h1 { font-family: sans-serif; font-weight: 800; margin: 0; font-size: 28px; letter-spacing: 1px; }
          .content { padding: 30px 25px; line-height: 1.6; }
          .welcome-badge { display: inline-block; background-color: #ffedd5; color: #c2410c; font-weight: bold; font-size: 12px; padding: 6px 12px; border-radius: 20px; margin-bottom: 15px; }
          .button { display: inline-block; background-color: #ea580c; color: #ffffff !important; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-top: 20px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍗 Fresh Minut</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.95;">Platform Ayam & Produk Segar Minahasa Utara</p>
          </div>
          <div class="content">
            <span class="welcome-badge">Selamat Bergabung!</span>
            <h2 style="color: #ea580c; margin-top: 0;">Halo Kawan Fresh Minut, ${userName}!</h2>
            <p>Selamat datang di keluarga besar <strong>Fresh Minut</strong>. Akun Anda telah berhasil terdaftar dengan email: <code>${userEmail}</code>.</p>
            <p>Kini Anda dapat menikmati layanan belanja ayam segar & produk harian langsung dari peternak mitra Minahasa Utara dengan jaminan timbangan presisi digital IoT & potongan higienis (Potong 8, Utuh, Fillet Dada, dll.).</p>
            
            <div style="background-color: #fff7ed; border: 1px dashed #f97316; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong style="color: #c2410c;">💡 Promo Spesial Pelanggan Baru:</strong>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #9a3412;">Gunakan kode voucher <strong>FRESHMINUT15</strong> untuk mendapatkan potongan 15% pada pesanan pertama Anda!</p>
            </div>

            <a href="https://www.freshminut.com" class="button">Pesan Ayam Segar Sekarang</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Fresh Minut Minahasa Utara. All rights reserved.</p>
            <p style="margin-top: 5px; opacity: 0.8;">Airmadidi - Kalawat Hub • Customer Support support@freshminut.com</p>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!transporter) {
    console.log(`[EMAIL SIMULATION] Registration email triggered for: ${userEmail} (${userName})`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: userEmail,
      subject: '✨ Selamat Datang di Fresh Minut - Konfirmasi Pendaftaran',
      html: htmlContent,
    });
    console.log(`[EMAIL SUCCESS] Registration email sent to ${userEmail} (${info.messageId})`);
    return { success: true };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send registration email to ${userEmail}:`, error);
    return { success: false, error };
  }
}

/**
 * Send Order Confirmation Email on New Order Checkout / Payment Settlement
 */
export async function sendOrderConfirmationEmail(orderData: {
  userEmail: string;
  userName: string;
  orderNumber: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  totalAmount: number;
  discountAmount?: number;
  discountCode?: string;
  shippingAddress: string;
  isPaid?: boolean;
}) {
  const transporter = createTransporter();

  const itemsHtml = orderData.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity} kg</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatIDR(item.price * item.quantity)}</td>
      </tr>
    `
    )
    .join('');

  const subtotal = orderData.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const statusTitle = orderData.isPaid ? 'Pembayaran Lunas & Ayam Segar Diproses' : 'Konfirmasi Pesanan Fresh Minut';
  const statusMessage = orderData.isPaid
    ? `Hore Kawan ${orderData.userName}! Pembayaran Anda telah kami terima (LUNAS). Pesanan ayam Anda sedang ditimbang & dipotong oleh mitra Fresh Minut Minahasa Utara!`
    : `Terima kasih atas pesanan Anda, Kawan ${orderData.userName}! Pesanan Anda telah diterima dan siap diproses oleh tim Fresh Minut.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fcfcfc; color: #1e293b; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background-color: #ea580c; padding: 30px 20px; text-align: center; color: #ffffff; }
          .header h1 { font-family: sans-serif; font-weight: 800; margin: 0; font-size: 26px; }
          .content { padding: 30px 25px; line-height: 1.6; }
          .order-number { background-color: #ffedd5; color: #9a3412; font-family: monospace; font-weight: bold; font-size: 16px; padding: 8px 16px; border-radius: 8px; display: inline-block; margin-bottom: 15px; }
          .status-badge { display: inline-block; background-color: ${orderData.isPaid ? '#d1fae5' : '#ffedd5'}; color: ${orderData.isPaid ? '#065f46' : '#9a3412'}; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th { background-color: #f8fafc; color: #475569; padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
          .totals { font-size: 14px; line-height: 1.8; }
          .grand-total { font-size: 18px; font-weight: bold; color: #ea580c; border-top: 2px solid #ea580c; padding-top: 8px; margin-top: 8px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍗 Fresh Minut</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.95;">${statusTitle}</p>
          </div>
          <div class="content">
            <span class="status-badge">${orderData.isPaid ? 'STATUS: LUNAS (PAID)' : 'STATUS: MENUNGGU PEMBAYARAN'}</span>
            <h2 style="color: #ea580c; margin-top: 0;">${statusTitle}</h2>
            <p>${statusMessage}</p>

            <div style="text-align: center; margin: 15px 0;">
              <span class="order-number">Nomor Pesanan: ${orderData.orderNumber}</span>
            </div>

            <h3 style="color: #ea580c; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Rincian Produk Ayam</h3>
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th style="text-align: center;">Berat (Kg)</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals" style="margin-left: auto; max-width: 250px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Subtotal:</span>
                <span>${formatIDR(subtotal)}</span>
              </div>
              ${
                orderData.discountAmount && orderData.discountAmount > 0
                  ? `
                <div style="display: flex; justify-content: space-between; color: #047857; font-weight: bold;">
                  <span>Diskon (${orderData.discountCode}):</span>
                  <span>-${formatIDR(orderData.discountAmount)}</span>
                </div>
              `
                  : ''
              }
              <div class="grand-total" style="display: flex; justify-content: space-between;">
                <span>Total Bayar:</span>
                <span>${formatIDR(orderData.totalAmount)}</span>
              </div>
            </div>

            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 25px; font-size: 13px; border: 1px solid #e2e8f0;">
              <strong style="color: #ea580c;">Alamat Pengiriman Minut:</strong>
              <p style="margin: 5px 0 0 0; color: #334155;">${orderData.shippingAddress}</p>
            </div>
          </div>
          <div class="footer">
            <p>Butuh bantuan dengan pesanan Anda? Hubungi kami di support@freshminut.com</p>
            <p style="margin-top: 5px; opacity: 0.8;">© ${new Date().getFullYear()} Fresh Minut Minahasa Utara</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const subjectText = orderData.isPaid
    ? `✅ Pembayaran Lunas! Pesanan ${orderData.orderNumber} - Fresh Minut`
    : `🍗 Konfirmasi Pesanan ${orderData.orderNumber} - Fresh Minut`;

  if (!transporter) {
    console.log(`[EMAIL SIMULATION] Order email triggered for: ${orderData.userEmail} (${orderData.orderNumber})`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: orderData.userEmail,
      subject: subjectText,
      html: htmlContent,
    });
    console.log(`[EMAIL SUCCESS] Order email sent to ${orderData.userEmail} (${info.messageId})`);
    return { success: true };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send order email to ${orderData.userEmail}:`, error);
    return { success: false, error };
  }
}

/**
 * Send Payment Success Email when an Order is Settled / Paid
 */
export async function sendOrderPaidSuccessEmail(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, user: true },
    });

    if (!order) return;

    let customerEmail = order.user?.email || '';
    const customerName = order.user?.name || 'Pelanggan Setia';
    let shippingAddr = 'Alamat Pengiriman';

    try {
      if (order.shippingAddress) {
        shippingAddr = JSON.parse(order.shippingAddress);
      }
    } catch {
      shippingAddr = order.shippingAddress || 'Alamat Pengiriman';
    }

    if (!customerEmail) {
      const log = await prisma.activityLog.findFirst({
        where: { entity: 'Order', entityId: order.id, action: 'DISCOUNT_APPLIED' },
        orderBy: { createdAt: 'desc' },
      });
      if (log?.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.email) customerEmail = parsed.email;
        } catch {
          // ignore
        }
      }
    }

    if (!customerEmail) {
      return; // tidak ada email pelanggan -> jangan kirim ke alamat lain
    }

    await sendOrderConfirmationEmail({
      userEmail: customerEmail,
      userName: customerName,
      orderNumber: order.orderNumber,
      items: order.items.map((i) => ({
        name: i.product.name,
        price: i.pricePerKg,
        quantity: i.requestedKg,
      })),
      totalAmount: order.finalAmount,
      shippingAddress: typeof shippingAddr === 'string' ? shippingAddr : JSON.stringify(shippingAddr),
      isPaid: true,
    });
  } catch (err) {
    console.error('Failed to dispatch order paid success email:', err);
  }
}

/**
 * Email pemasaran/retensi (kampanye CRM & pengingat keranjang).
 * Bila SMTP belum dikonfigurasi, email tidak dikirim tetapi tetap dicatat (status LOGGED) agar demo tetap jalan.
 */
export async function sendMarketingEmail(params: { to: string; subject: string; heading: string; body: string; ctaText?: string; ctaUrl?: string }) {
  const transporter = createTransporter();
  if (!transporter) return 'LOGGED' as const;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #fed7aa;border-radius:12px;overflow:hidden">
    <div style="background:#ea580c;color:#fff;padding:20px 24px;font-size:20px;font-weight:bold">🍗 Fresh Minut</div>
    <div style="padding:24px;color:#1e293b;line-height:1.6">
      <h2 style="margin-top:0">${params.heading}</h2>
      <p style="white-space:pre-line">${params.body}</p>
      ${params.ctaUrl ? `<p><a href="${params.ctaUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${params.ctaText ?? 'Belanja Sekarang'}</a></p>` : ''}
    </div>
  </div>`;
  try {
    await transporter.sendMail({ from: SMTP_FROM, to: params.to, subject: params.subject, html });
    return 'SENT' as const;
  } catch (e) {
    console.error('sendMarketingEmail failed', e);
    return 'FAILED' as const;
  }
}
