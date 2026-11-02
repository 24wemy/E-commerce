'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { sendRegistrationWelcomeEmail } from '@/lib/email';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter.'),
  email: z.string().email('Format email tidak valid.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
});

export async function registerUserAction(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsed = registerSchema.safeParse(data);

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { name, email, password } = parsed.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: 'Email ini sudah terdaftar. Silakan masuk.' };
    }

    // Hash password & Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: Role.CUSTOMER,
      },
    });

    // Send Welcome Email
    try {
      await sendRegistrationWelcomeEmail(newUser.email, newUser.name);
    } catch (err) {
      console.error('Failed to dispatch registration welcome email:', err);
    }

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'Pendaftaran gagal. Coba lagi beberapa saat.' };
  }
}

export async function signOutAction() {
  const { signOut } = await import('@/auth');
  await signOut({ redirectTo: '/' });
}
