import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

   private apiUrl = environment.apiUrl; // 👈 usar la URL del environment

  constructor(private http: HttpClient) {}

  registrar(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/registro`, usuario);
  }

  login(credenciales: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credenciales);

  }
}
