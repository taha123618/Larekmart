"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { ShoppingBag, User, RotateCcw, Store } from "lucide-react";
import { useRouter } from "next/navigation";

const ProfileButton = () => {
  const router = useRouter();
  const { user } = useUser();

  const isSeller = Boolean(
    user?.publicMetadata?.isSeller ||
      user?.unsafeMetadata?.isSeller ||
      user?.publicMetadata?.role === "seller",
  );

  return (
    <UserButton>
      <UserButton.MenuItems>
        {isSeller ? (
          <UserButton.Action
            label="Seller Portal"
            labelIcon={<Store className="w-4 h-4 text-emerald-500" />}
            onClick={() => router.push("/become-a-seller")}
          />
        ) : (
          <UserButton.Action
            label="Become a Seller"
            labelIcon={<Store className="w-4 h-4 text-indigo-500" />}
            onClick={() => router.push("/become-a-seller")}
          />
        )}
        <UserButton.Action
          label="Account & Addresses"
          labelIcon={<User className="w-4 h-4" />}
          onClick={() => router.push("/account")}
        />
        <UserButton.Action
          label="See Orders"
          labelIcon={<ShoppingBag className="w-4 h-4" />}
          onClick={() => router.push("/orders")}
        />
        <UserButton.Action
          label="My Returns & Refunds"
          labelIcon={<RotateCcw className="w-4 h-4" />}
          onClick={() => router.push("/account/returns")}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
};

export default ProfileButton;
