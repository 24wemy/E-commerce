import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { CheckoutForm } from '@/components/shop/CheckoutForm';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl flex-1">
        <h1 className="text-3xl font-bold text-ink mb-8">Checkout</h1>
        <CheckoutForm />
      </main>
      <Footer />
    </div>
  );
}
