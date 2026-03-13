import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
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
    path: 'home',
		component: Home,
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
    redirectTo: 'home/generar-reporte',
    pathMatch: 'full',
  },
  {
    path: 'docente/supervisar-asistencia',
    redirectTo: 'home/supervisar-asistencia',
    pathMatch: 'full',
  },
  {
    path: 'docente/asistencia',
    redirectTo: 'home/asistencia',
    pathMatch: 'full',
  },
  {
    path: 'estudiante/asistencia-registrada',
    redirectTo: 'home/asistencias-registradas',
    pathMatch: 'full',
  },
  {
    path: 'estudiante/mis-cursos',
    redirectTo: 'home/mis-cursos',
    pathMatch: 'full',
  },
  {
    path: 'docente/registrar-estudiante-curso',
    redirectTo: 'home/registrar-estudiante-curso',
    pathMatch: 'full',
  },
	{
		path: 'admin/registrar-secretario',
		redirectTo: 'home/registrar-secretario',
		pathMatch: 'full',
	},
  {
    path: 'admin/registrar-biometria',
    redirectTo: 'home/registro-biometrico',
    pathMatch: 'full',
  },
	{
		path: 'secretario/gestion-curso',
		redirectTo: 'home/gestion-curso',
		pathMatch: 'full',
  },
  {
    path: 'secretario/gestion-docente',
    redirectTo: 'home/gestion-docente',
    pathMatch: 'full',
  },
	{
		path: 'secretario/gestion-horario',
		redirectTo: 'home/gestion-horario',
		pathMatch: 'full',
  },
  {
    path: 'secretario/gestion-salon',
    redirectTo: 'home/gestion-salon',
    pathMatch: 'full',
  },
  {
    path: 'secretario/sec-generar-reporte',
    redirectTo: 'home/sec-generar-reporte',
    pathMatch: 'full',
  },
  {
    path: 'mi-perfil',
    redirectTo: 'home/mi-perfil',
    pathMatch: 'full',
  },

	// Compatibilidad: rutas antiguas con prefijo /jcprincipal
	{ path: 'jcprincipal', redirectTo: 'home', pathMatch: 'full' },
	{ path: 'jcprincipal/supervisar-asistencia', redirectTo: 'home/supervisar-asistencia', pathMatch: 'full' },
	{ path: 'jcprincipal/asistencia', redirectTo: 'home/asistencia', pathMatch: 'full' },
	{ path: 'jcprincipal/asistencias-registradas', redirectTo: 'home/asistencias-registradas', pathMatch: 'full' },
	{ path: 'jcprincipal/mis-cursos', redirectTo: 'home/mis-cursos', pathMatch: 'full' },
	{ path: 'jcprincipal/registrar-estudiante-curso', redirectTo: 'home/registrar-estudiante-curso', pathMatch: 'full' },
	{ path: 'jcprincipal/registro-biometrico', redirectTo: 'home/registro-biometrico', pathMatch: 'full' },
	{ path: 'jcprincipal/registrar-secretario', redirectTo: 'home/registrar-secretario', pathMatch: 'full' },
	{ path: 'jcprincipal/gestion-curso', redirectTo: 'home/gestion-curso', pathMatch: 'full' },
	{ path: 'jcprincipal/gestion-docente', redirectTo: 'home/gestion-docente', pathMatch: 'full' },
	{ path: 'jcprincipal/gestion-horario', redirectTo: 'home/gestion-horario', pathMatch: 'full' },
	{ path: 'jcprincipal/gestion-salon', redirectTo: 'home/gestion-salon', pathMatch: 'full' },
	{ path: 'jcprincipal/generar-reporte', redirectTo: 'home/generar-reporte', pathMatch: 'full' },
	{ path: 'jcprincipal/sec-generar-reporte', redirectTo: 'home/sec-generar-reporte', pathMatch: 'full' },
	{ path: 'jcprincipal/mi-perfil', redirectTo: 'home/mi-perfil', pathMatch: 'full' },

];
