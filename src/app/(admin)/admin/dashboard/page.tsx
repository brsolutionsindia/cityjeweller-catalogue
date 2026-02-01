import RequireAdmin from "@/components/auth/RequireAdmin";

export default function Page() {
  return (
    <RequireAdmin>
      {/* admin dashboard UI */}
    </RequireAdmin>
  );
}
