import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

type CurrentUser = {
  rol?: string;
} & Record<string, unknown>;

function readCurrentUser(): CurrentUser | null {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as CurrentUser;
  } catch {
    return null;
  }
}

export const roleGuard: CanActivateFn = (route) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) return true;

  const router = inject(Router);

  const user = readCurrentUser();
  const role = typeof user?.rol === 'string' ? user.rol : undefined;

  if (!role) {
    router.navigate(['/']);
    return false;
  }

  const roles = route.data?.['roles'] as string[] | undefined;
  if (!roles || roles.length === 0) return true;

  if (roles.includes(role)) return true;

  router.navigate(['/jcprincipal/mi-perfil']);
  return false;
};
