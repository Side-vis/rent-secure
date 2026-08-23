import LandlordDetailViewer from "@/components/admin/LandlordDetailViewer";

type LandlordDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LandlordDetailPage({
  params,
}: LandlordDetailPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LandlordDetailViewer userId={id} />
    </div>
  );
}
