'use client';
import { useEffect, useState } from 'react';
import { enrollmentRepository, type Receipt } from './repository';
export function ReceiptSummary() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  useEffect(() => {
    let active = true;
    enrollmentRepository.receipt().then((value) => {
      if (active) setReceipt(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return receipt ? (
    <div className="my-6 rounded-xl border border-gray-100 bg-white p-5 text-left text-sm">
      <strong className="text-brand-500">{receipt.name}</strong>
      <p className="mt-2">
        {receipt.id} · {receipt.status}
      </p>
      <p className="mt-1 text-gray-500">{receipt.categories.join(', ')}</p>
    </div>
  ) : null;
}
