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
    color:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/60",
  },
  {
    icon: Truck,
    title: "Fast Global Delivery",
    desc: "Real-time shipment tracking",
    color:
      "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/60",
  },
  {
    icon: RotateCcw,
    title: "30-Day Free Return",
    desc: "Hassle-free refunds & return label",
    color:
      "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/60",
  },
  {
    icon: Headphones,
    title: "24/7 Customer Care",
    desc: "Instant live dispute resolution",
    color:
      "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/60",
  },
  {
    icon: CreditCard,
    title: "Safe Payments",
    desc: "Stripe, Cards, & Cash On Delivery",
    color:
      "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/60",
  },
];

export default function TrustBadges() {
  return (
    <div className="my-10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {BADGES.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 sm:gap-3.5 group ${
                idx === BADGES.length - 1 ? "col-span-2 md:col-span-1" : ""
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs transition-transform duration-300 group-hover:scale-105 ${item.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
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
