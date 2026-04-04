import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { toast } from 'sonner';
import nexusLogo from 'figma:asset/b9fc9ba1c54f0166784e3d5c5adc4d2864a4bfba.png';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Loader2, LogIn } from 'lucide-react';
import { LavaLampBackground } from '../components/LavaLampBackground';

export function Login() {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Auto-seed all users silently on first mount
  useEffect(() => {
    const seeded = sessionStorage.getItem('nexus-seeded');
    if (seeded) return;
    sessionStorage.setItem('nexus-seeded', '1');
    fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/seed-users`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      }
    ).catch(() => {/* silent */});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !cpf.trim()) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    const nameParts = fullName.trim().split(' ').filter(Boolean);
    if (nameParts.length < 2) {
      toast.error('Por favor, digite seu nome e sobrenome');
      return;
    }

    setLoading(true);
    try {
      await signIn(fullName, cpf.trim());
      toast.success('Bem-vindo ao Nexus! 🚀');
      navigate('/');
    } catch (error: any) {
      toast.error('Nome ou CPF inválidos. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{ background: '#0e0820' }}
    >

      {/* ── Lava lamp canvas background ── */}
      <LavaLampBackground />

      {/* ── CSS keyframes ── */}
      <style>{`
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Login card ── */}
      <div
        className="relative w-full max-w-md"
        style={{ animation: 'fadeSlideUp 0.6s ease-out both' }}
      >
        <div
          className="rounded-3xl border border-purple-500/20 shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(10,4,20,0.85)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 0 60px rgba(139,92,246,0.18), 0 25px 50px rgba(0,0,0,0.6)',
          }}
        >
          {/* Top accent line */}
          <div
            className="h-[2px] w-full"
            style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6, #a855f7, transparent)' }}
          />

          <div className="px-8 pt-8 pb-10">
            {/* Mascot — floating animation */}
            <div className="flex justify-center mb-5">
              <img
                src={nexusLogo}
                alt="Nexus Mascote"
                className="object-contain drop-shadow-lg"
                style={{
                  width: 120,
                  height: 120,
                  animation: 'mascotFloat 4s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 18px rgba(139,92,246,0.5))',
                }}
              />
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1
                className="text-4xl font-black tracking-widest mb-1"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #7c3aed 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.12em',
                }}
              >
                NEXUS
              </h1>
              <p className="text-purple-300/70 text-sm font-medium tracking-widest uppercase">
                Entre na sua conta
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-2 uppercase tracking-wider">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all text-sm disabled:opacity-50"
                  style={{
                    background: 'rgba(139,92,246,0.07)',
                    borderColor: 'rgba(139,92,246,0.25)',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.7)'; e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15), inset 0 1px 4px rgba(0,0,0,0.3)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.25)'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.3)'; }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-300/80 mb-2 uppercase tracking-wider">
                  CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="Somente números"
                  autoComplete="off"
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all text-sm disabled:opacity-50"
                  style={{
                    background: 'rgba(139,92,246,0.07)',
                    borderColor: 'rgba(139,92,246,0.25)',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.7)'; e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15), inset 0 1px 4px rgba(0,0,0,0.3)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.25)'; e.target.style.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.3)'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-widest uppercase flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 mt-2"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #a855f7 100%)',
                  boxShadow: '0 4px 24px rgba(139,92,246,0.5)',
                  letterSpacing: '0.15em',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 32px rgba(168,85,247,0.7)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(139,92,246,0.5)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Entrando...</>
                ) : (
                  <><LogIn className="w-4 h-4" />Entrar</>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: 'rgba(139,92,246,0.15)' }}>
              <p className="text-xs" style={{ color: 'rgba(196,181,253,0.45)' }}>
                Desenvolvido por{' '}
                <span style={{ color: 'rgba(192,132,252,0.8)', fontWeight: 600 }}>Dodoco</span>
                {' '}em parceria com{' '}
                <span
                  style={{
                    color: 'rgba(192,132,252,0.8)',
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    letterSpacing: '0.1em',
                  }}
                >
                  NEXUS
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}