"use client";

import {
  ShippingFormInputs,
  shippingFormSchema,
  ShippingRate,
  AddressResponse,
} from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Truck,
  Check,
  Loader2,
  MapPin,
  BookmarkCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { fetchShippingRates } from "@/services/shipping.service";
import { fetchUserAddresses, createUserAddress } from "@/services/user.service";
import { useAuth, useUser } from "@clerk/nextjs";

const getCarrierBadge = (carrier: string) => {
  const c = carrier.toLowerCase();
  if (c === "tcs") {
    return (
      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
        TCS
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
        LEOPARDS
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
        DHL
      </span>
    );
  }
  return (
    <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
      DIRECT
    </span>
  );
};

const ShippingForm = ({
  setShippingForm,
}: {
  setShippingForm: (data: ShippingFormInputs) => void;
}) => {
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ShippingFormInputs>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: {
      carrier: "custom",
      serviceType: "standard",
      shippingAmount: 200,
      codFee: 30,
      isCod: false,
    },
  });

  const [savedAddresses, setSavedAddresses] = useState<AddressResponse[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [saveAddressToAccount, setSaveAddressToAccount] =
    useState<boolean>(false);
  const [availableRates, setAvailableRates] = useState<ShippingRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [selectedRateId, setSelectedRateId] =
    useState<string>("custom-standard");
  const [isCodEnabled, setIsCodEnabled] = useState<boolean>(false);

  const city = watch("city");
  const router = useRouter();

  const handleSelectSavedAddress = useCallback(
    (addr: AddressResponse) => {
      setSelectedAddressId(addr.id);
      setValue("name", addr.recipientName);
      setValue("phone", addr.phone);
      setValue("address", addr.addressLine1);
      setValue("city", addr.city);
      if (clerkUser?.primaryEmailAddress?.emailAddress) {
        setValue("email", clerkUser.primaryEmailAddress.emailAddress);
      }
    },
    [clerkUser, setValue],
  );

  // Load saved user addresses from user-service
  useEffect(() => {
    if (!isSignedIn) return;
    let isCancelled = false;
    const loadAddresses = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const addrs = await fetchUserAddresses(token);
        if (!isCancelled && addrs.length > 0) {
          setSavedAddresses(addrs);
          // If there is a default address, select and auto-populate it
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          if (def) {
            handleSelectSavedAddress(def);
          }
        }
      } catch (err) {
        console.warn("Could not load user addresses from user-service:", err);
      }
    };
    loadAddresses();
    return () => {
      isCancelled = true;
    };
  }, [isSignedIn, getToken, handleSelectSavedAddress]);

  // Pre-fill user details from Clerk if available
  useEffect(() => {
    if (clerkUser) {
      if (clerkUser.fullName) setValue("name", clerkUser.fullName);
      if (clerkUser.primaryEmailAddress?.emailAddress) {
        setValue("email", clerkUser.primaryEmailAddress.emailAddress);
      }
      if (clerkUser.primaryPhoneNumber?.phoneNumber) {
        setValue("phone", clerkUser.primaryPhoneNumber.phoneNumber);
      }
    }
  }, [clerkUser, setValue]);

  // Fetch real-time shipping rates when city or COD option changes
  useEffect(() => {
    if (!city || city.trim().length < 3) {
      return;
    }

    let isCancelled = false;
    const fetchRates = async () => {
      setLoadingRates(true);
      try {
        const rates = await fetchShippingRates({
          city: city.trim(),
          country: "PK",
          isCod: isCodEnabled,
        });
        if (!isCancelled && rates.length > 0) {
          setAvailableRates(rates);
          // Auto-select standard or first rate
          const standardRate =
            rates.find((r) => r.service === "standard") || rates[0];
          if (standardRate) {
            setSelectedRateId(standardRate.id);
            setValue("carrier", standardRate.carrier);
            setValue("serviceType", standardRate.service);
            setValue("shippingAmount", standardRate.amount);
            setValue("isCod", isCodEnabled);
            setValue("codFee", isCodEnabled ? (standardRate.codFee ?? 30) : 0);
          }
        }
      } catch (err) {
        console.warn("Could not load real-time shipping rates:", err);
      } finally {
        if (!isCancelled) setLoadingRates(false);
      }
    };

    const timer = setTimeout(fetchRates, 400);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [city, isCodEnabled, setValue]);

  const handleSelectRate = (rate: ShippingRate) => {
    setSelectedRateId(rate.id);
    setValue("carrier", rate.carrier);
    setValue("serviceType", rate.service);
    setValue("shippingAmount", rate.amount);
    setValue("isCod", isCodEnabled && rate.isCodAvailable);
    setValue("codFee", isCodEnabled ? (rate.codFee ?? 30) : 0);
  };

  const handleToggleCod = (checked: boolean) => {
    setIsCodEnabled(checked);
    setValue("isCod", checked);
    const currentRate = availableRates.find((r) => r.id === selectedRateId);
    setValue("codFee", checked ? (currentRate?.codFee ?? 30) : 0);
  };

  const handleShippingForm: SubmitHandler<ShippingFormInputs> = async (
    data,
  ) => {
    const selectedRate = availableRates.find((r) => r.id === selectedRateId);
    const resolvedShippingAmount =
      selectedRate?.amount ??
      (typeof data.shippingAmount === "number" ? data.shippingAmount : 200);
    const resolvedCodFee = isCodEnabled
      ? (selectedRate?.codFee ??
        (typeof data.codFee === "number" ? data.codFee : 30))
      : 0;

    // If customer opted to save this address and is signed in
    if (saveAddressToAccount && isSignedIn) {
      try {
        const token = await getToken();
        if (token) {
          await createUserAddress(token, {
            recipientName: data.name,
            phone: data.phone,
            addressLine1: data.address,
            city: data.city,
            state: "Province",
            postalCode: "00000",
            country: "PK",
            type: "SHIPPING",
            isDefault: savedAddresses.length === 0,
          });
        }
      } catch (e) {
        console.warn("Could not save address to user-service:", e);
      }
    }

    setShippingForm({
      ...data,
      carrier: selectedRate?.carrier || data.carrier || "custom",
      serviceType: selectedRate?.service || data.serviceType || "standard",
      shippingAmount: resolvedShippingAmount,
      codFee: resolvedCodFee,
      isCod: isCodEnabled,
    });
    router.push("/cart?step=3", { scroll: false });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(handleShippingForm)}
    >
      {/* Saved Addresses Selector (if signed in and has addresses) */}
      {isSignedIn && savedAddresses.length > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl mb-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-600" />
              Use Saved Address
            </span>
            <span className="text-[11px] text-gray-500">Click to autofill</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr.id;
              return (
                <div
                  key={addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition text-xs ${
                    isSelected
                      ? "border-black bg-white ring-1 ring-black shadow-xs"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-gray-900 mb-0.5">
                    <span>{addr.recipientName}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 truncate">{addr.addressLine1}</p>
                  <p className="text-gray-500 font-medium">{addr.city}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-xs text-gray-500 font-medium">
          Name
        </label>
        <input
          className="border-b border-gray-200 py-2 outline-none text-sm focus:border-gray-800 transition"
          type="text"
          id="name"
          placeholder="Muhammad Ali"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs text-gray-500 font-medium">
          Email
        </label>
        <input
          className="border-b border-gray-200 py-2 outline-none text-sm focus:border-gray-800 transition"
          type="email"
          id="email"
          placeholder="ali@example.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-xs text-gray-500 font-medium">
          Phone
        </label>
        <input
          className="border-b border-gray-200 py-2 outline-none text-sm focus:border-gray-800 transition"
          type="text"
          id="phone"
          placeholder="03001234567"
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-xs text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="address" className="text-xs text-gray-500 font-medium">
          Delivery Address
        </label>
        <input
          className="border-b border-gray-200 py-2 outline-none text-sm focus:border-gray-800 transition"
          type="text"
          id="address"
          placeholder="House 45, Street 12, Phase 5 DHA"
          {...register("address")}
        />
        {errors.address && (
          <p className="text-xs text-red-500">{errors.address.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="city" className="text-xs text-gray-500 font-medium">
          City
        </label>
        <input
          className="border-b border-gray-200 py-2 outline-none text-sm focus:border-gray-800 transition"
          type="text"
          id="city"
          placeholder="Karachi, Lahore, Islamabad..."
          {...register("city")}
        />
        {errors.city && (
          <p className="text-xs text-red-500">{errors.city.message}</p>
        )}
      </div>

      {/* SAVE ADDRESS TO ACCOUNT OPTION */}
      {isSignedIn && (
        <label className="flex items-center gap-2 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={saveAddressToAccount}
            onChange={(e) => setSaveAddressToAccount(e.target.checked)}
            className="rounded border-gray-300 text-black focus:ring-black w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-gray-700 font-medium flex items-center gap-1">
            <BookmarkCheck className="w-3.5 h-3.5 text-gray-500" />
            Save this address to my account for future orders
          </span>
        </label>
      )}

      {/* CASH ON DELIVERY TOGGLE */}
      <div className="mt-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
            💵 Cash on Delivery (COD)
          </span>
          <span className="text-[11px] text-emerald-700">
            Pay in cash to courier rider upon parcel arrival
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isCodEnabled}
            onChange={(e) => handleToggleCod(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* DYNAMIC DELIVERY OPTIONS */}
      <div className="mt-1 pt-2 border-t border-gray-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-gray-500" />
            Carrier Delivery Options
          </label>
          {loadingRates && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Calculating carrier rates...
            </span>
          )}
        </div>

        {availableRates.length === 0 && !loadingRates ? (
          <p className="text-xs text-gray-400 italic">
            Enter your city above to view live carrier delivery rates and times.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {availableRates.slice(0, 6).map((rate) => {
              const isSelected = selectedRateId === rate.id;
              const isCodSupported = rate.isCodAvailable;

              return (
                <div
                  key={rate.id}
                  onClick={() => handleSelectRate(rate)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "border-gray-900 bg-gray-50/70 ring-1 ring-gray-900"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      {getCarrierBadge(rate.carrier)}
                      <span className="text-xs font-semibold text-gray-900">
                        {rate.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">
                        Est. {rate.estimatedDaysMin ?? 1}-
                        {rate.estimatedDaysMax ?? 3} days
                      </span>
                      {isCodEnabled && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            isCodSupported
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-500 line-through"
                          }`}
                        >
                          {isCodSupported
                            ? `COD: +PKR ${rate.codFee ?? 0}`
                            : "Prepaid Only"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900">
                      PKR{" "}
                      {rate.amount +
                        (isCodEnabled && isCodSupported
                          ? (rate.codFee ?? 0)
                          : 0)}
                    </span>
                    {isSelected && (
                      <div className="w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center text-white ml-auto mt-1">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-gray-900 hover:bg-gray-800 transition-all duration-300 text-white p-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-2 mt-2 font-medium text-sm"
      >
        Proceed to Payment
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
};

export default ShippingForm;
