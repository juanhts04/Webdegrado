import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

import { UsuarioService } from '../../services/usuario';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, NgOptimizedImage],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {

  loginData = {
    correo: '',
    contrasena: ''
  };

  private readonly router = inject(Router);
  private readonly usuarioService = inject(UsuarioService);

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

        switch (res.usuario.rol) {
          case 'admin':
			this.router.navigate(['/jcprincipal/registrar-secretario']);
            break;
          case 'docente':
			this.router.navigate(['/jcprincipal/supervisar-asistencia']);
            break;
          case 'secretario':
			this.router.navigate(['/jcprincipal/gestion-curso']);
            break;
          case 'estudiante':
			this.router.navigate(['/jcprincipal/mis-cursos']);
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

  olvidoContrasena() {
    alert('Si olvidaste tu contraseña, contacta al administrador.');
  }

  entrarComoInvitado() {
    this.router.navigate(['/jcprincipal']);
  }
}
