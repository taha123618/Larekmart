"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  User as UserIcon,
  MapPin,
  Bell,
  Shield,
  Plus,
  Trash2,
  CheckCircle,
  Home,
  Briefcase,
  Mail,
  Smartphone,
  Globe,
  DollarSign,
  Loader2,
} from "lucide-react";
import {
  fetchCurrentUser,
  updateUserProfile,
  fetchUserAddresses,
  createUserAddress,
  deleteUserAddress,
  updateUserPreferences,
  updateUserSettings,
} from "@/services/user.service";
import { uploadAvatar, resolveMediaUrls } from "@/services/media.service";
import type {
  UserDetailResponse,
  AddressResponse,
  CreateAddressInput,
  UpdateProfileInput,
  UpdatePreferencesInput,
  UpdateSettingsInput,
} from "@repo/types";

export default function AccountPage(): React.JSX.Element {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "profile" | "addresses" | "preferences" | "settings"
  >("profile");

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserDetailResponse | null>(null);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);

  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");

  // Address modal/form state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddressLine1, setNewAddressLine1] = useState("");
  const [newAddressLine2, setNewAddressLine2] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const newCountry = "PK";
  const [newAddressType, setNewAddressType] = useState<
    "SHIPPING" | "BILLING" | "BOTH"
  >("SHIPPING");
  const [newIsDefault, setNewIsDefault] = useState(false);

  // Preferences state
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");
  const [marketingEmail, setMarketingEmail] = useState(true);
  const [marketingSms, setMarketingSms] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [productRecommendations, setProductRecommendations] = useState(true);

  // Settings state
  const [twoFactorPrompt, setTwoFactorPrompt] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<
    "public" | "private" | "contacts"
  >("public");
  const [orderUpdatesEmail, setOrderUpdatesEmail] = useState(true);
  const [orderUpdatesSms, setOrderUpdatesSms] = useState(true);

  // Avatar state: media reference (media:<uuid>) wins over legacy avatarUrl.
  const [avatarMediaId, setAvatarMediaId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [isSaving, startSaving] = useTransition();

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const [userRes, addrRes] = await Promise.all([
        fetchCurrentUser(token),
        fetchUserAddresses(token),
      ]);

      if (userRes) {
        setUserData(userRes);
        if (userRes.profile) {
          setFirstName(userRes.profile.firstName || "");
          setLastName(userRes.profile.lastName || "");
          setDisplayName(userRes.profile.displayName || "");
          setBio(userRes.profile.bio || "");
          setGender(userRes.profile.gender || "");
          setAvatarMediaId(userRes.profile.avatarMediaId || null);
          setAvatarUrl(userRes.profile.avatarUrl || null);
        } else {
          setFirstName(clerkUser?.firstName || "");
          setLastName(clerkUser?.lastName || "");
          setDisplayName(clerkUser?.fullName || "");
        }

        if (userRes.preferences) {
          setPreferredLanguage(userRes.preferences.preferredLanguage || "en");
          setCurrency(userRes.preferences.currency || "USD");
          setMarketingEmail(userRes.preferences.marketingEmail ?? true);
          setMarketingSms(userRes.preferences.marketingSms ?? false);
          setPushNotifications(userRes.preferences.pushNotifications ?? true);
          setProductRecommendations(
            userRes.preferences.productRecommendations ?? true,
          );
        }

        if (userRes.settings) {
          setTwoFactorPrompt(userRes.settings.twoFactorPrompt ?? false);
          setProfileVisibility(
            (userRes.settings.profileVisibility as
              | "public"
              | "private"
              | "contacts") || "public",
          );
          setOrderUpdatesEmail(userRes.settings.orderUpdatesEmail ?? true);
          setOrderUpdatesSms(userRes.settings.orderUpdatesSms ?? true);
        }
      }

      setAddresses(addrRes);
    } catch (err) {
      console.error("Failed to load user data:", err);
      toast.error("Unable to load profile data");
    } finally {
      setLoading(false);
    }
  }, [getToken, clerkUser]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
      return;
    }

    if (isSignedIn) {
      loadUserData();
    }
  }, [isLoaded, isSignedIn, loadUserData, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const payload: UpdateProfileInput = {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          gender: gender.trim() || undefined,
        };

        await updateUserProfile(token, payload);
        toast.success("Profile updated successfully!");
        await loadUserData();
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update profile",
        );
      }
    });
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientName || !newPhone || !newAddressLine1 || !newCity) {
      toast.warn("Please fill in all required address fields");
      return;
    }

    startSaving(async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const payload: CreateAddressInput = {
          recipientName: newRecipientName.trim(),
          phone: newPhone.trim(),
          addressLine1: newAddressLine1.trim(),
          addressLine2: newAddressLine2.trim() || undefined,
          city: newCity.trim(),
          state: newState.trim() || "Province",
          postalCode: newPostalCode.trim() || "00000",
          country: newCountry.trim() || "PK",
          type: newAddressType,
          isDefault: newIsDefault,
        };

        await createUserAddress(token, payload);
        toast.success("Address added successfully!");
        setShowAddressModal(false);
        // Reset form
        setNewRecipientName("");
        setNewPhone("");
        setNewAddressLine1("");
        setNewAddressLine2("");
        setNewCity("");
        setNewState("");
        setNewPostalCode("");
        setNewIsDefault(false);
        await loadUserData();
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save address",
        );
      }
    });
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await deleteUserAddress(token, addressId);
      toast.success("Address deleted");
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    } catch {
      toast.error("Failed to delete address");
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const payload: UpdatePreferencesInput = {
          preferredLanguage,
          currency,
          marketingEmail,
          marketingSms,
          pushNotifications,
          productRecommendations,
        };

        await updateUserPreferences(token, payload);
        toast.success("Preferences updated!");
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update preferences",
        );
      }
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const payload: UpdateSettingsInput = {
          twoFactorPrompt,
          profileVisibility,
          orderUpdatesEmail,
          orderUpdatesSms,
        };

        await updateUserSettings(token, payload);
        toast.success("Settings updated!");
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update settings",
        );
      }
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side pre-checks; media-service re-validates everything.
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar must be under 2MB");
      e.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP avatars are supported");
      e.target.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      const token = await getToken();
      if (!token) return;

      // Owner = this user's verified Clerk id (media-service authorizes
      // user-owned media against the session identity).
      const ownerId = clerkUser?.id;
      if (!ownerId) throw new Error("User identity unavailable");

      const { mediaId } = await uploadAvatar(file, ownerId, getToken);

      // Persist the reference on the profile; user-service announces
      // user.avatar_uploaded and media-service claims ownership.
      await updateUserProfile(token, {
        avatarMediaId: mediaId,
      } as UpdateProfileInput);

      // Resolve immediately (the 256px avatar variant may still be processing;
      // resolution returns null then and the fallback initials render).
      const resolved = await resolveMediaUrls([mediaId]);
      setAvatarMediaId(mediaId);
      setAvatarUrl(resolved[mediaId] ?? null);
      toast.success("Avatar uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Avatar upload failed");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        <p className="text-sm text-gray-500">Loading your account details...</p>
      </div>
    );
  }

  const userInitial =
    firstName?.[0] ||
    clerkUser?.firstName?.[0] ||
    clerkUser?.emailAddresses?.[0]?.emailAddress?.[0] ||
    "U";

  return (
    <div className="py-8 px-4 sm:px-6 max-w-5xl mx-auto">
      {/* Top Profile Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 dark:from-[#0b0f19] dark:via-indigo-950/60 dark:to-[#080c14] border border-indigo-500/30 text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
        <div className="relative">
          {avatarMediaId ? (
            <AvatarMediaImage
              mediaRef={avatarMediaId}
              fallbackUrl={avatarUrl}
              userInitial={userInitial.toUpperCase()}
            />
          ) : clerkUser?.imageUrl ? (
            <Image
              src={clerkUser.imageUrl}
              alt="Avatar"
              width={96}
              height={96}
              unoptimized
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/20 object-cover shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white/20">
              {userInitial.toUpperCase()}
            </div>
          )}
          <label
            className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center cursor-pointer border-2 border-slate-900 transition-colors ${
              avatarUploading ? "opacity-60 pointer-events-none" : ""
            }`}
            title="Upload new avatar"
          >
            {avatarUploading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={avatarUploading}
            />
          </label>
        </div>

        <div className="text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {displayName ||
                `${firstName} ${lastName}`.trim() ||
                clerkUser?.fullName ||
                "Valued Customer"}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-max mx-auto sm:mx-0">
              {userData?.status || "ACTIVE"}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="w-4 h-4 text-gray-400" />
            {userData?.email || clerkUser?.emailAddresses?.[0]?.emailAddress}
          </p>
          {bio && (
            <p className="text-xs text-gray-300 mt-2 max-w-xl italic">
              &ldquo;{bio}&rdquo;
            </p>
          )}

          {/* Quick Account Badges */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-gray-200 border border-white/10 font-medium">
              {addresses.length} Saved{" "}
              {addresses.length === 1 ? "Address" : "Addresses"}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-gray-200 border border-white/10 font-medium">
              Currency: {currency}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-gray-200 border border-white/10 font-medium">
              Language: {preferredLanguage.toUpperCase()}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
              Verified Shopper
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-800 mb-8 gap-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "profile"
              ? "border-black dark:border-white text-black dark:text-white font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <UserIcon className="w-4 h-4" />
          Profile
        </button>

        <button
          onClick={() => setActiveTab("addresses")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "addresses"
              ? "border-black dark:border-white text-black dark:text-white font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Saved Addresses ({addresses.length})
        </button>

        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "preferences"
              ? "border-black dark:border-white text-black dark:text-white font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Bell className="w-4 h-4" />
          Preferences
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "settings"
              ? "border-black dark:border-white text-black dark:text-white font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          <Shield className="w-4 h-4" />
          Security & Privacy
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Personal Profile
            </h2>
            <p className="text-sm text-gray-500">
              Manage your identity and customer details
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="First Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="Last Name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Display Name (Nickname)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                placeholder="How your name appears in store"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email (Managed by Clerk)
                </label>
                <input
                  type="text"
                  disabled
                  value={userData?.email || ""}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-gray-400 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Bio / Notes
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                placeholder="Tell us a bit about your style preferences..."
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Addresses */}
      {activeTab === "addresses" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Shipping & Delivery Addresses
              </h2>
              <p className="text-sm text-gray-500">
                Fast-track your checkout with pre-saved addresses
              </p>
            </div>
            <button
              onClick={() => setShowAddressModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-semibold hover:opacity-90 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Address
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                No addresses saved yet
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Add your home or office address to save time during checkout.
              </p>
              <button
                onClick={() => setShowAddressModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Your First Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-5 rounded-xl border transition-all ${
                    addr.isDefault
                      ? "border-black dark:border-white bg-gray-50/50 dark:bg-zinc-800/40 shadow-sm"
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-md">
                        {addr.type === "SHIPPING" ? (
                          <Home className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        ) : (
                          <Briefcase className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        )}
                      </span>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {addr.recipientName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle className="w-3 h-3" />
                          Default
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-md"
                        title="Delete Address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                    <p className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      {addr.phone}
                    </p>
                    <p>{addr.addressLine1}</p>
                    {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                    <p>
                      {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {addr.country}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Address Modal */}
          {showAddressModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Add Delivery Address
                  </h3>
                  <button
                    onClick={() => setShowAddressModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleCreateAddress} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Recipient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="e.g. +92 300 1234567"
                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Address Type
                      </label>
                      <select
                        value={newAddressType}
                        onChange={(e) =>
                          setNewAddressType(
                            e.target.value as "SHIPPING" | "BILLING" | "BOTH",
                          )
                        }
                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      >
                        <option value="SHIPPING">Shipping</option>
                        <option value="BILLING">Billing</option>
                        <option value="BOTH">Both</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddressLine1}
                      onChange={(e) => setNewAddressLine1(e.target.value)}
                      placeholder="House / Flat / Street # / Area"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Apartment / Suite (Optional)
                    </label>
                    <input
                      type="text"
                      value={newAddressLine2}
                      onChange={(e) => setNewAddressLine2(e.target.value)}
                      placeholder="Apt 4B"
                      className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        placeholder="Lahore / Karachi"
                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        State/Province
                      </label>
                      <input
                        type="text"
                        value={newState}
                        onChange={(e) => setNewState(e.target.value)}
                        placeholder="Punjab"
                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={newPostalCode}
                        onChange={(e) => setNewPostalCode(e.target.value)}
                        placeholder="54000"
                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={newIsDefault}
                      onChange={(e) => setNewIsDefault(e.target.checked)}
                      className="rounded border-gray-300 text-black focus:ring-black dark:focus:ring-white"
                    />
                    <label
                      htmlFor="isDefault"
                      className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                    >
                      Make this my default delivery address
                    </label>
                  </div>

                  <div className="pt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(false)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-50"
                    >
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Address
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Preferences */}
      {activeTab === "preferences" && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Store Preferences & Alerts
            </h2>
            <p className="text-sm text-gray-500">
              Customize how and when you receive discounts and updates
            </p>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  Preferred Language
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="en">English (US)</option>
                  <option value="ur">Urdu (اردو)</option>
                  <option value="es">Spanish (Español)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Display Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="PKR">PKR (₨)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Marketing & Recommendations
              </h3>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Email Newsletters
                  </p>
                  <p className="text-xs text-gray-500">
                    Get early access to drops, sales, and seasonal fashion
                    alerts
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketingEmail}
                  onChange={(e) => setMarketingEmail(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-black w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    SMS Promotions
                  </p>
                  <p className="text-xs text-gray-500">
                    Receive flash coupons and rapid delivery alerts via text
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketingSms}
                  onChange={(e) => setMarketingSms(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-black w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Personalized Recommendations
                  </p>
                  <p className="text-xs text-gray-500">
                    AI-curated style suggestions based on your shopping tastes
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={productRecommendations}
                  onChange={(e) => setProductRecommendations(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-black w-4 h-4"
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Settings & Privacy */}
      {activeTab === "settings" && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Security & Order Alerts
            </h2>
            <p className="text-sm text-gray-500">
              Configure notifications and privacy boundaries
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Order Updates
              </h3>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Email Order Status
                  </p>
                  <p className="text-xs text-gray-500">
                    Confirmations, shipment tracking and invoices
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={orderUpdatesEmail}
                  onChange={(e) => setOrderUpdatesEmail(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-black w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    SMS Courier Dispatch
                  </p>
                  <p className="text-xs text-gray-500">
                    Real-time driver updates on delivery day
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={orderUpdatesSms}
                  onChange={(e) => setOrderUpdatesSms(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-black w-4 h-4"
                />
              </label>
            </div>

            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Privacy & Visibility
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Controls whether community reviews show your profile
              </p>
              <select
                value={profileVisibility}
                onChange={(e) =>
                  setProfileVisibility(
                    e.target.value as "public" | "private" | "contacts",
                  )
                }
                className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              >
                <option value="public">
                  Public (Display name & avatar shown on reviews)
                </option>
                <option value="private">
                  Private (Anonymous buyer on reviews)
                </option>
              </select>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Security Settings
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * Avatar renderer for media references: resolves `media:<uuid>` via
 * media-service (session-memoized), falling back to the legacy avatarUrl,
 * then to the initial letter. Used on the account page banner.
 */
function AvatarMediaImage({
  mediaRef,
  fallbackUrl,
  userInitial,
}: {
  mediaRef: string;
  fallbackUrl: string | null;
  userInitial: string;
}) {
  const [url, setUrl] = useState<string | null>(fallbackUrl);

  useEffect(() => {
    let cancelled = false;
    resolveMediaUrls([mediaRef]).then((items) => {
      if (!cancelled) {
        setUrl(items[mediaRef] ?? fallbackUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mediaRef, fallbackUrl]);

  if (!url) {
    return (
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white/20">
        {userInitial}
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt="Avatar"
      width={96}
      height={96}
      unoptimized
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/20 object-cover shadow-lg"
    />
  );
}
