import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, Tv2, ArrowRight, Lock, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email invalid'),
  password: z.string().min(1, 'Parola este necesară'),
  totpCode: z.string().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

// Animated floating particles
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 1,
            height: Math.random() * 4 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? 'rgba(96,165,250,0.6)' : i % 3 === 1 ? 'rgba(167,139,250,0.6)' : 'rgba(236,72,153,0.4)',
          }}
          animate={{
            y: [0, -120, 0],
            opacity: [0, 0.8, 0],
            scale: [1, 1.5, 0.5],
          }}
          transition={{
            duration: Math.random() * 6 + 6,
            repeat: Infinity,
            delay: Math.random() * 8,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Animated gradient orbs
function GradientOrbs() {
  return (
    <>
      <motion.div
        className="absolute rounded-full blur-[120px] pointer-events-none"
        style={{ width: 600, height: 600, top: '-20%', left: '-10%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full blur-[120px] pointer-events-none"
        style={{ width: 500, height: 500, bottom: '-15%', right: '-10%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute rounded-full blur-[80px] pointer-events-none"
        style={{ width: 300, height: 300, top: '40%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'admin@iptv.local', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      if (res.data.requires2FA) { setRequires2FA(true); setLoading(false); return; }
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Autentificare eșuată';
      toast({ title: 'Eroare de autentificare', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050810 0%, #0B0F19 40%, #0f0a1e 100%)' }}>

      <GradientOrbs />
      <Particles />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <motion.div
        className="w-full max-w-[420px] relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 30 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="relative mb-5"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', boxShadow: '0 8px 32px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1)' }}>
              <Tv2 className="h-9 w-9 text-white relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            {/* Glow ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ boxShadow: '0 0 40px rgba(99,102,241,0.5)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-white">IPTV Panel</h1>
          <p className="text-sm text-slate-400 mt-1.5">Management Profesional IPTV</p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="relative rounded-2xl p-8"
          style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Gradient top border */}
          <div className="absolute top-0 left-8 right-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)' }} />

          <AnimatePresence mode="wait">
            {!requires2FA ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold text-white mb-1">Bun venit înapoi</h2>
                <p className="text-sm text-slate-400 mb-7">Autentifică-te în panoul tău</p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Email field */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
                    <motion.div
                      className="relative"
                      animate={{ scale: focusedField === 'email' ? 1.01 : 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none transition-colors"
                        style={{ color: focusedField === 'email' ? '#60a5fa' : undefined }} />
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="admin@iptv.local"
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 transition-all outline-none"
                        style={{
                          background: focusedField === 'email' ? 'rgba(96,165,250,0.06)' : 'rgba(15,23,42,0.6)',
                          border: `1px solid ${focusedField === 'email' ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(96,165,250,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                      />
                    </motion.div>
                    {errors.email && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400 flex items-center gap-1">
                        <span>⚠</span> {errors.email.message}
                      </motion.p>
                    )}
                  </div>

                  {/* Password field */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Parolă</label>
                    <motion.div
                      className="relative"
                      animate={{ scale: focusedField === 'password' ? 1.01 : 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none transition-colors"
                        style={{ color: focusedField === 'password' ? '#60a5fa' : undefined }} />
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        className="w-full h-11 pl-10 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 transition-all outline-none"
                        style={{
                          background: focusedField === 'password' ? 'rgba(96,165,250,0.06)' : 'rgba(15,23,42,0.6)',
                          border: `1px solid ${focusedField === 'password' ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(96,165,250,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </motion.div>
                    {errors.password && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400 flex items-center gap-1">
                        <span>⚠</span> {errors.password.message}
                      </motion.p>
                    )}
                  </div>

                  {/* Submit button */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white relative overflow-hidden flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                      boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                    }}
                    whileHover={{ scale: 1.01, boxShadow: '0 12px 32px rgba(99,102,241,0.5)' }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                      animate={{ x: ['-200%', '200%'] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                    />
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Autentificare...</span>
                      </>
                    ) : (
                      <>
                        <span>Intră în cont</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Verificare 2FA</h2>
                    <p className="text-xs text-slate-400">Introdu codul din aplicația de autentificare</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <input
                    {...register('totpCode')}
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full h-14 rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-white placeholder:text-slate-600 outline-none transition-all"
                    style={{
                      background: 'rgba(15,23,42,0.6)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? 'Verificare...' : 'Verifică Codul'}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Demo credentials hint */}
          <motion.div
            className="mt-6 pt-5 border-t text-center"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs text-slate-500">
              Demo: <span className="text-blue-400/80">admin@iptv.local</span> / <span className="text-blue-400/80">admin123</span>
            </p>
          </motion.div>
        </motion.div>

        {/* Version */}
        <motion.p
          className="text-center text-xs text-slate-600 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          IPTV Panel v3.0 · Powered by Node.js + Prisma
        </motion.p>
      </motion.div>
    </div>
  );
}
