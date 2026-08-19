import { useParams } from "react-router-dom";
import { CheckFormPage } from "@/features/finance/checks/CheckFormPage";

export default function EditCheckPage() {
  const { checkId } = useParams<{ checkId: string }>();
  return <CheckFormPage checkId={checkId} />;
}
