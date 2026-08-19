import { useParams } from "react-router-dom";
import { CheckDetailPage as CheckDetailView } from "@/features/finance/checks/CheckDetailPage";

export default function CheckDetailPage() {
  const { checkId } = useParams<{ checkId: string }>();
  return <CheckDetailView checkId={checkId} />;
}
