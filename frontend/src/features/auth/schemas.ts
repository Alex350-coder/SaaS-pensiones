import { z } from 'zod';

/** Bytes, not characters — bcrypt truncates at 72 bytes (matches backend). */
const byteLength = (value: string): number => new TextEncoder().encode(value).length;

const email = z
  .string()
  .trim()
  .min(1, 'Ingresa tu correo.')
  .email('El correo no tiene un formato válido.')
  .max(254);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(120, 'El nombre es demasiado largo.'),
    email,
    role: z.enum(['CLIENT', 'RESTAURANT_ADMIN']),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres.')
      .refine((v) => byteLength(v) <= 72, 'La contraseña es demasiado larga.'),
    confirmPassword: z.string(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{6,20}$/, 'El teléfono no tiene un formato válido.')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
