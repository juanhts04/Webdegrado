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
  selector: 'app-home',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly activeKey = signal<string>('supervisar-asistencia');
  readonly currentUrl = signal<string>(this.router.url);

	readonly sidebarOpen = signal<boolean>(false);
  readonly sidebarCollapsed = signal<boolean>(false);
  readonly isMobile = signal<boolean>(false);

  constructor() {
    this.setupResponsiveSidebar();

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

  private setupResponsiveSidebar() {
    if (!this.isBrowser) return;

    const mql = window.matchMedia('(max-width: 640px)');
    const update = (matches: boolean) => {
      this.isMobile.set(matches);
      this.sidebarOpen.set(false);
    };

    update(mql.matches);

    const handler = (e: MediaQueryListEvent) => update(e.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      this.destroyRef.onDestroy(() => mql.removeEventListener('change', handler));
    } else {
      // Safari legacy
      mql.addListener(handler);
      this.destroyRef.onDestroy(() => mql.removeListener(handler));
    }
  }

  private syncActiveKeyFromUrl(url: string) {
		if (url.includes('/home/supervisar-asistencia')) {
			this.activeKey.set('supervisar-asistencia');
		}
    if (url.includes('/home/asistencia')) {
      this.activeKey.set('registrar-asistencia');
    }
    if (url.includes('/home/asistencias-registradas')) {
      this.activeKey.set('asistencias-registradas');
    }
    if (url.includes('/home/mis-cursos')) {
      this.activeKey.set('mis-cursos');
    }
    if (url.includes('/home/registrar-estudiante-curso')) {
      this.activeKey.set('registrar-estudiante-curso');
    }
    if (url.includes('/home/registro-biometrico')) {
      this.activeKey.set('registro-biometrico');
    }
    if (url.includes('/home/registrar-secretario')) {
      this.activeKey.set('registrar-secretario');
    }
		if (url.includes('/home/gestion-curso')) {
			this.activeKey.set('gestionar-curso');
		}
    if (url.includes('/home/gestion-docente')) {
      this.activeKey.set('gestionar-docente');
    }
    if (url.includes('/home/gestion-horario')) {
      this.activeKey.set('gestionar-horario');
    }
		if (url.includes('/home/gestion-salon')) {
			this.activeKey.set('gestionar-salon');
		}
    if (url.includes('/home/generar-reporte')) {
      this.activeKey.set('generar-reporte-docente');
    }
    if (url.includes('/home/sec-generar-reporte')) {
      this.activeKey.set('generar-reporte-secretario');
    }
    if (url.includes('/home/mi-perfil')) {
      this.activeKey.set('mi-perfil');
    }
  }

  readonly isHome = computed(() => {
    const url = this.currentUrl();
    return url === '/home' || url === '/home/';
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
    { key: 'generar-reporte-docente', label: 'Generar Reporte (Docente)', badge: 'GRD', icon: 'file' as const },
    { key: 'gestionar-curso', label: 'Gestionar Curso', badge: 'GC', icon: 'settings' as const },
    { key: 'gestionar-docente', label: 'Gestionar Docente', badge: 'GD', icon: 'users' as const },
    { key: 'gestionar-horario', label: 'Gestionar Horario', badge: 'GH', icon: 'clock' as const },
    { key: 'gestionar-salon', label: 'Gestionar Salón', badge: 'GS', icon: 'building' as const },
    { key: 'generar-reporte-secretario', label: 'Generar Reporte (Secretario)', badge: 'GRS', icon: 'file' as const },
    { key: 'mi-perfil', label: 'Mi Perfil', badge: 'MP', icon: 'user' as const },
  ] as const;

  readonly menuItemsForRole = computed(() => {
    const role = this.currentUser()?.rol;

    if (role === 'admin') {
      return [...this.menuItems];
    }

    if (role === 'docente') {
      const allowed = new Set([
        'supervisar-asistencia',
        'registrar-asistencia',
        'registrar-estudiante-curso',
        'generar-reporte-docente',
        'mi-perfil',
      ]);
      return this.menuItems.filter((item) => allowed.has(item.key));
    }

    if (role === 'secretario') {
      const allowed = new Set([
        'gestionar-curso',
        'gestionar-docente',
        'gestionar-horario',
        'gestionar-salon',
        'generar-reporte-secretario',
        'mi-perfil',
      ]);
      return this.menuItems.filter((item) => allowed.has(item.key));
    }

    if (role === 'estudiante') {
      const allowed = new Set(['mis-cursos', 'asistencias-registradas', 'mi-perfil']);
      return this.menuItems.filter((item) => allowed.has(item.key));
    }

    return [] as (typeof this.menuItems)[number][];
  });

  readonly activeLabel = computed(() => {
    const key = this.activeKey();
    return this.menuItems.find((item) => item.key === key)?.label ?? 'Supervisar Asistencia';
  });

  selectItem(key: string) {
		this.closeSidebar();
    this.activeKey.set(key);

    if (key === 'supervisar-asistencia') {
      this.router.navigate(['/home/supervisar-asistencia']);
      return;
    }

    if (key === 'registrar-asistencia') {
      this.router.navigate(['/home/asistencia']);
      return;
    }

    if (key === 'asistencias-registradas') {
      this.router.navigate(['/home/asistencias-registradas']);
      return;
    }

    if (key === 'mis-cursos') {
      this.router.navigate(['/home/mis-cursos']);
      return;
    }

		if (key === 'registrar-estudiante-curso') {
			this.router.navigate(['/home/registrar-estudiante-curso']);
			return;
		}

    if (key === 'registrar-secretario') {
      this.router.navigate(['/home/registrar-secretario']);
      return;
    }

    if (key === 'registro-biometrico') {
      this.router.navigate(['/home/registro-biometrico']);
      return;
    }

    if (key === 'gestionar-curso') {
      this.router.navigateByUrl('/home/gestion-curso');
      return;
    }

		if (key === 'gestionar-docente') {
			this.router.navigateByUrl('/home/gestion-docente');
			return;
		}

    if (key === 'gestionar-horario') {
      this.router.navigateByUrl('/home/gestion-horario');
      return;
    }

    if (key === 'gestionar-salon') {
      this.router.navigateByUrl('/home/gestion-salon');
      return;
    }

    if (key === 'generar-reporte-docente') {
      this.router.navigateByUrl('/home/generar-reporte');
      return;
    }

    if (key === 'generar-reporte-secretario') {
      this.router.navigateByUrl('/home/sec-generar-reporte');
      return;
    }

    if (key === 'mi-perfil') {
      this.router.navigateByUrl('/home/mi-perfil');
      return;
    }

		// Fallback: mantener la vista actual.
    this.router.navigate(['/home']);
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }

	toggleSidebar() {
    if (this.isMobile()) {
      this.sidebarOpen.update((open) => !open);
      return;
    }
    this.sidebarCollapsed.update((collapsed) => !collapsed);
	}

	closeSidebar() {
		this.sidebarOpen.set(false);
	}
}
