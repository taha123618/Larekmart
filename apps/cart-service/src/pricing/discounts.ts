export interface CouponRule {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
}

// Built-in / promotional sample coupons (in production, can also query promotion-service)
export const VALID_PROMOTIONS: Record<string, CouponRule> = {
  WELCOME10: {
    code: "WELCOME10",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 1000,
  },
  SAVE500: {
    code: "SAVE500",
    discountType: "fixed",
    discountValue: 500,
    minOrderAmount: 2500,
  },
  VIP20: {
    code: "VIP20",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 5000,
  },
  SUMMER20: {
    code: "SUMMER20",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 3000,
  },
  SAVE15: {
    code: "SAVE15",
    discountType: "percentage",
    discountValue: 15,
    minOrderAmount: 2000,
  },
  FREESHIP: {
    code: "FREESHIP",
    discountType: "fixed",
    discountValue: 250,
    minOrderAmount: 1500,
  },
};

export const calculateCouponDiscount = (
  coupon: CouponRule,
  subtotal: number,
): { appliedAmount: number; isValid: boolean; reason?: string } => {
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
    return {
      appliedAmount: 0,
      isValid: false,
      reason: `Minimum order amount of PKR ${coupon.minOrderAmount} required for coupon ${coupon.code}`,
    };
  }

  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = Math.round((subtotal * coupon.discountValue) / 100);
  } else if (coupon.discountType === "fixed") {
    discount = Math.min(coupon.discountValue, subtotal);
  }

  return {
    appliedAmount: Math.max(0, discount),
    isValid: true,
  };
};
