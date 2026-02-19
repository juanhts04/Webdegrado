import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { UsuarioService } from '../../services/usuario';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class Login {

  loginData = {
    correo: '',
    contrasena: ''
  };

  constructor(
    private router: Router,
    private usuarioService: UsuarioService

  ) {}

  login() {
    if (!this.loginData.correo || !this.loginData.contrasena) {
      alert('Por favor, ingresa tu correo y contraseña');
      return;
    }

    const dataToSend = {
      correo: this.loginData.correo.trim(),
      password: this.loginData.contrasena.trim()
    };

    this.usuarioService.login(dataToSend).subscribe({
      next: (res: any) => {
        console.log('✅ Respuesta del servidor:', res);

        localStorage.setItem('currentUser', JSON.stringify(res.usuario));

        alert(`Bienvenido ${res.usuario.nombre}`);

        switch (res.usuario.rol) {
          case 'admin':
            this.router.navigate(['/jcprincipal']);
            break;
          case 'docente':
            this.router.navigate(['/docente']);
            break;
          case 'secretario':
            this.router.navigate(['/secretario']);
            break;
          case 'estudiante':
            this.router.navigate(['/estudiante']);
            break;
          default:
            this.router.navigate(['/jcprincipal']);
        }
      },
      error: (err: any) => {
        console.error('❌ Error de login:', err);

        if (err.status === 401) {
          alert('Correo o contraseña incorrectos');
        } else if (err.status === 400) {
          alert('Faltan datos para iniciar sesión');
        } else {
          alert('Error en el servidor al intentar iniciar sesión');
        }
      }
    });
  }

  registrarseU() {
    this.router.navigate(['/registrar-usuario']);
  }
}
