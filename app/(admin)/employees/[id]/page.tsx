import { EmployeeDetail } from "@/components/admin/employee-detail";

export default async function EmployeeDetailPage({ params }: PageProps<"/employees/[id]">) {
  const { id } = await params;
  return <EmployeeDetail employeeId={id} />;
}
