import RequireAdmin from "@/components/auth/RequireAdmin";
import Dashboard from "../page"; // or render dashboard UI here

export default function Page() {
  return (
    <RequireAdmin>
      <div className="p-6">Admin Dashboard</div>
    </RequireAdmin>
  );
}
