import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService } from '../../core/employee.service';
import { Employee } from '../../core/models';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-admin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-employees.component.html',
  styleUrl: './admin-employees.component.scss',
})
export class AdminEmployeesComponent implements OnInit {
  mode: 'form' | 'view' = 'form';
  employees: Employee[] = [];
  name = '';
  email = '';
  phone = '';
  designation = '';
  department = '';
  address = '';
  joining_date = '';
  file: File | null = null;
  editingId: number | null = null;
  error = '';
  loading = false;
  savePhase: SavePhase = 'idle';
  readonly saveButtonLabel = saveButtonLabel;

  constructor(private employeeService: EmployeeService, private toast: ToastService) {}

  ngOnInit(): void {
    this.reload();
  }

  showForm(): void {
    this.mode = 'form';
  }

  showView(): void {
    this.mode = 'view';
    this.reload();
  }

  reload(): void {
    this.employeeService.list().subscribe({
      next: (data) => (this.employees = data),
      error: () => (this.error = 'Unable to load employees'),
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
  }

  resetForm(): void {
    this.name = '';
    this.email = '';
    this.phone = '';
    this.designation = '';
    this.department = '';
    this.address = '';
    this.joining_date = '';
    this.file = null;
    this.editingId = null;
  }

  edit(emp: Employee): void {
    this.editingId = emp.id;
    this.name = emp.name;
    this.email = emp.email;
    this.phone = emp.phone;
    this.designation = emp.designation;
    this.department = emp.department || '';
    this.address = emp.address || '';
    this.joining_date = emp.joining_date || '';
    this.file = null;
    this.mode = 'form';
  }

  save(): void {
    if (!this.name || !this.email || !this.phone || !this.designation) {
      this.error = 'Name, email, phone and designation are required';
      this.toast.error(this.error);
      return;
    }
    const form = new FormData();
    form.append('name', this.name);
    form.append('email', this.email);
    form.append('phone', this.phone);
    form.append('designation', this.designation);
    form.append('department', this.department || '');
    form.append('address', this.address || '');
    form.append('joining_date', this.joining_date || '');
    if (this.file) form.append('image', this.file);

    this.loading = true;
    this.savePhase = 'saving';
    this.error = '';
    this.toast.beginSave();
    const req =
      this.editingId === null
        ? this.employeeService.create(form)
        : this.employeeService.update(this.editingId, form);

    req.subscribe({
      next: () => {
        this.loading = false;
        this.savePhase = 'saved';
        const msg = this.editingId ? 'Employee updated' : 'Employee added';
        this.toast.success(msg);
        this.resetForm();
        this.reload();
        this.mode = 'view';
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.savePhase = 'failed';
        const msg = err.error?.message || 'Save failed';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
    });
  }

  remove(emp: Employee): void {
    if (!confirm(`Remove employee ${emp.name}?`)) return;
    this.toast.beginSave();
    this.employeeService.remove(emp.id).subscribe({
      next: () => {
        this.toast.success(`${emp.name} removed`);
        this.reload();
      },
      error: (err) => {
        const msg = err.error?.message || 'Delete failed';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }

  imageUrl(emp: Employee): string {
    return emp.image || 'assets/medicines/default.svg';
  }
}
