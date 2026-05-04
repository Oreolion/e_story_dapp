import { BrandedLoader } from "@/components/ui/branded-loader";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <BrandedLoader size="md" message="Loading..." />
    </div>
  );
}
