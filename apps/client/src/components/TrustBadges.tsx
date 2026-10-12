import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  CreditCard,
} from "lucide-react";

const BADGES = [
  {
    icon: ShieldCheck,
    title: "Buyer Protection",
    desc: "100% money back guarantee",
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    icon: Truck,
    title: "Fast Global Delivery",
    desc: "Real-time shipment tracking",
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
  },
  {
    icon: RotateCcw,
    title: "30-Day Free Return",
    desc: "Hassle-free refunds & return label",
    color: "text-amber-600 bg-amber-50 border-amber-100",
  },
  {
    icon: Headphones,
    title: "24/7 Customer Care",
    desc: "Instant live dispute resolution",
    color: "text-purple-600 bg-purple-50 border-purple-100",
  },
  {
    icon: CreditCard,
    title: "Safe Payments",
    desc: "Stripe, Cards, & Cash On Delivery",
    color: "text-cyan-600 bg-cyan-50 border-cyan-100",
  },
];

export default function TrustBadges() {
  return (
    <div className="my-10 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {BADGES.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 sm:gap-3.5 ${
                idx === BADGES.length - 1 ? "col-span-2 md:col-span-1" : ""
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${item.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
