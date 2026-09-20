import { EmployeeDetail } from "@/components/admin/employee-detail";

type EmployeeDetailPageProps = { params: Promise<{ id: string }> };

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { id } = await params;
  return <EmployeeDetail employeeId={id} />;
}
