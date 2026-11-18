import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8">
      <AdminNav />
      {children}
    </div>
  );
}
