'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/stores/use-cart-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Trophy, Lock, X, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';

interface MiniBakeGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const FRESHMINUT_QUESTIONS: Question[] = [
  {
    id: 1,
    question: 'Bahan baku utama apa yang disajikan oleh Fresh Minut Minahasa Utara setiap harinya?',
    options: [
      'Daging Olahan Beku Impor',
      'Ayam Potong Segar Subuh 04:00 WITA dari Peternak Lokal',
      'Ayam Olahan Kaleng',
      'Daging Sintetis'
    ],
    correctIndex: 1,
    explanation: 'Fresh Minut selalu menyediakan ayam broiler & kampung yang dipotong segar jam 04:00 WITA langsung dari peternak lokal Minahasa Utara!',
  },
  {
    id: 2,
    question: 'Apa keunggulan utama sistem penimbangan Fresh Minut untuk pesanan ayam segar Anda?',
    options: [
      'Flexible Weight & Smart Pricing (Harga akurat sesuai berat riil timbangan digital IoT)',
      'Berat Dipatok Tanpa Penimbangan',
      'Tidak Ada Struk Penimbangan',
      'Sistem Timbangan Manual Rusak'
    ],
    correctIndex: 0,
    explanation: 'Sistem Fresh Minut menjamin harga dihitung transparan sesuai berat aktual hasil timbangan digital presisi.',
  },
  {
    id: 3,
    question: 'Berapa batas minimal total belanja di Fresh Minut untuk membuka kesempatan kuis & voucher diskon rahasia?',
    options: ['Rp 50.000', 'Rp 75.000', 'Rp 100.000', 'Rp 250.000'],
    correctIndex: 2,
    explanation: 'Tepat sekali! Pembelian di atas Rp 100.000 memberikan 1x kesempatan kuis & voucher diskon rahasia.',
  },
];

export function MiniBakeGameModal({ isOpen, onClose }: MiniBakeGameModalProps) {
  const { totalPrice, applyDiscountCode, appliedDiscount, hasPlayedGame, setHasPlayedGame } = useCartStore();

  const subtotal = totalPrice();
  const isEligible = subtotal >= 100000;
  const neededAmount = Math.max(0, 100000 - subtotal);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'READY' | 'QUIZ' | 'RESULT' | 'ALREADY_PLAYED'>('READY');
  const [unlockedCode, setUnlockedCode] = useState('FRESHMINUT15');
  const [applySuccessMsg, setApplySuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  useEffect(() => {
    if (isOpen) {
      if (hasPlayedGame) {
        setGameState('ALREADY_PLAYED');
      } else {
        setGameState('READY');
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setScore(0);
        setApplySuccessMsg('');
        setCopied(false);
      }
    }
  }, [isOpen, hasPlayedGame]);

  const handleStartQuiz = () => {
    if (!isEligible || hasPlayedGame) return;
    setGameState('QUIZ');
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setScore(0);
  };

  const handleSelectOption = (index: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);

    const isCorrect = index === FRESHMINUT_QUESTIONS[currentQuestionIndex].correctIndex;
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(newScore);

    setTimeout(() => {
      if (currentQuestionIndex + 1 < FRESHMINUT_QUESTIONS.length) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedOption(null);
      } else {
        setHasPlayedGame(true);
        setGameState('RESULT');

        if (newScore >= 2) {
          const codes = ['FRESHMINUT15', 'MINUT20K'];
          setUnlockedCode(codes[Math.floor(Math.random() * codes.length)]);
        } else {
          setUnlockedCode('FRESHMINUT10');
        }
      }
    }, 1200);
  };

  const handleApplyDiscount = async () => {
    const res = await applyDiscountCode(unlockedCode);
    setApplySuccessMsg(res.message);
  };

  if (!isOpen) return null;

  const currentQ = FRESHMINUT_QUESTIONS[currentQuestionIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-daun-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-daun-700 hover:bg-daun-800 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="h-5 w-5 text-kunyit-300 animate-pulse" />
            <span>Kuis Fresh Minut Minahasa Utara</span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {!isEligible ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-daun-100 rounded-full flex items-center justify-center mx-auto text-daun-800 shadow-inner">
                <Lock className="h-8 w-8 text-daun-700" />
              </div>

              <div>
                <Badge variant="outline" className="border-daun-500 text-daun-800 bg-daun-50 mb-2">
                  Syarat Belanja Belum Terpenuhi
                </Badge>
                <h3 className="text-xl font-bold text-slate-900">Kuis Fresh Minut Terkunci</h3>
                <p className="text-sm text-slate-600 mt-2 max-w-xs mx-auto">
                  Kuis ini khusus untuk pembelian ayam di atas <span className="font-bold text-daun-700">Rp 100.000</span>.
                </p>
              </div>

              <div className="bg-daun-50 p-4 rounded-xl border border-daun-200 text-left space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Keranjang Saat Ini: {formatIDR(subtotal)}</span>
                  <span>Target: {formatIDR(100000)}</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-daun-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, (subtotal / 100000) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-daun-800 font-medium text-center">
                  Tambah pesanan senilai <span className="font-bold">{formatIDR(neededAmount)}</span> lagi untuk membuka Kuis Fresh Minut!
                </p>
              </div>

              <Button onClick={onClose} className="w-full bg-daun-600 hover:bg-daun-700 text-white font-bold">
                Kembali Belanja Ayam
              </Button>
            </div>
          ) : gameState === 'ALREADY_PLAYED' ? (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-daun-100 text-daun-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="h-8 w-8 text-daun-700" />
              </div>

              <div>
                <Badge className="bg-daun-700 text-white mb-2">1x Kesempatan Main Telah Digunakan</Badge>
                <h3 className="text-2xl font-bold text-slate-900">Terima Kasih Mengikuti Kuis Fresh Minut!</h3>
                <p className="text-sm text-slate-600 mt-2 max-w-xs mx-auto">
                  Anda telah menggunakan kesempatan bermain untuk transaksi ini.
                </p>
              </div>

              {appliedDiscount ? (
                <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl space-y-1 text-emerald-900">
                  <div className="text-xs font-semibold">VOUCHER DISKON TERPASANG</div>
                  <div className="text-xl font-mono font-bold">{appliedDiscount.code}</div>
                  <div className="text-xs">{appliedDiscount.description}</div>
                </div>
              ) : (
                <div className="bg-kunyit-50 border border-kunyit-200 p-4 rounded-xl space-y-1 text-kunyit-900">
                  <div className="text-xs font-semibold">KODE DISKON FRESH MINUT ANDA</div>
                  <div className="text-xl font-mono font-bold text-slate-900">{unlockedCode}</div>
                  <Button onClick={handleApplyDiscount} size="sm" className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                    Pasang Kode Ini
                  </Button>
                </div>
              )}

              <Button onClick={onClose} className="w-full bg-daun-600 hover:bg-daun-700 text-white font-bold">
                Tutup & Lanjut Ke Pembayaran
              </Button>
            </div>
          ) : (
            <>
              {gameState === 'READY' && (
                <div className="text-center space-y-5 py-2">
                  <div className="w-16 h-16 bg-daun-700 hover:bg-daun-800 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <HelpCircle className="h-8 w-8" />
                  </div>

                  <div>
                    <Badge className="bg-emerald-600 text-white mb-2">
                      1x Kesempatan Bermain Aktif!
                    </Badge>
                    <h3 className="text-2xl font-bold text-slate-900">Kuis Fresh Minut Ayam Segar</h3>
                    <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
                      Jawab 3 pertanyaan seputar Fresh Minut Minahasa Utara untuk membuka Voucher Diskon Potongan Ayam hingga 15%!
                    </p>
                  </div>

                  <div className="bg-kunyit-50 p-3 rounded-xl border border-kunyit-200 text-xs text-ink space-y-1">
                    <div className="font-bold flex items-center justify-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-kunyit-700" />
                      <span>Catatan Penting:</span>
                    </div>
                    <p>Kuis ini dapat dimainkan 1x sebelum melakukan pembayaran.</p>
                  </div>

                  <Button
                    onClick={handleStartQuiz}
                    className="w-full py-6 text-lg font-bold bg-daun-600 hover:bg-daun-700 text-white shadow-lg hover:shadow-xl transition"
                  >
                    🧠 Mulai Kuis Fresh Minut
                  </Button>
                </div>
              )}

              {gameState === 'QUIZ' && (
                <div className="space-y-5">
                  <div className="flex justify-between items-center bg-daun-50 px-4 py-2 rounded-xl border border-daun-200 text-xs font-bold text-daun-900">
                    <span>Pertanyaan {currentQuestionIndex + 1} dari {FRESHMINUT_QUESTIONS.length}</span>
                    <span>Skor: {score}</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {currentQ.question}
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {currentQ.options.map((option, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = idx === currentQ.correctIndex;

                      let btnStyle = 'border-slate-200 hover:border-daun-400 hover:bg-daun-50/50 text-slate-800';
                      if (selectedOption !== null) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = 'bg-red-100 border-red-500 text-red-950 font-bold';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={selectedOption !== null}
                          onClick={() => handleSelectOption(idx)}
                          className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between text-sm ${btnStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-200/80 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span>{option}</span>
                          </div>
                          {selectedOption !== null && isCorrect && (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOption !== null && (
                    <div className="bg-kunyit-50 p-3 rounded-lg border border-kunyit-200 text-xs text-kunyit-900">
                      <strong>Penjelasan:</strong> {currentQ.explanation}
                    </div>
                  )}
                </div>
              )}

              {gameState === 'RESULT' && (
                <div className="text-center space-y-5 py-2">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Trophy className="h-8 w-8 text-emerald-700 animate-bounce" />
                  </div>

                  <div>
                    <Badge className="bg-daun-700 text-white mb-2">Kuis Selesai!</Badge>
                    <h3 className="text-2xl font-bold text-slate-900">
                      Skor Anda: {score} / {FRESHMINUT_QUESTIONS.length}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {score >= 2
                        ? 'Luar biasa! Anda paham betul keunggulan ayam segar Fresh Minut!'
                        : 'Terima kasih telah mengikuti kuis Fresh Minut!'}
                    </p>
                  </div>

                  <div className="bg-daun-700 hover:bg-daun-800 border-2 border-dashed border-daun-400 p-4 rounded-xl space-y-2">
                    <div className="text-xs text-daun-800 font-bold uppercase tracking-wider">
                      🎁 VOUCHER DISKON FRESH MINUT UNLOCKED
                    </div>
                    <div className="text-2xl font-mono font-black text-slate-900 tracking-wider">
                      {unlockedCode}
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold">
                      {unlockedCode === 'FRESHMINUT15' && '✨ Diskon 15% OFF Ayam Segar'}
                      {unlockedCode === 'MINUT20K' && '✨ Potongan Langsung Rp 20.000'}
                      {unlockedCode === 'FRESHMINUT10' && '✨ Diskon Spesial 10% OFF'}
                    </div>
                  </div>

                  {applySuccessMsg ? (
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>{applySuccessMsg}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleApplyDiscount}
                        className="w-full py-6 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                      >
                        ⚡ Pasang Kode Diskon Ke Keranjang
                      </Button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(unlockedCode);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        {copied ? 'Kode berhasil disalin!' : 'Salin kode secara manual'}
                      </button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full border-daun-300 text-daun-900 hover:bg-daun-50 font-semibold"
                  >
                    Tutup & Lanjut Ke Checkout
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
