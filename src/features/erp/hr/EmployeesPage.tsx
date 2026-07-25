import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import {
  createEmployee,
  createEmployeeTimeEntry,
  createHRDepartment,
  createHRLeaveRequest,
  createHROnboardingTask,
  createHRPosition,
  createHRRecruitmentCandidate,
  listEmployees,
  listEmployeeTimeEntries,
  listERPUsers,
  listHRDepartments,
  listHRLeaveRequests,
  listHROnboardingTasks,
  listHRPositions,
  listHRRecruitmentCandidates,
  updateEmployee,
  updateHRDepartment,
  updateHRLeaveRequest,
  updateHROnboardingTask,
  updateHRPosition,
  updateHRRecruitmentCandidate,
} from "../shared/erpApi";
import { formatDate, formatNumber } from "../shared/formatters";
import {
  Employee,
  EmployeeStatus,
  EmployeeTimeEntry,
  ERPUser,
  HRDepartment,
  HRLeaveRequest,
  HROnboardingTask,
  HRPosition,
  HRRecruitmentCandidate,
  LeaveRequestStatus,
  OnboardingTaskStatus,
  RecruitmentStatus,
} from "../shared/types";

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Aktif",
  inactive: "Pasif",
  on_leave: "İzinde",
  terminated: "Ayrıldı",
  candidate: "Aday",
};

const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  draft: "Taslak",
  pending: "Onay Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  cancelled: "İptal",
};

const RECRUITMENT_STATUS_LABELS: Record<RecruitmentStatus, string> = {
  new: "Yeni",
  screening: "Ön Değerlendirme",
  interview: "Görüşme",
  offer: "Teklif",
  hired: "İşe Alındı",
  rejected: "Reddedildi",
};

const ONBOARDING_STATUS_LABELS: Record<OnboardingTaskStatus, string> = {
  open: "Açık",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

function statusTone(status: string) {
  if (["active", "approved", "hired", "completed"].includes(status)) return "success" as const;
  if (["pending", "screening", "interview", "offer", "in_progress", "on_leave"].includes(status)) return "warning" as const;
  if (["terminated", "rejected", "cancelled"].includes(status)) return "danger" as const;
  return "default" as const;
}

function optionLabel<T extends { id: string }>(rows: T[], id: string | null | undefined, getter: (row: T) => string) {
  if (!id) return "-";
  return rows.find((row) => row.id === id) ? getter(rows.find((row) => row.id === id) as T) : "-";
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<HRDepartment[]>([]);
  const [positions, setPositions] = useState<HRPosition[]>([]);
  const [timeEntries, setTimeEntries] = useState<EmployeeTimeEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<HRLeaveRequest[]>([]);
  const [candidates, setCandidates] = useState<HRRecruitmentCandidate[]>([]);
  const [onboardingTasks, setOnboardingTasks] = useState<HROnboardingTask[]>([]);
  const [erpUsers, setErpUsers] = useState<ERPUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeForm, setEmployeeForm] = useState({ employee_no: "", full_name: "", role: "", department_id: "", position_id: "", manager_employee_id: "", erp_user_id: "", phone: "", email: "", hire_date: "" });
  const [departmentForm, setDepartmentForm] = useState({ name: "", code: "", manager_employee_id: "", parent_department_id: "", notes: "" });
  const [positionForm, setPositionForm] = useState({ title: "", code: "", department_id: "", reports_to_position_id: "", notes: "" });
  const [attendanceForm, setAttendanceForm] = useState({ employee_id: "", work_date: new Date().toISOString().slice(0, 10), regular_hours: "8", overtime_hours: "0", notes: "" });
  const [leaveForm, setLeaveForm] = useState({ employee_id: "", leave_type: "Yıllık İzin", start_date: "", end_date: "", approver_employee_id: "", notes: "" });
  const [candidateForm, setCandidateForm] = useState({ full_name: "", email: "", phone: "", department_id: "", position_id: "", source: "", notes: "" });
  const [onboardingForm, setOnboardingForm] = useState({ title: "", employee_id: "", candidate_id: "", responsible_employee_id: "", due_date: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const [employeeResult, departmentResult, positionResult, timeResult, leaveResult, candidateResult, onboardingResult, erpUserResult] = await Promise.all([
      listEmployees(),
      listHRDepartments(),
      listHRPositions(),
      listEmployeeTimeEntries(),
      listHRLeaveRequests(),
      listHRRecruitmentCandidates(),
      listHROnboardingTasks(),
      listERPUsers(),
    ]);
    const firstError = [employeeResult, departmentResult, positionResult, timeResult, leaveResult, candidateResult, onboardingResult].find((result) => result.error)?.error ?? null;
    setError(firstError);
    if (firstError) toast({ title: "Hata", description: firstError, variant: "destructive" });
    setEmployees(employeeResult.data);
    setDepartments(departmentResult.data);
    setPositions(positionResult.data);
    setTimeEntries(timeResult.data);
    setLeaveRequests(leaveResult.data);
    setCandidates(candidateResult.data);
    setOnboardingTasks(onboardingResult.data);
    setErpUsers(erpUserResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredEmployees = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    return employees.filter((employee) => {
      const departmentName = optionLabel(departments, employee.department_id, (department) => department.name);
      const positionTitle = optionLabel(positions, employee.position_id, (position) => position.title);
      const haystack = [employee.full_name, employee.employee_no, employee.email, employee.phone, employee.department, employee.role, departmentName, positionTitle].join(" ").toLocaleLowerCase("tr-TR");
      const matchesSearch = !needle || haystack.includes(needle);
      const matchesStatus = statusFilter === "all" || (employee.status ?? (employee.is_active ? "active" : "inactive")) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [departments, employees, positions, search, statusFilter]);

  const save = async (action: Promise<{ error: string | null }>, message: string) => {
    const result = await action;
    if (result.error) {
      toast({ title: "Hata", description: result.error, variant: "destructive" });
      return false;
    }
    toast({ title: "Kaydedildi", description: message });
    await load();
    return true;
  };

  const submitEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeForm.full_name.trim()) return;
    const department = departments.find((item) => item.id === employeeForm.department_id);
    const ok = await save(createEmployee({
      ...employeeForm,
      department: department?.name ?? null,
      department_id: employeeForm.department_id || null,
      position_id: employeeForm.position_id || null,
      manager_employee_id: employeeForm.manager_employee_id || null,
      erp_user_id: employeeForm.erp_user_id || null,
      hire_date: employeeForm.hire_date || null,
      status: "active",
    }), "Çalışan kaydı oluşturuldu.");
    if (ok) setEmployeeForm({ employee_no: "", full_name: "", role: "", department_id: "", position_id: "", manager_employee_id: "", erp_user_id: "", phone: "", email: "", hire_date: "" });
  };

  if (loading) {
    return (
      <ERPLayout title="İnsan Kaynakları">
        <p className="text-sm text-muted-foreground">İnsan kaynakları verileri yükleniyor...</p>
      </ERPLayout>
    );
  }

  return (
    <ERPLayout title="İnsan Kaynakları">
      <PageHeader title="İnsan Kaynakları" description="Çalışan, organizasyon, devam, izin, işe alım ve oryantasyon kayıtlarını yönetin." />

      {error ? <MigrationNotice message={error} /> : null}

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="employees">Çalışanlar</TabsTrigger>
          <TabsTrigger value="departments">Departmanlar</TabsTrigger>
          <TabsTrigger value="positions">Pozisyonlar</TabsTrigger>
          <TabsTrigger value="attendance">Devam Takibi</TabsTrigger>
          <TabsTrigger value="leave">İzin Yönetimi</TabsTrigger>
          <TabsTrigger value="recruitment">İşe Alım</TabsTrigger>
          <TabsTrigger value="onboarding">Oryantasyon</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <FormSection title="Yeni Çalışan" description="Çalışan kartı, organizasyon ve kullanıcı bağlantısı temelini oluşturun.">
            <form className="grid gap-3 md:grid-cols-4" onSubmit={submitEmployee}>
              <Input placeholder="Sicil No" value={employeeForm.employee_no} onChange={(event) => setEmployeeForm((current) => ({ ...current, employee_no: event.target.value }))} />
              <Input required placeholder="Ad Soyad *" value={employeeForm.full_name} onChange={(event) => setEmployeeForm((current) => ({ ...current, full_name: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={employeeForm.department_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, department_id: event.target.value }))}>
                <option value="">Departman seçiniz</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={employeeForm.position_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, position_id: event.target.value, role: positions.find((item) => item.id === event.target.value)?.title ?? current.role }))}>
                <option value="">Pozisyon seçiniz</option>
                {positions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={employeeForm.manager_employee_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, manager_employee_id: event.target.value }))}>
                <option value="">Yönetici seçiniz</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={employeeForm.erp_user_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, erp_user_id: event.target.value }))}>
                <option value="">ERP kullanıcısı seçiniz</option>
                {erpUsers.map((erpUser) => <option key={erpUser.id} value={erpUser.id}>{erpUser.full_name || erpUser.email}</option>)}
              </select>
              <Input placeholder="Telefon" value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} />
              <Input type="email" placeholder="E-posta" value={employeeForm.email} onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))} />
              <Input type="date" value={employeeForm.hire_date} onChange={(event) => setEmployeeForm((current) => ({ ...current, hire_date: event.target.value }))} />
              <Button type="submit">Çalışan Ekle</Button>
            </form>
          </FormSection>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input placeholder="Çalışan ara" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tüm Durumlar</option>
              {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {filteredEmployees.length === 0 ? <EmptyState title="Çalışan kaydı yok" description="Yeni çalışan ekleyerek başlayabilirsiniz." /> : (
            <DataTable
              data={filteredEmployees}
              rowKey={(row) => row.id}
              columns={[
                { key: "name", header: "Çalışan", render: (row) => <div><p className="font-medium">{row.full_name}</p><p className="text-xs text-muted-foreground">{row.employee_no || row.email || "-"}</p></div> },
                { key: "department", header: "Departman", render: (row) => optionLabel(departments, row.department_id, (department) => department.name) || row.department || "-" },
                { key: "position", header: "Pozisyon", render: (row) => optionLabel(positions, row.position_id, (position) => position.title) || row.role || "-" },
                { key: "manager", header: "Yönetici", render: (row) => optionLabel(employees, row.manager_employee_id, (employee) => employee.full_name) },
                { key: "user", header: "ERP Kullanıcısı", render: (row) => optionLabel(erpUsers, row.erp_user_id, (erpUser) => erpUser.full_name || erpUser.email) },
                { key: "status", header: "Durum", render: (row) => <StatusBadge label={EMPLOYEE_STATUS_LABELS[row.status ?? (row.is_active ? "active" : "inactive")]} tone={statusTone(row.status ?? (row.is_active ? "active" : "inactive"))} /> },
                {
                  key: "actions",
                  header: "İşlemler",
                  render: (row) => (
                    <select className="h-9 rounded-md border bg-background px-2 text-xs" value={row.status ?? (row.is_active ? "active" : "inactive")} onChange={(event) => save(updateEmployee(row.id, { status: event.target.value as EmployeeStatus, is_active: event.target.value !== "inactive" && event.target.value !== "terminated" }), "Çalışan durumu güncellendi.")}>
                      {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ),
                },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <FormSection title="Yeni Departman" description="Organizasyon birimi ve raporlama temelini oluşturun.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createHRDepartment({ ...departmentForm, manager_employee_id: departmentForm.manager_employee_id || null, parent_department_id: departmentForm.parent_department_id || null }), "Departman oluşturuldu.");
              if (ok) setDepartmentForm({ name: "", code: "", manager_employee_id: "", parent_department_id: "", notes: "" });
            }}>
              <Input required placeholder="Departman adı *" value={departmentForm.name} onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Kod" value={departmentForm.code} onChange={(event) => setDepartmentForm((current) => ({ ...current, code: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={departmentForm.manager_employee_id} onChange={(event) => setDepartmentForm((current) => ({ ...current, manager_employee_id: event.target.value }))}><option value="">Yönetici</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={departmentForm.parent_department_id} onChange={(event) => setDepartmentForm((current) => ({ ...current, parent_department_id: event.target.value }))}><option value="">Üst departman</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
              <Button type="submit">Departman Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={departments} rowKey={(row) => row.id} columns={[
            { key: "name", header: "Departman", render: (row) => row.name },
            { key: "code", header: "Kod", render: (row) => row.code || "-" },
            { key: "manager", header: "Yönetici", render: (row) => optionLabel(employees, row.manager_employee_id, (employee) => employee.full_name) },
            { key: "parent", header: "Üst Departman", render: (row) => optionLabel(departments, row.parent_department_id, (department) => department.name) },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
            { key: "actions", header: "İşlem", render: (row) => <Button variant="outline" size="sm" onClick={() => save(updateHRDepartment(row.id, { is_active: !row.is_active }), "Departman durumu güncellendi.")}>{row.is_active ? "Pasifleştir" : "Aktifleştir"}</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <FormSection title="Yeni Pozisyon" description="Pozisyon, departman ve raporlama ilişkisini tanımlayın.">
            <form className="grid gap-3 md:grid-cols-5" onSubmit={async (event) => {
              event.preventDefault();
              const ok = await save(createHRPosition({ ...positionForm, department_id: positionForm.department_id || null, reports_to_position_id: positionForm.reports_to_position_id || null }), "Pozisyon oluşturuldu.");
              if (ok) setPositionForm({ title: "", code: "", department_id: "", reports_to_position_id: "", notes: "" });
            }}>
              <Input required placeholder="Pozisyon adı *" value={positionForm.title} onChange={(event) => setPositionForm((current) => ({ ...current, title: event.target.value }))} />
              <Input placeholder="Kod" value={positionForm.code} onChange={(event) => setPositionForm((current) => ({ ...current, code: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={positionForm.department_id} onChange={(event) => setPositionForm((current) => ({ ...current, department_id: event.target.value }))}><option value="">Departman</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={positionForm.reports_to_position_id} onChange={(event) => setPositionForm((current) => ({ ...current, reports_to_position_id: event.target.value }))}><option value="">Bağlı pozisyon</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select>
              <Button type="submit">Pozisyon Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={positions} rowKey={(row) => row.id} columns={[
            { key: "title", header: "Pozisyon", render: (row) => row.title },
            { key: "department", header: "Departman", render: (row) => optionLabel(departments, row.department_id, (department) => department.name) },
            { key: "reports", header: "Bağlı Pozisyon", render: (row) => optionLabel(positions, row.reports_to_position_id, (position) => position.title) },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
            { key: "actions", header: "İşlem", render: (row) => <Button variant="outline" size="sm" onClick={() => save(updateHRPosition(row.id, { is_active: !row.is_active }), "Pozisyon durumu güncellendi.")}>{row.is_active ? "Pasifleştir" : "Aktifleştir"}</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <FormSection title="Devam Kaydı" description="Günlük çalışma ve fazla mesai temelini kaydedin.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={async (event) => {
              event.preventDefault();
              if (!attendanceForm.employee_id) return;
              const ok = await save(createEmployeeTimeEntry({ employee_id: attendanceForm.employee_id, work_date: attendanceForm.work_date, regular_hours: Number(attendanceForm.regular_hours || 0), overtime_hours: Number(attendanceForm.overtime_hours || 0), notes: attendanceForm.notes || null }), "Devam kaydı oluşturuldu.");
              if (ok) setAttendanceForm({ employee_id: "", work_date: new Date().toISOString().slice(0, 10), regular_hours: "8", overtime_hours: "0", notes: "" });
            }}>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={attendanceForm.employee_id} onChange={(event) => setAttendanceForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Çalışan</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select>
              <Input type="date" value={attendanceForm.work_date} onChange={(event) => setAttendanceForm((current) => ({ ...current, work_date: event.target.value }))} />
              <Input type="number" step="0.25" value={attendanceForm.regular_hours} onChange={(event) => setAttendanceForm((current) => ({ ...current, regular_hours: event.target.value }))} />
              <Input type="number" step="0.25" value={attendanceForm.overtime_hours} onChange={(event) => setAttendanceForm((current) => ({ ...current, overtime_hours: event.target.value }))} />
              <Input placeholder="Not" value={attendanceForm.notes} onChange={(event) => setAttendanceForm((current) => ({ ...current, notes: event.target.value }))} />
              <Button type="submit">Kaydet</Button>
            </form>
          </FormSection>
          <DataTable data={timeEntries} rowKey={(row) => row.id} columns={[
            { key: "employee", header: "Çalışan", render: (row) => optionLabel(employees, row.employee_id, (employee) => employee.full_name) },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.work_date) },
            { key: "regular", header: "Normal Saat", className: "text-right", render: (row) => formatNumber(row.regular_hours || 0, 2) },
            { key: "overtime", header: "Mesai", className: "text-right", render: (row) => formatNumber(row.overtime_hours || 0, 2) },
            { key: "notes", header: "Not", render: (row) => row.notes || "-" },
          ]} />
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <FormSection title="İzin Talebi" description="Onaya hazır izin talebi kaydı oluşturun.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={async (event) => {
              event.preventDefault();
              if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) return;
              const ok = await save(createHRLeaveRequest({ ...leaveForm, approver_employee_id: leaveForm.approver_employee_id || null, status: "pending" }), "İzin talebi oluşturuldu.");
              if (ok) setLeaveForm({ employee_id: "", leave_type: "Yıllık İzin", start_date: "", end_date: "", approver_employee_id: "", notes: "" });
            }}>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={leaveForm.employee_id} onChange={(event) => setLeaveForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Çalışan</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select>
              <Input placeholder="İzin türü" value={leaveForm.leave_type} onChange={(event) => setLeaveForm((current) => ({ ...current, leave_type: event.target.value }))} />
              <Input type="date" value={leaveForm.start_date} onChange={(event) => setLeaveForm((current) => ({ ...current, start_date: event.target.value }))} />
              <Input type="date" value={leaveForm.end_date} onChange={(event) => setLeaveForm((current) => ({ ...current, end_date: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={leaveForm.approver_employee_id} onChange={(event) => setLeaveForm((current) => ({ ...current, approver_employee_id: event.target.value }))}><option value="">Onaylayan</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select>
              <Button type="submit">Talep Oluştur</Button>
            </form>
          </FormSection>
          <DataTable data={leaveRequests} rowKey={(row) => row.id} columns={[
            { key: "employee", header: "Çalışan", render: (row) => optionLabel(employees, row.employee_id, (employee) => employee.full_name) },
            { key: "type", header: "İzin Türü", render: (row) => row.leave_type },
            { key: "dates", header: "Tarih", render: (row) => `${formatDate(row.start_date)} - ${formatDate(row.end_date)}` },
            { key: "approver", header: "Onaylayan", render: (row) => optionLabel(employees, row.approver_employee_id, (employee) => employee.full_name) },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={LEAVE_STATUS_LABELS[row.status]} tone={statusTone(row.status)} /> },
            { key: "actions", header: "İşlem", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-xs" value={row.status} onChange={(event) => save(updateHRLeaveRequest(row.id, { status: event.target.value as LeaveRequestStatus }), "İzin durumu güncellendi.")}>{Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          ]} />
        </TabsContent>

        <TabsContent value="recruitment" className="space-y-4">
          <FormSection title="Aday Kaydı" description="İşe alım süreci için aday ve pozisyon bağlantısı oluşturun.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={async (event) => {
              event.preventDefault();
              if (!candidateForm.full_name.trim()) return;
              const ok = await save(createHRRecruitmentCandidate({ ...candidateForm, department_id: candidateForm.department_id || null, position_id: candidateForm.position_id || null, status: "new" }), "Aday kaydı oluşturuldu.");
              if (ok) setCandidateForm({ full_name: "", email: "", phone: "", department_id: "", position_id: "", source: "", notes: "" });
            }}>
              <Input required placeholder="Ad Soyad *" value={candidateForm.full_name} onChange={(event) => setCandidateForm((current) => ({ ...current, full_name: event.target.value }))} />
              <Input type="email" placeholder="E-posta" value={candidateForm.email} onChange={(event) => setCandidateForm((current) => ({ ...current, email: event.target.value }))} />
              <Input placeholder="Telefon" value={candidateForm.phone} onChange={(event) => setCandidateForm((current) => ({ ...current, phone: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={candidateForm.department_id} onChange={(event) => setCandidateForm((current) => ({ ...current, department_id: event.target.value }))}><option value="">Departman</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={candidateForm.position_id} onChange={(event) => setCandidateForm((current) => ({ ...current, position_id: event.target.value }))}><option value="">Pozisyon</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select>
              <Button type="submit">Aday Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={candidates} rowKey={(row) => row.id} columns={[
            { key: "name", header: "Aday", render: (row) => <div><p className="font-medium">{row.full_name}</p><p className="text-xs text-muted-foreground">{row.email || row.phone || "-"}</p></div> },
            { key: "department", header: "Departman", render: (row) => optionLabel(departments, row.department_id, (department) => department.name) },
            { key: "position", header: "Pozisyon", render: (row) => optionLabel(positions, row.position_id, (position) => position.title) },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={RECRUITMENT_STATUS_LABELS[row.status]} tone={statusTone(row.status)} /> },
            { key: "actions", header: "İşlem", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-xs" value={row.status} onChange={(event) => save(updateHRRecruitmentCandidate(row.id, { status: event.target.value as RecruitmentStatus }), "Aday durumu güncellendi.")}>{Object.entries(RECRUITMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          ]} />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <FormSection title="Oryantasyon Görevi" description="Yeni çalışan veya aday için görev hazırlayın.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={async (event) => {
              event.preventDefault();
              if (!onboardingForm.title.trim()) return;
              const ok = await save(createHROnboardingTask({ ...onboardingForm, employee_id: onboardingForm.employee_id || null, candidate_id: onboardingForm.candidate_id || null, responsible_employee_id: onboardingForm.responsible_employee_id || null, due_date: onboardingForm.due_date || null, status: "open" }), "Oryantasyon görevi oluşturuldu.");
              if (ok) setOnboardingForm({ title: "", employee_id: "", candidate_id: "", responsible_employee_id: "", due_date: "", notes: "" });
            }}>
              <Input required placeholder="Görev başlığı *" value={onboardingForm.title} onChange={(event) => setOnboardingForm((current) => ({ ...current, title: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={onboardingForm.employee_id} onChange={(event) => setOnboardingForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Çalışan</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={onboardingForm.candidate_id} onChange={(event) => setOnboardingForm((current) => ({ ...current, candidate_id: event.target.value }))}><option value="">Aday</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={onboardingForm.responsible_employee_id} onChange={(event) => setOnboardingForm((current) => ({ ...current, responsible_employee_id: event.target.value }))}><option value="">Sorumlu</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select>
              <Input type="date" value={onboardingForm.due_date} onChange={(event) => setOnboardingForm((current) => ({ ...current, due_date: event.target.value }))} />
              <Button type="submit">Görev Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={onboardingTasks} rowKey={(row) => row.id} columns={[
            { key: "title", header: "Görev", render: (row) => row.title },
            { key: "person", header: "Kişi", render: (row) => optionLabel(employees, row.employee_id, (employee) => employee.full_name) || optionLabel(candidates, row.candidate_id, (candidate) => candidate.full_name) },
            { key: "responsible", header: "Sorumlu", render: (row) => optionLabel(employees, row.responsible_employee_id, (employee) => employee.full_name) },
            { key: "due", header: "Termin", render: (row) => row.due_date ? formatDate(row.due_date) : "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={ONBOARDING_STATUS_LABELS[row.status]} tone={statusTone(row.status)} /> },
            { key: "actions", header: "İşlem", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-xs" value={row.status} onChange={(event) => save(updateHROnboardingTask(row.id, { status: event.target.value as OnboardingTaskStatus }), "Oryantasyon durumu güncellendi.")}>{Object.entries(ONBOARDING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          ]} />
        </TabsContent>
      </Tabs>
    </ERPLayout>
  );
}
