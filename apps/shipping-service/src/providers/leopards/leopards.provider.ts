import type {
  ShippingProvider,
  ShippingRateRequest,
  ShippingRate,
  CreateShipmentRequest,
  ShipmentResult,
  CancelShipmentRequest,
  CreateLabelRequest,
  ShippingLabel,
  TrackingResult,
} from "../interface.js";
import { v4 as uuidv4 } from "uuid";

export class LeopardsShippingProvider implements ShippingProvider {
  readonly carrierCode = "leopards";

  async getRates(request: ShippingRateRequest): Promise<ShippingRate[]> {
    const weight = request.weight ?? 0.5;
    // Leopards Standard COD: 220 base
    const standardRate = Math.round(220 + Math.max(0, weight - 0.5) * 90);
    // Leopards Overnight: 400 base
    const overnightRate = Math.round(400 + Math.max(0, weight - 0.5) * 140);

    // Leopards COD is available across Pakistan. Fee: 1.5% of collection value (min 60 PKR)
    const isCod = Boolean(request.isCod);
    const codFee = isCod
      ? Math.max(60, Math.round((request.codAmount ?? 1000) * 0.015))
      : null;

    return [
      {
        id: "leopards-standard",
        carrier: this.carrierCode,
        service: "standard",
        name: "Leopards Standard Surface",
        amount: standardRate,
        currency: "PKR",
        estimatedDaysMin: 2,
        estimatedDaysMax: 4,
        isCodAvailable: true,
        codFee,
      },
      {
        id: "leopards-overnight",
        carrier: this.carrierCode,
        service: "overnight",
        name: "Leopards Yellow Box Express",
        amount: overnightRate,
        currency: "PKR",
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        isCodAvailable: true,
        codFee,
      },
    ];
  }

  async createShipment(
    request: CreateShipmentRequest,
  ): Promise<ShipmentResult> {
    const trackingNo = `LEO${Math.floor(10000000 + Math.random() * 90000000)}`;
    const estimatedDays = request.serviceType === "overnight" ? 1 : 3;

    const isCod = Boolean(request.isCod);
    const codFee = isCod
      ? (request.codFee ??
        Math.max(60, Math.round((request.codAmount ?? 0) * 0.015)))
      : null;

    return {
      carrier: this.carrierCode,
      trackingNumber: trackingNo,
      labelUrl: `https://merchant.leopardscourier.com/api/labels/${trackingNo}.pdf`,
      estimatedDeliveryAt: new Date(Date.now() + estimatedDays * 86400000),
      isCod,
      codAmount: isCod ? request.codAmount : null,
      codFee,
      metadata: {
        bookedAt: new Date().toISOString(),
        weight: request.packages?.[0]?.weight ?? 1,
        destinationCity: request.shippingAddress.city,
        isCod,
        ...(isCod && {
          consignment_type: "COD",
          booked_packet_collect_amount: request.codAmount,
          cod_fee: codFee,
          collection_instructions: `Collect PKR ${request.codAmount} from consignee upon parcel handover.`,
        }),
      },
    };
  }

  async cancelShipment(request: CancelShipmentRequest): Promise<void> {
    console.log(
      `[LeopardsShippingProvider] Booking ${request.trackingNumber} voided`,
    );
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    return {
      shipmentId: "",
      carrier: this.carrierCode,
      trackingNumber,
      status: "PICKED_UP",
      estimatedDeliveryAt: new Date(Date.now() + 86400000).toISOString(),
      events: [
        {
          id: uuidv4(),
          shipmentId: "",
          status: "PICKED_UP",
          description: "Parcel collected by Leopards rider",
          location: "Karachi Central Hub",
          occurredAt: new Date().toISOString(),
          source: "carrier_poll",
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }

  async createLabel(
    request: CreateLabelRequest & { trackingNumber: string },
  ): Promise<ShippingLabel> {
    return {
      id: uuidv4(),
      shipmentId: request.shipmentId,
      carrier: this.carrierCode,
      trackingNumber: request.trackingNumber,
      format: request.format ?? "pdf",
      labelUrl: `https://merchant.leopardscourier.com/api/labels/${request.trackingNumber}.${request.format ?? "pdf"}`,
      cost: 220,
      createdAt: new Date().toISOString(),
    };
  }
}
