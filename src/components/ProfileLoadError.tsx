import { Button } from '@/components/ui/button';

/** Shown when the account lookup failed technically. Never redirects to onboarding. */
export const ProfileLoadError = ({ onRetry }: { onRetry: () => void | Promise<void> }) => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="max-w-sm text-center space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar sua conta</h2>
      <p className="text-sm text-muted-foreground">
        Verifique sua conexão e tente novamente. Seus dados e sua loja estão preservados.
      </p>
      <Button onClick={() => void onRetry()}>Tentar novamente</Button>
    </div>
  </div>
);
