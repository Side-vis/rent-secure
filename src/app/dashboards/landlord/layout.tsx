import LandlordNav from "@/components/landlord/LandlordNav";

export default function LandlordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8">
      <LandlordNav />
      {children}
    </div>
  );
}
