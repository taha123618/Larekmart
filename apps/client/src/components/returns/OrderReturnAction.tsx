"use client";

import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { OrderType } from "@repo/types";
import RequestReturnModal from "./RequestReturnModal";
import { useRouter } from "next/navigation";

interface OrderReturnActionProps {
  order: OrderType;
}

export default function OrderReturnAction({
  order,
}: OrderReturnActionProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
        title="Request Return & Refund"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Return Items</span>
      </button>

      <RequestReturnModal
        order={order}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
