"use client";

import { UserButton } from "@clerk/nextjs";
import { ShoppingBag, User } from "lucide-react";
import { useRouter } from "next/navigation";

const ProfileButton = () => {
  const router = useRouter();
  return (
    <UserButton>
      <UserButton.MenuItems>
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
      </UserButton.MenuItems>
    </UserButton>
  );
};

export default ProfileButton;
