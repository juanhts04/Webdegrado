import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

type PerfilRol = 'estudiante' | 'docente' | 'secretario' | 'admin' | 'desconocido';

type UsuarioPerfil = Record<string, unknown> & {
  nombre?: string;
  codigo?: string | number;
  correo?: string;
  email?: string;
  rol?: string;
  role?: string;
  tipo?: string;
  tipo_usuario?: string;
  tipoUsuario?: string;
  perfil?: string;
  cargo?: string;
  programa?: string;
  programa_nombre?: string;
  semestre?: string | number;
};

type CampoPerfil = { label: string; value: string };

@Component({
  selector: 'app-mi-perfil',
  imports: [CommonModule],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiPerfil {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly usuario = signal<UsuarioPerfil | null>(this.readProfile());

  readonly nombre = computed(() => {
    const n = this.usuario()?.nombre;
    return typeof n === 'string' && n.trim() ? n.trim() : '—';
  });

  readonly iniciales = computed(() => {
    const nombre = this.nombre().trim();
    if (!nombre || nombre === '—') return 'U';
    const parts = nombre.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? 'U';
    const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') ?? '';
    return (first + last).toUpperCase();
  });

  readonly identificador = computed(() => {
    const u = this.usuario();
    if (!u) return '—';
    const codigo = u.codigo;
    if (typeof codigo === 'string' && codigo.trim()) return codigo.trim();
    if (typeof codigo === 'number' && Number.isFinite(codigo)) return String(codigo);

    const idCandidate = u['id'] ?? u['Id'] ?? u['ID'];
    if (typeof idCandidate === 'string' && idCandidate.trim()) return idCandidate.trim();
    if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) return String(idCandidate);
    return '—';
  });

  readonly correo = computed(() => {
    const u = this.usuario();
    if (!u) return '—';
    const c = u.correo;
    if (typeof c === 'string' && c.trim()) return c.trim();
    const e = u.email;
    if (typeof e === 'string' && e.trim()) return e.trim();
    return '—';
  });

  readonly telefono = computed(() => {
    const u = this.usuario();
    if (!u) return '—';
    const candidates: unknown[] = [
      u['telefono'],
      u['teléfono'],
      u['phone'],
      u['celular'],
      u['movil'],
      u['móvil'],
      u['mobile'],
      u['tel'],
    ];
    for (const v of candidates) {
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    return '—';
  });

  private normalizarRol(raw: unknown): PerfilRol {
    if (typeof raw !== 'string') return 'desconocido';
    const v = raw.trim().toLowerCase();
    if (!v) return 'desconocido';
    if (v.includes('estudiante')) return 'estudiante';
    if (v.includes('docente') || v.includes('profesor')) return 'docente';
    if (v.includes('secretario')) return 'secretario';
    if (v === 'admin' || v.includes('administrador')) return 'admin';
    return 'desconocido';
  }

  readonly rol = computed<PerfilRol>(() => {
    const u = this.usuario();
    if (!u) return 'desconocido';
    const fromUser = u.rol ?? u.role ?? u.tipo ?? u.tipo_usuario ?? u.tipoUsuario ?? u.perfil ?? u.cargo;
    const norm = this.normalizarRol(fromUser);
    if (norm !== 'desconocido') return norm;

    const programa = u.programa_nombre ?? u.programa;
    if (typeof programa === 'string' && programa.trim()) return 'estudiante';
    const semestre = u.semestre;
    if (typeof semestre === 'string' || typeof semestre === 'number') return 'estudiante';
    return 'desconocido';
  });

  readonly rolLabel = computed(() => {
    switch (this.rol()) {
      case 'estudiante':
        return 'Estudiante';
      case 'docente':
        return 'Docente';
      case 'secretario':
        return 'Secretario Académico';
      case 'admin':
        return 'Administrador';
      default:
        return 'Usuario';
    }
  });

  readonly camposPrincipales = computed<CampoPerfil[]>(() => {
    const u = this.usuario();
    if (!u) return [];

    const campos: CampoPerfil[] = [
      { label: 'Rol', value: this.rolLabel() },
      { label: 'Código/ID', value: this.identificador() },
    ];

    if (this.rol() === 'estudiante') {
      const programa = u.programa_nombre ?? u.programa;
      if (typeof programa === 'string' && programa.trim()) {
        campos.push({ label: 'Programa', value: programa.trim() });
      }
      const semestre = u.semestre;
      if (typeof semestre === 'string' && semestre.trim()) {
        campos.push({ label: 'Semestre', value: semestre.trim() });
      } else if (typeof semestre === 'number' && Number.isFinite(semestre)) {
        campos.push({ label: 'Semestre', value: String(semestre) });
      }
    }

    if (this.rol() === 'docente') {
      const dept = u['departamento'] ?? u['area'] ?? u['facultad'];
      if (typeof dept === 'string' && dept.trim()) {
        campos.push({ label: 'Departamento/Área', value: dept.trim() });
      }
      const desc = u['descripcion_perfil'] ?? u['descripcion'] ?? u['perfil_descripcion'];
      if (typeof desc === 'string' && desc.trim()) {
        campos.push({ label: 'Descripción', value: desc.trim() });
      }
    }

    if (this.rol() === 'secretario') {
      const cargo = u.cargo ?? u['puesto'];
      if (typeof cargo === 'string' && cargo.trim()) {
        campos.push({ label: 'Cargo', value: cargo.trim() });
      }
      const dep = u['dependencia'] ?? u['oficina'];
      if (typeof dep === 'string' && dep.trim()) {
        campos.push({ label: 'Dependencia', value: dep.trim() });
      }
    }

    if (this.rol() === 'admin') {
      const permisos = u['permisos'] ?? u['nivel'];
      if (typeof permisos === 'string' && permisos.trim()) {
        campos.push({ label: 'Nivel/Permisos', value: permisos.trim() });
      }
    }

    campos.push({ label: 'Email', value: this.correo() });
    if (this.telefono() !== '—') campos.push({ label: 'Teléfono', value: this.telefono() });

    return campos.filter((c) => !!c.value && c.value !== '—');
  });

  private readProfile(): UsuarioPerfil | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as UsuarioPerfil;
    } catch {
      return null;
    }
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
