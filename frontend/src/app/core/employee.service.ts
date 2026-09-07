import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Employee } from './models';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly api = '/api/employees';

  constructor(private http: HttpClient) {}

  list(): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.api);
  }

  create(form: FormData): Observable<Employee> {
    return this.http.post<Employee>(this.api, form);
  }

  update(id: number, form: FormData): Observable<Employee> {
    return this.http.put<Employee>(`${this.api}/${id}`, form);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }
}
