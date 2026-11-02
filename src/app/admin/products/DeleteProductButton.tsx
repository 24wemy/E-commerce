'use client';

import { deleteProductAction } from '@/actions/admin';
import { ActionButton } from '@/components/admin/ActionForm';

export function DeleteProductButton({ id }: { id: string }) {
  return (
    <ActionButton
      action={() => deleteProductAction(id)}
      confirmText="Hapus produk ini? (Produk yang punya riwayat order akan dinonaktifkan saja)"
      className="inline-flex items-center rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
    >
      Hapus
    </ActionButton>
  );
}
