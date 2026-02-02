import RequireAdmin from "@/components/auth/RequireAdmin";
import AdminHome from "../page"; // OR your dashboard component

export default function Page() {
  return (
    <RequireAdmin>
      <AdminHome />
    </RequireAdmin>
  );
}
