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
      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-rose-950/60 text-red-700 dark:text-rose-400">
        TCS
      </span>
    );
  }
  if (c === "leopards") {
    return (
      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-amber-950/60 text-yellow-800 dark:text-amber-400">
        LEOPARDS
      </span>
    );
  }
  if (c === "dhl") {
    return (
      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
        DHL
      </span>
    );
  }
  return (
    <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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
      country: "US",
      state: "CA",
      postalCode: "90001",
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
      if (addr.state) setValue("state", addr.state);
      if (addr.postalCode) setValue("postalCode", addr.postalCode);
      if (addr.country) setValue("country", addr.country);
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
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl mb-1 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
              Use Saved Address
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Click to autofill
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddressId === addr.id;
              return (
                <div
                  key={addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all text-xs ${
                    isSelected
                      ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-1">
                    <span>{addr.recipientName}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full font-bold">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 truncate">
                    {addr.addressLine1}
                  </p>
                  <p className="text-slate-500 dark:text-slate-500 font-medium mt-0.5">
                    {addr.city}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid: Name & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            Full Name
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            type="text"
            id="name"
            placeholder="Muhammad Ali"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-rose-500 font-medium">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            Email Address
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            type="email"
            id="email"
            placeholder="ali@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-rose-500 font-medium">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      {/* Grid: Phone & City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            Phone Number
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            type="text"
            id="phone"
            placeholder="03001234567"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-rose-500 font-medium">
              {errors.phone.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="city"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            City
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            type="text"
            id="city"
            placeholder="Karachi, Lahore, Islamabad, Los Angeles..."
            {...register("city")}
          />
          {errors.city && (
            <p className="text-xs text-rose-500 font-medium">
              {errors.city.message}
            </p>
          )}
        </div>
      </div>

      {/* Grid: Country, State & Postal Code for Tax & Carrier Calculation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="country"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            Country
          </label>
          <select
            id="country"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            {...register("country")}
          >
            <option value="US">United States (US)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="PK">Pakistan (PK)</option>
            <option value="CA">Canada (CA)</option>
            <option value="DE">Germany (DE)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="state"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            State / Region
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            type="text"
            id="state"
            placeholder="e.g. CA, NY, TX"
            {...register("state")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="postalCode"
            className="text-xs text-slate-700 dark:text-slate-300 font-bold"
          >
            Postal / ZIP Code
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
            type="text"
            id="postalCode"
            placeholder="e.g. 90001, 10001"
            {...register("postalCode")}
          />
        </div>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="address"
          className="text-xs text-slate-700 dark:text-slate-300 font-bold"
        >
          Delivery Street Address
        </label>
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs"
          type="text"
          id="address"
          placeholder="House 45, Street 12, Phase 5 DHA"
          {...register("address")}
        />
        {errors.address && (
          <p className="text-xs text-rose-500 font-medium">
            {errors.address.message}
          </p>
        )}
      </div>

      {/* SAVE ADDRESS TO ACCOUNT OPTION */}
      {isSignedIn && (
        <label className="flex items-center gap-2 py-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={saveAddressToAccount}
            onChange={(e) => setSaveAddressToAccount(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
            <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            Save this address to my account for future orders
          </span>
        </label>
      )}

      {/* CASH ON DELIVERY TOGGLE */}
      <div className="mt-1 p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between shadow-xs">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
            💵 Cash on Delivery (COD)
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
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
          <div className="w-10 h-5.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* DYNAMIC DELIVERY OPTIONS */}
      <div className="mt-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-indigo-500" />
            Carrier Delivery Options
          </label>
          {loadingRates && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
              Calculating carrier rates...
            </span>
          )}
        </div>

        {availableRates.length === 0 && !loadingRates ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            Enter your city above to view live carrier delivery rates and times.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
            {availableRates.slice(0, 6).map((rate) => {
              const isSelected = selectedRateId === rate.id;
              const isCodSupported = rate.isCodAvailable;

              return (
                <div
                  key={rate.id}
                  onClick={() => handleSelectRate(rate)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/70 dark:bg-slate-800/60"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      {getCarrierBadge(rate.carrier)}
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {rate.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Est. {rate.estimatedDaysMin ?? 1}-
                        {rate.estimatedDaysMax ?? 3} days
                      </span>
                      {isCodEnabled && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isCodSupported
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 line-through"
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
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      PKR{" "}
                      {rate.amount +
                        (isCodEnabled && isCodSupported
                          ? (rate.codFee ?? 0)
                          : 0)}
                    </span>
                    {isSelected && (
                      <div className="w-4 h-4 bg-indigo-600 dark:bg-indigo-500 rounded-full flex items-center justify-center text-white ml-auto mt-1 shadow-xs">
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
        className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 transition-all duration-300 text-white p-3.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 mt-2 font-bold text-sm shadow-lg shadow-indigo-500/25 active:scale-[0.99]"
      >
        <span>Proceed to Payment</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
};

export default ShippingForm;
