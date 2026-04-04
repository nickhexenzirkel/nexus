import { Link } from 'react-router';
import { Home } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Página não encontrada
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg transition-colors"
        >
          <Home className="w-5 h-5" />
          Voltar para o Feed
        </Link>
      </div>
    </div>
  );
}
