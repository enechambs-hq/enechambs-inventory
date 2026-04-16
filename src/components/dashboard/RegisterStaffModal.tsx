"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { UserRole, RegisterStaffDto } from "@/types";
import { authService } from "@/lib/services/auth.service";

const schema = z.object({
  email: z.email("Invalid email address"),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  role: z.enum([UserRole.ADMIN, UserRole.STAFF]),
});

type FormValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RegisterStaffModal({ open, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: UserRole.STAFF },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: RegisterStaffDto) => {
    try {
      setIsSubmitting(true);
      await authService.registerStaff(data);
      toast.success(`Staff account created. A setup email has been sent to ${data.email}.`);
      handleClose();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || "Failed to register staff";
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="relative bg-card rounded-xl border p-6 w-full max-w-md animate-in zoom-in-95 fade-in duration-300">
        {isSubmitting && (
          <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm font-medium">Registering staff...</span>
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-1">Register Staff</h2>
        <p className="text-sm text-muted-foreground mb-5">
          A setup email will be sent to the provided address.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              {...register("email")}
              type="email"
              placeholder="staff@example.com"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">First Name</label>
              <input
                {...register("firstName")}
                type="text"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Last Name</label>
              <input
                {...register("lastName")}
                type="text"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <select
              {...register("role")}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={UserRole.STAFF}>Staff</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Registering..." : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
