import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Medicine } from './models';

@Injectable({ providedIn: 'root' })
export class MedicineService {
  private readonly api = '/api/medicines';

  constructor(private http: HttpClient) {}

  list(): Observable<Medicine[]> {
    return this.http.get<Medicine[]>(this.api);
  }

  get(id: number): Observable<Medicine> {
    return this.http.get<Medicine>(`${this.api}/${id}`);
  }

  create(form: FormData): Observable<Medicine> {
    return this.http.post<Medicine>(this.api, form);
  }

  update(id: number, form: FormData): Observable<Medicine> {
    return this.http.put<Medicine>(`${this.api}/${id}`, form);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  restock(id: number, quantity: number): Observable<Medicine> {
    return this.http.patch<Medicine>(`${this.api}/${id}/restock`, { quantity });
  }
}
