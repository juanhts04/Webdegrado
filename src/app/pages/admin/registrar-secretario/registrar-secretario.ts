import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { ProgramasAcademicosService } from '../../../services/programas-academicos';
import { Secretario as SecretarioService } from '../../../services/secretario';

type ProgramaAcademico = {
  id: string;
  nombre: string;
};

type SecretarioRow = {
  id: string;
  codigo: string;
  nombreCompleto: string;
  correo: string;
  programaAcademicoId: string;
  programaNombre: string;
  estado: 'Activo' | 'Inactivo';
  fechaRegistro: string;
};

@Component({
  selector: 'app-registrar-secretario',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-secretario.html',
  styleUrl: './registrar-secretario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrarSecretario {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);
  private readonly programasService = inject(ProgramasAcademicosService);
  private readonly secretarioService = inject(SecretarioService);

  readonly programasAcademicos = signal<ProgramaAcademico[]>([]);

  readonly secretarios = signal<SecretarioRow[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly query = signal<string>('');

  readonly cargando = signal(false);

  readonly filteredSecretarios = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.secretarios();
    if (!q) return rows;
    return rows.filter((s) => {
      return (
        s.codigo.toLowerCase().includes(q) ||
        s.nombreCompleto.toLowerCase().includes(q) ||
        s.correo.toLowerCase().includes(q) ||
        s.programaNombre.toLowerCase().includes(q) ||
        s.estado.toLowerCase().includes(q)
      );
    });
  });

  readonly form = this.fb.nonNullable.group({
    codigo: this.fb.nonNullable.control('', [Validators.required]),
    correo: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    programaAcademicoId: this.fb.nonNullable.control('', [Validators.required]),
    nombreCompleto: this.fb.nonNullable.control('', [Validators.required]),
    password: this.fb.nonNullable.control('', [Validators.required]),
  });

  ngOnInit(): void {
    this.cargarDesdeApi();
  }

  private cargarDesdeApi(): void {
    if (!this.isBrowser) return;
    this.cargando.set(true);

    forkJoin({
      programas: this.programasService.listar().pipe(catchError(() => of([] as any[]))),
      secretarios: this.secretarioService.listar().pipe(catchError(() => of([] as any[]))),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ programas, secretarios }) => {
          const programasList = (Array.isArray(programas) ? programas : []).map((p: any) => ({
            id: String(p?.id ?? p?.programaAcademicoId ?? p?.programa_academico_id ?? ''),
            nombre: String(p?.nombre ?? p?.programa ?? p?.name ?? '—'),
          }))
          .filter((p: ProgramaAcademico) => !!p.id);

          const programaNombreById = new Map(programasList.map((p) => [p.id, p.nombre] as const));

          const rowsRaw = Array.isArray(secretarios) ? secretarios : [];
          const secretariosList: SecretarioRow[] = rowsRaw
            .map((s: any) => {
              const id = String(s?.id ?? s?.secretarioId ?? s?.id_secretario ?? s?.idSecretario ?? '');
              if (!id) return null;

              const codigo = String(s?.codigo ?? s?.codigo_secretario ?? s?.code ?? '').trim();
              const nombreCompleto = String(
                s?.nombreCompleto ?? s?.nombre_completo ?? s?.nombre ?? s?.fullName ?? s?.nombres ?? '',
              ).trim();
              const correo = String(s?.correo ?? s?.email ?? s?.mail ?? '').trim();
              const programaAcademicoId = String(
                s?.programaAcademicoId ?? s?.programa_academico_id ?? s?.programaId ?? s?.programa_id ?? '',
              ).trim();

              const programaNombreDirecto = String(
                s?.programaNombre ?? s?.programa_nombre ?? s?.programa ?? s?.programaAcademico?.nombre ?? '',
              ).trim();
              const programaNombre = programaNombreDirecto || programaNombreById.get(programaAcademicoId) || '—';

              const estadoRaw = (s?.estado ?? s?.activo ?? s?.status ?? 'Activo') as any;
              const estadoText = String(estadoRaw).toLowerCase();
              const estado: 'Activo' | 'Inactivo' =
                estadoText.includes('inac') || estadoRaw === false || estadoRaw === 0 ? 'Inactivo' : 'Activo';

              const fechaRaw = s?.fechaRegistro ?? s?.fecha_registro ?? s?.createdAt ?? s?.created_at ?? s?.fecha;
              const fecha = this.formatFecha(fechaRaw);

              return {
                id,
                codigo: codigo || '—',
                nombreCompleto: nombreCompleto || '—',
                correo: correo || '—',
                programaAcademicoId,
                programaNombre,
                estado,
                fechaRegistro: fecha,
              };
            })
            .filter((x: SecretarioRow | null): x is SecretarioRow => !!x);

          this.programasAcademicos.set(programasList);
          this.secretarios.set(secretariosList);
          this.cargando.set(false);
        },
        error: () => {
          this.programasAcademicos.set([]);
          this.secretarios.set([]);
          this.cargando.set(false);
        },
      });
  }

  private formatFecha(value: any): string {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toLocaleDateString('es-CO');
    const text = String(value).trim();
    if (!text) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(text);
    if (Number.isFinite(d.getTime())) return d.toLocaleDateString('es-CO');
    return text;
  }

  private toNumberId(id: string): number | null {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  setQuery(value: string) {
    this.query.set(value);
  }

  submit() {
    const editing = this.editingId();
    if (editing) {
      // En edición, password no es obligatorio.
      this.form.controls.password.setValidators([]);
      this.form.controls.password.updateValueAndValidity({ emitEvent: false });
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const payload: any = {
      codigo: value.codigo.trim(),
      correo: value.correo.trim(),
      programaAcademicoId: Number.isFinite(Number(value.programaAcademicoId))
        ? Number(value.programaAcademicoId)
        : value.programaAcademicoId,
      nombreCompleto: value.nombreCompleto.trim(),
      ...(value.password?.trim() ? { password: value.password.trim() } : {}),
    };

    if (editing) {
      const idNum = this.toNumberId(editing);
      if (!idNum) {
        return;
      }
      this.secretarioService
        .actualizar(idNum, payload)
        .pipe(take(1), catchError(() => of(null)))
        .subscribe(() => {
          this.editingId.set(null);
          this.resetForm();
          this.cargarDesdeApi();
        });
      return;
    }

    this.secretarioService
      .registrar(payload)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => {
        this.resetForm();
        this.cargarDesdeApi();
      });
  }

  edit(id: string) {
    const row = this.secretarios().find((r) => r.id === id);
    if (!row) return;
    this.editingId.set(id);
    this.form.setValue({
      codigo: row.codigo,
      correo: row.correo,
      programaAcademicoId: row.programaAcademicoId,
      nombreCompleto: row.nombreCompleto,
      password: '',
    });
    this.form.controls.password.setValidators([]);
    this.form.controls.password.updateValueAndValidity({ emitEvent: false });
  }

  remove(id: string) {
    const idNum = this.toNumberId(id);
    if (!idNum) return;

    this.secretarioService
      .eliminar(idNum)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe(() => {
        if (this.editingId() === id) {
          this.cancel();
        }
        this.cargarDesdeApi();
      });
  }

  cancel() {
    this.editingId.set(null);
    this.resetForm();
  }

  private resetForm() {
    this.form.reset({
      codigo: '',
      correo: '',
      programaAcademicoId: '',
      nombreCompleto: '',
      password: '',
    });
    // Volver a requerir password para registro nuevo
    this.form.controls.password.setValidators([Validators.required]);
    this.form.controls.password.updateValueAndValidity({ emitEvent: false });
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
