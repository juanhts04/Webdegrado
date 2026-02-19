import { Routes } from '@angular/router';
import { Jcprincipal } from './pages/jcprincipal/jcprincipal';
import { RegistrarEstudianteCurso } from './pages/docente/registrar-estudiante-curso/registrar-estudiante-curso';
import { RegistrarBiometria } from './pages/admin/registrar-biometria/registrar-biometria';
import { RegistrarSecretario } from './pages/admin/registrar-secretario/registrar-secretario';
import { Login } from './pages/login/login';

export const routes: Routes = [

  {
    path: '',
    component: Login,
  },
  {
    path: 'jcprincipal',
    component: Jcprincipal,
    children: [
      {
        path: 'registrar-estudiante-curso',
        component: RegistrarEstudianteCurso,
      },
      {
        path: 'registro-biometrico',
        component: RegistrarBiometria,
      },
			{
				path: 'registrar-secretario',
				component: RegistrarSecretario,
			},
    ],
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
  }

];
