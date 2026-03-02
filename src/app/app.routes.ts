import { Routes } from '@angular/router';
import { Jcprincipal } from './pages/jcprincipal/jcprincipal';
import { RegistrarEstudianteCurso } from './pages/docente/registrar-estudiante-curso/registrar-estudiante-curso';
import { RegistrarBiometria } from './pages/admin/registrar-biometria/registrar-biometria';
import { RegistrarSecretario } from './pages/admin/registrar-secretario/registrar-secretario';
import { GestionCurso } from './pages/secretario/gestion-curso/gestion-curso';
import { GestionDocente } from './pages/secretario/gestion-docente/gestion-docente';
import { GestionHorario } from './pages/secretario/gestion-horario/gestion-horario';
import { GestionSalon } from './pages/secretario/gestion-salon/gestion-salon';
import { SecGenerarReporte } from './pages/secretario/sec-generar-reporte/sec-generar-reporte';
import { GenerarReporte } from './pages/docente/generar-reporte/generar-reporte';
import { MiPerfil } from './mi-perfil/mi-perfil';
import { SupervisarAsistencia } from './pages/docente/supervisar-asistencia/supervisar-asistencia';
import { Asistencia } from './pages/docente/asistencia/asistencia';
import { AsistenciaRegistrada } from './pages/estudiante/asistencia-registrada/asistencia-registrada';
import { MisCursos } from './pages/estudiante/mis-cursos/mis-cursos';
import { Login } from './pages/login/login';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [

  {
    path: '',
    component: Login,
  },
  {
    path: 'jcprincipal',
    component: Jcprincipal,
		canActivate: [roleGuard],
		data: { roles: ['admin', 'docente', 'secretario', 'estudiante'] },
    children: [
      {
        path: 'supervisar-asistencia',
        component: SupervisarAsistencia,
			canActivate: [roleGuard],
			data: { roles: ['docente'] },
      },
      {
        path: 'asistencia',
        component: Asistencia,
			canActivate: [roleGuard],
			data: { roles: ['docente'] },
      },
      {
        path: 'asistencias-registradas',
        component: AsistenciaRegistrada,
			canActivate: [roleGuard],
			data: { roles: ['estudiante'] },
      },
      {
        path: 'mis-cursos',
        component: MisCursos,
			canActivate: [roleGuard],
			data: { roles: ['estudiante'] },
      },
      {
        path: 'registrar-estudiante-curso',
        component: RegistrarEstudianteCurso,
			canActivate: [roleGuard],
			data: { roles: ['docente'] },
      },
      {
        path: 'registro-biometrico',
        component: RegistrarBiometria,
			canActivate: [roleGuard],
			data: { roles: ['admin'] },
      },
			{
				path: 'registrar-secretario',
				component: RegistrarSecretario,
				canActivate: [roleGuard],
				data: { roles: ['admin'] },
			},
			{
				path: 'gestion-curso',
				component: GestionCurso,
				canActivate: [roleGuard],
				data: { roles: ['secretario'] },
			},
      {
        path: 'gestion-docente',
        component: GestionDocente,
			canActivate: [roleGuard],
			data: { roles: ['secretario'] },
      },
			{
				path: 'gestion-horario',
				component: GestionHorario,
				canActivate: [roleGuard],
				data: { roles: ['secretario'] },
			},
      {
        path: 'gestion-salon',
        component: GestionSalon,
			canActivate: [roleGuard],
			data: { roles: ['secretario'] },
      },
      {
        path: 'sec-generar-reporte',
        component: SecGenerarReporte,
			canActivate: [roleGuard],
			data: { roles: ['secretario'] },
      },
      {
        path: 'generar-reporte',
        component: GenerarReporte,
			canActivate: [roleGuard],
			data: { roles: ['docente'] },
      },
      {
        path: 'mi-perfil',
        component: MiPerfil,
			canActivate: [roleGuard],
			data: { roles: ['admin', 'docente', 'secretario', 'estudiante'] },
      },
    ],
  },
  {
    path: 'docente/generar-reporte',
    redirectTo: 'jcprincipal/generar-reporte',
    pathMatch: 'full',
  },
  {
    path: 'docente/supervisar-asistencia',
    redirectTo: 'jcprincipal/supervisar-asistencia',
    pathMatch: 'full',
  },
  {
    path: 'docente/asistencia',
    redirectTo: 'jcprincipal/asistencia',
    pathMatch: 'full',
  },
  {
    path: 'estudiante/asistencia-registrada',
    redirectTo: 'jcprincipal/asistencias-registradas',
    pathMatch: 'full',
  },
  {
    path: 'estudiante/mis-cursos',
    redirectTo: 'jcprincipal/mis-cursos',
    pathMatch: 'full',
  },
  {
    path: 'docente/registrar-estudiante-curso',
    redirectTo: 'jcprincipal/registrar-estudiante-curso',
    pathMatch: 'full',
  },
	{
		path: 'admin/registrar-secretario',
		redirectTo: 'jcprincipal/registrar-secretario',
		pathMatch: 'full',
	},
  {
    path: 'admin/registrar-biometria',
    redirectTo: 'jcprincipal/registro-biometrico',
    pathMatch: 'full',
  },
	{
		path: 'secretario/gestion-curso',
		redirectTo: 'jcprincipal/gestion-curso',
		pathMatch: 'full',
  },
  {
    path: 'secretario/gestion-docente',
    redirectTo: 'jcprincipal/gestion-docente',
    pathMatch: 'full',
  },
	{
		path: 'secretario/gestion-horario',
		redirectTo: 'jcprincipal/gestion-horario',
		pathMatch: 'full',
  },
  {
    path: 'secretario/gestion-salon',
    redirectTo: 'jcprincipal/gestion-salon',
    pathMatch: 'full',
  },
  {
    path: 'secretario/sec-generar-reporte',
    redirectTo: 'jcprincipal/sec-generar-reporte',
    pathMatch: 'full',
  },
  {
    path: 'mi-perfil',
    redirectTo: 'jcprincipal/mi-perfil',
    pathMatch: 'full',
  }

];
