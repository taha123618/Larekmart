"use client";

import React, { useState } from "react";
import { LifeBuoy } from "lucide-react";
import type { OrderType } from "@repo/types";
import OpenSupportTicketModal from "./OpenSupportTicketModal";
import { useRouter } from "next/navigation";

interface OrderSupportActionProps {
  order: OrderType;
}

export default function OrderSupportAction({
  order,
}: OrderSupportActionProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const orderId = order._id || (order as { id?: string }).id || "";

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition cursor-pointer"
        title="Contact Support regarding this order"
      >
        <LifeBuoy className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
        <span>Support</span>
      </button>

      <OpenSupportTicketModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        initialOrderId={orderId}
        initialCategoryCode="ORDER_INQUIRY"
        initialSubject={
          orderId ? `Help with Order #${orderId}` : "Order Support"
        }
      />
    </>
  );
}
