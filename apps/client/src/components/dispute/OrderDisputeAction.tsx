"use client";

import React, { useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { OrderType } from "@repo/types";
import OpenDisputeModal from "./OpenDisputeModal";
import { useRouter } from "next/navigation";

interface OrderDisputeActionProps {
  order: OrderType;
}

export default function OrderDisputeAction({
  order,
}: OrderDisputeActionProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
        title="Report Issue & Open Dispute"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Dispute Order</span>
      </button>

      <OpenDisputeModal
        order={order}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}

