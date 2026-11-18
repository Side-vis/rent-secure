import { Suspense } from "react";
import LandlordsList from "@/components/admin/LandlordsList";

export default function AdminLandlordsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-300">
            Loading landlords...
          </div>
        }
      >
        <LandlordsList />
      </Suspense>
    </div>
  );
}
