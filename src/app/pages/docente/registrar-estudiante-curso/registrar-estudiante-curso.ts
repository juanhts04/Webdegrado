import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

type Course = {
  id: string;
  name: string;
 	code?: string;
};

type StudentOption = {
  id: string;
  code?: string;
  name: string;
  courseId: string;
};

type StudentRow = {
  studentId: string;
  code: string;
  fullName: string;
  programaAcademico: string;
  docente: string;
  courseId: string;
  courseName: string;
  date: string;
};

@Component({
  selector: 'app-registrar-estudiante-curso',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-estudiante-curso.html',
  styleUrl: './registrar-estudiante-curso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrarEstudianteCurso {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly fb = inject(FormBuilder);

  readonly courses = signal<Course[]>([
    { id: 'bases-datos', code: 'BD', name: 'Bases de datos' },
    { id: 'calculo-integral', code: 'CI', name: 'Calculo integral' },
    { id: 'analisis-sistemas', code: 'AS', name: 'Análisis de sistemas' },
  ]);

  readonly allStudents = signal<StudentOption[]>([
    { id: 'e1', code: '20231050', name: 'Ana María López', courseId: 'bases-datos' },
    { id: 'e2', code: '20231120', name: 'Juan David Pérez', courseId: 'bases-datos' },
    { id: 'e3', code: '20221005', name: 'María Fernanda Ruiz', courseId: 'calculo-integral' },
    { id: 'e4', code: '20212077', name: 'Carlos Andrés Gómez', courseId: 'analisis-sistemas' },
  ]);

  readonly selectedCourseId = signal<string>('');

  readonly availableStudents = computed(() => {
    const courseId = this.selectedCourseId();
    if (!courseId) return [];
    return this.allStudents().filter((s) => s.courseId === courseId);
  });

  readonly students = signal<StudentRow[]>([]);
  readonly filterCourseId = signal<string>('all');
  readonly editingCode = signal<string | null>(null);

  readonly filteredStudents = computed(() => {
    const filterId = this.filterCourseId();
    const rows = this.students();
    if (filterId === 'all') return rows;
    return rows.filter((r) => r.courseId === filterId);
  });

  readonly form = this.fb.nonNullable.group({
    courseId: this.fb.nonNullable.control('', [Validators.required]),
    studentId: this.fb.nonNullable.control('', [Validators.required]),
    fullName: this.fb.nonNullable.control(''),
    programaAcademico: this.fb.nonNullable.control(''),
    studentCode: this.fb.nonNullable.control('', [Validators.required]),
    docente: this.fb.nonNullable.control(''),
  });

  onCourseChange(courseId: string) {
    this.selectedCourseId.set(courseId);
    this.form.patchValue({ studentId: '' });
  }

  onStudentChange(studentId: string) {
    const student = this.allStudents().find((s) => s.id === studentId);
    if (!student) return;
    this.form.patchValue({
      studentCode: student.code ?? this.form.controls.studentCode.value,
      fullName: student.name,
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const student = this.allStudents().find((s) => s.id === value.studentId);
    const course = this.courses().find((c) => c.id === value.courseId);
    const date = new Date();
    const formatted = date.toLocaleDateString('es-CO');

    const row: StudentRow = {
      studentId: value.studentId,
      code: value.studentCode.trim(),
      fullName: value.fullName.trim() || (student?.name ?? '').trim() || '—',
      programaAcademico: value.programaAcademico.trim(),
      docente: value.docente.trim(),
      courseId: value.courseId,
      courseName: course?.name ?? value.courseId,
      date: formatted,
    };

    const editing = this.editingCode();
    if (editing) {
      this.students.update((rows) => rows.map((r) => (r.code === editing ? row : r)));
      this.editingCode.set(null);
    } else {
      this.students.update((rows) => [row, ...rows]);
    }

    this.form.reset({
      courseId: '',
      studentId: '',
      fullName: '',
      programaAcademico: '',
      studentCode: '',
      docente: '',
    });
    this.selectedCourseId.set('');
  }

  cancel() {
    this.editingCode.set(null);
    this.form.reset({
      courseId: '',
      studentId: '',
      fullName: '',
      programaAcademico: '',
      studentCode: '',
      docente: '',
    });
    this.selectedCourseId.set('');
  }

  setFilter(courseId: string) {
    this.filterCourseId.set(courseId);
  }

  edit(code: string) {
    const row = this.students().find((r) => r.code === code);
    if (!row) return;
    this.editingCode.set(code);
    this.selectedCourseId.set(row.courseId);
    this.form.setValue({
      courseId: row.courseId,
      studentId: row.studentId,
      fullName: row.fullName,
      programaAcademico: row.programaAcademico,
      studentCode: row.code,
      docente: row.docente,
    });
  }

  remove(code: string) {
    this.students.update((rows) => rows.filter((r) => r.code !== code));
    if (this.editingCode() === code) {
      this.cancel();
    }
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
    }
    this.router.navigate(['/']);
  }
}
