import { Routes } from '@angular/router';
import { Jcprincipal } from './pages/jcprincipal/jcprincipal';
import { Login } from './pages/login/login';

export const routes: Routes = [

  {
    path: '',
    component: Login,
  } ,
  {
    path: 'jcprincipal',
    component: Jcprincipal,
  }

];
