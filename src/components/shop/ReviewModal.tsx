'use client';

import React, { useState } from 'react';
import { Star, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { createProductReviewAction } from '@/actions/review';

interface ReviewModalProps {
  orderId: string;
  orderNumber: string;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReviewModal({
  orderId,
  orderNumber,
  productName,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg('Silakan berikan ulasan pesan/komentar tentang kualitas ayam segar yang diterima.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await createProductReviewAction({
      orderId,
      rating,
      comment: comment.trim(),
    });

    setLoading(false);

    if (res.success) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } else {
      setErrorMsg(res.error || 'Gagal mengirimkan ulasan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 relative overflow-hidden">
        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Terima Kasih!</h3>
            <p className="text-xs text-slate-600">
              Ulasan & Rating Bintang <strong className="text-kunyit-500">{rating} ⭐</strong> Anda tentang <strong>{productName}</strong> berhasil dikirimkan.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Beri Ulasan Produk</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-daun-100 text-daun-700 font-bold">
                    Fresh Minut
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{orderNumber} • {productName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Star Rating Picker */}
            <div className="text-center py-2 space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Bagaimana Kualitas & Kesegaran Produk?
              </label>
              <div className="flex justify-center items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          active ? 'text-kunyit-400 fill-kunyit-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="text-xs font-bold text-kunyit-600">
                {rating === 5 && 'Sangat Puas & Ayam Sangat Segar! 🌟'}
                {rating === 4 && 'Puas (Ayam Segar & Potongan Rapi) 👍'}
                {rating === 3 && 'Cukup Baik 👌'}
                {rating === 2 && 'Kurang Puas 🙁'}
                {rating === 1 && 'Sangat Kecewa 😞'}
              </div>
            </div>

            {/* Comment Text Area */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-daun-600" />
                <span>Pengalaman & Catatan Anda:</span>
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Ayam dipotong jam 6 pagi masih hangat & empuk saat dibuat Woku. Pelayanan Fresh Minut cepat!"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-3 focus:outline-none focus:border-daun-500 focus:bg-white transition"
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-daun-700 hover:bg-daun-800 rounded-xl transition shadow-md shadow-daun-900/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Ulasan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
