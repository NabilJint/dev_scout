import { SignIn } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignIn
        appearance={{ theme: shadcn }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
      />
    </div>
  );
}