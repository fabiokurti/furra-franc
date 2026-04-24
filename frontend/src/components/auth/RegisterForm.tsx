import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

const schema = z
  .object({
    name: z.string().min(2, 'Emri duhet të ketë të paktën 2 karaktere'),
    email: z.string().email('Adresë emaili e pavlefshme'),
    password: z.string().min(6, 'Fjalëkalimi duhet të ketë të paktën 6 karaktere'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Fjalëkalimet nuk përputhen',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await registerUser(data.name, data.email, data.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error.response?.data?.message || 'Regjistrimi dështoi. Ju lutem provoni përsëri.');
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-2">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xl font-bold">F</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Krijo llogari</CardTitle>
        <CardDescription className="text-center">Bashkohuni me menaxhimin e furrës Furra Franc</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Emri i plotë</Label>
            <Input id="name" placeholder="Arben Hoxha" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="ju@shembull.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Fjalëkalimi</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmo fjalëkalimin</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Krijo llogari
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Keni tashmë një llogari?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Hyr
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
