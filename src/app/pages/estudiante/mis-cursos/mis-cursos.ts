import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, from, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, take, toArray } from 'rxjs/operators';
import { CursoService } from '../../../services/cursos';
import { DocenteService } from '../../../services/docentes';
import { EstudiantesService } from '../../../services/estudiantes';
import { HorarioService } from '../../../services/horarios';

type ActiveTab = 'cursos' | 'horario';

type CursoCardVm = {
  id: number;
  nombre: string;
  codigo: string;
  docente: string;
  progreso: number;
};

type HorarioRow = {
  curso: string;
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
  sabado: string;
};

@Component({
  selector: 'app-mis-cursos',
  imports: [CommonModule],
  templateUrl: './mis-cursos.html',
  styleUrl: './mis-cursos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisCursos {
  private readonly cursoService = inject(CursoService);
  private readonly docenteService = inject(DocenteService);
  private readonly estudiantesService = inject(EstudiantesService);
  private readonly horarioService = inject(HorarioService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly activeTab = signal<ActiveTab>('cursos');
  readonly pageTitle = computed(() => (this.activeTab() === 'horario' ? 'Horario' : 'Mis Cursos'));

  readonly cursos = signal<CursoCardVm[]>([]);
  readonly cargandoCursos = signal(false);

  readonly horario = signal<HorarioRow[]>([]);
  readonly cargandoHorario = signal(false);

  readonly toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private cursosAsignadosRaw: any[] = [];
  private horariosById = new Map<number, any>();
  private readonly docentePorCursoCache = new Map<number, string>();
  private resolviendoDocentes = false;

  constructor() {
    this.cursoService.cursosChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCursos());
  }

  ngOnInit(): void {
    this.cargarCursos();
  }

  logout() {
    if (this.isBrowser) localStorage.removeItem('currentUser');
    this.router.navigate(['/']);
  }

  setTab(tab: ActiveTab) {
    this.activeTab.set(tab);
  }

  toast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 2200);
  }

  private getCurrentUser(): any {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private getCurrentStudentIdentity(): { estudianteId?: number; codigo?: string; email?: string } {
    const user = this.getCurrentUser();
    if (!user) return {};

    const estudianteId = Number(
      user?.estudianteId ??
        user?.id_estudiante ??
        user?.idEstudiante ??
        user?.estudiante_id ??
        user?.estudiante?.id,
    );

    const email = (
      user?.correo ?? user?.email ?? user?.mail ?? user?.usuario?.correo ?? user?.usuario?.email ?? ''
    )
      .toString()
      .trim()
      .toLowerCase();

    const codigo = (
      user?.codigo ?? user?.codigoEstudiante ?? user?.code ?? user?.user ?? user?.username ?? user?.usuario?.codigo ?? ''
    )
      .toString()
      .trim();

    return {
      ...(Number.isFinite(estudianteId) && estudianteId > 0 ? { estudianteId } : {}),
      ...(codigo ? { codigo } : {}),
      ...(email ? { email } : {}),
    };
  }

  private resolveEstudianteId$() {
    if (!this.isBrowser) return of(null);
    const user = this.getCurrentUser();
    const rol = (user?.rol ?? user?.role ?? user?.tipo ?? user?.perfil ?? '').toString().trim().toLowerCase();

    const explicit = Number(
      user?.estudianteId ??
        user?.id_estudiante ??
        user?.idEstudiante ??
        user?.estudiante_id ??
        user?.estudiante?.id,
    );
    if (Number.isFinite(explicit) && explicit > 0) return of(explicit);

    const correo = (
      user?.correo ??
        user?.email ??
        user?.mail ??
        user?.usuario?.correo ??
        user?.usuario?.email ??
        ''
    )
      .toString()
      .trim()
      .toLowerCase();
    const codigo = (
      user?.codigo ??
        user?.codigoEstudiante ??
        user?.code ??
        user?.user ??
        user?.username ??
        user?.usuario?.codigo ??
        ''
    )
      .toString()
      .trim();

    if (rol && !rol.includes('estudiante')) return of(null);
    if (!correo && !codigo) {
      const maybe = Number(user?.id);
      return Number.isFinite(maybe) && maybe > 0 ? of(maybe) : of(null);
    }

    return this.estudiantesService.listar().pipe(
      take(1),
      map((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const match = list.find((r: any) => {
          const rCorreo = (r?.correo ?? r?.email ?? r?.mail ?? '').toString().trim().toLowerCase();
          const rCodigo = (r?.codigo ?? r?.codigoEstudiante ?? r?.code ?? r?.user ?? r?.username ?? '')
            .toString()
            .trim();
          if (correo && rCorreo && rCorreo === correo) return true;
          if (codigo && rCodigo && rCodigo === codigo) return true;
          return false;
        });

        const id = Number(
          match?.id ??
            match?.estudianteId ??
            match?.id_estudiante ??
            match?.idEstudiante ??
            match?.estudiante_id,
        );
        if (Number.isFinite(id) && id > 0) return id;
        const maybe = Number(user?.id);
        return Number.isFinite(maybe) && maybe > 0 ? maybe : null;
      }),
      catchError(() => of(null)),
    );
  }

  cargarCursos(): void {
    if (!this.isBrowser) return;
    this.cargandoCursos.set(true);

    const identityHint = this.getCurrentStudentIdentity();

    this.resolveEstudianteId$()
      .pipe(
        take(1),
        switchMap((id) => {
          if (!id) {
            this.toast(
              'No se pudo identificar tu estudiante. Verifica que tu correo esté registrado como estudiante.',
            );
            return of([] as any[]);
          }

          return this.estudiantesService.listarCursosAsignados(id).pipe(
            catchError((err) => {
              console.error('[MisCursos] Error cargando cursos asignados', err);
              // Fallback: reconstruye cursos usando /estudiantes-por-curso/:cursoId
              return this.scanCursosByStudent({
                estudianteId: id,
                codigo: identityHint.codigo,
                email: identityHint.email,
              }).pipe(
                catchError((scanErr) => {
                  console.error('[MisCursos] Error en fallback scan', scanErr);
                  this.toast('No se pudieron cargar tus cursos');
                  return of([] as any[]);
                }),
              );
            }),
          );
        }),
      )
      .subscribe({
        next: (data) => {
          const raw = Array.isArray(data) ? data : Array.isArray((data as any)?.cursos) ? (data as any).cursos : [];
          this.cursosAsignadosRaw = raw;

          const mapped: CursoCardVm[] = raw
            .map((c: any) => {
              const id = Number(c?.id ?? c?.cursoId ?? c?.curso_id ?? c?.id_curso);
              if (!Number.isFinite(id) || id <= 0) return null;

              const nombre = (c?.nombre ?? c?.nombreCurso ?? c?.name ?? '').toString().trim();
              const codigo = (c?.codigo ?? c?.codigo_curso ?? c?.codigoCurso ?? '').toString().trim();

              const docenteDirecto = (c?.docente ?? c?.docente_nombre ?? c?.docenteNombre ?? c?.docente_name)
                ?.toString?.()
                ?.trim?.();
              const docenteCached = this.docentePorCursoCache.get(id);
              const docente = docenteDirecto || docenteCached || '—';

              const progresoNum = Number(c?.progreso ?? 0);
              const progreso = Number.isFinite(progresoNum) ? Math.max(0, Math.min(100, progresoNum)) : 0;

              return {
                id,
                nombre: nombre || `${codigo || 'Curso'}`,
                codigo: codigo || '—',
                docente,
                progreso,
              };
            })
            .filter((x: CursoCardVm | null): x is CursoCardVm => !!x);

          this.cursos.set(mapped);
          this.cargandoCursos.set(false);

          this.construirHorarioAcademico();

          const faltantes = mapped.filter((c) => !c.docente || c.docente === '—').map((c) => c.id);
          this.resolverDocentesAsignados(faltantes);
        },
        error: () => {
          this.cursos.set([]);
          this.cursosAsignadosRaw = [];
          this.horario.set([]);
          this.cargandoCursos.set(false);
        },
      });
  }

  private scanCursosByStudent(identity: { estudianteId: number; codigo?: string; email?: string }) {
    return this.cursoService.listar().pipe(
      take(1),
      map((rows: any) => (Array.isArray(rows) ? rows : [])),
      switchMap((courses: any[]) => {
        if (!courses.length) return of([] as any[]);

        const matchesStudent = (row: any): boolean => {
          const rid = Number(row?.estudiante_id ?? row?.id_estudiante ?? row?.estudianteId ?? row?.idEstudiante ?? row?.id);
          if (Number.isFinite(rid) && rid > 0 && rid === identity.estudianteId) return true;

          const rCode = (row?.codigo ?? row?.codigo_estudiante ?? row?.codigoEstudiante ?? row?.code ?? row?.user ?? row?.username)
            ?.toString?.()
            ?.trim?.();
          if (identity.codigo && rCode && String(rCode) === identity.codigo) return true;

          const rEmail = (row?.correo ?? row?.email ?? row?.mail)
            ?.toString?.()
            ?.trim?.()
            ?.toLowerCase?.();
          if (identity.email && rEmail && String(rEmail) === identity.email) return true;

          return false;
        };

        return from(courses).pipe(
          mergeMap(
            (course: any) => {
              const courseId = Number(course?.id ?? course?.curso_id ?? course?.id_curso ?? course?.cursoId);
              if (!Number.isFinite(courseId) || courseId <= 0) return of(null);

              return this.estudiantesService.listarPorCurso(courseId).pipe(
                take(1),
                map((students: any) => {
                  const list = Array.isArray(students)
                    ? students
                    : Array.isArray((students as any)?.estudiantes)
                      ? (students as any).estudiantes
                      : [];
                  const found = list.some((s: any) => matchesStudent(s));
                  return found ? course : null;
                }),
                catchError(() => of(null)),
              );
            },
            4,
          ),
          toArray(),
          map((arr) => arr.filter((x): x is any => !!x)),
        );
      }),
    );
  }

  private construirHorarioAcademico(): void {
    const cursosRaw = Array.isArray(this.cursosAsignadosRaw) ? this.cursosAsignadosRaw : [];
    if (!cursosRaw.length) {
      this.horario.set([]);
      return;
    }

    this.cargandoHorario.set(true);

    this.horarioService
      .listar()
      .pipe(take(1), catchError(() => of([] as any[])))
      .subscribe({
        next: (horarios) => {
          const list = Array.isArray(horarios) ? horarios : [];
          const entries: Array<readonly [number, any]> = list
            .map((h: any) => {
              const id = Number(h?.id ?? h?.horario_id ?? h?.id_horario);
              return Number.isFinite(id) && id > 0 ? ([id, h] as const) : null;
            })
            .filter((x): x is readonly [number, any] => x !== null);
          this.horariosById = new Map<number, any>(entries);

          const rows = cursosRaw.map((c: any) => this.buildHorarioRow(c)).filter((x): x is HorarioRow => !!x);
          this.horario.set(rows);
          this.cargandoHorario.set(false);
        },
        error: () => {
          this.horario.set([]);
          this.cargandoHorario.set(false);
        },
      });
  }

  private buildHorarioRow(curso: any): HorarioRow | null {
    const nombre = (curso?.nombre ?? curso?.nombreCurso ?? curso?.name ?? '').toString().trim();
    const codigo = (curso?.codigo ?? curso?.codigo_curso ?? curso?.codigoCurso ?? '').toString().trim();
    const cursoLabel = nombre || codigo;
    if (!cursoLabel) return null;

    const dayBuckets: Record<string, Array<{ time: string; place: string }>> = {
      lunes: [],
      martes: [],
      miercoles: [],
      jueves: [],
      viernes: [],
      sabado: [],
    };

    const horarios = this.getCursoHorarios(curso);
    for (const h of horarios) {
      const days = this.horarioDias(h);
      const time = this.horarioHoraLabel(h);
      if (!days.length || !time) continue;

      const place = this.horarioLugarLabel(h);
      for (const d of days) {
        const key = this.normalizeDayKey(d);
        if (!key || !dayBuckets[key]) continue;
        dayBuckets[key].push({ time, place });
      }
    }

    const cell = (items: Array<{ time: string; place: string }>) => {
      if (!items.length) return '';
      const times = Array.from(new Set(items.map((x) => x.time).filter(Boolean))).join(' / ');
      const places = Array.from(new Set(items.map((x) => x.place).filter(Boolean))).join(' / ');
      return places ? `${times}\n${places}` : times;
    };

    return {
      curso: cursoLabel,
      lunes: cell(dayBuckets['lunes']),
      martes: cell(dayBuckets['martes']),
      miercoles: cell(dayBuckets['miercoles']),
      jueves: cell(dayBuckets['jueves']),
      viernes: cell(dayBuckets['viernes']),
      sabado: cell(dayBuckets['sabado']),
    };
  }

  private parseHorarioIds(curso: any): number[] {
    const raw =
      curso?.horario_ids ??
      curso?.horarioIds ??
      curso?.horarios_ids ??
      curso?.horariosIds ??
      curso?.horario_id ??
      curso?.horarioId;

    if (Array.isArray(raw)) {
      return raw.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0);
    }

    if (typeof raw === 'string') {
      return raw
        .split(/[,;\s]+/g)
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x) && x > 0);
    }

    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? [n] : [];
  }

  private horarioFromAny(value: any): any | null {
    if (!value) return null;
    if (typeof value === 'object') return value;
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) return null;
    return this.horariosById.get(id) ?? { id };
  }

  private getCursoHorarios(curso: any): any[] {
    if (!curso || typeof curso !== 'object') return [];

    const list = curso?.horarios ?? curso?.horarios_asignados ?? curso?.horariosAsignados;
    if (Array.isArray(list) && list.length) {
      return list.map((x: any) => this.horarioFromAny(x)).filter(Boolean) as any[];
    }

    const ids = this.parseHorarioIds(curso);
    if (ids.length) {
      return ids.map((id) => this.horarioFromAny(id)).filter(Boolean) as any[];
    }

    const single = curso?.horario;
    if (single && typeof single === 'object') return [single];

    const dia = (curso?.dia ?? '').toString().trim();
    const diasArr = Array.isArray(curso?.dias) ? (curso.dias as any[]) : [];
    const inicio = (curso?.hora_inicio ?? curso?.horaInicio ?? '').toString().trim();
    const fin = (curso?.hora_fin ?? curso?.horaFin ?? '').toString().trim();
    if (!dia && !diasArr.length && !inicio && !fin) return [];

    return [
      {
        dia,
        dias: diasArr,
        hora_inicio: inicio,
        hora_fin: fin,
      },
    ];
  }

  private horarioDias(h: any): string[] {
    const dia = (h?.dia ?? '').toString().trim();
    if (dia) return [dia];
    const diasArr = Array.isArray(h?.dias) ? (h.dias as any[]) : [];
    return diasArr.map((x) => String(x).trim()).filter(Boolean);
  }

  private formatHHmm(value: any): string {
    const text = (value ?? '').toString().trim();
    if (!text) return '';
    const match = text.match(/\b([01]\d|2[0-3]):[0-5]\d/);
    return match?.[0] ?? '';
  }

  private horarioHoraLabel(h: any): string {
    const inicio = this.formatHHmm(h?.hora_inicio ?? h?.horaInicio);
    const fin = this.formatHHmm(h?.hora_fin ?? h?.horaFin);
    if (inicio && fin) return `${inicio} - ${fin}`;
    return inicio || fin;
  }

  private horarioLugarLabel(h: any): string {
    const direct = (h?.salon_nombre ?? h?.salonNombre ?? '').toString().trim();
    if (direct) return direct;

    const salon = h?.salon;
    if (salon && typeof salon === 'object') {
      const name = (salon?.nombre ?? salon?.salon_nombre ?? '').toString().trim();
      if (name) return name;
      const composed = [salon?.bloque, salon?.numero_salon, salon?.numero].filter(Boolean).join(' - ');
      if (composed) return composed;
    }

    const composed = [h?.bloque, h?.numero_salon, h?.numero].filter(Boolean).join(' - ');
    return composed || '';
  }

  private normalizeDayKey(input: string): 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | '' {
    const v = (input ?? '').toString().trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('lun')) return 'lunes';
    if (v.startsWith('mar')) return 'martes';
    if (v.startsWith('mié') || v.startsWith('mie')) return 'miercoles';
    if (v.startsWith('jue')) return 'jueves';
    if (v.startsWith('vie')) return 'viernes';
    if (v.startsWith('sáb') || v.startsWith('sab')) return 'sabado';
    return '';
  }

  private docenteNombre(d: any): string {
    const direct = (d?.nombre ?? d?.nombre_completo ?? d?.name ?? '').toString().trim();
    if (direct) return direct;
    const parts = [d?.nombres, d?.apellidos]
      .filter(Boolean)
      .map((x: any) => String(x).trim())
      .filter((x: string) => !!x);
    return parts.join(' ').trim();
  }

  private aplicarDocenteCache(): void {
    const list = this.cursos();
    if (!list.length) return;
    this.cursos.set(
      list.map((c) => {
        if (c.docente && c.docente !== '—') return c;
        const docente = this.docentePorCursoCache.get(c.id);
        return docente ? { ...c, docente } : c;
      }),
    );
  }

  private resolverDocentesAsignados(cursoIds: number[]): void {
    const ids = (cursoIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
    const pendientes = ids.filter((id) => !this.docentePorCursoCache.has(id));
    if (!pendientes.length) {
      this.aplicarDocenteCache();
      return;
    }
    if (this.resolviendoDocentes) return;
    this.resolviendoDocentes = true;

    const objetivo = new Set(pendientes);

    this.docenteService
      .listar()
      .pipe(take(1), catchError(() => of([] as any[])))
      .subscribe({
        next: (docentes) => {
          const list = Array.isArray(docentes) ? docentes : [];
          if (!list.length) {
            this.resolviendoDocentes = false;
            return;
          }

          const requests = list.map((d: any) => {
            const docenteId = Number(d?.id ?? d?.docenteId ?? d?.docente_id ?? d?.id_docente);
            if (!Number.isFinite(docenteId) || docenteId <= 0) return of({ docente: d, cursos: [] as any[] });
            return this.docenteService.listarCursosAsignados(docenteId).pipe(
              take(1),
              map((cursos) => ({ docente: d, cursos: Array.isArray(cursos) ? cursos : [] })),
              catchError(() => of({ docente: d, cursos: [] as any[] })),
            );
          });

          forkJoin(requests)
            .pipe(take(1))
            .subscribe({
              next: (groups) => {
                for (const g of groups ?? []) {
                  const docenteNombre = this.docenteNombre(g?.docente);
                  if (!docenteNombre) continue;

                  for (const c of g?.cursos ?? []) {
                    const cursoId = Number(c?.cursoId ?? c?.id ?? c?.curso_id ?? c?.id_curso);
                    if (!Number.isFinite(cursoId) || cursoId <= 0) continue;
                    if (!objetivo.has(cursoId)) continue;
                    if (!this.docentePorCursoCache.has(cursoId)) {
                      this.docentePorCursoCache.set(cursoId, docenteNombre);
                    }
                  }
                }

                this.aplicarDocenteCache();
                this.resolviendoDocentes = false;
              },
              error: () => {
                this.resolviendoDocentes = false;
              },
            });
        },
        error: () => {
          this.resolviendoDocentes = false;
        },
      });
  }

  private splitSlot(value: string): { time: string; place: string } {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return { time: '', place: '' };

    const [rawTime, ...rest] = trimmed.split('\n');
    const rawPlace = rest.join('\n');

    const time = (rawTime ?? '').trim().replace(/\s*-\s*/g, '-');
    const place = (rawPlace ?? '').trim().replace(/\s*-\s*/g, '-');

    return { time, place };
  }

  slotTime(value: string): string {
    return this.splitSlot(value).time;
  }

  slotPlace(value: string): string {
    return this.splitSlot(value).place;
  }

}
