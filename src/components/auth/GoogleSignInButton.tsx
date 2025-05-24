import { Button } from '@/components/ui/button';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Cloud, Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export const GoogleSignInButton = ({ 
  className,
  variant = 'outline',
  size = 'default'
}: GoogleSignInButtonProps) => {
  const { signIn, isLoading } = useGoogleAuth();

  return (
    <Button 
      onClick={signIn} 
      disabled={isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Cloud className="w-4 h-4 mr-2" />
      )}
      {isLoading ? 'Connecting...' : 'Connect Google Drive'}
    </Button>
  );
};