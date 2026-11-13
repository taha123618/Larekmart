import { Injectable, Logger } from "@nestjs/common";
import type { AiSupportMessageInput, AiSupportResponse } from "@repo/types";

interface KnowledgeItem {
  keywords: string[];
  intent: AiSupportResponse["intent"];
  answer: string;
  sources: string[];
  action?: AiSupportResponse["suggestedAction"];
}

const KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    keywords: ["track", "tracking", "status", "where is", "package", "delivery status"],
    intent: "ORDER_TRACKING",
    answer:
      "You can track your order in real-time by visiting the Track Order page (/track) or heading to your Account Orders section. You will need your Order ID and email address.",
    sources: ["Larekmart Order Lifecycle Guide", "Courier Tracking API"],
    action: "TRACK_ORDER",
  },
  {
    keywords: ["shipping", "delivery time", "carrier", "tcs", "leopards", "dhl", "how long"],
    intent: "SHIPPING_INQUIRY",
    answer:
      "Standard domestic delivery takes 2–4 business days via our verified logistics partners (TCS, Leopards, DHL Express). Expedited delivery options are available at checkout depending on your destination city.",
    sources: ["Larekmart Shipping Policy v2"],
    action: "TRACK_ORDER",
  },
  {
    keywords: ["return", "refund", "exchange", "damaged", "wrong item", "send back", "rma"],
    intent: "RETURN_POLICY",
    answer:
      "We offer a 14-day hassle-free return window for all eligible items. Items must be in unwashed, original condition with security tags intact. To start a return, visit your Order Details page and click 'Request Return' to generate an instant RMA slip.",
    sources: ["Larekmart Customer Protection & Return Terms"],
    action: "REQUEST_RETURN",
  },
  {
    keywords: ["payment", "credit card", "stripe", "cash on delivery", "cod", "debit", "pay"],
    intent: "PAYMENT_METHODS",
    answer:
      "Larekmart supports secure checkout via Stripe (Visa, Mastercard, American Express) with 3D Secure verification, as well as Cash on Delivery (COD) for supported domestic locations.",
    sources: ["Larekmart PCI-DSS Compliance & Billing Documentation"],
    action: "VIEW_CART",
  },
  {
    keywords: ["seller", "merchant", "vendor", "sell", "onboarding", "kyb", "storefront"],
    intent: "SELLER_ONBOARDING",
    answer:
      "Interested in selling on Larekmart? You can apply through our Merchant Onboarding portal (/become-a-seller). Complete the 4-step KYB registration with your business verification documents to begin listing products.",
    sources: ["Merchant Onboarding & KYB Standards"],
  },
];

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  async answerQuestion(input: AiSupportMessageInput): Promise<AiSupportResponse> {
    const query = input.message.toLowerCase().trim();
    this.logger.log(`Processing AI support inquiry: "${query.slice(0, 80)}"`);

    // Match keywords against knowledge base
    let bestMatch: KnowledgeItem | null = null;
    let highestScore = 0;

    for (const item of KNOWLEDGE_BASE) {
      let score = 0;
      for (const kw of item.keywords) {
        if (query.includes(kw)) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && highestScore > 0) {
      return {
        answer: bestMatch.answer,
        intent: bestMatch.intent,
        confidence: Math.min(0.7 + highestScore * 0.1, 0.98),
        sources: bestMatch.sources,
        canEscalate: true,
        suggestedAction: bestMatch.action,
      };
    }

    // Default general help with escalation option
    return {
      answer:
        "I'm here to help with your orders, shipping, returns, and payment questions. If you need dedicated human support with an existing order or account issue, you can escalate this conversation directly to our customer support team to open a support ticket.",
      intent: "GENERAL_HELP",
      confidence: 0.5,
      sources: ["Larekmart Support Helpdesk"],
      canEscalate: true,
      suggestedAction: "OPEN_TICKET",
    };
  }
}
