"use client";

import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { updateAdminUserStatus } from "@/services/user.service";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: "Full name must be at least 2 characters!" })
    .max(100),
  email: z.string().email({ message: "Invalid email address!" }),
  phone: z.string().optional(),
  status: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "DEACTIVATED",
    "PENDING_VERIFICATION",
  ]),
});

export interface EditUserProps {
  userId?: string;
  initialStatus?:
    | "ACTIVE"
    | "SUSPENDED"
    | "DEACTIVATED"
    | "PENDING_VERIFICATION";
  fullName?: string;
  email?: string;
  phone?: string;
}

const EditUser = ({
  userId,
  initialStatus = "ACTIVE",
  fullName = "",
  email = "",
  phone = "",
}: EditUserProps) => {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: fullName || "Customer",
      email: email || "",
      phone: phone || "",
      status: initialStatus,
    },
  });

  useEffect(() => {
    form.reset({
      fullName: fullName || "Customer",
      email: email || "",
      phone: phone || "",
      status: initialStatus,
    });
  }, [userId, initialStatus, fullName, email, phone, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userId) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available");

      const ok = await updateAdminUserStatus(token, userId, values.status);
      if (ok) {
        setSuccessMsg(`User status updated to ${values.status}!`);
        router.refresh();
      } else {
        setErrorMsg("Failed to update user status in user-service");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle className="mb-4">Edit Customer Record</SheetTitle>
        <SheetDescription asChild>
          <div>
            {successMsg && (
              <div className="p-3 mb-4 rounded bg-emerald-100 text-emerald-900 text-xs font-semibold">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 mb-4 rounded bg-red-100 text-red-900 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormDescription>Customer name</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormDescription>
                        Verified primary email address
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Account Status (User Service Domain)
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">
                            ACTIVE (Normal customer access)
                          </SelectItem>
                          <SelectItem value="SUSPENDED">
                            SUSPENDED (Restricted access)
                          </SelectItem>
                          <SelectItem value="DEACTIVATED">
                            DEACTIVATED (Account closed)
                          </SelectItem>
                          <SelectItem value="PENDING_VERIFICATION">
                            PENDING_VERIFICATION
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Directly controls customer status in user-service
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Status
                </Button>
              </form>
            </Form>
          </div>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  );
};

export default EditUser;
