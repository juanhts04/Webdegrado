import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

type MenuIcon =
  | 'users'
  | 'calendar'
  | 'book'
  | 'user-plus'
  | 'id'
  | 'list'
  | 'file'
  | 'settings'
  | 'clock'
  | 'building'
  | 'user';

@Component({
  selector: 'app-jcprincipal',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './jcprincipal.html',
  styleUrl: './jcprincipal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Jcprincipal {

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly activeKey = signal<string>('supervisar-asistencia');
  readonly currentUrl = signal<string>(this.router.url);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects);
        this.syncActiveKeyFromUrl(e.urlAfterRedirects);
      });
  }

  private syncActiveKeyFromUrl(url: string) {
    if (url.includes('/jcprincipal/registrar-estudiante-curso')) {
      this.activeKey.set('registrar-estudiante-curso');
    }
    if (url.includes('/jcprincipal/registro-biometrico')) {
      this.activeKey.set('registro-biometrico');
    }
    if (url.includes('/jcprincipal/registrar-secretario')) {
      this.activeKey.set('registrar-secretario');
    }
  }

  readonly isHome = computed(() => {
    const url = this.currentUrl();
    return url === '/jcprincipal' || url === '/jcprincipal/';
  });

  private readCurrentUser(): { nombre?: string; rol?: string } | null {
    if (!this.isBrowser) return null;

    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as { nombre?: string; rol?: string };
      }
      return null;
    } catch {
      return null;
    }
  }

  readonly currentUser = signal<{ nombre?: string; rol?: string } | null>(this.readCurrentUser());
  readonly displayName = computed(() => this.currentUser()?.nombre ?? 'Usuario');
  readonly displayRole = computed(() => {
    const role = this.currentUser()?.rol;
    if (!role) return '—';
    return role.charAt(0).toUpperCase() + role.slice(1);
  });
  readonly initials = computed(() => {
    const name = this.displayName().trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? 'U';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return (first + (second ?? '')).toUpperCase();
  });

  readonly menuItems = [
    { key: 'supervisar-asistencia', label: 'Supervisar Asistencia', badge: 'SA', icon: 'calendar' as const },
    { key: 'registrar-asistencia', label: 'Registrar asistencia', badge: 'RA', icon: 'user-plus' as const },
    { key: 'mis-cursos', label: 'Mis Cursos', badge: 'MC', icon: 'book' as const },
    { key: 'registrar-estudiante-curso', label: 'Registrar Estudiante a Curso', badge: 'EC', icon: 'users' as const },
    { key: 'registrar-secretario', label: 'Registrar Secretario', badge: 'RS', icon: 'users' as const },
    { key: 'registro-biometrico', label: 'Registro Biometrico', badge: 'RB', icon: 'id' as const },
    { key: 'asistencias-registradas', label: 'Asistencias registradas', badge: 'AR', icon: 'list' as const },
    { key: 'gestionar-curso', label: 'Gestionar Curso', badge: 'GC', icon: 'settings' as const },
    { key: 'gestionar-docente', label: 'Gestionar Docente', badge: 'GD', icon: 'users' as const },
    { key: 'gestionar-horario', label: 'Gestionar Horario', badge: 'GH', icon: 'clock' as const },
    { key: 'gestionar-salon', label: 'Gestionar Salón', badge: 'GS', icon: 'building' as const },
    { key: 'generar-reporte', label: 'Generar Reporte', badge: 'GR', icon: 'file' as const },
    { key: 'mi-perfil', label: 'Mi Perfil', badge: 'MP', icon: 'user' as const },
  ] as const;

  readonly activeLabel = computed(() => {
    const key = this.activeKey();
    return this.menuItems.find((item) => item.key === key)?.label ?? 'Supervisar Asistencia';
  });

  selectItem(key: string) {
    this.activeKey.set(key);

		if (key === 'registrar-estudiante-curso') {
      this.router.navigate(['/jcprincipal/registrar-estudiante-curso']);
			return;
		}

    if (key === 'registrar-secretario') {
      this.router.navigate(['/jcprincipal/registrar-secretario']);
      return;
    }

    if (key === 'registro-biometrico') {
      this.router.navigate(['/jcprincipal/registro-biometrico']);
      return;
    }

		// Fallback: mantener la vista actual.
		this.router.navigate(['/jcprincipal']);
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
