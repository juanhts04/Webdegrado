import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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

  readonly programasAcademicos = signal<ProgramaAcademico[]>([
    { id: '1', nombre: 'Ingeniería de Software' },
    { id: '2', nombre: 'Ingeniería de Sistemas' },
    { id: '3', nombre: 'Administración' },
  ]);

  readonly secretarios = signal<SecretarioRow[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly query = signal<string>('');

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
    const programa = this.programasAcademicos().find((p) => p.id === value.programaAcademicoId);
    const formatted = new Date().toLocaleDateString('es-CO');

    const row: SecretarioRow = {
      id: editing ?? crypto.randomUUID(),
      codigo: value.codigo.trim(),
      nombreCompleto: value.nombreCompleto.trim(),
      correo: value.correo.trim(),
      programaAcademicoId: value.programaAcademicoId,
      programaNombre: programa?.nombre ?? '—',
      estado: 'Activo',
      fechaRegistro: formatted,
    };

    if (editing) {
      this.secretarios.update((rows) => rows.map((r) => (r.id === editing ? row : r)));
      this.editingId.set(null);
    } else {
      this.secretarios.update((rows) => [row, ...rows]);
    }

    this.resetForm();
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
    this.secretarios.update((rows) => rows.filter((r) => r.id !== id));
    if (this.editingId() === id) {
      this.cancel();
    }
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
