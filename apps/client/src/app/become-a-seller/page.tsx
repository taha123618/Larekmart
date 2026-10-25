"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  registerVendor,
  getMyVendor,
  submitVendorVerification,
} from "@/services/vendor.service";
import {
  createSeller,
  getMySeller,
  fetchSystemSettings,
} from "@/services/seller.service";
import { fetchCurrentUser } from "@/services/user.service";
import type { OrganizationType, UserDetailResponse } from "@repo/types";
import {
  Store,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Clock,
  Sparkles,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

export default function BecomeASellerPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingMerchant, setExistingMerchant] = useState<{
    vendorName?: string;
    storeName?: string;
    storeSlug?: string;
    status?: string;
  } | null>(null);
  const [dbUser, setDbUser] = useState<UserDetailResponse | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [isSellerEnabled, setIsSellerEnabled] = useState(true);
  const [isSellerRegistrationOpen, setIsSellerRegistrationOpen] =
    useState(true);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(
    null,
  );
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    fetchSystemSettings()
      .then((settings) => {
        setIsSellerEnabled(settings.isSellerEnabled);
        setIsSellerRegistrationOpen(settings.isSellerRegistrationOpen);
        setMaintenanceMessage(settings.maintenanceMessage ?? null);
      })
      .catch(() => {
        setIsSellerEnabled(true);
        setIsSellerRegistrationOpen(true);
      })
      .finally(() => setIsLoadingSettings(false));
  }, []);

  const userIsSeller = Boolean(
    dbUser?.isSeller ||
      user?.publicMetadata?.isSeller ||
      user?.unsafeMetadata?.isSeller ||
      user?.publicMetadata?.role === "seller",
  );

  // Form State - Step 1: Legal Business Entity (Vendor)
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [organizationType, setOrganizationType] =
    useState<OrganizationType>("LLC");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxIdentifier, setTaxIdentifier] = useState("");
  const [country, setCountry] = useState("US");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [representativeName, setRepresentativeName] = useState("");

  // Form State - Step 2: Storefront Setup (Seller)
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");

  // Success result info
  const [createdSlug, setCreatedSlug] = useState("");

  // Auto-slugify store name
  const handleStoreNameChange = (val: string) => {
    setStoreName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  // Check if current user already has a vendor or seller account
  useEffect(() => {
    async function checkAccount() {
      if (!isLoaded || !isSignedIn) {
        setIsLoadingAccount(false);
        return;
      }

      try {
        const token = await getToken();
        const [vendor, seller, userProfile] = await Promise.all([
          getMyVendor(token || undefined),
          getMySeller(token || undefined),
          token ? fetchCurrentUser(token) : Promise.resolve(null),
        ]);

        if (userProfile) {
          setDbUser(userProfile);
        }

        if (vendor || seller) {
          setExistingMerchant({
            vendorName: vendor?.legalName,
            storeName: seller?.store?.name,
            storeSlug: seller?.store?.slug,
            status: seller?.status || vendor?.status || "PENDING",
          });
        }
      } catch (err) {
        console.warn("Error checking existing merchant profile:", err);
      } finally {
        setIsLoadingAccount(false);
      }
    }

    checkAccount();
  }, [isLoaded, isSignedIn, getToken]);

  // Autofill email/name from Clerk when user signs in
  useEffect(() => {
    if (user) {
      if (user.primaryEmailAddress?.emailAddress && !businessEmail) {
        setBusinessEmail(user.primaryEmailAddress.emailAddress);
      }
      if (user.fullName && !representativeName) {
        setRepresentativeName(user.fullName);
      }
    }
  }, [user, businessEmail, representativeName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast.error("Please sign in to complete merchant registration");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token)
        throw new Error("Authentication token expired. Please refresh.");

      // 1. Register Legal Business Entity (Vendor Service)
      const vendorResult = await registerVendor(
        {
          legalName,
          tradeName: tradeName || undefined,
          organizationType,
          registrationNumber,
          taxIdentifier,
          country,
          businessProfile: {
            industryCategory: "Retail & E-Commerce",
            businessEmail,
            businessPhone,
            registeredAddressLine1: "Primary Business Office",
            city: "Metropolis",
            state: "State",
            postalCode: "10001",
            country,
            authorizedRepresentativeName:
              representativeName || "Authorized Manager",
            authorizedRepresentativeEmail: businessEmail,
            authorizedRepresentativePhone: businessPhone,
            authorizedRepresentativeRole: "Principal Officer",
          },
        },
        token,
      );

      // 2. Register Merchant Storefront (Seller Service)
      const sellerResult = await createSeller(
        {
          vendorId: vendorResult.id,
          storeName,
          slug: slug || undefined,
          headline: headline || undefined,
          description: description || undefined,
        },
        token,
      );

      // 3. Submit Vendor KYB Verification Dossier into Review Queue
      try {
        await submitVendorVerification(
          vendorResult.id,
          {
            workflowType: "MANUAL_ADMIN",
            notes: "Self-service onboarding application",
          },
          token,
        );
      } catch (verificationErr) {
        console.warn(
          "Non-fatal verification queue submission warning:",
          verificationErr,
        );
      }

      setCreatedSlug(sellerResult.store?.slug || slug);
      setStep(3);
      toast.success("Merchant application submitted successfully!");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to submit registration. Please check input.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0b0f19] text-neutral-900 dark:text-neutral-100 pb-20">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-[#0b0f19] py-16 sm:py-24 text-white">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-6 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Larekmart Merchant Partner Network
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Sell to Millions of Shoppers.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Grow Without Limits.
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto">
            Open your digital storefront on Larekmart. Take advantage of
            automated KYB verification, multi-carrier shipping labels, and
            real-time sales analytics.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mt-12 text-left">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="text-2xl font-black text-indigo-400">0%</div>
              <div className="text-xs text-neutral-300 mt-0.5">
                Listing fees to start
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="text-2xl font-black text-purple-400">2M+</div>
              <div className="text-xs text-neutral-300 mt-0.5">
                Active shoppers
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="text-2xl font-black text-pink-400">Daily</div>
              <div className="text-xs text-neutral-300 mt-0.5">
                Automated payouts
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="text-2xl font-black text-emerald-400">24/7</div>
              <div className="text-xs text-neutral-300 mt-0.5">
                Seller protection
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REGISTRATION & DASHBOARD CONTAINER */}
      <div className="max-w-3xl mx-auto px-4 -mt-8 relative z-10">
        {isLoadingAccount || isLoadingSettings ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500 mb-2" />
            <p className="text-sm text-neutral-500">
              Checking marketplace and account status...
            </p>
          </div>
        ) : !isSellerEnabled ? (
          /* FEATURE DISABLED CALLOUT */
          <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">
              Seller & Vendor Operations Paused
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              {maintenanceMessage ||
                "The marketplace seller program is currently paused by platform administrators for scheduled maintenance. Please check back later."}
            </p>

            {existingMerchant && (
              <div className="mt-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-left text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Preserved Merchant Account
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Paused
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Store Name:</span>
                  <span className="font-semibold">
                    {existingMerchant.storeName || "Pending Storefront"}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Your store and organization records remain safely preserved in
                  our system and will automatically reactivate once the program
                  resumes.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-semibold text-sm transition-colors"
              >
                Return to Homepage
              </Link>
            </div>
          </div>
        ) : !isSellerRegistrationOpen && !existingMerchant && !userIsSeller ? (
          /* REGISTRATION PAUSED CALLOUT */
          <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">
              New Merchant Onboarding Temporarily Paused
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              We are currently not accepting new merchant applications while we
              upgrade marketplace systems. Existing verified sellers can still
              access their store management portals.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 font-semibold text-sm transition-colors"
              >
                Return to Storefront
              </Link>
            </div>
          </div>
        ) : !isSignedIn ? (
          /* NOT SIGNED IN CALLOUT */
          <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold">
              Sign In to Register Your Business
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              Your merchant storefront will be securely linked to your
              authenticated Clerk identity. Sign in or create a free account to
              begin.
            </p>
            <div className="pt-2">
              <Link
                href="/sign-in?redirect_url=/become-a-seller"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20"
              >
                Sign In to Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : existingMerchant ? (
          /* ALREADY REGISTERED STATUS */
          <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  You are a Registered Merchant
                </h2>
                <p className="text-xs text-neutral-500">
                  {existingMerchant.vendorName || "Merchant Organization"}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Store Name:</span>
                <span className="font-semibold">
                  {existingMerchant.storeName || "Pending Storefront"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Account Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                  {existingMerchant.status}
                </span>
              </div>
              {existingMerchant.storeSlug && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Public Storefront:</span>
                  <Link
                    href={`/stores/${existingMerchant.storeSlug}`}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-xs"
                  >
                    /stores/{existingMerchant.storeSlug}
                  </Link>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {existingMerchant.storeSlug && (
                <Link
                  href={`/stores/${existingMerchant.storeSlug}`}
                  className="flex-1 text-center py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                >
                  View My Public Storefront
                </Link>
              )}
              <Link
                href="/products"
                className="flex-1 text-center py-2.5 px-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-semibold transition-colors"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        ) : (
          /* MULTI-STEP ONBOARDING FORM */
          <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 sm:p-10">
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= 1
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400"
                  }`}
                >
                  1
                </div>
                <span className="text-xs sm:text-sm font-medium">
                  Business Identity (KYB)
                </span>
              </div>

              <div className="h-0.5 w-8 bg-neutral-200 dark:bg-neutral-800" />

              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= 2
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400"
                  }`}
                >
                  2
                </div>
                <span className="text-xs sm:text-sm font-medium">
                  Storefront Profile
                </span>
              </div>

              <div className="h-0.5 w-8 bg-neutral-200 dark:bg-neutral-800" />

              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === 3
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400"
                  }`}
                >
                  3
                </div>
                <span className="text-xs sm:text-sm font-medium">
                  Confirmation
                </span>
              </div>
            </div>

            {userIsSeller ? (
              <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Authoritative Seller Privilege Verified
                    </h3>
                    <p className="mt-0.5 text-xs text-emerald-700/90 dark:text-emerald-400/90">
                      Your database user account has active seller credentials (
                      <code className="font-mono bg-emerald-500/10 px-1 py-0.5 rounded">
                        isSeller: true
                      </code>
                      ). You are fully authorized to operate marketplace
                      storefronts, manage policies, and sell products.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-200">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                      Seller Qualification Requirement
                    </h3>
                    <p className="mt-0.5 text-xs text-blue-700/90 dark:text-blue-400/90">
                      Your current customer profile has not yet been designated
                      with seller credentials (
                      <code className="font-mono bg-blue-500/10 px-1 py-0.5 rounded">
                        isSeller: true
                      </code>
                      ). You may prepare your business registration below;
                      server approval and merchant activation will be granted
                      following Super Admin or automated KYB compliance review.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: LEGAL BUSINESS ENTITY */}
            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !legalName ||
                    !registrationNumber ||
                    !taxIdentifier ||
                    !businessEmail
                  ) {
                    toast.error("Please fill in all required business fields");
                    return;
                  }
                  setStep(2);
                }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                    Legal Organization Details
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Required for merchant compliance, KYB verification, and
                    lawful tax reporting.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Legal Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Global Trading LLC"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Trade Name / DBA (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Direct"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Organization Type *
                    </label>
                    <select
                      value={organizationType}
                      onChange={(e) =>
                        setOrganizationType(e.target.value as OrganizationType)
                      }
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="LLC">
                        Limited Liability Company (LLC)
                      </option>
                      <option value="CORPORATION">
                        Corporation (Inc / Corp)
                      </option>
                      <option value="SOLE_PROPRIETORSHIP">
                        Sole Proprietorship
                      </option>
                      <option value="PARTNERSHIP">Partnership</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Company Registration Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. REG-892349"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Tax Identifier / EIN / VAT *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TAX-99214"
                      value={taxIdentifier}
                      onChange={(e) => setTaxIdentifier(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Country of Operation *
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="US">United States (US)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="CA">Canada (CA)</option>
                      <option value="PK">Pakistan (PK)</option>
                      <option value="DE">Germany (DE)</option>
                      <option value="AE">United Arab Emirates (AE)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Authorized Representative *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={representativeName}
                      onChange={(e) => setRepresentativeName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Official Business Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="contact@business.com"
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Official Business Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+1 (555) 000-0000"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    Next: Storefront Setup{" "}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: STOREFRONT SETUP */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Store className="h-5 w-5 text-indigo-500" />
                    Public Storefront Profile
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    This is how customers will discover your brand, catalog, and
                    policies.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Storefront Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Tech Essentials"
                      value={storeName}
                      onChange={(e) => handleStoreNameChange(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Public Storefront URL Slug *
                    </label>
                    <div className="flex items-center mt-1">
                      <span className="px-3 py-2 text-xs font-mono bg-neutral-100 dark:bg-neutral-800 border border-r-0 border-neutral-300 dark:border-neutral-700 rounded-l-lg text-neutral-500">
                        larekmart.com/stores/
                      </span>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) =>
                          setSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          )
                        }
                        className="flex-1 px-3 py-2 text-sm font-mono rounded-r-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Store Headline / Tagline
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Premier supplier of smart electronics & accessories"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      About Your Store (Bio)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe your brand, specialty, and customer support standards..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Primary Store Currency
                    </label>
                    <select
                      value={primaryCurrency}
                      onChange={(e) => setPrimaryCurrency(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="PKR">PKR (Rs) - Pakistani Rupee</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Back to Business Details
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Merchant Account...
                      </>
                    ) : (
                      <>
                        Submit Application{" "}
                        <ShieldCheck className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SUCCESS CONFIRMATION */}
            {step === 3 && (
              <div className="text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
                  Welcome to Larekmart!
                </h2>

                <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-md mx-auto">
                  Your merchant profile and legal entity have been created and
                  queued for KYB compliance review.
                </p>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs text-left max-w-md mx-auto space-y-2 mt-4">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Store Name:</span>
                    <span className="font-semibold">{storeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">
                      Verification Status:
                    </span>
                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Under Review
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Storefront URL:</span>
                    <span className="font-mono text-indigo-500">
                      /stores/{createdSlug}
                    </span>
                  </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                  <Link
                    href={`/stores/${createdSlug}`}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    View Storefront Preview
                  </Link>
                  <Link
                    href="/products"
                    className="flex-1 py-3 px-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-semibold text-sm transition-colors"
                  >
                    Return to Shopping
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
