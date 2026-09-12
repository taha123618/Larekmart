import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "./SearchBar";
import { Home } from "lucide-react";
import NotificationBell from "./NotificationBell";
import ShoppingCartIcon from "./ShoppingCartIcon";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import ProfileButton from "./ProfileButton";

const Navbar = () => {
  return (
    <nav className="w-full flex items-center justify-between border-b border-gray-200 pb-4">
      {/* LEFT */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logo.png"
          alt="Larekmart"
          width={36}
          height={36}
          className="w-6 h-6 md:w-9 md:h-9"
        />
        <p className="hidden md:block text-md font-medium tracking-wider">
          LAREKMART.
        </p>
      </Link>
      {/* RIGHT */}
      <div className="flex items-center gap-6">
        <Suspense fallback={<div className="w-40" />}>
          <SearchBar />
        </Suspense>
        <Link href="/">
          <Home className="w-4 h-4 text-gray-600" />
        </Link>
        <NotificationBell />
        <ShoppingCartIcon />
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <ProfileButton />
        </SignedIn>
      </div>
    </nav>
  );
};

export default Navbar;
