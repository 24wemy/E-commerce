'use client';

import { useState } from 'react';
import { upsertProductAction } from '@/actions/admin';
import { ActionForm } from '@/components/admin/ActionForm';
import { fieldCls, labelCls, btnCls, btnGhostCls } from '@/components/admin/ui';

type P = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  pricePerKg: number;
  minStockKg: number;
  leadTimeDays: number;
  isActive: boolean;
  images: string[];
};

export function ProductFormModal({ existingProduct }: { existingProduct?: P }) {
  const [open, setOpen] = useState(false);
  const p = existingProduct;
  return (
    <>
      <button className={p ? btnGhostCls : btnCls} onClick={() => setOpen(true)}>
        {p ? 'Edit' : '+ Tambah Produk'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{p ? `Edit ${p.name}` : 'Tambah Produk'}</h2>
            <ActionForm
              action={async (fd) => {
                const r = await upsertProductAction(fd);
                if (r.success) setTimeout(() => setOpen(false), 400);
                return r;
              }}
              className="space-y-3"
            >
              {p && <input type="hidden" name="id" value={p.id} />}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>SKU</label>
                  <input name="sku" required defaultValue={p?.sku} className={`${fieldCls} uppercase`} placeholder="AYM-BRL-001" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Nama produk</label>
                  <input name="name" required defaultValue={p?.name} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                <input name="category" required defaultValue={p?.category ?? 'AYAM_SEGAR'} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Deskripsi</label>
                <textarea name="description" rows={3} defaultValue={p?.description} className={fieldCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Harga per kg (Rp)</label>
                  <input name="pricePerKg" type="number" min={100} required defaultValue={p?.pricePerKg} className={fieldCls} />
                </div>
                {!p && (
                  <div>
                    <label className={labelCls}>Stok awal (kg)</label>
                    <input name="stockKg" type="number" step="0.1" min={0} defaultValue={0} className={fieldCls} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Batas stok minimum (kg)</label>
                  <input name="minStockKg" type="number" step="0.1" min={0} required defaultValue={p?.minStockKg ?? 5} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Lead time supplier (hari)</label>
                  <input name="leadTimeDays" type="number" min={0} required defaultValue={p?.leadTimeDays ?? 1} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>URL foto</label>
                <input name="image" type="url" defaultValue={p?.images[0]} className={fieldCls} placeholder="https://images.unsplash.com/..." />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Tampilkan di toko
              </label>
              {p && <p className="text-xs text-slate-500">Perubahan stok dilakukan di halaman Inventory agar tercatat di log pergerakan stok.</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>
                  Tutup
                </button>
                <button className={btnCls}>Simpan</button>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
