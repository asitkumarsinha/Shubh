import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService } from '../../core/employee.service';
import { Employee } from '../../core/models';

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
  message = '';
  error = '';
  loading = false;

  constructor(private employeeService: EmployeeService) {}

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
    this.error = '';
    const req =
      this.editingId === null
        ? this.employeeService.create(form)
        : this.employeeService.update(this.editingId, form);

    req.subscribe({
      next: () => {
        this.loading = false;
        this.message = this.editingId ? 'Employee updated' : 'Employee added';
        this.resetForm();
        this.reload();
        this.mode = 'view';
        setTimeout(() => (this.message = ''), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Save failed';
      },
    });
  }

  remove(emp: Employee): void {
    if (!confirm(`Remove employee ${emp.name}?`)) return;
    this.employeeService.remove(emp.id).subscribe({
      next: () => {
        this.message = `${emp.name} removed`;
        this.reload();
        setTimeout(() => (this.message = ''), 2000);
      },
      error: (err) => (this.error = err.error?.message || 'Delete failed'),
    });
  }

  imageUrl(emp: Employee): string {
    return emp.image || 'assets/medicines/default.svg';
  }
}
